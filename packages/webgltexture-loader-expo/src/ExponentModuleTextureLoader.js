//@flow
import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache
} from "webgltexture-loader";
import { Image } from "react-native";
import Expo from "expo";
import md5 from "./md5";

const neverEnding = new Promise(() => {});

type Asset = {
  width: number,
  height: number,
  uri: string,
  localUri: string
};

const hash = (module: number | { uri: string }) =>
  typeof module === "number" ? module : module.uri;

const localAsset = (module: number) => {
  const asset = Expo.Asset.fromModule(module);
  return asset.downloadAsync().then(() => asset);
};

const remoteAssetCache = {};

const remoteAsset = (uri: string) => {
  const i = uri.lastIndexOf(".");
  const ext = i !== -1 ? uri.slice(i) : ".jpg";
  const key = md5(uri);
  if (key in remoteAssetCache) {
    return Promise.resolve(remoteAssetCache[key]);
  }
  const promise = Promise.all([
    new Promise((success, failure) =>
      Image.getSize(uri, (width, height) => success({ width, height }), failure)
    ),
    Expo.FileSystem.downloadAsync(
      uri,
      Expo.FileSystem.documentDirectory + `ExponentAsset-${key}${ext}`,
      {
        cache: true
      }
    )
  ]).then(([size, asset]) => ({ ...size, uri, localUri: asset.uri }));
  remoteAssetCache[key] = promise;
  return promise;
};

const localFile = (uri: string) => {
  const i = uri.lastIndexOf(".");
  const ext = i !== -1 ? uri.slice(i) : ".jpg";
  const key = md5(uri);
  if (key in remoteAssetCache) {
    return Promise.resolve(remoteAssetCache[key]);
  }
  const promise = new Promise((success, failure) =>
      Image.getSize(uri, (width, height) => success({ width, height }), failure)
  );
  promise.then(size => ({ ...size, uri, localUri: uri }));
  remoteAssetCache[key] = promise;
  return promise;
};

export const loadAsset = (module: number | { uri: string }): Promise<Asset> =>
  typeof module === "number" ? localAsset(module) : ((module.uri.startsWith("file:") || module.uri.startsWith("data:")) ? localFile(module.uri) : remoteAsset(module.uri));

class ExponentModuleTextureLoader extends WebGLTextureLoaderAsyncHashCache<
  number | { uri: string }
> {
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
    const promise = loadAsset(module).then(asset => {
      if (disposed) return neverEnding;
      const { width, height } = asset;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // $FlowFixMe
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

globalRegistry.add(ExponentModuleTextureLoader);

export default ExponentModuleTextureLoader;
