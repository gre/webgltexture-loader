declare module "expo-modules-core" {
  /**
   * Resolves a native module by name. We pull `ExponentGLObjectManager`
   * through this path because on Expo SDK 54+ the older
   * `NativeModulesProxy.ExponentGLObjectManager` lookup returns `undefined`
   * even when the module is installed and working.
   */
  export function requireNativeModule<T>(name: string): T;
}

declare module "expo-camera" {
  // `Camera` is the legacy class export (Expo SDK <= 50). Kept here for
  // back-compat detection via `instanceof`. Newer SDKs may not export it
  // at runtime, so all uses are guarded with a `typeof Camera === "function"`
  // check.
  export class Camera {}
  // `CameraView` is the modern (SDK 51+) functional component. The shape
  // here is intentionally loose — we only care about ref-shaped objects.
  // Refs typically expose one of: `nativeTag`, `_nativeTag`,
  // `__internalInstanceHandle`, or `getNativeRef()`.
  export class CameraView {}
}
