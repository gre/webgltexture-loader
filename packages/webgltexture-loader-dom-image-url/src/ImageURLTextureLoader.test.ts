// `ImageURLTextureLoader` reads `window.Image` from the global. Node's
// default jest env has neither, so install a controllable fake before
// importing the loader. Each constructed instance is recorded so tests can
// drive `onload` / `onerror` / `onabort` synchronously.

type ImageHandlers = (() => void) | null;
class FakeImage {
  static instances: FakeImage[] = [];
  width = 0;
  height = 0;
  src = "";
  crossOrigin: string | null = null;
  onload: ImageHandlers = null;
  onerror: ((e?: unknown) => void) | null = null;
  onabort: ((e?: unknown) => void) | null = null;
  constructor() {
    FakeImage.instances.push(this);
  }
}

const WINDOW_NOT_SET = Symbol("not-set");
const IMAGE_NOT_SET = Symbol("not-set");
let previousWindow: unknown = WINDOW_NOT_SET;
let previousImage: unknown = IMAGE_NOT_SET;

beforeAll(() => {
  const g = globalThis as { window?: unknown; Image?: unknown };
  previousWindow = "window" in g ? g.window : WINDOW_NOT_SET;
  previousImage = "Image" in g ? g.Image : IMAGE_NOT_SET;
  // The loader uses `new window.Image()`, so install on both `window` and
  // (defensively) the global so any path resolves the same fake.
  g.window = { Image: FakeImage };
  g.Image = FakeImage;
});
afterAll(() => {
  const g = globalThis as { window?: unknown; Image?: unknown };
  if (previousWindow === WINDOW_NOT_SET) {
    delete g.window;
  } else {
    g.window = previousWindow;
  }
  if (previousImage === IMAGE_NOT_SET) {
    delete g.Image;
  } else {
    g.Image = previousImage;
  }
});

beforeEach(() => {
  FakeImage.instances = [];
});

import ImageURLTextureLoader from "./ImageURLTextureLoader.js";

const mockGL = (overrides: Partial<WebGLRenderingContext> = {}) =>
  ({
    TEXTURE_2D: 0x0de1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    deleteTexture: () => {},
    createTexture: () => ({}) as WebGLTexture,
    bindTexture: () => {},
    texImage2D: () => {},
    ...overrides,
  }) as unknown as WebGLRenderingContext;

test("canLoad accepts strings", () => {
  const loader = new ImageURLTextureLoader(mockGL());
  expect(loader.canLoad("https://example.com/foo.png")).toBe(true);
  expect(loader.canLoad("")).toBe(true);
});

test("canLoad rejects non-strings", () => {
  const loader = new ImageURLTextureLoader(mockGL());
  expect(loader.canLoad(null)).toBe(false);
  expect(loader.canLoad(undefined)).toBe(false);
  expect(loader.canLoad(42)).toBe(false);
  expect(loader.canLoad({})).toBe(false);
});

test("inputHash is the URL itself and is idempotent", () => {
  const loader = new ImageURLTextureLoader(mockGL());
  expect(loader.inputHash("foo")).toBe("foo");
  expect(loader.inputHash("foo")).toBe(loader.inputHash("foo"));
});

test("loadNoCache resolves with a texture and the image dimensions on onload", async () => {
  const tex = { __id: "t" } as unknown as WebGLTexture;
  const binds: [number, WebGLTexture][] = [];
  const uploads: unknown[] = [];
  const gl = mockGL({
    createTexture: () => tex,
    bindTexture: ((target: number, t: WebGLTexture) => {
      binds.push([target, t]);
    }) as WebGLRenderingContext["bindTexture"],
    texImage2D: ((...args: unknown[]) => {
      uploads.push(args);
    }) as unknown as WebGLRenderingContext["texImage2D"],
  });
  const loader = new ImageURLTextureLoader(gl);
  const promise = loader.load("https://example.com/cat.png");
  // Loader must have constructed a single Image and set its src + crossOrigin.
  expect(FakeImage.instances).toHaveLength(1);
  const img = FakeImage.instances[0]!;
  expect(img.src).toBe("https://example.com/cat.png");
  expect(img.crossOrigin).toBe("anonymous");
  // Pretend the image decoded with concrete dimensions.
  img.width = 320;
  img.height = 240;
  img.onload?.();
  const result = await promise;
  expect(result.width).toBe(320);
  expect(result.height).toBe(240);
  expect(result.texture).toBe(tex);
  expect(binds).toEqual([[gl.TEXTURE_2D, tex]]);
  expect(uploads).toHaveLength(1);
  expect((uploads[0] as unknown[])[5]).toBe(img);
});

test("loadNoCache does not set crossOrigin on data: URLs", async () => {
  const loader = new ImageURLTextureLoader(mockGL());
  const promise = loader.load("data:image/png;base64,AAAA");
  const img = FakeImage.instances[0]!;
  expect(img.crossOrigin).toBe(null);
  img.width = 1;
  img.height = 1;
  img.onload?.();
  await promise;
});

test("loadNoCache rejects on image error", async () => {
  const loader = new ImageURLTextureLoader(mockGL());
  const promise = loader.load("https://example.com/bad.png");
  const img = FakeImage.instances[0]!;
  img.onerror?.(new Error("net"));
  await expect(promise).rejects.toThrow(/image load failed/);
});

test("loadNoCache rejects on image abort", async () => {
  const loader = new ImageURLTextureLoader(mockGL());
  const promise = loader.load("https://example.com/abort.png");
  const img = FakeImage.instances[0]!;
  img.onabort?.(new Error("abort"));
  await expect(promise).rejects.toThrow(/image load failed/);
});

test("dispose hook clears handlers and src on a still-pending image", () => {
  const loader = new ImageURLTextureLoader(mockGL());
  // Reach into protected loadNoCache so we get the dispose hook directly.
  const { dispose } = (
    loader as unknown as {
      loadNoCache: (src: string) => { promise: Promise<unknown>; dispose: () => void };
    }
  ).loadNoCache("https://example.com/cancel.png");
  const img = FakeImage.instances[0]!;
  expect(img.onload).not.toBeNull();
  dispose();
  expect(img.onload).toBeNull();
  expect(img.onerror).toBeNull();
  expect(img.onabort).toBeNull();
  expect(img.src).toBe("");
  // Dispose is idempotent (the inner img reference is null on second call).
  expect(() => dispose()).not.toThrow();
});

test("dispose after onload is a no-op (the inner img reference is cleared on success)", () => {
  const loader = new ImageURLTextureLoader(mockGL());
  const { dispose, promise } = (
    loader as unknown as {
      loadNoCache: (src: string) => { promise: Promise<unknown>; dispose: () => void };
    }
  ).loadNoCache("https://example.com/done.png");
  const img = FakeImage.instances[0]!;
  img.width = 4;
  img.height = 4;
  img.onload?.();
  // After success the loader nulls its `img` ref so dispose can't reach handlers.
  expect(() => dispose()).not.toThrow();
  // Still resolves cleanly.
  return promise;
});

test("load is idempotent on the same URL (single Image is constructed)", async () => {
  const loader = new ImageURLTextureLoader(mockGL());
  const p1 = loader.load("https://example.com/once.png");
  const p2 = loader.load("https://example.com/once.png");
  expect(p1).toBe(p2);
  expect(FakeImage.instances).toHaveLength(1);
  const img = FakeImage.instances[0]!;
  img.width = 1;
  img.height = 1;
  img.onload?.();
  await p1;
});
