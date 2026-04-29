import { Asset } from "expo-asset";
import { Image } from "react-native";
import {
  createTexture,
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache,
} from "webgltexture-loader";

const neverEnding: Promise<never> = new Promise(() => {});

type AssetModel = {
  width: number | null;
  height: number | null;
  uri: string;
  localUri?: string | null;
};

type Input = number | { uri: string } | AssetModel;

const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(new Error(`Image.getSize failed for ${uri}`, { cause: error })),
    );
  });

export const loadAsset = async (module: Input): Promise<AssetModel> => {
  // 1. Numeric module id (`require("./img.png")`) — download via Asset.
  if (typeof module === "number") {
    return Asset.fromModule(module).downloadAsync();
  }

  // 2. Pre-resolved asset with concrete dimensions — trust the caller.
  const m = module as Partial<AssetModel> & { uri: string };
  if (typeof m.width === "number" && typeof m.height === "number") {
    return m as AssetModel;
  }

  // 3. Pre-resolved local file but dimensions are missing/null — just measure.
  if (m.localUri) {
    const { width, height } = await getImageSize(m.localUri);
    return { ...m, width, height };
  }

  // 4. Bare URI — download then measure (expo-asset returns null width/height
  //    for remote URIs on iOS/Android, hence Image.getSize).
  const [asset] = await Asset.loadAsync(m.uri);
  if (!asset) {
    throw new Error(`Asset.loadAsync returned no asset for ${m.uri}`);
  }
  const { width, height } = await getImageSize(asset.localUri ?? asset.uri);
  asset.width = width;
  asset.height = height;
  return asset;
};

export default class ExpoModuleTextureLoader extends WebGLTextureLoaderAsyncHashCache<Input> {
  override canLoad(input: unknown): boolean {
    return (
      typeof input === "number" ||
      (typeof input === "object" &&
        input !== null &&
        typeof (input as { uri?: unknown }).uri === "string")
    );
  }

  override inputHash(module: Input) {
    return typeof module === "number" ? module : module.uri;
  }

  override loadNoCache(module: Input) {
    const { gl } = this;
    let disposed = false;
    const dispose = () => {
      disposed = true;
    };
    const promise = loadAsset(module).then((asset) => {
      if (disposed) return neverEnding;
      const { width, height, uri } = asset;
      if (typeof width !== "number" || typeof height !== "number") {
        throw new Error(
          `Expo asset has no dimensions (width=${width}, height=${height}, uri=${uri})`,
        );
      }
      const texture = createTexture(gl);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Expo's gl shim accepts an Asset where standard WebGL expects an
      // ArrayBufferView; only the source argument needs the cast.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        asset as unknown as ArrayBufferView,
      );
      return { texture, width, height };
    });
    return { promise, dispose };
  }
}

globalRegistry.add(ExpoModuleTextureLoader);
