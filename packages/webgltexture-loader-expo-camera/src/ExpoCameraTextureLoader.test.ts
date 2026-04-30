// Mock the Expo peer-deps before importing the loader. They're declared as
// peerDependencies and not actually installed in this monorepo.
jest.mock(
  "expo-camera",
  () => ({
    Camera: class Camera {},
  }),
  { virtual: true },
);
jest.mock(
  "expo-modules-core",
  () => ({
    NativeModulesProxy: {},
  }),
  { virtual: true },
);

import ExpoCameraTextureLoader from "./ExpoCameraTextureLoader.js";

const mockGL = () =>
  ({
    deleteTexture: () => {},
    getExtension: () => null,
  }) as unknown as WebGLRenderingContext;

/** GL with a fake `GLViewRef.createCameraTextureAsync` so `loadNoCache` resolves. */
const mockGLWithExtension = () => {
  let nextId = 1;
  return {
    deleteTexture: () => {},
    getExtension: (name: string) =>
      name === "GLViewRef"
        ? {
            createCameraTextureAsync: () =>
              Promise.resolve({ exglObjId: nextId++ } as unknown as WebGLTexture & {
                exglObjId: number;
              }),
          }
        : null,
  } as unknown as WebGLRenderingContext;
};

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

test("canLoad accepts a duck-typed object with __internalInstanceHandle", () => {
  const loader = new ExpoCameraTextureLoader(mockGL());
  expect(loader.canLoad({ __internalInstanceHandle: {} })).toBe(true);
});

// Pull the mocked `Camera` class the loader sees, via `jest.requireMock`
// so we hit the same module identity. Instances do not have `_nativeTag` /
// `__internalInstanceHandle` / `getNativeRef`, so this exercises the
// `instanceof` back-compat path.
const MockedCamera = jest.requireMock<{ Camera: new () => unknown }>("expo-camera").Camera;

test("canLoad accepts a legacy Camera class instance (SDK <= 50)", () => {
  const legacyInstance = new MockedCamera();
  const loader = new ExpoCameraTextureLoader(mockGL());
  expect(loader.canLoad(legacyInstance)).toBe(true);
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

test("load returns the explicit width/height when given the wrapper shape", async () => {
  const loader = new ExpoCameraTextureLoader(mockGLWithExtension());
  const camera = { _nativeTag: 7 };
  const result = await loader.load({ camera, width: 1280, height: 720 });
  expect(result.width).toBe(1280);
  expect(result.height).toBe(720);
});

test("load returns 0/0 dimensions when given a bare ref", async () => {
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
