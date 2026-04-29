import LoaderResolver from "./LoaderResolver.js";
import LoadersRegistry from "./LoadersRegistry.js";
import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache.js";

const mockGL = () => ({ deleteTexture: () => {} }) as unknown as WebGLRenderingContext;

class NumberLoader extends WebGLTextureLoaderSyncHashCache<number> {
  override canLoad(input: unknown) {
    return typeof input === "number";
  }
  override inputHash(input: number) {
    return input;
  }
  override getNoCache(input: number) {
    return {
      texture: { id: input } as unknown as WebGLTexture,
      width: 2,
      height: 2,
    };
  }
}

class StringLoader extends WebGLTextureLoaderSyncHashCache<string> {
  static priority = 100;
  override canLoad(input: unknown) {
    return typeof input === "string";
  }
  override inputHash(input: string) {
    return input;
  }
  override getNoCache(input: string) {
    return {
      texture: { id: input } as unknown as WebGLTexture,
      width: 1,
      height: 1,
    };
  }
}

test("an empty LoaderResolver resolves nothing", () => {
  const gl = {} as WebGLRenderingContext;
  // Pass an explicit empty registry so this test doesn't pick up loaders
  // that other test files have side-effect-registered into globalRegistry.
  const resolver = new LoaderResolver(gl, new LoadersRegistry());
  expect(resolver.resolve(null)).toBeUndefined();
  expect(resolver.resolve(42)).toBeUndefined();
  expect(resolver.resolve("foo")).toBeUndefined();
  resolver.dispose();
});

test("resolves the matching loader and rejects unsupported inputs", () => {
  const registry = new LoadersRegistry();
  registry.add(NumberLoader);
  const resolver = new LoaderResolver(mockGL(), registry);
  expect(resolver.resolve(null)).toBeUndefined();
  expect(resolver.resolve("foo")).toBeUndefined();
  expect(resolver.resolve(42)).toBeInstanceOf(NumberLoader);
  resolver.dispose();
});

test("higher-priority loader wins when multiple registered", () => {
  const registry = new LoadersRegistry();
  registry.add(NumberLoader);
  registry.add(StringLoader);
  const resolver = new LoaderResolver(mockGL(), registry);
  expect(resolver.resolve("foo")).toBeInstanceOf(StringLoader);
  expect(resolver.resolve(42)).toBeInstanceOf(NumberLoader);
});

test("dispose() cascades to every loader", () => {
  const calls: string[] = [];
  class TrackingA extends WebGLTextureLoaderSyncHashCache<number> {
    override dispose() {
      calls.push("A");
    }
  }
  class TrackingB extends WebGLTextureLoaderSyncHashCache<number> {
    override dispose() {
      calls.push("B");
    }
  }
  const registry = new LoadersRegistry();
  registry.add(TrackingA);
  registry.add(TrackingB);
  const resolver = new LoaderResolver(mockGL(), registry);
  resolver.dispose();
  expect(calls.toSorted()).toEqual(["A", "B"]);
});
