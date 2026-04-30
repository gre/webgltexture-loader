// Mock the Expo peer-deps before importing the loader. They're declared as
// peerDependencies and not actually installed in this monorepo.
jest.mock(
  "expo-camera",
  () => ({
    Camera: class Camera {},
    // Modern (SDK 51+) class component. Real instances on SDK 54 carry a
    // private `_cameraRef = createRef()` whose `.current` is the actual
    // native handle; the loader unwraps to that before calling Expo's GL
    // bridge.
    CameraView: class CameraView {
      _cameraRef: { current: unknown } = { current: null };
    },
  }),
  { virtual: true },
);
jest.mock(
  "expo-modules-core",
  () => ({
    requireNativeModule: jest.fn(),
  }),
  { virtual: true },
);

import ExpoCameraTextureLoader from "./ExpoCameraTextureLoader.js";

const ExpoModulesCoreMock = jest.requireMock<{
  requireNativeModule: jest.Mock;
}>("expo-modules-core");

/**
 * Configure `requireNativeModule("ExponentGLObjectManager")` to return a
 * fake manager. Returns the mocks so individual tests can assert on calls.
 */
const installFakeNativeModule = (firstExglObjId = 1001) => {
  let nextId = firstExglObjId;
  const createCameraTextureAsync = jest.fn(() => Promise.resolve({ exglObjId: nextId++ }));
  const destroyObjectAsync = jest.fn(() => Promise.resolve());
  ExpoModulesCoreMock.requireNativeModule.mockImplementation((name: string) => {
    if (name === "ExponentGLObjectManager") {
      return { createCameraTextureAsync, destroyObjectAsync };
    }
    throw new Error(`unexpected requireNativeModule call: ${name}`);
  });
  return { createCameraTextureAsync, destroyObjectAsync };
};

beforeEach(() => {
  ExpoModulesCoreMock.requireNativeModule.mockReset();
});

const mockGL = () =>
  ({
    deleteTexture: () => {},
    getExtension: () => null,
  }) as unknown as WebGLRenderingContext;

/** GL whose `GLViewRef` extension exposes a fake `exglCtxId` (older SDKs). */
const mockGLWithExtension = (exglCtxId = 11) =>
  ({
    deleteTexture: () => {},
    getExtension: (name: string) => (name === "GLViewRef" ? { exglCtxId } : null),
  }) as unknown as WebGLRenderingContext;

/** GL with `contextId` set directly on the context (SDK 54+ public API). */
const mockGLWithContextId = (contextId = 11) =>
  ({
    contextId,
    deleteTexture: () => {},
    getExtension: () => null,
  }) as unknown as WebGLRenderingContext;

/** GL with `__exglCtxId` set directly on the context (older internal API). */
const mockGLWithDunderExgl = (id = 11) =>
  ({
    __exglCtxId: id,
    deleteTexture: () => {},
    getExtension: () => null,
  }) as unknown as WebGLRenderingContext;

// Many tests construct synthetic textures via `new WebGLTexture()`. Node
// has no such constructor, so install a minimal one on `globalThis`. The
// loader reads `globalThis.WebGLTexture` directly to sidestep DOM types
// (which type WebGLTexture as a non-constructible interface). We save and
// restore any pre-existing value so the global doesn't leak across other
// test files (jsdom envs may already provide their own WebGLTexture).
const WEBGL_TEXTURE_NOT_SET = Symbol("not-set");
let previousWebGLTexture: unknown = WEBGL_TEXTURE_NOT_SET;
beforeAll(() => {
  const g = globalThis as { WebGLTexture?: unknown };
  previousWebGLTexture = "WebGLTexture" in g ? g.WebGLTexture : WEBGL_TEXTURE_NOT_SET;
  if (typeof g.WebGLTexture !== "function") {
    g.WebGLTexture = class WebGLTexture {};
  }
});
afterAll(() => {
  const g = globalThis as { WebGLTexture?: unknown };
  if (previousWebGLTexture === WEBGL_TEXTURE_NOT_SET) {
    delete g.WebGLTexture;
  } else {
    g.WebGLTexture = previousWebGLTexture;
  }
});

test("canLoad rejects primitives", () => {
  const loader = new ExpoCameraTextureLoader(mockGL());
  expect(loader.canLoad(null)).toBe(false);
  expect(loader.canLoad(42)).toBe(false);
  expect(loader.canLoad("foo")).toBe(false);
  // Plain object with none of the duck-typed markers.
  expect(loader.canLoad({})).toBe(false);
});

test("canLoad accepts a duck-typed object with _nativeTag", () => {
  const loader = new ExpoCameraTextureLoader(mockGL());
  expect(loader.canLoad({ _nativeTag: 123 })).toBe(true);
});

test("canLoad accepts a duck-typed object with nativeTag (SDK 54+)", () => {
  const loader = new ExpoCameraTextureLoader(mockGL());
  expect(loader.canLoad({ nativeTag: 224 })).toBe(true);
});

test("canLoad accepts a duck-typed object with __internalInstanceHandle", () => {
  const loader = new ExpoCameraTextureLoader(mockGL());
  expect(loader.canLoad({ __internalInstanceHandle: {} })).toBe(true);
});

// Pull the mocked `Camera` / `CameraView` classes the loader sees, via
// `jest.requireMock` so we hit the same module identity. Instances do not
// have `_nativeTag` / `__internalInstanceHandle` / `getNativeRef`, so they
// exercise the `instanceof` back-compat / modern paths.
const ExpoCameraMock = jest.requireMock<{
  Camera: new () => unknown;
  CameraView: new () => { _cameraRef: { current: unknown } };
}>("expo-camera");
const MockedCamera = ExpoCameraMock.Camera;
const MockedCameraView = ExpoCameraMock.CameraView;

test("canLoad accepts a legacy Camera class instance (SDK <= 50)", () => {
  const legacyInstance = new MockedCamera();
  const loader = new ExpoCameraTextureLoader(mockGL());
  expect(loader.canLoad(legacyInstance)).toBe(true);
});

test("canLoad accepts a modern CameraView class instance (SDK 51+)", () => {
  // Real SDK 54 instance shape: no `_nativeTag` / `__internalInstanceHandle`
  // / `getNativeRef`; only the private `_cameraRef`. None of the duck-typed
  // branches match — only the `instanceof CameraView` branch saves us.
  const cameraView = new MockedCameraView();
  cameraView._cameraRef = { current: { nativeTag: 224 } };
  const loader = new ExpoCameraTextureLoader(mockGL());
  expect(loader.canLoad(cameraView)).toBe(true);
});

test("canLoad accepts the { camera, width, height } wrapper shape", () => {
  const loader = new ExpoCameraTextureLoader(mockGL());
  const camera = { _nativeTag: 42 };
  expect(loader.canLoad({ camera, width: 1280, height: 720 })).toBe(true);
});

test("inputHash is idempotent for the same ref", () => {
  const loader = new ExpoCameraTextureLoader(mockGL());
  const ref = { _nativeTag: 1 };
  const h1 = loader.inputHash(ref);
  const h2 = loader.inputHash(ref);
  expect(h1).toBe(h2);
  // The wrapper shape unwraps to the same ref, so it hashes the same.
  expect(loader.inputHash({ camera: ref, width: 640, height: 480 })).toBe(h1);
});

test("inputHash returns different values for different refs", () => {
  const loader = new ExpoCameraTextureLoader(mockGL());
  const a = { _nativeTag: 1 };
  const b = { _nativeTag: 2 };
  expect(loader.inputHash(a)).not.toBe(loader.inputHash(b));
});

test("inputHash is idempotent across the CameraView wrapper", () => {
  // Two calls with the same CameraView wrapper must produce the same hash —
  // the unwrap step keys on `_cameraRef.current`, not the wrapper identity.
  const loader = new ExpoCameraTextureLoader(mockGL());
  const cameraView = new MockedCameraView();
  cameraView._cameraRef = { current: { _nativeTag: 224 } };
  const h1 = loader.inputHash(cameraView);
  const h2 = loader.inputHash(cameraView);
  expect(h1).toBe(h2);
});

test("inputHash treats CameraView and its inner native ref as equivalent", () => {
  // The whole point of unwrapping inside `inputHash`: the WeakMap-based
  // hash counter MUST key on the native ref, otherwise dispose / cache
  // invariants get desynced when callers pass the wrapper in one place
  // and the unwrapped ref in another.
  const loader = new ExpoCameraTextureLoader(mockGL());
  const nativeRef = { _nativeTag: 224 };
  const cameraView = new MockedCameraView();
  cameraView._cameraRef = { current: nativeRef };
  expect(loader.inputHash(cameraView)).toBe(loader.inputHash(nativeRef));
});

test("loadNoCache resolves with a texture carrying the native exglObjId", async () => {
  const { createCameraTextureAsync } = installFakeNativeModule(1001);
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(11));
  const camera = { nativeTag: 224 };
  const result = await loader.load({ camera, width: 1280, height: 720 });
  // Native module called with the GL context id and host-component tag.
  expect(createCameraTextureAsync).toHaveBeenCalledWith(11, 224);
  expect((result.texture as { id?: number }).id).toBe(1001);
  expect(result.texture).toBeInstanceOf(
    (globalThis as { WebGLTexture: new () => WebGLTexture }).WebGLTexture,
  );
  expect(result.width).toBe(1280);
  expect(result.height).toBe(720);
});

test("loadNoCache accepts the legacy `_nativeTag` field", async () => {
  const { createCameraTextureAsync } = installFakeNativeModule(2002);
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(7));
  const camera = { _nativeTag: 99 };
  await loader.load(camera);
  expect(createCameraTextureAsync).toHaveBeenCalledWith(7, 99);
});

test("loadNoCache resolves the tag through `getNativeRef()`", async () => {
  // Some SDKs only expose the native ref via a method; resolveCameraTag
  // must call it and read the tag off the returned object.
  const { createCameraTextureAsync } = installFakeNativeModule(3003);
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(11));
  const inner = { nativeTag: 444 };
  const camera = { getNativeRef: () => inner };
  await loader.load({ camera, width: 1, height: 1 });
  expect(createCameraTextureAsync).toHaveBeenCalledWith(11, 444);
});

test("loadNoCache resolves via gl.contextId on SDK 54+", async () => {
  // SDK 54 stops shipping the GLViewRef extension and exposes the EXGL
  // context id directly as `gl.contextId` instead.
  const { createCameraTextureAsync } = installFakeNativeModule(4004);
  const loader = new ExpoCameraTextureLoader(mockGLWithContextId(54));
  await loader.load({ camera: { nativeTag: 17 }, width: 1, height: 1 });
  expect(createCameraTextureAsync).toHaveBeenCalledWith(54, 17);
});

test("loadNoCache resolves via gl.__exglCtxId fallback", async () => {
  // Some older internal expo-gl builds put the id on `gl.__exglCtxId`
  // instead of either `contextId` or the GLViewRef extension.
  const { createCameraTextureAsync } = installFakeNativeModule(5005);
  const loader = new ExpoCameraTextureLoader(mockGLWithDunderExgl(33));
  await loader.load({ camera: { nativeTag: 8 }, width: 1, height: 1 });
  expect(createCameraTextureAsync).toHaveBeenCalledWith(33, 8);
});

test("loadNoCache rejects when no path exposes the EXGL context id", async () => {
  installFakeNativeModule();
  const loader = new ExpoCameraTextureLoader(mockGL());
  const camera = { nativeTag: 224 };
  await expect(loader.load({ camera, width: 1, height: 1 })).rejects.toThrow(/EXGL context id/);
});

test("loadNoCache rejects when GLViewRef returns a non-numeric exglCtxId", async () => {
  installFakeNativeModule();
  // Some misconfigured envs hand back the extension object without an
  // exglCtxId; the bridge would otherwise be invoked with `undefined`.
  const gl = {
    deleteTexture: () => {},
    getExtension: (name: string) => (name === "GLViewRef" ? {} : null),
  } as unknown as WebGLRenderingContext;
  const loader = new ExpoCameraTextureLoader(gl);
  await expect(loader.load({ camera: { nativeTag: 1 }, width: 1, height: 1 })).rejects.toThrow(
    /exglCtxId/,
  );
});

test("loadNoCache rejects when the camera ref has no native tag", async () => {
  installFakeNativeModule();
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(11));
  // CameraView whose unwrapped inner ref carries neither `nativeTag` nor
  // `_nativeTag`. The loader still recognises it via `instanceof`, but
  // `loadNoCache` cannot resolve a tag and must reject.
  const cameraView = new MockedCameraView();
  cameraView._cameraRef = { current: { __internalInstanceHandle: {} } };
  await expect(loader.load({ camera: cameraView, width: 1, height: 1 })).rejects.toThrow(
    /native(Tag| React Native tag)/,
  );
});

test("disposeTexture forwards the exglObjId to the native module", async () => {
  const { destroyObjectAsync } = installFakeNativeModule(4242);
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(11));
  const camera = { nativeTag: 1 };
  const { texture } = await loader.load({ camera, width: 1, height: 1 });
  loader.disposeTexture(texture);
  expect(destroyObjectAsync).toHaveBeenCalledWith(4242);
});

test("disposeTexture is best-effort when the native module is unavailable", async () => {
  // First load to register an exglObjId for the texture.
  installFakeNativeModule(7);
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(11));
  const { texture } = await loader.load({ camera: { nativeTag: 1 }, width: 1, height: 1 });
  // Then make `requireNativeModule` throw, dispose must not propagate.
  ExpoModulesCoreMock.requireNativeModule.mockImplementation(() => {
    throw new Error("native module missing");
  });
  expect(() => loader.disposeTexture(texture)).not.toThrow();
});

test("disposeTexture swallows async rejections from destroyObjectAsync", async () => {
  // Replace the manager so the destroy promise rejects.
  const destroyObjectAsync = jest.fn(() => Promise.reject(new Error("boom")));
  const createCameraTextureAsync = jest.fn(() => Promise.resolve({ exglObjId: 88 }));
  ExpoModulesCoreMock.requireNativeModule.mockImplementation(() => ({
    createCameraTextureAsync,
    destroyObjectAsync,
  }));
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(11));
  const { texture } = await loader.load({ camera: { nativeTag: 1 }, width: 1, height: 1 });
  // Listen for unhandled rejections; dispose must not produce one.
  const unhandled = jest.fn();
  process.on("unhandledRejection", unhandled);
  try {
    loader.disposeTexture(texture);
    // Flush microtasks so the rejected promise has a chance to surface.
    await new Promise((resolve) => setImmediate(resolve));
    expect(destroyObjectAsync).toHaveBeenCalledWith(88);
    expect(unhandled).not.toHaveBeenCalled();
  } finally {
    process.off("unhandledRejection", unhandled);
  }
});

test("loadNoCache rejects when requireNativeModule throws synchronously", async () => {
  ExpoModulesCoreMock.requireNativeModule.mockImplementation(() => {
    throw new Error("ExponentGLObjectManager not registered");
  });
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(11));
  // The bridge never gets called and we get a proper rejection rather than
  // a synchronous throw out of loadNoCache.
  await expect(loader.load({ camera: { nativeTag: 1 }, width: 1, height: 1 })).rejects.toThrow(
    /ExponentGLObjectManager/,
  );
});

test("a cancelled load destroys the EXGL object once it resolves", async () => {
  // Defer the createCameraTextureAsync resolution so we can call dispose
  // between load() and the bridge response. Without the cleanup hook this
  // would leak the native EXGL object created on the GPU.
  let resolveCreate: (v: { exglObjId: number }) => void = () => {};
  const createCameraTextureAsync = jest.fn(
    () => new Promise<{ exglObjId: number }>((resolve) => (resolveCreate = resolve)),
  );
  const destroyObjectAsync = jest.fn(() => Promise.resolve());
  ExpoModulesCoreMock.requireNativeModule.mockImplementation(() => ({
    createCameraTextureAsync,
    destroyObjectAsync,
  }));
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension(11));
  // Reach into the protected loadNoCache to grab the dispose hook directly.
  const camera = { nativeTag: 1 };
  const { promise, dispose } = (
    loader as unknown as {
      loadNoCache: (input: { camera: { nativeTag: number }; width: number; height: number }) => {
        promise: Promise<unknown>;
        dispose: () => void;
      };
    }
  ).loadNoCache({ camera, width: 1, height: 1 });
  dispose();
  resolveCreate({ exglObjId: 555 });
  // Race the never-ending promise against a microtask drain so the test
  // doesn't hang. The destroy call must have fired regardless.
  await Promise.race([promise, new Promise((r) => setImmediate(r))]);
  expect(destroyObjectAsync).toHaveBeenCalledWith(555);
});

test("load returns the explicit width/height when given the wrapper shape", async () => {
  installFakeNativeModule();
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension());
  const camera = { _nativeTag: 7 };
  const result = await loader.load({ camera, width: 1280, height: 720 });
  expect(result.width).toBe(1280);
  expect(result.height).toBe(720);
});

test("load returns 0/0 dimensions when given a bare ref", async () => {
  installFakeNativeModule();
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension());
  const camera = { _nativeTag: 8 };
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const result = await loader.load(camera);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  } finally {
    warn.mockRestore();
  }
});

test("the missing-dimensions warning fires exactly once per loader", async () => {
  installFakeNativeModule();
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension());
  const a = { _nativeTag: 9 };
  const b = { _nativeTag: 10 };
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    await loader.load(a);
    await loader.load(b);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/webgltexture-loader-expo-camera/);
  } finally {
    warn.mockRestore();
  }
});

test("the warning does not fire when callers provide explicit dimensions", async () => {
  installFakeNativeModule();
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension());
  const camera = { _nativeTag: 11 };
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    await loader.load({ camera, width: 800, height: 600 });
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});

test("explicit dimensions on a re-load update a previously cached 0/0 result", async () => {
  installFakeNativeModule();
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension());
  const camera = { _nativeTag: 12 };
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const first = await loader.load(camera);
    expect(first.width).toBe(0);
    expect(first.height).toBe(0);
    const second = await loader.load({ camera, width: 1920, height: 1080 });
    expect(second.width).toBe(1920);
    expect(second.height).toBe(1080);
    // The cached entry returned by `get` reflects the updated dimensions too.
    const cached = loader.get(camera);
    expect(cached?.width).toBe(1920);
    expect(cached?.height).toBe(1080);
  } finally {
    warn.mockRestore();
  }
});
