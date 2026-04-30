// `globalShim.js` is imported by `NDArrayTextureLoader.ts` (this package's
// entry point) before any path reaches typedarray-pool, so we don't repeat
// the side-effect import here.
import type { NdArray } from "ndarray";
import ndarray from "ndarray";
import ops from "ndarray-ops";
import pool from "typedarray-pool";

// Some of the texImage2D logic below is adapted from
// https://github.com/stackgl/gl-texture2d/blob/master/texture.js

function isPacked(shape: number[], stride: number[]): boolean {
  if (shape.length === 3) {
    return stride[2] === 1 && stride[1] === shape[0] * shape[2] && stride[0] === shape[2];
  }
  return stride[0] === 1 && stride[1] === shape[0];
}

function convertFloatToUint8(out: NdArray, inp: NdArray): void {
  ops.muls(out, inp, 255.0);
}

// Memoize per-dtype warnings so we only console.warn once per fallback dtype.
const warnedFallbackDtypes = new Set<string>();
function warnIntegerFallback(dtype: string): void {
  if (warnedFallbackDtypes.has(dtype)) return;
  warnedFallbackDtypes.add(dtype);
  console.warn(
    `webgltexture-loader-ndarray: ndarray dtype "${dtype}" requires WebGL2 integer textures; ` +
      `falling back to uint8 on this WebGL1 context. Precision will be reduced.`,
  );
}

// Lookup table for integer-typed dtypes -> per-channel-count internal formats and gl type.
// All entries here are WebGL2-only; on WebGL1 we fall back to uint8 with a warning.
type IntegerDtypeKind = "uint16" | "int16" | "uint32" | "int32" | "int8";

interface IntegerDtypeEntry {
  // Names of the WebGL2 internalformat constants per channel count: [R, RG, RGB, RGBA].
  internalformatNames: [string, string, string, string];
  // Name of the gl.type constant (e.g. "UNSIGNED_SHORT", "SHORT").
  typeName: string;
}

// Per-channel-count `format` constants for integer textures (1..4 channels).
// Hoisted to module scope so we don't reallocate this array on every draw.
const INTEGER_FORMAT_NAMES: readonly [string, string, string, string] = [
  "RED_INTEGER",
  "RG_INTEGER",
  "RGB_INTEGER",
  "RGBA_INTEGER",
];

const INTEGER_DTYPE_TABLE: Record<IntegerDtypeKind, IntegerDtypeEntry> = {
  uint16: {
    internalformatNames: ["R16UI", "RG16UI", "RGB16UI", "RGBA16UI"],
    typeName: "UNSIGNED_SHORT",
  },
  int16: {
    internalformatNames: ["R16I", "RG16I", "RGB16I", "RGBA16I"],
    typeName: "SHORT",
  },
  uint32: {
    internalformatNames: ["R32UI", "RG32UI", "RGB32UI", "RGBA32UI"],
    typeName: "UNSIGNED_INT",
  },
  int32: {
    internalformatNames: ["R32I", "RG32I", "RGB32I", "RGBA32I"],
    typeName: "INT",
  },
  int8: {
    internalformatNames: ["R8I", "RG8I", "RGB8I", "RGBA8I"],
    typeName: "BYTE",
  },
};

function isIntegerDtype(dtype: string): dtype is IntegerDtypeKind {
  return (
    dtype === "uint16" ||
    dtype === "int16" ||
    dtype === "uint32" ||
    dtype === "int32" ||
    dtype === "int8"
  );
}

// Read a numeric constant by name from a WebGL2 context. Casts because the DOM
// lib types we use are WebGLRenderingContext (WebGL1).
function gl2Const(gl: WebGLRenderingContext, name: string): number {
  return (gl as unknown as Record<string, number>)[name];
}

// Detect WebGL2 reliably across browsers and headless test runners:
//   - `gl instanceof WebGLRenderingContext` is true for WebGL2 too
//     (WebGL2RenderingContext extends it), so it can't distinguish.
//   - `WebGL2RenderingContext` is undefined under headless-gl/Node.
//   - Some headless WebGL1 backends expose `texStorage2D` as a stub.
// Probing a WebGL2-only enum that WebGL1 simply doesn't define is the most
// portable check available.
function isWebGL2Context(gl: WebGLRenderingContext): boolean {
  return typeof (gl as unknown as { R16UI?: unknown }).R16UI === "number";
}

export default function drawNDArrayTexture(
  gl: WebGLRenderingContext,
  array: NdArray,
  floatSupported: boolean,
): void {
  const isWebGL1 = !isWebGL2Context(gl);

  let dtype: string = array.dtype;
  let shape = array.shape.slice();
  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (shape[0] < 0 || shape[0] > maxSize || shape[1] < 0 || shape[1] > maxSize) {
    throw new Error("webgltexture-loader-ndarray: Invalid texture size");
  }
  let packed = isPacked(shape, array.stride.slice());

  // Determine whether this dtype should take the WebGL2 integer texture path.
  const integerKind: IntegerDtypeKind | null = isIntegerDtype(dtype) ? dtype : null;
  const useIntegerPath = integerKind !== null && !isWebGL1;
  if (integerKind !== null && isWebGL1) {
    // WebGL1 has no integer textures; warn once and fall through to the uint8 branch.
    warnIntegerFallback(integerKind);
  }

  let type = 0;
  if (useIntegerPath && integerKind !== null) {
    type = gl2Const(gl, INTEGER_DTYPE_TABLE[integerKind].typeName);
    // `packed` (computed above from stride/offset) already determines whether
    // we can upload `array.data` directly; only repack when not contiguous.
  } else if (dtype === "float32") {
    type = gl.FLOAT;
  } else if (dtype === "float64") {
    type = gl.FLOAT;
    packed = false;
    dtype = "float32";
  } else if (dtype === "uint8") {
    type = gl.UNSIGNED_BYTE;
  } else {
    // Unknown / fallback (also the WebGL1 path for integer dtypes).
    type = gl.UNSIGNED_BYTE;
    packed = false;
    dtype = "uint8";
  }

  // Resolve final `type` before picking internalformat: on WebGL2 the
  // internalformat must match the data type (e.g. RGB32F requires FLOAT,
  // not UNSIGNED_BYTE), so we need the post-fallback `type` here.
  // ALPHA / LUMINANCE_ALPHA have no usable float internalformat on WebGL2,
  // so we force the uint8 path for those shapes when running on WebGL2.
  if (!isWebGL1 && type === gl.FLOAT && shape.length === 3 && (shape[2] === 1 || shape[2] === 2)) {
    floatSupported = false;
  }
  if (type === gl.FLOAT && !floatSupported) {
    type = gl.UNSIGNED_BYTE;
    packed = false;
  }

  let format = 0;
  let internalformat = 0;
  if (shape.length === 2) {
    if (useIntegerPath && integerKind !== null) {
      // Treat 2D shapes as single-channel R*I/R*UI integer textures.
      format = gl2Const(gl, "RED_INTEGER");
      internalformat = gl2Const(gl, INTEGER_DTYPE_TABLE[integerKind].internalformatNames[0]);
    } else {
      internalformat = format = gl.LUMINANCE;
    }
    shape = [shape[0], shape[1], 1];
    array = ndarray(array.data, shape, [array.stride[0], array.stride[1], 1], array.offset);
  } else if (shape.length === 3) {
    if (useIntegerPath && integerKind !== null) {
      const channelIndex = shape[2] - 1;
      if (channelIndex < 0 || channelIndex > 3) {
        throw new Error("webgltexture-loader-ndarray: Invalid shape for pixel coords");
      }
      format = gl2Const(gl, INTEGER_FORMAT_NAMES[channelIndex]);
      internalformat = gl2Const(
        gl,
        INTEGER_DTYPE_TABLE[integerKind].internalformatNames[channelIndex],
      );
    } else if (shape[2] === 1) {
      internalformat = format = gl.ALPHA;
    } else if (shape[2] === 2) {
      internalformat = format = gl.LUMINANCE_ALPHA;
    } else if (shape[2] === 3) {
      format = gl.RGB;
      internalformat =
        !isWebGL1 && type === gl.FLOAT ? (gl as unknown as { RGB32F: number }).RGB32F : gl.RGB;
    } else if (shape[2] === 4) {
      format = gl.RGBA;
      internalformat =
        !isWebGL1 && type === gl.FLOAT ? (gl as unknown as { RGBA32F: number }).RGBA32F : gl.RGBA;
    } else {
      throw new Error("webgltexture-loader-ndarray: Invalid shape for pixel coords");
    }
  } else {
    throw new Error("webgltexture-loader-ndarray: Invalid shape for texture");
  }
  let buffer: ArrayBufferView;
  const size = array.size;
  let store: ArrayBufferView | undefined;
  if (!packed) {
    const stride = [shape[2], shape[2] * shape[0], 1];
    if ((dtype === "float32" || dtype === "float64") && type === gl.UNSIGNED_BYTE) {
      const u8 = pool.malloc(size, "uint8") as Uint8Array;
      const out = ndarray(u8, shape, stride, 0);
      convertFloatToUint8(out, array);
      store = u8;
      buffer = u8.subarray(0, size);
    } else if (useIntegerPath && integerKind !== null) {
      const typed = pool.malloc(size, integerKind) as unknown as
        | Uint16Array
        | Int16Array
        | Uint32Array
        | Int32Array
        | Int8Array;
      const out = ndarray(typed, shape, stride, 0);
      ops.assign(out, array);
      store = typed;
      buffer = typed.subarray(0, size);
    } else {
      const typed = pool.malloc(size, dtype as "uint8" | "float32") as Uint8Array | Float32Array;
      const out = ndarray(typed, shape, stride, 0);
      ops.assign(out, array);
      store = typed;
      buffer = typed.subarray(0, size);
    }
  } else if (array.offset === 0 && array.data.length === size) {
    buffer = array.data as ArrayBufferView;
  } else {
    buffer = (array.data as Uint8Array).subarray(array.offset, array.offset + size);
  }
  // Row byte sizes for the new integer dtypes (and for RGB/uint8 at odd widths)
  // are not always multiples of the default UNPACK_ALIGNMENT of 4, which can
  // corrupt uploads. Set alignment to 1 around the upload and restore after,
  // using try/finally so a thrown texImage2D doesn't leak the alignment.
  const prevAlignment = gl.getParameter(gl.UNPACK_ALIGNMENT);
  if (prevAlignment !== 1) gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  try {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalformat,
      shape[0],
      shape[1],
      0,
      format,
      type,
      buffer as ArrayBufferView,
    );
  } finally {
    if (prevAlignment !== 1) gl.pixelStorei(gl.UNPACK_ALIGNMENT, prevAlignment);
    if (store) {
      pool.free(store);
    }
  }
}
