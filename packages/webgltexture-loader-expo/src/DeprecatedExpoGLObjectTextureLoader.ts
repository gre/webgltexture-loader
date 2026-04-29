import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache,
} from "webgltexture-loader";
import { NativeModulesProxy } from "expo-modules-core";

const neverEnding: Promise<never> = new Promise(() => {});

const available = !!(
  NativeModulesProxy.ExponentGLObjectManager &&
  NativeModulesProxy.ExponentGLObjectManager.createObjectAsync
);

let warned = false;

export default class ExpoGLObjectTextureLoader extends WebGLTextureLoaderAsyncHashCache<
  Record<string, unknown>
> {
  static priority = -200;

  objIds: WeakMap<WebGLTexture, number> = new WeakMap();

  override canLoad(input: unknown): boolean {
    if (!available && !warned) {
      warned = true;
      console.log(
        "webgltexture-loader-expo: ExponentGLObjectManager.createObjectAsync is not available. Make sure to use the correct version of Expo"
      );
    }
    return available && typeof input === "object" && input !== null;
  }

  override disposeTexture(texture: WebGLTexture): void {
    const exglObjId = this.objIds.get(texture);
    if (exglObjId !== undefined) {
      NativeModulesProxy.ExponentGLObjectManager?.destroyObjectAsync?.(
        exglObjId
      );
    }
    this.objIds.delete(texture);
  }

  override inputHash(config: Record<string, unknown>) {
    return JSON.stringify(config);
  }

  override loadNoCache(config: Record<string, unknown>) {
    const { gl } = this;
    const { __exglCtxId: exglCtxId } = gl as unknown as { __exglCtxId: number };
    let disposed = false;
    const dispose = () => {
      disposed = true;
    };
    const promise =
      NativeModulesProxy.ExponentGLObjectManager!.createObjectAsync!({
        exglCtxId,
        texture: config,
      }).then(({ exglObjId }) => {
        if (disposed) return neverEnding;
        // Expo polyfills a constructible WebGLTexture(exglObjId) on the global.
        // Standard browsers expose WebGLTexture as an opaque, non-constructible
        // interface; this code only runs under Expo.
        const texture = new (
          globalThis as unknown as { WebGLTexture: new (id: number) => WebGLTexture }
        ).WebGLTexture(exglObjId);
        this.objIds.set(texture, exglObjId);
        return { texture, width: 0, height: 0 };
      });
    return { promise, dispose };
  }
}

globalRegistry.add(ExpoGLObjectTextureLoader);
