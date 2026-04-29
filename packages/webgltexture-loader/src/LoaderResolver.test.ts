import LoaderResolver from "./LoaderResolver.js";
import LoadersRegistry from "./LoadersRegistry.js";
import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache.js";

test("an empty LoaderResolver resolves nothing", () => {
  const gl = {} as WebGLRenderingContext;
  const resolver = new LoaderResolver(gl);
  expect(resolver.resolve(null)).toBeUndefined();
  expect(resolver.resolve(42)).toBeUndefined();
  expect(resolver.resolve("foo")).toBeUndefined();
  resolver.dispose();
});

test("LoaderResolver works with one loader", () => {
  const gl = {
    deleteTexture: () => {},
  } as unknown as WebGLRenderingContext;
  const registry = new LoadersRegistry();
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
  registry.add(FakeLoader);
  const resolver = new LoaderResolver(gl, registry);
  expect(resolver.resolve(null)).toBeUndefined();
  expect(resolver.resolve("foo")).toBeUndefined();
  const loader = resolver.resolve(42);
  expect(loader).toBeDefined();
  expect(loader).toBeInstanceOf(FakeLoader);
  resolver.dispose();
});
