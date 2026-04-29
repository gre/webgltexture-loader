import {
  createTexture,
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache,
} from "webgltexture-loader";
import * as AssetUtils from "expo-asset-utils";
import { Asset } from "expo-asset";

const neverEnding: Promise<never> = new Promise(() => {});

type AssetModel = {
  width: number;
  height: number;
  uri: string;
  localUri?: string | null;
};

type Input = number | { uri: string } | AssetModel;

const localAsset = (module: number): Promise<Asset> => {
  const asset = Asset.fromModule(module);
  return asset.downloadAsync().then(() => asset);
};

export const loadAsset = (module: Input): Promise<AssetModel> => {
  if (typeof module === "number") {
    return localAsset(module) as Promise<unknown> as Promise<AssetModel>;
  }
  if ("localUri" in module && module.localUri) {
    return Promise.resolve(module as AssetModel);
  }
  return AssetUtils.resolveAsync(module.uri) as Promise<AssetModel>;
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
      const { width, height } = asset;
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
        asset as unknown as ArrayBufferView
      );
      return { texture, width, height };
    });
    return { promise, dispose };
  }
}

globalRegistry.add(ExpoModuleTextureLoader);
