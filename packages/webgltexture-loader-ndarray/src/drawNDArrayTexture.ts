import type { NdArray } from "ndarray";
import ndarray from "ndarray";
import ops from "ndarray-ops";
import pool from "typedarray-pool";

// Some of the texImage2D logic below is adapted from
// https://github.com/stackgl/gl-texture2d/blob/master/texture.js

type GlobalWithBuffer = { Buffer?: { isBuffer: (b: unknown) => boolean } };
// Browser shim so typedarray-pool's Buffer.isBuffer check doesn't crash.
if (typeof (globalThis as GlobalWithBuffer).Buffer === "undefined") {
  (globalThis as GlobalWithBuffer).Buffer = { isBuffer: () => false };
}

function isPacked(shape: number[], stride: number[]): boolean {
  if (shape.length === 3) {
    return stride[2] === 1 && stride[1] === shape[0] * shape[2] && stride[0] === shape[2];
  }
  return stride[0] === 1 && stride[1] === shape[0];
}

function convertFloatToUint8(out: NdArray, inp: NdArray): void {
  ops.muls(out, inp, 255.0);
}

export default function drawNDArrayTexture(
  gl: WebGLRenderingContext,
  array: NdArray,
  floatSupported: boolean,
): void {
  const isWebGL1 =
    typeof WebGLRenderingContext === "undefined" || gl instanceof WebGLRenderingContext;

  let dtype: string = array.dtype;
  let shape = array.shape.slice();
  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (shape[0] < 0 || shape[0] > maxSize || shape[1] < 0 || shape[1] > maxSize) {
    throw new Error("webgltexture-loader-ndarray: Invalid texture size");
  }
  let packed = isPacked(shape, array.stride.slice());
  let type = 0;
  if (dtype === "float32") {
    type = gl.FLOAT;
  } else if (dtype === "float64") {
    type = gl.FLOAT;
    packed = false;
    dtype = "float32";
  } else if (dtype === "uint8") {
    type = gl.UNSIGNED_BYTE;
  } else {
    type = gl.UNSIGNED_BYTE;
    packed = false;
    dtype = "uint8";
  }
  let format = 0;
  let internalformat = 0;
  if (shape.length === 2) {
    internalformat = format = gl.LUMINANCE;
    shape = [shape[0], shape[1], 1];
    array = ndarray(array.data, shape, [array.stride[0], array.stride[1], 1], array.offset);
  } else if (shape.length === 3) {
    if (shape[2] === 1) {
      internalformat = format = gl.ALPHA;
      // WebGL2 doesn't appear to expose a usable float internalformat for ALPHA;
      // fall back to uint8.
      if (!isWebGL1) floatSupported = false;
    } else if (shape[2] === 2) {
      internalformat = format = gl.LUMINANCE_ALPHA;
      // Same WebGL2 quirk as ALPHA above.
      if (!isWebGL1) floatSupported = false;
    } else if (shape[2] === 3) {
      format = gl.RGB;
      internalformat = isWebGL1 ? gl.RGB : (gl as unknown as { RGB32F: number }).RGB32F;
    } else if (shape[2] === 4) {
      format = gl.RGBA;
      internalformat = isWebGL1 ? gl.RGBA : (gl as unknown as { RGBA32F: number }).RGBA32F;
    } else {
      throw new Error("webgltexture-loader-ndarray: Invalid shape for pixel coords");
    }
  } else {
    throw new Error("webgltexture-loader-ndarray: Invalid shape for texture");
  }
  if (type === gl.FLOAT && !floatSupported) {
    type = gl.UNSIGNED_BYTE;
    packed = false;
  }
  let buffer: ArrayBufferView;
  const size = array.size;
  let store: Uint8Array | Float32Array | undefined;
  if (!packed) {
    const stride = [shape[2], shape[2] * shape[0], 1];
    if ((dtype === "float32" || dtype === "float64") && type === gl.UNSIGNED_BYTE) {
      store = pool.malloc(size, "uint8") as Uint8Array;
      const out = ndarray(store, shape, stride, 0);
      convertFloatToUint8(out, array);
    } else {
      store = pool.malloc(size, dtype as "uint8" | "float32") as Uint8Array | Float32Array;
      const out = ndarray(store, shape, stride, 0);
      ops.assign(out, array);
    }
    buffer = store.subarray(0, size);
  } else if (array.offset === 0 && array.data.length === size) {
    buffer = array.data as ArrayBufferView;
  } else {
    buffer = (array.data as Uint8Array).subarray(array.offset, array.offset + size);
  }
  gl.texImage2D(gl.TEXTURE_2D, 0, internalformat, shape[0], shape[1], 0, format, type, buffer);
  if (store) {
    pool.free(store);
  }
}
