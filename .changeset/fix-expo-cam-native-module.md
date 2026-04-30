---
"webgltexture-loader-expo-camera": patch
---

Fix runtime crash on Expo Go SDK 54 when loading a camera texture.

`glView.createCameraTextureAsync(camera)` throws "Cannot read property
'createCameraTextureAsync' of undefined" because expo-gl's `GLView`
extension closure captures an `ExponentGLObjectManager` that's
`undefined` at runtime under SDK 54. We now resolve the native module
directly via `requireNativeModule("ExponentGLObjectManager")` and call
`createCameraTextureAsync(exglCtxId, cameraTag)` with the GL context id
read off `gl.getExtension("GLViewRef").exglCtxId` and the host-component
native tag (accepting both `nativeTag` and the legacy `_nativeTag`).

Same root cause hit `disposeTexture`: `NativeModulesProxy.ExponentGLObjectManager`
is also `undefined` on SDK 54, so destroys silently no-op'd and leaked
GPU textures. Dispose now goes through `requireNativeModule` too,
wrapped in try/catch so a missing module never propagates from cleanup.

Also handles SDK 54's quirky `globalThis.WebGLTexture(arg)` constructor
that ignores its argument: we now `new WebGLTexture()` and assign `.id`
explicitly so `gl.bindTexture`'s `instanceof WebGLTexture` check still
passes.
