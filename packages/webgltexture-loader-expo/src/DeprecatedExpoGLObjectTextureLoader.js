//@flow
import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache
} from "webgltexture-loader";
import { NativeModulesProxy } from "expo-modules-core";

const neverEnding = new Promise(() => { });

const available = !!(
  NativeModulesProxy.ExponentGLObjectManager &&
  NativeModulesProxy.ExponentGLObjectManager.createObjectAsync
);

let warned = false;

class ExpoGLObjectTextureLoader extends WebGLTextureLoaderAsyncHashCache<Object> {
  static priority = -200;

  objIds: WeakMap<WebGLTexture, number> = new WeakMap();

  canLoad(input: any) {
    if (!available && !warned) {
      warned = true;
      console.log(
        "webgltexture-loader-expo: ExponentGLObjectManager.createObjectAsync is not available. Make sure to use the correct version of Expo"
      );
    }
    return available && typeof input === "object";
  }

  disposeTexture(texture: WebGLTexture) {
    const exglObjId = this.objIds.get(texture);
    if (exglObjId) {
      NativeModulesProxy.ExponentGLObjectManager.destroyObjectAsync(exglObjId);
    }
    this.objIds.delete(texture);
  }

  inputHash(config: Object) {
    // JSON.stringify is a quick way to hash the config object
    return JSON.stringify(config);
  }

  loadNoCache(config: Object) {
    const { gl } = this;
    // $FlowFixMe
    const { __exglCtxId: exglCtxId } = gl;
    let disposed = false;
    const dispose = () => {
      disposed = true;
    };
    const promise = NativeModulesProxy.ExponentGLObjectManager.createObjectAsync(
      {
        exglCtxId,
        texture: config
      }
    ).then(({ exglObjId }) => {
      if (disposed) return neverEnding;
      // $FlowFixMe
      const texture = new WebGLTexture(exglObjId);
      this.objIds.set(texture, exglObjId);
      const width = 0;
      const height = 0;
      // ^ unfortunately there is no way to retrieve these
      return { texture, width, height };
    });
    return { promise, dispose };
  }
}

globalRegistry.add(ExpoGLObjectTextureLoader);

export default ExpoGLObjectTextureLoader;
