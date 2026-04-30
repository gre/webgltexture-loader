import ImageSourceTextureLoader from "./ImageSourceTextureLoader.js";

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

test("canLoad accepts a numeric module id when the RN extension is available", () => {
  const loader = new ImageSourceTextureLoader(mockGLWithRN(makeRN()));
  expect(loader.canLoad(42)).toBe(true);
});

test("canLoad accepts an object with a string `uri`", () => {
  const loader = new ImageSourceTextureLoader(mockGLWithRN(makeRN()));
  expect(loader.canLoad({ uri: "https://example.com/img.png" })).toBe(true);
});

test("canLoad rejects objects without a string uri", () => {
  const loader = new ImageSourceTextureLoader(mockGLWithRN(makeRN()));
  expect(loader.canLoad({})).toBe(false);
  expect(loader.canLoad({ uri: 42 })).toBe(false);
  expect(loader.canLoad(null)).toBe(false);
});

test("canLoad rejects strings (not a valid ImageSource)", () => {
  const loader = new ImageSourceTextureLoader(mockGLWithRN(makeRN()));
  expect(loader.canLoad("foo")).toBe(false);
});

test("canLoad returns false when the RN extension is missing (any input)", () => {
  const loader = new ImageSourceTextureLoader(mockGL());
  expect(loader.canLoad(1)).toBe(false);
  expect(loader.canLoad({ uri: "x" })).toBe(false);
});

test("inputHash is the numeric id for a require() module", () => {
  const loader = new ImageSourceTextureLoader(mockGLWithRN(makeRN()));
  expect(loader.inputHash(7)).toBe(7);
  expect(loader.inputHash(7)).toBe(loader.inputHash(7));
});

test("inputHash is the uri for a remote/local file source", () => {
  const loader = new ImageSourceTextureLoader(mockGLWithRN(makeRN()));
  const src = { uri: "file:///cat.png" };
  expect(loader.inputHash(src)).toBe("file:///cat.png");
  expect(loader.inputHash(src)).toBe(loader.inputHash(src));
});

test("loadNoCache forwards { yflip:true, image } to rngl.loadTexture", async () => {
  const rngl = makeRN();
  const tex = { __id: "T" } as unknown as WebGLTexture;
  rngl.loadTexture.mockResolvedValue({ texture: tex, width: 4, height: 8 });
  const loader = new ImageSourceTextureLoader(mockGLWithRN(rngl));
  const result = await loader.load(123);
  expect(rngl.loadTexture).toHaveBeenCalledWith({ yflip: true, image: 123 });
  expect(result).toEqual({ texture: tex, width: 4, height: 8 });
});

test("loadNoCache forwards a uri-shaped image to rngl.loadTexture", async () => {
  const rngl = makeRN();
  rngl.loadTexture.mockResolvedValue({
    texture: {} as WebGLTexture,
    width: 1,
    height: 1,
  });
  const loader = new ImageSourceTextureLoader(mockGLWithRN(rngl));
  const src = { uri: "https://example.com/x.png" };
  await loader.load(src);
  expect(rngl.loadTexture).toHaveBeenCalledWith({ yflip: true, image: src });
});

test("loadNoCache rejects when the RN extension is missing", async () => {
  const loader = new ImageSourceTextureLoader(mockGL());
  await expect(loader.load(7)).rejects.toThrow(/RN.*not available/);
});

test("disposeTexture forwards to rngl.unloadTexture", () => {
  const rngl = makeRN();
  const loader = new ImageSourceTextureLoader(mockGLWithRN(rngl));
  const tex = {} as WebGLTexture;
  loader.disposeTexture(tex);
  expect(rngl.unloadTexture).toHaveBeenCalledWith(tex);
});

test("disposeTexture is safe when the RN extension is missing", () => {
  const loader = new ImageSourceTextureLoader(mockGL());
  expect(() => loader.disposeTexture({} as WebGLTexture)).not.toThrow();
});

test("loadNoCache returns a no-op dispose hook", () => {
  const rngl = makeRN();
  rngl.loadTexture.mockResolvedValue({
    texture: {} as WebGLTexture,
    width: 1,
    height: 1,
  });
  const loader = new ImageSourceTextureLoader(mockGLWithRN(rngl));
  const { dispose } = (
    loader as unknown as {
      loadNoCache: (input: number | { uri: string }) => {
        promise: Promise<unknown>;
        dispose: () => void;
      };
    }
  ).loadNoCache(1);
  expect(() => dispose()).not.toThrow();
});
