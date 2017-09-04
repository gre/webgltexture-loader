import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache";

test("simple usage", () => {
  const gl = {
    deleteTexture: () => {}
  };
  class FakeLoader extends WebGLTextureLoaderSyncHashCache {
    canLoad(input) {
      return typeof input === "number";
    }
    inputHash(input) {
      return input;
    }
    getNoCache(input) {
      return { texture: { id: input }, width: 2, height: 2 };
    }
  }
  const loader = new FakeLoader(gl);
  expect(loader.get(42)).toMatchObject({
    texture: { id: 42 },
    width: 2,
    height: 2
  });
  expect(loader.get(43)).toMatchObject({
    texture: { id: 43 },
    width: 2,
    height: 2
  });
  loader.dispose();
});
