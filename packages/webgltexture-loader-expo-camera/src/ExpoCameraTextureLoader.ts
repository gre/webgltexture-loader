// Use a namespace import: a named `import { Camera }` would hard-fail at
// module evaluation time on SDKs where `expo-camera` no longer exports
// `Camera`. Reading off the namespace lets the runtime guard (`typeof
// LegacyCamera === "function"`) actually do its job.
import * as ExpoCameraModule from "expo-camera";
import { requireNativeModule } from "expo-modules-core";
import { globalRegistry, WebGLTextureLoaderAsyncHashCache } from "webgltexture-loader";

const LegacyCamera: unknown = (ExpoCameraModule as { Camera?: unknown }).Camera;
const CameraView: unknown = (ExpoCameraModule as { CameraView?: unknown }).CameraView;

const neverEnding: Promise<never> = new Promise(() => {});

/**
 * Native `ExponentGLObjectManager` module exposed by `expo-gl`. We resolve
 * it via `requireNativeModule` rather than `NativeModulesProxy` because on
 * Expo SDK 54+ (Expo Go / Android) `NativeModulesProxy.ExponentGLObjectManager`
 * is `undefined` even when the module is actually installed and working.
 *
 * We also can't go through the `glView.createCameraTextureAsync` extension
 * method: in the same env it captures an `ExponentGLObjectManager` reference
 * that is `undefined` at closure time (TDZ / load-order issue inside expo-gl),
 * so calling it throws "Cannot read property 'createCameraTextureAsync' of
 * undefined". Calling the native module directly sidesteps both bugs.
 */
interface ExpoGLObjectManager {
  createCameraTextureAsync(exglCtxId: number, cameraTag: number): Promise<{ exglObjId: number }>;
  destroyObjectAsync(exglObjId: number): Promise<void>;
}

/**
 * The `GLViewRef` extension that older expo-gl SDKs injected into the WebGL
 * context. Typed loosely because the runtime shape varies by SDK; we validate
 * `exglCtxId` is a number before using it. SDK 54 stops shipping the
 * extension and exposes the same id as `gl.__exglCtxId` instead, so we try
 * that property first and fall back to the extension.
 */
interface GLViewRefExtension {
  exglCtxId?: unknown;
}

/**
 * Resolve the EXGL context id across SDK versions:
 *
 *   - SDK 54+ exposes it as `gl.contextId` (the public field on
 *     `ExpoWebGLRenderingContext`, see expo-gl's GLView.types).
 *   - Some older internal builds put it on `gl.__exglCtxId`.
 *   - Even older expo-gl injected a `GLViewRef` extension carrying the id.
 *
 * We try them in order and return null if none of them produce a number.
 */
function resolveExglCtxId(gl: WebGLRenderingContext): number | null {
  const ctx = gl as unknown as { contextId?: unknown; __exglCtxId?: unknown };
  if (typeof ctx.contextId === "number") return ctx.contextId;
  if (typeof ctx.__exglCtxId === "number") return ctx.__exglCtxId;
  const ext = gl.getExtension("GLViewRef") as unknown as GLViewRefExtension | null;
  if (ext && typeof ext.exglCtxId === "number") return ext.exglCtxId;
  return null;
}

/**
 * A "camera ref" is anything we recognise as a candidate native ref. The
 * shape varies across Expo SDKs:
 *
 * - `nativeTag` / `_nativeTag`: numeric RN host-component native tag (no
 *   underscore on SDK 54+, with underscore on legacy refs). This is the
 *   field `loadNoCache` actually feeds to `createCameraTextureAsync`.
 * - `getNativeRef()`: some SDKs hide the host ref behind a method;
 *   `resolveCameraTag` calls it and reads `nativeTag` / `_nativeTag` off
 *   the result.
 * - `__internalInstanceHandle`: marker present on RN New Architecture
 *   (Fabric) refs. We recognise it for identity / canLoad purposes but a
 *   numeric tag may not be reachable without RN internals; in that case
 *   `loadNoCache` rejects with a clear "no native tag" error.
 * - `instanceof CameraView`: modern (SDK 51+) class component instance.
 *   Its real native ref lives at `instance._cameraRef.current`; we unwrap
 *   to that before resolving the tag (see `unwrapNativeCameraRef`).
 *
 * As a back-compat fallback we also accept anything that is `instanceof`
 * the legacy `Camera` class. Both class references are read off the
 * namespace import (rather than a named import) and gated behind
 * `typeof === "function"`, so SDKs that drop the export entirely don't
 * crash at module load.
 */
type LegacyCameraOrCameraViewRef = {
  nativeTag?: unknown;
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

/** Duck-type check: does `value` look like a native camera ref? */
function isCameraRef(value: unknown): value is LegacyCameraOrCameraViewRef {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if ("nativeTag" in obj) return true;
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
 * `<ExpoCamera ... ref={this._cameraRef}>`). Unwrap so both the native-tag
 * lookup AND the `inputHash` WeakMap key on the same identity, otherwise
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

/**
 * Extract the React Native host-component tag from a camera ref. SDK 54+
 * exposes it as `nativeTag` (no underscore); older SDKs use `_nativeTag`.
 * Some SDKs put the real ref behind a `getNativeRef()` method, so try that
 * too. Returns `null` when no numeric tag is reachable so callers can
 * produce a clear error.
 */
function resolveCameraTag(ref: LegacyCameraOrCameraViewRef): number | null {
  if (typeof ref.nativeTag === "number") return ref.nativeTag;
  if (typeof ref._nativeTag === "number") return ref._nativeTag;
  if (typeof ref.getNativeRef === "function") {
    const inner = ref.getNativeRef() as { nativeTag?: unknown; _nativeTag?: unknown } | null;
    if (inner) {
      if (typeof inner.nativeTag === "number") return inner.nativeTag;
      if (typeof inner._nativeTag === "number") return inner._nativeTag;
    }
  }
  return null;
}

/**
 * Best-effort destroy of a native EXGL object. The native module may be
 * unavailable (sync throw from `requireNativeModule`) and `destroyObjectAsync`
 * itself may reject; either failure is swallowed because dispose has no
 * recourse and the JS-side texture is already going away.
 */
function destroyEXGLObject(exglObjId: number): void {
  try {
    const manager = requireNativeModule<ExpoGLObjectManager>("ExponentGLObjectManager");
    void manager.destroyObjectAsync(exglObjId).catch(() => {});
  } catch {
    // swallow: native module missing in this environment.
  }
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
      destroyEXGLObject(exglObjId);
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

    const exglCtxId = resolveExglCtxId(gl);
    if (exglCtxId === null) {
      return {
        promise: Promise.reject(
          new Error(
            "webgltexture-loader-expo-camera: could not resolve the EXGL context id. " +
              'Tried `gl.contextId` (SDK 54+), `gl.__exglCtxId`, and `gl.getExtension("GLViewRef").exglCtxId` ' +
              "(older SDKs); none exposed a numeric id. This loader only works inside " +
              "an Expo GLView-provided WebGL context (see expo-gl's <GLView>).",
          ),
        ),
        dispose,
      };
    }

    const cameraTag = resolveCameraTag(camera);
    if (cameraTag === null) {
      return {
        promise: Promise.reject(
          new Error(
            "webgltexture-loader-expo-camera: could not resolve a numeric React Native " +
              "tag from the camera ref (looked for `nativeTag` / `_nativeTag`). " +
              "Make sure you pass the camera ref produced by `<CameraView ref={...} />` " +
              "(or the legacy `<Camera ref={...} />`) once it has mounted.",
          ),
        ),
        dispose,
      };
    }

    // SDK 54's `globalThis.WebGLTexture(arg)` constructor IGNORES its
    // argument, so we build the wrapper and assign `.id` manually. We still
    // need `new WebGLTexture()` because `gl.bindTexture` does an `instanceof
    // WebGLTexture` check at the native bridge. Resolve the constructor up
    // front so a missing global rejects synchronously without spending a
    // native-module round-trip we can't use.
    const WebGLTextureCtor = (globalThis as { WebGLTexture?: new () => WebGLTexture }).WebGLTexture;
    if (typeof WebGLTextureCtor !== "function") {
      return {
        promise: Promise.reject(
          new Error(
            "webgltexture-loader-expo-camera: globalThis.WebGLTexture is not a constructor. " +
              "Expo's GLView runtime should provide it inside the GL context's worklet.",
          ),
        ),
        dispose,
      };
    }

    let manager: ExpoGLObjectManager;
    try {
      manager = requireNativeModule<ExpoGLObjectManager>("ExponentGLObjectManager");
    } catch (err) {
      return {
        promise: Promise.reject(
          new Error(
            "webgltexture-loader-expo-camera: failed to resolve the native " +
              "ExponentGLObjectManager module via requireNativeModule. " +
              "Make sure expo-gl is installed and linked in this runtime. " +
              `(underlying error: ${(err as Error)?.message ?? String(err)})`,
          ),
        ),
        dispose,
      };
    }

    const promise = manager.createCameraTextureAsync(exglCtxId, cameraTag).then(({ exglObjId }) => {
      if (disposed) {
        // The caller cancelled before we got the EXGL id; the native object
        // exists but has no JS-side handle, so destroy it now (best-effort)
        // to avoid leaking GPU memory.
        destroyEXGLObject(exglObjId);
        return neverEnding;
      }
      const texture = new WebGLTextureCtor() as WebGLTexture & { id?: number };
      texture.id = exglObjId;
      this.objIds.set(texture, exglObjId);
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
