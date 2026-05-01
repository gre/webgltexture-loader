// `VideoTextureLoader` checks `input instanceof HTMLVideoElement` and
// polls `videoWidth`. Install a minimal class on `globalThis` so the
// instanceof guard passes in plain Node.

const HTML_VIDEO_NOT_SET = Symbol("not-set");
let previousHTMLVideoElement: unknown = HTML_VIDEO_NOT_SET;
beforeAll(() => {
  const g = globalThis as { HTMLVideoElement?: unknown };
  previousHTMLVideoElement = "HTMLVideoElement" in g ? g.HTMLVideoElement : HTML_VIDEO_NOT_SET;
  if (typeof g.HTMLVideoElement !== "function") {
    g.HTMLVideoElement = class HTMLVideoElement {
      videoWidth = 0;
      videoHeight = 0;
    };
  }
});
afterAll(() => {
  const g = globalThis as { HTMLVideoElement?: unknown };
  if (previousHTMLVideoElement === HTML_VIDEO_NOT_SET) {
    delete g.HTMLVideoElement;
  } else {
    g.HTMLVideoElement = previousHTMLVideoElement;
  }
});

import VideoTextureLoader from "./VideoTextureLoader.js";

const HTMLVideoElementCtor = () =>
  (globalThis as { HTMLVideoElement: new () => HTMLVideoElement }).HTMLVideoElement;

const makeVideo = (videoWidth = 0, videoHeight = 0): HTMLVideoElement => {
  const v = new (HTMLVideoElementCtor())();
  Object.assign(v, { videoWidth, videoHeight });
  return v;
};

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

test("canLoad accepts HTMLVideoElement instances and rejects others", () => {
  const loader = new VideoTextureLoader(mockGL());
  expect(loader.canLoad(makeVideo())).toBe(true);
  expect(loader.canLoad(null)).toBe(false);
  expect(loader.canLoad(undefined)).toBe(false);
  expect(loader.canLoad(0)).toBe(false);
  expect(loader.canLoad("foo")).toBe(false);
  expect(loader.canLoad({})).toBe(false);
});

test("inputHash is the video element itself and is idempotent", () => {
  const loader = new VideoTextureLoader(mockGL());
  const v = makeVideo();
  expect(loader.inputHash(v)).toBe(v);
  expect(loader.inputHash(v)).toBe(loader.inputHash(v));
});

test("loadNoCache resolves immediately when videoWidth is already set", async () => {
  const tex = { __id: "T" } as unknown as WebGLTexture;
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
  const loader = new VideoTextureLoader(gl);
  const v = makeVideo(640, 360);
  const result = await loader.load(v);
  expect(result.width).toBe(640);
  expect(result.height).toBe(360);
  expect(result.texture).toBe(tex);
  expect(binds).toEqual([[gl.TEXTURE_2D, tex]]);
  expect(uploads).toHaveLength(1);
  expect((uploads[0] as unknown[])[5]).toBe(v);
});

test("loadNoCache polls via setTimeout until videoWidth becomes positive", async () => {
  jest.useFakeTimers();
  try {
    const loader = new VideoTextureLoader(mockGL());
    const v = makeVideo(0, 0);
    const promise = loader.load(v);
    // First check sees 0 → schedules a timeout.
    expect(jest.getTimerCount()).toBe(1);
    // Make the video become "ready" then drive the polling loop forward.
    v.videoWidth = 128;
    v.videoHeight = 64;
    jest.advanceTimersByTime(100);
    // After the next tick the promise resolves with the new dims.
    const result = await promise;
    expect(result.width).toBe(128);
    expect(result.height).toBe(64);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test("loadNoCache.dispose clears a pending poll timeout", () => {
  jest.useFakeTimers();
  try {
    const loader = new VideoTextureLoader(mockGL());
    const v = makeVideo(0, 0);
    // Reach into the protected loadNoCache.
    const { dispose } = (
      loader as unknown as {
        loadNoCache: (input: HTMLVideoElement) => {
          promise: Promise<unknown>;
          dispose: () => void;
        };
      }
    ).loadNoCache(v);
    expect(jest.getTimerCount()).toBe(1);
    dispose();
    expect(jest.getTimerCount()).toBe(0);
    // Dispose before any timeout is scheduled is a no-op too.
    const { dispose: noopDispose } = (
      loader as unknown as {
        loadNoCache: (input: HTMLVideoElement) => {
          promise: Promise<unknown>;
          dispose: () => void;
        };
      }
    ).loadNoCache(makeVideo(2, 2));
    // videoWidth > 0 means no timer was ever set; calling dispose is safe.
    expect(jest.getTimerCount()).toBe(0);
    expect(() => noopDispose()).not.toThrow();
  } finally {
    jest.useRealTimers();
  }
});

test("update binds and re-uploads the video to the cached texture", async () => {
  const binds: [number, WebGLTexture][] = [];
  const uploads: unknown[] = [];
  const tex = { __id: "T" } as unknown as WebGLTexture;
  const gl = mockGL({
    createTexture: () => tex,
    bindTexture: ((target: number, t: WebGLTexture) => {
      binds.push([target, t]);
    }) as WebGLRenderingContext["bindTexture"],
    texImage2D: ((...args: unknown[]) => {
      uploads.push(args);
    }) as unknown as WebGLRenderingContext["texImage2D"],
  });
  const loader = new VideoTextureLoader(gl);
  const v = makeVideo(2, 2);
  await loader.load(v);
  binds.length = 0;
  uploads.length = 0;
  loader.update(v);
  expect(binds).toEqual([[gl.TEXTURE_2D, tex]]);
  expect(uploads).toHaveLength(1);
  expect((uploads[0] as unknown[])[5]).toBe(v);
});

test("update is a no-op when the video has not been loaded yet", () => {
  const binds: unknown[] = [];
  const uploads: unknown[] = [];
  const gl = mockGL({
    bindTexture: ((..._args: unknown[]) => {
      binds.push(_args);
    }) as WebGLRenderingContext["bindTexture"],
    texImage2D: ((..._args: unknown[]) => {
      uploads.push(_args);
    }) as unknown as WebGLRenderingContext["texImage2D"],
  });
  const loader = new VideoTextureLoader(gl);
  loader.update(makeVideo(1, 1));
  expect(binds).toEqual([]);
  expect(uploads).toEqual([]);
});

test("dispose deletes every cached texture", async () => {
  const deleted: WebGLTexture[] = [];
  let i = 0;
  const gl = mockGL({
    createTexture: () => ({ __id: i++ }) as unknown as WebGLTexture,
    deleteTexture: ((t: WebGLTexture) => {
      deleted.push(t);
    }) as WebGLRenderingContext["deleteTexture"],
  });
  const loader = new VideoTextureLoader(gl);
  const a = await loader.load(makeVideo(2, 2));
  const b = await loader.load(makeVideo(3, 3));
  loader.dispose();
  expect(deleted).toEqual([a.texture, b.texture]);
});
