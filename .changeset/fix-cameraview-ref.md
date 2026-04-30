---
"webgltexture-loader-expo-camera": patch
"webgltexture-loader-expo": patch
---

expo-camera: detect modern `CameraView` instances on Expo SDK 54+. The class
exposes none of the legacy duck-typed markers (`_nativeTag` /
`__internalInstanceHandle` / `getNativeRef`) and the legacy `instanceof
Camera` fallback is dead because `Camera` is no longer exported. Adds a
fifth `instanceof CameraView` branch in `canLoad`, and unwraps the wrapper
to `instance._cameraRef.current` before calling Expo's GL bridge AND inside
`inputHash` (so the WeakMap-based hash counter keys on the same native
identity that's passed to the native call — otherwise dispose/cache
invariants get desynced).

expo: reword the "ExponentGLObjectManager.createObjectAsync is not
available" message and demote it to `console.debug`. The previous wording
falsely implied the user was on the wrong Expo version; the loader is just
a legacy fallback that doesn't apply on SDK 51+.
