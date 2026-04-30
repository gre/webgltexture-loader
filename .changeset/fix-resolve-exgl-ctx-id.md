---
"webgltexture-loader-expo-camera": patch
---

Resolve the EXGL context id across SDK versions.

Expo SDK 54 stopped shipping the `GLViewRef` extension and exposes the EXGL
context id as `gl.contextId` instead. The loader now tries:

1. `gl.contextId` (SDK 54+ public API on `ExpoWebGLRenderingContext`),
2. `gl.__exglCtxId` (older internal builds),
3. `gl.getExtension("GLViewRef").exglCtxId` (legacy extension).

If none expose a numeric id, the loader rejects with a clear error pointing
at `<GLView>`. Previously the loader only checked path 3, so it crashed on
SDK 54 with `gl.getExtension("GLViewRef") returned null`.
