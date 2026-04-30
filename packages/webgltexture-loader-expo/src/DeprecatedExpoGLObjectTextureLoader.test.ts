// `DeprecatedExpoGLObjectTextureLoader.ts` reads `NativeModulesProxy` at
// import time to decide whether the loader is `available`. The mock state
// has to be set BEFORE the loader module is required, so each test that
// flips availability uses `jest.isolateModules` and re-mocks
// `expo-modules-core`. Mock the global registry and the WebGLTexture
// constructor too.
//
// We also save and restore any pre-existing `globalThis.WebGLTexture` so
// the global doesn't leak across other test files.

const WEBGL_TEXTURE_NOT_SET = Symbol("not-set");
let previousWebGLTexture: unknown = WEBGL_TEXTURE_NOT_SET;
beforeAll(() => {
  const g = globalThis as { WebGLTexture?: unknown };
  previousWebGLTexture = "WebGLTexture" in g ? g.WebGLTexture : WEBGL_TEXTURE_NOT_SET;
  // The loader does `new globalThis.WebGLTexture(exglObjId)` so install a
  // constructible polyfill that records the id.
  g.WebGLTexture = class WebGLTexture {
    id: number;
    constructor(id: number) {
      this.id = id;
    }
  };
});
afterAll(() => {
  const g = globalThis as { WebGLTexture?: unknown };
  if (previousWebGLTexture === WEBGL_TEXTURE_NOT_SET) {
    delete g.WebGLTexture;
  } else {
    g.WebGLTexture = previousWebGLTexture;
  }
});

const mockGL = (overrides: Partial<WebGLRenderingContext> = {}) =>
  ({
    deleteTexture: () => {},
    ...overrides,
  }) as unknown as WebGLRenderingContext;

const mockGLWithExglCtx = (exglCtxId = 11) =>
  ({
    deleteTexture: () => {},
    __exglCtxId: exglCtxId,
  }) as unknown as WebGLRenderingContext;

type Loader = typeof import("./DeprecatedExpoGLObjectTextureLoader.js").default;

interface CoreMock {
  NativeModulesProxy: {
    ExponentGLObjectManager?: {
      createObjectAsync?: jest.Mock;
      destroyObjectAsync?: jest.Mock;
    };
  };
}

const installCoreMock = (impl: CoreMock["NativeModulesProxy"]) => {
  jest.doMock("expo-modules-core", () => ({ NativeModulesProxy: impl }), { virtual: true });
};

const requireLoaderFresh = (impl: CoreMock["NativeModulesProxy"]): { Loader: Loader } => {
  let Loader!: Loader;
  jest.isolateModules(() => {
    installCoreMock(impl);
    Loader = require("./DeprecatedExpoGLObjectTextureLoader.js").default;
  });
  return { Loader };
};

afterEach(() => {
  jest.dontMock("expo-modules-core");
  jest.resetModules();
});

test("canLoad returns true for an object input when createObjectAsync is available", () => {
  const { Loader } = requireLoaderFresh({
    ExponentGLObjectManager: {
      createObjectAsync: jest.fn(),
      destroyObjectAsync: jest.fn(),
    },
  });
  const loader = new Loader(mockGL());
  expect(loader.canLoad({})).toBe(true);
});

test("canLoad returns false for null and primitives", () => {
  const { Loader } = requireLoaderFresh({
    ExponentGLObjectManager: {
      createObjectAsync: jest.fn(),
      destroyObjectAsync: jest.fn(),
    },
  });
  const loader = new Loader(mockGL());
  expect(loader.canLoad(null)).toBe(false);
  expect(loader.canLoad(undefined)).toBe(false);
  expect(loader.canLoad(42)).toBe(false);
  expect(loader.canLoad("foo")).toBe(false);
});

test("canLoad returns false when createObjectAsync is missing, and warns once", () => {
  const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
  try {
    const { Loader } = requireLoaderFresh({
      ExponentGLObjectManager: undefined,
    });
    const loader = new Loader(mockGL());
    expect(loader.canLoad({})).toBe(false);
    expect(loader.canLoad({})).toBe(false);
    // Module-level `warned` flag fires the debug only once.
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0]?.[0]).toMatch(/ExponentGLObjectManager/);
  } finally {
    debugSpy.mockRestore();
  }
});

test("priority is -200 (lowest fallback)", () => {
  const { Loader } = requireLoaderFresh({
    ExponentGLObjectManager: {
      createObjectAsync: jest.fn(),
      destroyObjectAsync: jest.fn(),
    },
  });
  expect(Loader.priority).toBe(-200);
});

test("inputHash is JSON.stringify(config) and is idempotent", () => {
  const { Loader } = requireLoaderFresh({
    ExponentGLObjectManager: {
      createObjectAsync: jest.fn(),
      destroyObjectAsync: jest.fn(),
    },
  });
  const loader = new Loader(mockGL());
  const cfg = { type: "x", value: 1 };
  expect(loader.inputHash(cfg)).toBe(JSON.stringify(cfg));
  expect(loader.inputHash(cfg)).toBe(loader.inputHash(cfg));
});

test("loadNoCache calls createObjectAsync with the GL ctx id and config, and produces a WebGLTexture", async () => {
  const createObjectAsync = jest.fn().mockResolvedValue({ exglObjId: 4242 });
  const destroyObjectAsync = jest.fn();
  const { Loader } = requireLoaderFresh({
    ExponentGLObjectManager: { createObjectAsync, destroyObjectAsync },
  });
  const loader = new Loader(mockGLWithExglCtx(11));
  const cfg = { type: "color", value: "#abcdef" };
  const result = await loader.load(cfg);
  expect(createObjectAsync).toHaveBeenCalledWith({ exglCtxId: 11, texture: cfg });
  expect((result.texture as { id: number }).id).toBe(4242);
  expect(result.width).toBe(0);
  expect(result.height).toBe(0);
});

test("loadNoCache rejects when createObjectAsync is unavailable at load time", async () => {
  // The loader was imported with createObjectAsync available (so canLoad
  // is true), but the function gets stripped before the actual load call.
  const createObjectAsync = jest.fn().mockResolvedValue({ exglObjId: 1 });
  const manager = {
    createObjectAsync: createObjectAsync as jest.Mock | undefined,
    destroyObjectAsync: jest.fn(),
  };
  const { Loader } = requireLoaderFresh({ ExponentGLObjectManager: manager });
  const loader = new Loader(mockGLWithExglCtx());
  // Strip createObjectAsync to simulate the runtime regression path.
  manager.createObjectAsync = undefined;
  await expect(loader.load({})).rejects.toThrow(/createObjectAsync not available/);
});

test("disposeTexture calls destroyObjectAsync with the recorded exglObjId", async () => {
  const createObjectAsync = jest.fn().mockResolvedValue({ exglObjId: 999 });
  const destroyObjectAsync = jest.fn();
  const { Loader } = requireLoaderFresh({
    ExponentGLObjectManager: { createObjectAsync, destroyObjectAsync },
  });
  const loader = new Loader(mockGLWithExglCtx());
  const { texture } = await loader.load({ a: 1 });
  loader.disposeTexture(texture);
  expect(destroyObjectAsync).toHaveBeenCalledWith(999);
});

test("disposeTexture is a silent no-op when the texture was never registered", () => {
  const createObjectAsync = jest.fn();
  const destroyObjectAsync = jest.fn();
  const { Loader } = requireLoaderFresh({
    ExponentGLObjectManager: { createObjectAsync, destroyObjectAsync },
  });
  const loader = new Loader(mockGLWithExglCtx());
  // Construct a texture the loader has no record of.
  const tex = new (
    globalThis as unknown as { WebGLTexture: new (id: number) => WebGLTexture }
  ).WebGLTexture(7);
  expect(() => loader.disposeTexture(tex)).not.toThrow();
  expect(destroyObjectAsync).not.toHaveBeenCalled();
});

test("a cancelled load drops the resolved result (never-ending)", async () => {
  let resolveCreate: (v: { exglObjId: number }) => void = () => {};
  const createObjectAsync = jest.fn(
    () =>
      new Promise<{ exglObjId: number }>((resolve) => {
        resolveCreate = resolve;
      }),
  );
  const destroyObjectAsync = jest.fn();
  const { Loader } = requireLoaderFresh({
    ExponentGLObjectManager: { createObjectAsync, destroyObjectAsync },
  });
  const loader = new Loader(mockGLWithExglCtx());
  const { promise, dispose } = (
    loader as unknown as {
      loadNoCache: (cfg: Record<string, unknown>) => {
        promise: Promise<unknown>;
        dispose: () => void;
      };
    }
  ).loadNoCache({ a: 1 });
  dispose();
  resolveCreate({ exglObjId: 1 });
  const winner = await Promise.race([
    promise.then(() => "resolved"),
    new Promise<string>((r) => setTimeout(() => r("timeout"), 10)),
  ]);
  expect(winner).toBe("timeout");
});
