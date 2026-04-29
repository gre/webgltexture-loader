import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache.js";

const mockGL = (deleted: WebGLTexture[] = []) =>
  ({
    deleteTexture: (t: WebGLTexture) => {
      deleted.push(t);
    },
  }) as unknown as WebGLRenderingContext;

class CountingLoader extends WebGLTextureLoaderSyncHashCache<number> {
  getNoCacheCalls = 0;
  override canLoad(input: unknown) {
    return typeof input === "number";
  }
  override inputHash(input: number) {
    return input;
  }
  override getNoCache(input: number) {
    this.getNoCacheCalls++;
    return {
      texture: { id: input } as unknown as WebGLTexture,
      width: 2,
      height: 2,
    };
  }
}

test("get caches: subsequent calls with the same input return the same value", () => {
  const loader = new CountingLoader(mockGL());
  const a = loader.get(42);
  const b = loader.get(42);
  expect(a).toBe(b);
  expect(loader.getNoCacheCalls).toBe(1);
  loader.dispose();
});

test("load() resolves to the same value as get() and is idempotent", async () => {
  const loader = new CountingLoader(mockGL());
  const p1 = loader.load(42);
  const p2 = loader.load(42);
  expect(p1).toBe(p2);
  await expect(p1).resolves.toBe(loader.get(42));
});

test("dispose deletes every cached texture", () => {
  const deleted: WebGLTexture[] = [];
  const loader = new CountingLoader(mockGL(deleted));
  const a = loader.get(1);
  const b = loader.get(2);
  loader.dispose();
  expect(deleted).toEqual([a.texture, b.texture]);
});
