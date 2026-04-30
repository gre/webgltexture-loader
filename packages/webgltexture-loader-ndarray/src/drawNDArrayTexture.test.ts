import ndarray from "ndarray";
import drawNDArrayTexture from "./drawNDArrayTexture.js";

/**
 * Mock the slice of WebGL2 the integer-texture path actually touches:
 *   - the WebGL1 enums it inherits (UNSIGNED_BYTE, FLOAT, RGBA, ALPHA, ...)
 *   - the WebGL2-only enums it probes (R16UI etc.) and reads via gl[name]
 *   - getParameter(MAX_TEXTURE_SIZE | UNPACK_ALIGNMENT)
 *   - pixelStorei (for UNPACK_ALIGNMENT save/restore)
 *   - texImage2D — the only call we want to assert on
 *
 * `R16UI` being a number is what triggers the WebGL2 path
 * (see `isWebGL2Context` in drawNDArrayTexture.ts).
 */
function makeMockWebGL2(): {
  gl: WebGLRenderingContext;
  texImage2D: jest.Mock;
} {
  const ENUMS: Record<string, number> = {
    // WebGL1 enums actually referenced by the function.
    UNSIGNED_BYTE: 0x1401,
    BYTE: 0x1400,
    SHORT: 0x1402,
    UNSIGNED_SHORT: 0x1403,
    INT: 0x1404,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
    ALPHA: 0x1906,
    RGB: 0x1907,
    RGBA: 0x1908,
    LUMINANCE: 0x1909,
    LUMINANCE_ALPHA: 0x190a,
    TEXTURE_2D: 0x0de1,
    MAX_TEXTURE_SIZE: 0x0d33,
    UNPACK_ALIGNMENT: 0x0cf5,
    // WebGL2-only constants the integer path resolves by name.
    RED_INTEGER: 0x8d94,
    RG_INTEGER: 0x8228,
    RGB_INTEGER: 0x8d98,
    RGBA_INTEGER: 0x8d99,
    R16UI: 0x8234,
    RG16UI: 0x823a,
    RGB16UI: 0x8d77,
    RGBA16UI: 0x8d76,
    R16I: 0x8233,
    RG16I: 0x8239,
    RGB16I: 0x8d89,
    RGBA16I: 0x8d88,
    R32UI: 0x8236,
    RG32UI: 0x823c,
    RGB32UI: 0x8d71,
    RGBA32UI: 0x8d70,
    R32I: 0x8235,
    RG32I: 0x823b,
    RGB32I: 0x8d83,
    RGBA32I: 0x8d82,
    R8I: 0x8231,
    RG8I: 0x8237,
    RGB8I: 0x8d8f,
    RGBA8I: 0x8d8e,
    RGB32F: 0x8815,
    RGBA32F: 0x8814,
  };
  const texImage2D = jest.fn();
  const gl = {
    ...ENUMS,
    getParameter: (name: number): number => {
      if (name === ENUMS.MAX_TEXTURE_SIZE) return 4096;
      if (name === ENUMS.UNPACK_ALIGNMENT) return 4;
      throw new Error("unexpected getParameter " + name);
    },
    pixelStorei: jest.fn(),
    texImage2D,
  };
  return { gl: gl as unknown as WebGLRenderingContext, texImage2D };
}

interface UploadCall {
  internalformat: number;
  format: number;
  type: number;
  width: number;
  height: number;
  buffer: ArrayBufferView;
}

function lastUpload(texImage2D: jest.Mock): UploadCall {
  const call = texImage2D.mock.calls.at(-1);
  if (!call) throw new Error("texImage2D was not called");
  // texImage2D(target, level, internalformat, width, height, border, format, type, pixels)
  return {
    internalformat: call[2],
    width: call[3],
    height: call[4],
    format: call[6],
    type: call[7],
    buffer: call[8],
  };
}

describe("drawNDArrayTexture WebGL2 integer paths (mocked context)", () => {
  // Each row: [dtype, expected internalformat enum name, expected GL type enum name, ctor].
  const cases: Array<{
    dtype: "uint16" | "int16" | "uint32" | "int32" | "int8";
    internalformatName: string;
    typeName: string;
    Ctor:
      | typeof Uint16Array
      | typeof Int16Array
      | typeof Uint32Array
      | typeof Int32Array
      | typeof Int8Array;
  }> = [
    {
      dtype: "uint16",
      internalformatName: "RGBA16UI",
      typeName: "UNSIGNED_SHORT",
      Ctor: Uint16Array,
    },
    { dtype: "int16", internalformatName: "RGBA16I", typeName: "SHORT", Ctor: Int16Array },
    {
      dtype: "uint32",
      internalformatName: "RGBA32UI",
      typeName: "UNSIGNED_INT",
      Ctor: Uint32Array,
    },
    { dtype: "int32", internalformatName: "RGBA32I", typeName: "INT", Ctor: Int32Array },
    { dtype: "int8", internalformatName: "RGBA8I", typeName: "BYTE", Ctor: Int8Array },
  ];

  for (const { dtype, internalformatName, typeName, Ctor } of cases) {
    test(`${dtype} RGBA -> RGBA_INTEGER + ${internalformatName} + ${typeName}`, () => {
      const { gl, texImage2D } = makeMockWebGL2();
      const data = new Ctor(2 * 2 * 4);
      const arr = ndarray(data as unknown as ArrayLike<number>, [2, 2, 4]);
      drawNDArrayTexture(gl, arr, false);
      const upload = lastUpload(texImage2D);
      const expected = gl as unknown as Record<string, number>;
      expect(upload.format).toBe(expected.RGBA_INTEGER);
      expect(upload.internalformat).toBe(expected[internalformatName]);
      expect(upload.type).toBe(expected[typeName]);
      expect(upload.width).toBe(2);
      expect(upload.height).toBe(2);
    });
  }

  // Non-RGBA channel counts dispatch through the same integer table; spot-check
  // a 2-channel uint16 to make sure the per-channel internalformat lookup picks
  // RG16UI (not RGBA16UI) and the format is RG_INTEGER (not RGBA_INTEGER).
  test("uint16 2-channel -> RG_INTEGER + RG16UI + UNSIGNED_SHORT", () => {
    const { gl, texImage2D } = makeMockWebGL2();
    const arr = ndarray(new Uint16Array(2 * 2 * 2), [2, 2, 2]);
    drawNDArrayTexture(gl, arr, false);
    const upload = lastUpload(texImage2D);
    const expected = gl as unknown as Record<string, number>;
    expect(upload.format).toBe(expected.RG_INTEGER);
    expect(upload.internalformat).toBe(expected.RG16UI);
    expect(upload.type).toBe(expected.UNSIGNED_SHORT);
  });

  // 2D shapes get treated as a single-channel R*I/R*UI texture.
  test("uint16 2D shape -> RED_INTEGER + R16UI + UNSIGNED_SHORT", () => {
    const { gl, texImage2D } = makeMockWebGL2();
    const arr = ndarray(new Uint16Array(2 * 2), [2, 2]);
    drawNDArrayTexture(gl, arr, false);
    const upload = lastUpload(texImage2D);
    const expected = gl as unknown as Record<string, number>;
    expect(upload.format).toBe(expected.RED_INTEGER);
    expect(upload.internalformat).toBe(expected.R16UI);
    expect(upload.type).toBe(expected.UNSIGNED_SHORT);
  });

  // The function saves/restores UNPACK_ALIGNMENT to 1 around the upload so
  // odd row byte sizes (frequent for integer dtypes) don't get corrupted.
  test("UNPACK_ALIGNMENT is set to 1 then restored to its previous value", () => {
    const { gl } = makeMockWebGL2();
    const pixelStorei = (gl as unknown as { pixelStorei: jest.Mock }).pixelStorei;
    const arr = ndarray(new Uint16Array(2 * 2 * 4), [2, 2, 4]);
    drawNDArrayTexture(gl, arr, false);
    expect(pixelStorei).toHaveBeenCalledWith(
      (gl as unknown as Record<string, number>).UNPACK_ALIGNMENT,
      1,
    );
    expect(pixelStorei).toHaveBeenLastCalledWith(
      (gl as unknown as Record<string, number>).UNPACK_ALIGNMENT,
      4,
    );
  });
});
