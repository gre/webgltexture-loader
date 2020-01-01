//@flow
import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache
} from "webgltexture-loader";
import { findNodeHandle } from "react-native";
import { NativeModulesProxy } from "@unimodules/core";
import { Camera } from "expo-camera";

const neverEnding = new Promise(() => {});

const available = !!(
  NativeModulesProxy.ExponentGLObjectManager &&
  NativeModulesProxy.ExponentGLObjectManager.createCameraTextureAsync
);

let warned = false;

class ExpoCameraTextureLoader extends WebGLTextureLoaderAsyncHashCache<Camera> {
  static priority = -199;

  objIds: WeakMap<WebGLTexture, number> = new WeakMap();

  canLoad(input: any) {
    if (input && input instanceof Camera) {
      if (available) return true;
      if (!warned) {
        warned = true;
        console.log(
          "webgltexture-loader-expo: ExponentGLObjectManager.createCameraTextureAsync is not available. Make sure to use the correct version of Expo"
        );
      }
    }
    return false;
  }

  disposeTexture(texture: WebGLTexture) {
    const exglObjId = this.objIds.get(texture);
    if (exglObjId) {
      NativeModulesProxy.ExponentGLObjectManager.destroyObjectAsync(exglObjId);
    }
    this.objIds.delete(texture);
  }

  inputHash(camera: Camera) {
    return findNodeHandle(camera);
  }

  loadNoCache(camera: Camera) {
    const { gl } = this;
    // $FlowFixMe
    const { __exglCtxId: exglCtxId } = gl;
    let disposed = false;
    const dispose = () => {
      disposed = true;
    };
    const glView = gl.getExtension("GLViewRef");
    const promise: Promise<*> = !glView
      ? Promise.reject(new Error("GLViewRef not available"))
      : glView.createCameraTextureAsync(camera).then(texture => {
          if (disposed) return neverEnding;
          // $FlowFixMe
          this.objIds.set(texture, texture.exglObjId);
          const width = 0;
          const height = 0;
          // ^ any way to retrieve these ?
          return { texture, width, height };
        });
    return { promise, dispose };
  }
}

globalRegistry.add(ExpoCameraTextureLoader);

export default ExpoCameraTextureLoader;
