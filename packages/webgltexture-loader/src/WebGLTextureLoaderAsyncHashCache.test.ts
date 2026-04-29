import WebGLTextureLoaderAsyncHashCache from "./WebGLTextureLoaderAsyncHashCache.js";

test("WebGLTextureLoaderAsyncHashCache simple usage", async () => {
  const gl = {
    deleteTexture: () => {},
  } as unknown as WebGLRenderingContext;
  class FakeLoader extends WebGLTextureLoaderAsyncHashCache<number> {
    canLoad(input: unknown) {
      return typeof input === "number";
    }
    inputHash(input: number) {
      return input;
    }
    loadNoCache(input: number) {
      return {
        promise: Promise.resolve({
          texture: { id: input } as unknown as WebGLTexture,
          width: 2,
          height: 2,
        }),
        dispose: () => {},
      };
    }
  }
  const loader = new FakeLoader(gl);
  let res = await loader.load(42);
  expect(res).toMatchObject({ width: 2, height: 2 });
  expect(loader.get(42)).toBe(res);
  expect(loader.get(43)).toBeUndefined();
  res = await loader.load(43);
  expect(res).toMatchObject({ width: 2, height: 2 });
  expect(loader.get(43)).toBe(res);
  loader.dispose();
});
