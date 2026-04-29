import { Camera } from "expo-camera";
import { NativeModulesProxy } from "expo-modules-core";
import { findNodeHandle } from "react-native";
import { globalRegistry, WebGLTextureLoaderAsyncHashCache } from "webgltexture-loader";

const neverEnding: Promise<never> = new Promise(() => {});

const available = !!NativeModulesProxy.ExponentGLObjectManager?.createCameraTextureAsync;

let warned = false;

interface GLViewRefExtension {
  createCameraTextureAsync(camera: Camera): Promise<WebGLTexture & { exglObjId: number }>;
}

export default class ExpoCameraTextureLoader extends WebGLTextureLoaderAsyncHashCache<Camera> {
  static priority = -199;

  objIds: WeakMap<WebGLTexture, number> = new WeakMap();

  override canLoad(input: unknown): boolean {
    if (input && input instanceof Camera) {
      if (available) return true;
      if (!warned) {
        warned = true;
        console.log(
          "webgltexture-loader-expo: ExponentGLObjectManager.createCameraTextureAsync is not available. Make sure to use the correct version of Expo",
        );
      }
    }
    return false;
  }

  override disposeTexture(texture: WebGLTexture): void {
    const exglObjId = this.objIds.get(texture);
    if (exglObjId !== undefined) {
      NativeModulesProxy.ExponentGLObjectManager?.destroyObjectAsync?.(exglObjId);
    }
    this.objIds.delete(texture);
  }

  override inputHash(camera: Camera) {
    return findNodeHandle(camera);
  }

  override loadNoCache(camera: Camera) {
    const { gl } = this;
    let disposed = false;
    const dispose = () => {
      disposed = true;
    };
    const glView = gl.getExtension("GLViewRef") as unknown as GLViewRefExtension | null;
    const promise = !glView
      ? Promise.reject(new Error("GLViewRef not available"))
      : glView.createCameraTextureAsync(camera).then((texture) => {
          if (disposed) return neverEnding;
          this.objIds.set(texture, texture.exglObjId);
          // width/height not exposed by Expo for camera textures — see issue #5.
          return { texture, width: 0, height: 0 };
        });
    return { promise, dispose };
  }
}

globalRegistry.add(ExpoCameraTextureLoader);
