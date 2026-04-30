// Use a namespace import: a named `import { Camera }` would hard-fail at
// module evaluation time on SDKs where `expo-camera` no longer exports
// `Camera`. Reading off the namespace lets the runtime guard (`typeof
// LegacyCamera === "function"`) actually do its job.
import * as ExpoCameraModule from "expo-camera";
import { NativeModulesProxy } from "expo-modules-core";
import { globalRegistry, WebGLTextureLoaderAsyncHashCache } from "webgltexture-loader";

const LegacyCamera: unknown = (ExpoCameraModule as { Camera?: unknown }).Camera;
const CameraView: unknown = (ExpoCameraModule as { CameraView?: unknown }).CameraView;

const neverEnding: Promise<never> = new Promise(() => {});

/**
 * A "camera ref" is anything that looks like a native ref Expo can attach
 * a GL camera texture to. We accept several shapes because Expo's API has
 * shifted across SDKs:
 *
 * - `_nativeTag` — RN class component / ref-forwarded class (legacy `Camera`).
 * - `__internalInstanceHandle` — RN New Architecture (Fabric) ref.
 * - `getNativeRef()` — `CameraView`'s pattern in some SDKs.
 * - `instanceof CameraView` — modern (SDK 51+) class component instance.
 *   Its real native ref is at `instance._cameraRef.current`; we unwrap to
 *   that before calling Expo's GL bridge (see `unwrapNativeCameraRef`).
 *
 * As a back-compat fallback we also accept anything that is `instanceof`
 * the legacy `Camera` class. Both class references are read off the
 * namespace import (rather than a named import) and gated behind
 * `typeof === "function"`, so SDKs that drop the export entirely don't
 * crash at module load.
 */
type LegacyCameraOrCameraViewRef = {
  _nativeTag?: unknown;
  __internalInstanceHandle?: unknown;
  getNativeRef?: () => unknown;
  _cameraRef?: { current?: unknown };
};

type CameraInputObject = {
  camera: LegacyCameraOrCameraViewRef;
  width: number;
  height: number;
};

export type CameraInput = LegacyCameraOrCameraViewRef | CameraInputObject;

interface GLViewRefExtension {
  createCameraTextureAsync(
    camera: LegacyCameraOrCameraViewRef,
  ): Promise<WebGLTexture & { exglObjId: number }>;
}

/** Duck-type check: does `value` look like a native camera ref? */
function isCameraRef(value: unknown): value is LegacyCameraOrCameraViewRef {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if ("_nativeTag" in obj) return true;
  if ("__internalInstanceHandle" in obj) return true;
  if (typeof obj.getNativeRef === "function") return true;
  // Modern (SDK 51+) `CameraView` class instance. Its native ref lives at
  // `_cameraRef.current` and gets unwrapped in `unwrapNativeCameraRef`.
  if (typeof CameraView === "function" && value instanceof CameraView) return true;
  // Back-compat: legacy `Camera` class instance. The guard handles SDKs
  // where the export is missing entirely (read off the namespace above).
  if (typeof LegacyCamera === "function" && value instanceof LegacyCamera) return true;
  return false;
}

/**
 * `CameraView` (SDK 51+) is a React class wrapper, not a native handle. The
 * real ref lives at `instance._cameraRef.current` (see expo-camera's
 * `CameraView.js`, which declares `_cameraRef = createRef()` and renders
 * `<ExpoCamera ... ref={this._cameraRef}>`). Unwrap so both the GL bridge
 * call AND the `inputHash` WeakMap key on the same identity — otherwise
 * dispose / cache invariants get desynced.
 */
function unwrapNativeCameraRef(input: LegacyCameraOrCameraViewRef): LegacyCameraOrCameraViewRef {
  if (typeof CameraView === "function" && input instanceof CameraView) {
    const inner = input._cameraRef?.current;
    if (inner && typeof inner === "object") {
      return inner as LegacyCameraOrCameraViewRef;
    }
  }
  return input;
}

/** Duck-type check: does `value` look like the `{ camera, width, height }` wrapper? */
function isCameraInputObject(value: unknown): value is CameraInputObject {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.width === "number" && typeof obj.height === "number" && isCameraRef(obj.camera);
}

export default class ExpoCameraTextureLoader extends WebGLTextureLoaderAsyncHashCache<CameraInput> {
  static priority = -199;

  /** Tracks the EXGL object id for each loaded texture so we can destroy it on dispose. */
  objIds: WeakMap<WebGLTexture, number> = new WeakMap();

  /**
   * Stable numeric id per ref. Replaces the deprecated `findNodeHandle()`
   * path: the New Architecture removed it, and we don't actually need the
   * native tag — only a stable hash.
   */
  private refHashes: WeakMap<object, number> = new WeakMap();
  private nextRefHash = 1;

  /** One-shot warning when callers don't pass explicit dimensions. */
  private dimensionsWarningEmitted = false;

  override canLoad(input: unknown): boolean {
    return isCameraRef(input) || isCameraInputObject(input);
  }

  override disposeTexture(texture: WebGLTexture): void {
    const exglObjId = this.objIds.get(texture);
    if (exglObjId !== undefined) {
      NativeModulesProxy.ExponentGLObjectManager?.destroyObjectAsync?.(exglObjId);
    }
    this.objIds.delete(texture);
  }

  /**
   * Unwrap a `CameraInput` to the underlying native ref. Strips the
   * `{ camera, width, height }` wrapper, then unwraps `CameraView` to its
   * inner `_cameraRef.current`. Used by both `inputHash` (so the WeakMap
   * keys on the native ref) and `loadNoCache` (so the GL bridge gets a
   * native handle, not the React wrapper).
   */
  private unwrap(input: CameraInput): LegacyCameraOrCameraViewRef {
    const ref = isCameraInputObject(input) ? input.camera : input;
    return unwrapNativeCameraRef(ref);
  }

  override inputHash(input: CameraInput): number {
    const ref = this.unwrap(input);
    let hash = this.refHashes.get(ref);
    if (hash === undefined) {
      hash = this.nextRefHash++;
      this.refHashes.set(ref, hash);
    }
    return hash;
  }

  override loadNoCache(input: CameraInput) {
    const { gl } = this;
    const explicit = isCameraInputObject(input) ? input : null;
    const camera = this.unwrap(input);

    if (!explicit && !this.dimensionsWarningEmitted) {
      this.dimensionsWarningEmitted = true;
      console.warn(
        "webgltexture-loader-expo-camera: width/height returned as 0 because no dimensions were provided. " +
          "Pass `{ camera, width, height }` instead of the bare camera ref to provide the resolution you configured.",
      );
    }

    let disposed = false;
    const dispose = () => {
      disposed = true;
    };
    const glView = gl.getExtension("GLViewRef") as unknown as GLViewRefExtension | null;
    const promise = !glView
      ? Promise.reject(
          new Error(
            'webgltexture-loader-expo-camera: gl.getExtension("GLViewRef") returned null. ' +
              "This loader only works inside an Expo GLView-provided WebGL context " +
              "(see expo-gl's <GLView> component).",
          ),
        )
      : glView.createCameraTextureAsync(camera).then((texture) => {
          if (disposed) return neverEnding;
          this.objIds.set(texture, texture.exglObjId);
          return {
            texture,
            width: explicit ? explicit.width : 0,
            height: explicit ? explicit.height : 0,
          };
        });
    return { promise, dispose };
  }

  /**
   * Override to repair the "sticky 0/0 dimensions" cache-collision: if the
   * texture was first loaded with a bare ref (cached as 0/0) and is later
   * re-requested with explicit `{ camera, width, height }`, update both the
   * cached `results` entry and the resolved promise so callers see the
   * dimensions instead of being stuck with 0/0.
   */
  override load(input: CameraInput) {
    const explicit = isCameraInputObject(input) ? input : null;
    if (!explicit) return super.load(input);

    const hash = this.inputHash(input);
    const cachedResult = this.results.get(hash);
    if (cachedResult) {
      cachedResult.width = explicit.width;
      cachedResult.height = explicit.height;
      return Promise.resolve(cachedResult);
    }

    const promise = super.load(input).then((result) => {
      result.width = explicit.width;
      result.height = explicit.height;
      return result;
    });
    return promise;
  }
}

globalRegistry.add(ExpoCameraTextureLoader);
