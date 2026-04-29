import ndarray from "ndarray";
import NDArrayTextureLoader from "./NDArrayTextureLoader.js";

let createGL: ((w: number, h: number) => WebGLRenderingContext) | null = null;
try {
  createGL = require("gl");
} catch {
  createGL = null;
}

const describeGL = createGL ? describe : describe.skip;

function destroy(gl: WebGLRenderingContext): void {
  (gl.getExtension("STACKGL_destroy_context") as { destroy(): void } | null)?.destroy();
}

function readPixel(gl: WebGLRenderingContext, texture: WebGLTexture): Uint8Array {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const out = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  gl.deleteFramebuffer(fb);
  return out;
}

describeGL("NDArrayTextureLoader against headless-gl", () => {
  let gl: WebGLRenderingContext;

  beforeEach(() => {
    gl = createGL!(2, 2);
  });

  afterEach(() => {
    destroy(gl);
  });

  test("uploads a uint8 RGBA ndarray and reports its size", () => {
    const loader = new NDArrayTextureLoader(gl);
    const data = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
    const arr = ndarray(data, [2, 2, 4]);
    const result = loader.get(arr);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(gl.isTexture(result.texture)).toBe(true);
    expect(Array.from(readPixel(gl, result.texture))).toEqual([255, 0, 0, 255]);
    loader.dispose();
    expect(gl.isTexture(result.texture)).toBe(false);
  });

  test("dispose deletes every cached texture", () => {
    const loader = new NDArrayTextureLoader(gl);
    const arrA = ndarray(new Uint8Array([255, 0, 0, 255]), [1, 1, 4]);
    const arrB = ndarray(new Uint8Array([0, 255, 0, 255]), [1, 1, 4]);
    const a = loader.get(arrA);
    const b = loader.get(arrB);
    expect(gl.isTexture(a.texture)).toBe(true);
    expect(gl.isTexture(b.texture)).toBe(true);
    loader.dispose();
    expect(gl.isTexture(a.texture)).toBe(false);
    expect(gl.isTexture(b.texture)).toBe(false);
  });

  test("update() re-uploads texture data without recreating it", () => {
    const loader = new NDArrayTextureLoader(gl);
    const arr = ndarray(new Uint8Array([255, 0, 0, 255]), [1, 1, 4]);
    const first = loader.get(arr);
    expect(Array.from(readPixel(gl, first.texture))).toEqual([255, 0, 0, 255]);
    arr.data[0] = 0;
    arr.data[1] = 255;
    loader.update(arr);
    expect(loader.get(arr).texture).toBe(first.texture);
    expect(Array.from(readPixel(gl, first.texture))).toEqual([0, 255, 0, 255]);
    loader.dispose();
  });

  test("uploads a 2D ndarray as LUMINANCE", () => {
    const loader = new NDArrayTextureLoader(gl);
    const arr = ndarray(new Uint8Array([42]), [1, 1]);
    const result = loader.get(arr);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(gl.isTexture(result.texture)).toBe(true);
    loader.dispose();
  });

  test("uploads a 3D RGB ndarray (3 channels)", () => {
    const loader = new NDArrayTextureLoader(gl);
    const arr = ndarray(new Uint8Array([10, 20, 30]), [1, 1, 3]);
    const result = loader.get(arr);
    expect(gl.isTexture(result.texture)).toBe(true);
    loader.dispose();
  });

  test("rejects unsupported channel counts", () => {
    const loader = new NDArrayTextureLoader(gl);
    const arr = ndarray(new Uint8Array(5), [1, 1, 5]);
    expect(() => loader.get(arr)).toThrow(/Invalid shape for pixel coords/);
    loader.dispose();
  });

  test("rejects shapes larger than MAX_TEXTURE_SIZE", () => {
    const loader = new NDArrayTextureLoader(gl);
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const arr = ndarray(new Uint8Array(4), [max + 1, 1, 4]);
    expect(() => loader.get(arr)).toThrow(/Invalid texture size/);
    loader.dispose();
  });

  // Integer dtype fallbacks under WebGL1.
  // headless-gl is WebGL1 only, so the WebGL2 integer texture paths
  // (R16UI, RG16UI, ...) cannot be exercised in CI. We only cover the
  // uint8 fallback and the one-time console.warn behavior here.
  // We isolate the module to reset the per-process warned-dtype memoization
  // between tests.
  describe("integer dtype fallback (WebGL1)", () => {
    let warnSpy: jest.SpyInstance;
    let LoaderCtor: typeof NDArrayTextureLoader;
    let nd: typeof ndarray;

    beforeEach(() => {
      jest.isolateModules(() => {
        LoaderCtor = require("./NDArrayTextureLoader.js").default;
        nd = require("ndarray");
      });
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test("uint16 ndarray on WebGL1 warns once and creates a fallback texture", () => {
      const loader = new LoaderCtor(gl);
      const data = new Uint16Array([1, 2, 3, 4]);
      const arr = nd(data, [2, 2]);
      const result = loader.get(arr);
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
      expect(gl.isTexture(result.texture)).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/uint16/);
      loader.dispose();
    });

    test("loading the same dtype twice only warns once", () => {
      const loader = new LoaderCtor(gl);
      const a = nd(new Uint16Array([1, 2, 3, 4]), [2, 2]);
      const b = nd(new Uint16Array([5, 6, 7, 8]), [2, 2]);
      loader.get(a);
      loader.get(b);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      loader.dispose();
    });
  });
});
