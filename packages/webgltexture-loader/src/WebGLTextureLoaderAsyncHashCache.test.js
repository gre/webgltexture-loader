import WebGLTextureLoaderAsyncHashCache from "./WebGLTextureLoaderAsyncHashCache";

test("WebGLTextureLoaderAsyncHashCache simple usage", async () => {
  const gl = {
    deleteTexture: () => {}
  };
  class FakeLoader extends WebGLTextureLoaderAsyncHashCache {
    canLoad(input) {
      return typeof input === "number";
    }
    inputHash(input) {
      return input;
    }
    loadNoCache(input) {
      return {
        promise: Promise.resolve({
          texture: { id: input },
          width: 2,
          height: 2
        }),
        dispose: () => {}
      };
    }
  }
  const loader = new FakeLoader(gl);
  let res = await loader.load(42);
  expect(res).toMatchObject({
    texture: { id: 42 },
    width: 2,
    height: 2
  });
  expect(loader.get(42)).toBe(res);
  // test with another value
  expect(loader.get(43)).toBeUndefined();
  res = await loader.load(43);
  expect(res).toMatchObject({
    texture: { id: 43 },
    width: 2,
    height: 2
  });
  expect(loader.get(43)).toBe(res);
  loader.dispose();
});
