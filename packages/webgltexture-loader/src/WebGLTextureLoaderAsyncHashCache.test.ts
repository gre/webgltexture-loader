import WebGLTextureLoaderAsyncHashCache from "./WebGLTextureLoaderAsyncHashCache.js";

const mockGL = (deleted: WebGLTexture[] = []) =>
  ({
    deleteTexture: (t: WebGLTexture) => {
      deleted.push(t);
    },
  }) as unknown as WebGLRenderingContext;

class FakeLoader extends WebGLTextureLoaderAsyncHashCache<number> {
  loadNoCacheCalls = 0;
  override canLoad(input: unknown) {
    return typeof input === "number";
  }
  override inputHash(input: number) {
    return input;
  }
  override loadNoCache(input: number) {
    this.loadNoCacheCalls++;
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

test("load resolves and get returns the same value afterwards", async () => {
  const loader = new FakeLoader(mockGL());
  const res = await loader.load(42);
  expect(res).toMatchObject({ width: 2, height: 2 });
  expect(loader.get(42)).toBe(res);
  expect(loader.get(43)).toBeUndefined();
  loader.dispose();
});

test("load is idempotent: same input returns the exact same Promise", () => {
  const loader = new FakeLoader(mockGL());
  const p1 = loader.load(42);
  const p2 = loader.load(42);
  expect(p1).toBe(p2);
  expect(loader.loadNoCacheCalls).toBe(1);
  loader.dispose();
});

test("cancelLoad invokes the underlying dispose and clears the promise", () => {
  let underlyingDisposed = false;
  class CancelableLoader extends WebGLTextureLoaderAsyncHashCache<number> {
    override canLoad(input: unknown) {
      return typeof input === "number";
    }
    override inputHash(input: number) {
      return input;
    }
    override loadNoCache(_input: number) {
      return {
        promise: new Promise<{
          texture: WebGLTexture;
          width: number;
          height: number;
        }>(() => {}),
        dispose: () => {
          underlyingDisposed = true;
        },
      };
    }
  }
  const loader = new CancelableLoader(mockGL());
  loader.load(42);
  loader.cancelLoad(42);
  expect(underlyingDisposed).toBe(true);
  // After cancel, a fresh load() must call loadNoCache again.
  underlyingDisposed = false;
  loader.load(42);
  expect(underlyingDisposed).toBe(false);
});

test("dispose during pending load: pending load resolves but result is dropped", async () => {
  let resolveLoad!: (v: { texture: WebGLTexture; width: number; height: number }) => void;
  class SlowLoader extends WebGLTextureLoaderAsyncHashCache<number> {
    override canLoad(input: unknown) {
      return typeof input === "number";
    }
    override inputHash(input: number) {
      return input;
    }
    override loadNoCache(_input: number) {
      return {
        promise: new Promise<{
          texture: WebGLTexture;
          width: number;
          height: number;
        }>((r) => {
          resolveLoad = r;
        }),
        dispose: () => {},
      };
    }
  }
  const loader = new SlowLoader(mockGL());
  const p = loader.load(42);
  loader.dispose();
  resolveLoad({
    texture: {} as WebGLTexture,
    width: 1,
    height: 1,
  });
  // The promise should never resolve (dispose drops the result).
  const winner = await Promise.race([
    p.then(() => "resolved"),
    new Promise((r) => setTimeout(r, 10, "timeout")),
  ]);
  expect(winner).toBe("timeout");
});

test("dispose deletes every cached texture exactly once", async () => {
  const deleted: WebGLTexture[] = [];
  const loader = new FakeLoader(mockGL(deleted));
  const a = await loader.load(1);
  const b = await loader.load(2);
  loader.dispose();
  expect(deleted).toEqual([a.texture, b.texture]);
});

test("loadNoCache rejection propagates", async () => {
  class FailingLoader extends WebGLTextureLoaderAsyncHashCache<number> {
    override canLoad(input: unknown) {
      return typeof input === "number";
    }
    override inputHash(input: number) {
      return input;
    }
    override loadNoCache(_input: number) {
      return {
        promise: Promise.reject(new Error("boom")),
        dispose: () => {},
      };
    }
  }
  const loader = new FailingLoader(mockGL());
  await expect(loader.load(42)).rejects.toThrow(/boom/);
});
