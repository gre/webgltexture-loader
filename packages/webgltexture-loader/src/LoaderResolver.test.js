import LoaderResolver from "./LoaderResolver";
import LoadersRegistry from "./LoadersRegistry";
import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache";

test("an empty LoaderResolver resolves nothing", () => {
  const gl = {};
  const resolver = new LoaderResolver(gl);
  expect(resolver.resolve(null)).toBeUndefined();
  expect(resolver.resolve(42)).toBeUndefined();
  expect(resolver.resolve("foo")).toBeUndefined();
  resolver.dispose();
});

test("LoaderResolver works with one loader", () => {
  const gl = {
    deleteTexture: () => {}
  };
  const registry = new LoadersRegistry();
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
  registry.add(FakeLoader);
  const resolver = new LoaderResolver(gl, registry);
  expect(resolver.resolve(null)).toBeUndefined();
  expect(resolver.resolve("foo")).toBeUndefined();
  const loader = resolver.resolve(42);
  expect(loader).toBeDefined();
  expect(loader).toBeInstanceOf(FakeLoader);
  resolver.dispose();
});
