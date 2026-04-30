// Mock the expo-asset / react-native peer-deps before importing the loader.
// They're declared as peerDependencies and not installed in this monorepo.
jest.mock(
  "expo-asset",
  () => ({
    Asset: {
      fromModule: jest.fn(),
      loadAsync: jest.fn(),
    },
  }),
  { virtual: true },
);
jest.mock(
  "react-native",
  () => ({
    Image: {
      getSize: jest.fn(),
    },
  }),
  { virtual: true },
);

import ExpoModuleTextureLoader, { loadAsset } from "./ExpoModuleTextureLoader.js";

const ExpoAssetMock = jest.requireMock<{
  Asset: { fromModule: jest.Mock; loadAsync: jest.Mock };
}>("expo-asset");
const RNMock = jest.requireMock<{ Image: { getSize: jest.Mock } }>("react-native");

beforeEach(() => {
  ExpoAssetMock.Asset.fromModule.mockReset();
  ExpoAssetMock.Asset.loadAsync.mockReset();
  RNMock.Image.getSize.mockReset();
});

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

test("canLoad accepts a numeric module id", () => {
  const loader = new ExpoModuleTextureLoader(mockGL());
  expect(loader.canLoad(42)).toBe(true);
});

test("canLoad accepts an object with a string `uri`", () => {
  const loader = new ExpoModuleTextureLoader(mockGL());
  expect(loader.canLoad({ uri: "file:///x.png" })).toBe(true);
});

test("canLoad rejects null / undefined / strings / objects without uri", () => {
  const loader = new ExpoModuleTextureLoader(mockGL());
  expect(loader.canLoad(null)).toBe(false);
  expect(loader.canLoad(undefined)).toBe(false);
  expect(loader.canLoad("foo")).toBe(false);
  expect(loader.canLoad({})).toBe(false);
  expect(loader.canLoad({ uri: 123 })).toBe(false);
});

test("inputHash is the numeric id for a require() module", () => {
  const loader = new ExpoModuleTextureLoader(mockGL());
  expect(loader.inputHash(7)).toBe(7);
});

test("inputHash is the uri for a uri-shaped source", () => {
  const loader = new ExpoModuleTextureLoader(mockGL());
  expect(loader.inputHash({ uri: "https://example.com/x.png" } as { uri: string })).toBe(
    "https://example.com/x.png",
  );
});

describe("loadAsset", () => {
  test("numeric module id is downloaded via Asset.fromModule().downloadAsync()", async () => {
    const downloadAsync = jest.fn().mockResolvedValue({
      width: 100,
      height: 50,
      uri: "file:///cached.png",
      localUri: "file:///cached.png",
    });
    ExpoAssetMock.Asset.fromModule.mockReturnValue({ downloadAsync });
    const asset = await loadAsset(123);
    expect(ExpoAssetMock.Asset.fromModule).toHaveBeenCalledWith(123);
    expect(downloadAsync).toHaveBeenCalled();
    expect(asset.width).toBe(100);
    expect(asset.height).toBe(50);
  });

  test("pre-resolved asset with concrete dimensions is returned as-is", async () => {
    const input = {
      uri: "file:///x.png",
      width: 300,
      height: 200,
      localUri: "file:///x.png",
    };
    const asset = await loadAsset(input);
    expect(asset).toBe(input);
    // No expo-asset / Image bridge calls.
    expect(ExpoAssetMock.Asset.fromModule).not.toHaveBeenCalled();
    expect(ExpoAssetMock.Asset.loadAsync).not.toHaveBeenCalled();
    expect(RNMock.Image.getSize).not.toHaveBeenCalled();
  });

  test("pre-resolved local file with missing dimensions is measured via Image.getSize", async () => {
    RNMock.Image.getSize.mockImplementation(
      (_uri: string, success: (w: number, h: number) => void, _failure: (e: unknown) => void) => {
        success(64, 32);
      },
    );
    const input = {
      uri: "file:///measured.png",
      localUri: "file:///measured.png",
      width: null as number | null,
      height: null as number | null,
    };
    const asset = await loadAsset(input);
    expect(RNMock.Image.getSize).toHaveBeenCalledWith(
      "file:///measured.png",
      expect.any(Function),
      expect.any(Function),
    );
    expect(asset.width).toBe(64);
    expect(asset.height).toBe(32);
  });

  test("bare uri downloads via Asset.loadAsync then measures via Image.getSize", async () => {
    const downloadedAsset = {
      uri: "https://example.com/x.png",
      localUri: "file:///downloaded.png",
      width: null,
      height: null,
    };
    ExpoAssetMock.Asset.loadAsync.mockResolvedValue([downloadedAsset]);
    RNMock.Image.getSize.mockImplementation(
      (_uri: string, success: (w: number, h: number) => void, _failure: (e: unknown) => void) => {
        success(800, 600);
      },
    );
    const asset = await loadAsset({ uri: "https://example.com/x.png" } as {
      uri: string;
    });
    expect(ExpoAssetMock.Asset.loadAsync).toHaveBeenCalledWith("https://example.com/x.png");
    expect(RNMock.Image.getSize).toHaveBeenCalledWith(
      "file:///downloaded.png",
      expect.any(Function),
      expect.any(Function),
    );
    expect(asset.width).toBe(800);
    expect(asset.height).toBe(600);
  });

  test("bare uri falls back to asset.uri when localUri is absent", async () => {
    const downloadedAsset = {
      uri: "https://example.com/y.png",
      localUri: null,
      width: null,
      height: null,
    };
    ExpoAssetMock.Asset.loadAsync.mockResolvedValue([downloadedAsset]);
    RNMock.Image.getSize.mockImplementation(
      (_uri: string, success: (w: number, h: number) => void, _failure: (e: unknown) => void) => {
        success(20, 10);
      },
    );
    await loadAsset({ uri: "https://example.com/y.png" } as { uri: string });
    expect(RNMock.Image.getSize).toHaveBeenCalledWith(
      "https://example.com/y.png",
      expect.any(Function),
      expect.any(Function),
    );
  });

  test("bare uri throws when Asset.loadAsync returns no asset", async () => {
    ExpoAssetMock.Asset.loadAsync.mockResolvedValue([]);
    await expect(loadAsset({ uri: "bad://nope" } as { uri: string })).rejects.toThrow(/no asset/);
  });

  test("Image.getSize failure rejects with a wrapped Error", async () => {
    RNMock.Image.getSize.mockImplementation(
      (_uri: string, _success: (w: number, h: number) => void, failure: (e: unknown) => void) => {
        failure(new Error("boom"));
      },
    );
    await expect(
      loadAsset({
        uri: "file:///x.png",
        localUri: "file:///x.png",
        width: null,
        height: null,
      }),
    ).rejects.toThrow(/Image.getSize failed/);
  });
});

test("loadNoCache resolves with a texture, the asset's dimensions, and uploads to GL", async () => {
  ExpoAssetMock.Asset.fromModule.mockReturnValue({
    downloadAsync: jest.fn().mockResolvedValue({
      width: 320,
      height: 240,
      uri: "file:///x.png",
      localUri: "file:///x.png",
    }),
  });
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
  const loader = new ExpoModuleTextureLoader(gl);
  const result = await loader.load(7);
  expect(result.width).toBe(320);
  expect(result.height).toBe(240);
  expect(result.texture).toBe(tex);
  expect(binds).toEqual([[gl.TEXTURE_2D, tex]]);
  expect(uploads).toHaveLength(1);
  // Width/height get passed positionally for the Expo-shim signature.
  const args = uploads[0] as unknown[];
  expect(args[0]).toBe(gl.TEXTURE_2D);
  expect(args[3]).toBe(320);
  expect(args[4]).toBe(240);
});

test("loadNoCache throws when the asset has no dimensions", async () => {
  ExpoAssetMock.Asset.fromModule.mockReturnValue({
    downloadAsync: jest.fn().mockResolvedValue({
      width: null,
      height: null,
      uri: "file:///bad.png",
      localUri: "file:///bad.png",
    }),
  });
  const loader = new ExpoModuleTextureLoader(mockGL());
  await expect(loader.load(99)).rejects.toThrow(/no dimensions/);
});

test("dispose during a pending load drops the resolved result", async () => {
  // Defer the asset download so we can dispose between load() and resolution.
  let resolveAsset: (
    asset: {
      width: number;
      height: number;
      uri: string;
      localUri: string;
    } | null,
  ) => void = () => {};
  ExpoAssetMock.Asset.fromModule.mockReturnValue({
    downloadAsync: () =>
      new Promise((resolve) => {
        resolveAsset = resolve as typeof resolveAsset;
      }),
  });
  const loader = new ExpoModuleTextureLoader(mockGL());
  // Reach into protected loadNoCache to grab the dispose hook.
  const { promise, dispose } = (
    loader as unknown as {
      loadNoCache: (input: number) => {
        promise: Promise<unknown>;
        dispose: () => void;
      };
    }
  ).loadNoCache(123);
  dispose();
  resolveAsset({
    width: 1,
    height: 1,
    uri: "file:///x.png",
    localUri: "file:///x.png",
  });
  // The disposed promise should never resolve. Race against a microtask
  // drain so the test doesn't hang.
  const winner = await Promise.race([
    promise.then(() => "resolved"),
    new Promise<string>((r) => setTimeout(() => r("timeout"), 10)),
  ]);
  expect(winner).toBe("timeout");
});
