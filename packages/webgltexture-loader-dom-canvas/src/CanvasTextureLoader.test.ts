// `CanvasTextureLoader` checks `input instanceof HTMLCanvasElement`. Node's
// default jest env has no DOM, so we install a minimal `HTMLCanvasElement`
// class on `globalThis` and restore it after the suite.
const HTML_CANVAS_NOT_SET = Symbol("not-set");
let previousHTMLCanvasElement: unknown = HTML_CANVAS_NOT_SET;
beforeAll(() => {
  const g = globalThis as { HTMLCanvasElement?: unknown };
  previousHTMLCanvasElement = "HTMLCanvasElement" in g ? g.HTMLCanvasElement : HTML_CANVAS_NOT_SET;
  if (typeof g.HTMLCanvasElement !== "function") {
    g.HTMLCanvasElement = class HTMLCanvasElement {
      width = 0;
      height = 0;
    };
  }
});
afterAll(() => {
  const g = globalThis as { HTMLCanvasElement?: unknown };
  if (previousHTMLCanvasElement === HTML_CANVAS_NOT_SET) {
    delete g.HTMLCanvasElement;
  } else {
    g.HTMLCanvasElement = previousHTMLCanvasElement;
  }
});

import CanvasTextureLoader from "./CanvasTextureLoader.js";

const HTMLCanvasElementCtor = () =>
  (globalThis as { HTMLCanvasElement: new () => HTMLCanvasElement }).HTMLCanvasElement;

const makeCanvas = (width = 256, height = 128): HTMLCanvasElement => {
  const c = new (HTMLCanvasElementCtor())();
  Object.assign(c, { width, height });
  return c;
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

test("canLoad returns true for an HTMLCanvasElement instance", () => {
  const loader = new CanvasTextureLoader(mockGL());
  expect(loader.canLoad(makeCanvas())).toBe(true);
});

test("canLoad returns false for non-canvas inputs", () => {
  const loader = new CanvasTextureLoader(mockGL());
  expect(loader.canLoad(null)).toBe(false);
  expect(loader.canLoad(undefined)).toBe(false);
  expect(loader.canLoad(42)).toBe(false);
  expect(loader.canLoad("foo")).toBe(false);
  expect(loader.canLoad({})).toBe(false);
});

test("inputHash is the canvas element itself and is idempotent", () => {
  const loader = new CanvasTextureLoader(mockGL());
  const c = makeCanvas();
  expect(loader.inputHash(c)).toBe(c);
  expect(loader.inputHash(c)).toBe(loader.inputHash(c));
});

test("getNoCache creates a texture, binds it, uploads pixels and reports the canvas size", () => {
  const created: WebGLTexture[] = [];
  const binds: [number, WebGLTexture][] = [];
  const uploads: unknown[] = [];
  const gl = mockGL({
    createTexture: () => {
      const t = { __id: created.length } as unknown as WebGLTexture;
      created.push(t);
      return t;
    },
    bindTexture: ((target: number, tex: WebGLTexture) => {
      binds.push([target, tex]);
    }) as WebGLRenderingContext["bindTexture"],
    texImage2D: ((...args: unknown[]) => {
      uploads.push(args);
    }) as unknown as WebGLRenderingContext["texImage2D"],
  });
  const loader = new CanvasTextureLoader(gl);
  const canvas = makeCanvas(640, 480);
  const result = loader.getNoCache(canvas);
  expect(result.width).toBe(640);
  expect(result.height).toBe(480);
  expect(result.texture).toBe(created[0]);
  expect(binds).toEqual([[gl.TEXTURE_2D, created[0]]]);
  expect(uploads).toHaveLength(1);
  // (target, level, internalFormat, format, type, source)
  const [target, level, internalFormat, format, type, source] = uploads[0] as unknown[];
  expect(target).toBe(gl.TEXTURE_2D);
  expect(level).toBe(0);
  expect(internalFormat).toBe(gl.RGBA);
  expect(format).toBe(gl.RGBA);
  expect(type).toBe(gl.UNSIGNED_BYTE);
  expect(source).toBe(canvas);
});

test("get caches: a second call returns the same TextureAndSize", () => {
  let createCalls = 0;
  const gl = mockGL({
    createTexture: () => {
      createCalls++;
      return {} as WebGLTexture;
    },
  });
  const loader = new CanvasTextureLoader(gl);
  const canvas = makeCanvas(8, 8);
  const a = loader.get(canvas);
  const b = loader.get(canvas);
  expect(a).toBe(b);
  expect(createCalls).toBe(1);
});

test("update binds and re-uploads the canvas to the cached texture", () => {
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
  const loader = new CanvasTextureLoader(gl);
  const canvas = makeCanvas(2, 2);
  loader.get(canvas);
  binds.length = 0;
  uploads.length = 0;
  loader.update(canvas);
  expect(binds).toEqual([[gl.TEXTURE_2D, tex]]);
  expect(uploads).toHaveLength(1);
  expect((uploads[0] as unknown[])[5]).toBe(canvas);
});

test("update on an un-loaded canvas creates the texture and uploads it (via get)", () => {
  // The sync hash cache's `get()` lazily creates the texture, so calling
  // `update()` on a fresh canvas implicitly triggers a load before
  // re-uploading. Both calls bind + upload, so we expect 2 of each.
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
  const loader = new CanvasTextureLoader(gl);
  const canvas = makeCanvas();
  loader.update(canvas);
  expect(binds).toHaveLength(2);
  expect(uploads).toHaveLength(2);
});

test("dispose deletes every cached texture", () => {
  const deleted: WebGLTexture[] = [];
  let i = 0;
  const gl = mockGL({
    createTexture: () => ({ __id: i++ }) as unknown as WebGLTexture,
    deleteTexture: ((t: WebGLTexture) => {
      deleted.push(t);
    }) as WebGLRenderingContext["deleteTexture"],
  });
  const loader = new CanvasTextureLoader(gl);
  const a = loader.get(makeCanvas(1, 1));
  const b = loader.get(makeCanvas(2, 2));
  loader.dispose();
  expect(deleted).toEqual([a.texture, b.texture]);
});
