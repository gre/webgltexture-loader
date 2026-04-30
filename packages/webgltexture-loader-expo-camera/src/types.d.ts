declare module "expo-modules-core" {
  export const NativeModulesProxy: {
    ExponentGLObjectManager?: {
      destroyObjectAsync?: (exglObjId: number) => Promise<void>;
    };
  };
}

declare module "expo-camera" {
  // `Camera` is the legacy class export (Expo SDK <= 50). Kept here for
  // back-compat detection via `instanceof`. Newer SDKs may not export it
  // at runtime, so all uses are guarded with a `typeof Camera === "function"`
  // check.
  export class Camera {}
  // `CameraView` is the modern (SDK 51+) functional component. The shape
  // here is intentionally loose — we only care about ref-shaped objects.
  // Refs typically expose one of: `_nativeTag`, `__internalInstanceHandle`,
  // or `getNativeRef()`.
  export class CameraView {}
}
