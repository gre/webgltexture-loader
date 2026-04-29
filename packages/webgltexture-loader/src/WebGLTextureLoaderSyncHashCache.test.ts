import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache.js";

test("simple usage", () => {
  const gl = {
    deleteTexture: () => {},
  } as unknown as WebGLRenderingContext;
  class FakeLoader extends WebGLTextureLoaderSyncHashCache<number> {
    canLoad(input: unknown) {
      return typeof input === "number";
    }
    inputHash(input: number) {
      return input;
    }
    getNoCache(input: number) {
      return {
        texture: { id: input } as unknown as WebGLTexture,
        width: 2,
        height: 2,
      };
    }
  }
  const loader = new FakeLoader(gl);
  expect(loader.get(42)).toMatchObject({ width: 2, height: 2 });
  expect(loader.get(43)).toMatchObject({ width: 2, height: 2 });
  loader.dispose();
});
