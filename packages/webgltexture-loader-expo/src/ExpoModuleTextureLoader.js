//@flow
import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache,
} from "webgltexture-loader";
import AssetUtils from "expo-asset-utils";
import { Asset } from "expo-asset";

const neverEnding = new Promise(() => {});

const localAsset = (module: number) => {
  const asset = Asset.fromModule(module);
  return asset.downloadAsync().then(() => asset);
};

type AssetModel = {
  width: number,
  height: number,
  uri: string,
  localUri: string,
};

type M = number | { uri: string } | AssetModel;

export const loadAsset = (module: M): Promise<AssetModel> =>
  typeof module === "number"
    ? localAsset(module)
    : module.localUri
    ? // $FlowFixMe
      Promise.resolve(module)
    : AssetUtils.resolveAsync(module.uri);

class ExpoModuleTextureLoader extends WebGLTextureLoaderAsyncHashCache<M> {
  objIds: WeakMap<WebGLTexture, number> = new WeakMap();

  canLoad(input: any) {
    return (
      typeof input === "number" ||
      (input && typeof input === "object" && typeof input.uri === "string")
    );
  }

  inputHash(module: *) {
    return typeof module === "number" ? module : module.uri;
  }

  loadNoCache(module: *) {
    const { gl } = this;
    let disposed = false;
    const dispose = () => {
      disposed = true;
    };
    const promise = loadAsset(module).then((asset) => {
      if (disposed) return neverEnding;
      const { width, height } = asset;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        asset
      );
      return { texture, width, height };
    });
    return { promise, dispose };
  }
}

globalRegistry.add(ExpoModuleTextureLoader);

export default ExpoModuleTextureLoader;
