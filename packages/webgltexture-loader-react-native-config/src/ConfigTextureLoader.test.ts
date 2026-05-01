import ConfigTextureLoader from "./ConfigTextureLoader.js";

interface RNGLExtension {
  loadTexture: jest.Mock;
  unloadTexture: jest.Mock;
}

const mockGL = (overrides: Partial<WebGLRenderingContext> = {}) =>
  ({
    deleteTexture: () => {},
    getExtension: () => null,
    ...overrides,
  }) as unknown as WebGLRenderingContext;

const mockGLWithRN = (rngl: RNGLExtension) =>
  mockGL({
    getExtension: ((name: string) => (name === "RN" ? rngl : null)) as (
      name: string,
    ) => unknown as WebGLRenderingContext["getExtension"],
  } as unknown as Partial<WebGLRenderingContext>);

const makeRN = (): RNGLExtension => ({
  loadTexture: jest.fn(),
  unloadTexture: jest.fn(),
});

test("priority is -100 (fallback loader)", () => {
  expect(ConfigTextureLoader.priority).toBe(-100);
});

test("canLoad returns true for any object when the RN extension is available", () => {
  const loader = new ConfigTextureLoader(mockGLWithRN(makeRN()));
  expect(loader.canLoad({})).toBe(true);
  expect(loader.canLoad({ foo: "bar" })).toBe(true);
});

test("canLoad rejects primitives even with the RN extension", () => {
  const loader = new ConfigTextureLoader(mockGLWithRN(makeRN()));
  expect(loader.canLoad(null)).toBe(false);
  expect(loader.canLoad(undefined)).toBe(false);
  expect(loader.canLoad(0)).toBe(false);
  expect(loader.canLoad("foo")).toBe(false);
});

test("canLoad returns false when the RN extension is missing", () => {
  const loader = new ConfigTextureLoader(mockGL());
  expect(loader.canLoad({})).toBe(false);
});

test("inputHash is the JSON-stringified config and is idempotent", () => {
  const loader = new ConfigTextureLoader(mockGLWithRN(makeRN()));
  const cfg = { a: 1, b: 2 };
  expect(loader.inputHash(cfg)).toBe(JSON.stringify(cfg));
  expect(loader.inputHash(cfg)).toBe(loader.inputHash(cfg));
});

test("loadNoCache forwards the config to rngl.loadTexture and resolves with its result", async () => {
  const rngl = makeRN();
  const tex = { __id: "T" } as unknown as WebGLTexture;
  rngl.loadTexture.mockResolvedValue({ texture: tex, width: 16, height: 32 });
  const loader = new ConfigTextureLoader(mockGLWithRN(rngl));
  const cfg = { kind: "color", value: "#ff00ff" };
  const result = await loader.load(cfg);
  expect(rngl.loadTexture).toHaveBeenCalledWith(cfg);
  expect(result).toEqual({ texture: tex, width: 16, height: 32 });
});

test("loadNoCache rejects when the RN extension is missing", async () => {
  const loader = new ConfigTextureLoader(mockGL());
  await expect(loader.load({ any: true })).rejects.toThrow(/RN.*not available/);
});

test("disposeTexture forwards to rngl.unloadTexture", () => {
  const rngl = makeRN();
  const loader = new ConfigTextureLoader(mockGLWithRN(rngl));
  const tex = { __id: "T" } as unknown as WebGLTexture;
  loader.disposeTexture(tex);
  expect(rngl.unloadTexture).toHaveBeenCalledWith(tex);
});

test("disposeTexture is safe when the RN extension is missing", () => {
  const loader = new ConfigTextureLoader(mockGL());
  const tex = { __id: "T" } as unknown as WebGLTexture;
  expect(() => loader.disposeTexture(tex)).not.toThrow();
});

test("dispose calls unloadTexture for each cached texture", async () => {
  const rngl = makeRN();
  const texA = { __id: "A" } as unknown as WebGLTexture;
  const texB = { __id: "B" } as unknown as WebGLTexture;
  rngl.loadTexture
    .mockResolvedValueOnce({ texture: texA, width: 1, height: 1 })
    .mockResolvedValueOnce({ texture: texB, width: 2, height: 2 });
  const loader = new ConfigTextureLoader(mockGLWithRN(rngl));
  await loader.load({ a: 1 });
  await loader.load({ b: 2 });
  loader.dispose();
  expect(rngl.unloadTexture).toHaveBeenCalledTimes(2);
  expect(rngl.unloadTexture).toHaveBeenCalledWith(texA);
  expect(rngl.unloadTexture).toHaveBeenCalledWith(texB);
});

test("loadNoCache returns a no-op dispose handle", () => {
  const rngl = makeRN();
  rngl.loadTexture.mockResolvedValue({
    texture: {} as WebGLTexture,
    width: 1,
    height: 1,
  });
  const loader = new ConfigTextureLoader(mockGLWithRN(rngl));
  const { dispose } = (
    loader as unknown as {
      loadNoCache: (cfg: Record<string, unknown>) => {
        promise: Promise<unknown>;
        dispose: () => void;
      };
    }
  ).loadNoCache({});
  expect(() => dispose()).not.toThrow();
});
