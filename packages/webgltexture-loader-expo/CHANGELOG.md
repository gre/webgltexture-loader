# webgltexture-loader-expo

## 2.1.0

### Minor Changes

- 57bfb68: First v2.1 alpha release. Modernization series:

  - TypeScript everywhere (was Flow). `.d.ts` shipped from `lib/`. Public API
    unchanged but imports must now resolve types.
  - Tooling: Yarn 4 + Corepack, Jest 30, oxlint + oxfmt, drop Lerna 3.
  - New `createTexture(gl)` helper exported from `webgltexture-loader` (throws
    with a clear message instead of returning null).
  - `LoadersRegistry.add` / `remove` are generic over the loader's input type;
    no more `as never` casts at registration sites.
  - Browser-side: `webgltexture-loader-ndarray` no longer crashes in browsers
    (`global is not defined` from `typedarray-pool` is shimmed in
    `globalShim.ts`, run before `typedarray-pool` evaluates).
  - ndarray: 16/32-bit integer dtypes (`uint16`, `int16`, `uint32`, `int32`,
    `int8`) now route to WebGL2 integer internalformats (`R16UI`, `RG16UI`,
    ...). Fall back to uint8 + one-time `console.warn` per dtype on WebGL1.
  - ndarray: `UNPACK_ALIGNMENT` save/set 1/restore around `texImage2D` (in
    `try/finally`) so non-aligned widths and 16/32-bit data uploads don't
    corrupt or leak the typedarray-pool buffer.
  - expo: drop deprecated `expo-asset-utils`. Replace
    `AssetUtils.resolveAsync(uri)` with `Asset.loadAsync(uri)` +
    `Image.getSize` (from `react-native`) so iOS/Android remote images get
    real width/height instead of `null`.
  - expo-camera: support modern `CameraView` API via duck-typed native-handle
    detection (`_nativeTag` / `__internalInstanceHandle` / `getNativeRef` /
    legacy `instanceof Camera`); drop deprecated `findNodeHandle`. Optional
    `{ camera, width, height }` wrapper input lets callers supply
    dimensions; one-time `console.warn` if omitted.

### Patch Changes

- a77e6fc: expo-camera: detect modern `CameraView` instances on Expo SDK 54+. The class
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

- Updated dependencies [57bfb68]
  - webgltexture-loader@2.1.0

## 2.1.0-alpha.1

### Patch Changes

- a77e6fc: expo-camera: detect modern `CameraView` instances on Expo SDK 54+. The class
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

## 2.1.0-alpha.0

### Minor Changes

- First v2.1 alpha release. Modernization series:

  - TypeScript everywhere (was Flow). `.d.ts` shipped from `lib/`. Public API
    unchanged but imports must now resolve types.
  - Tooling: Yarn 4 + Corepack, Jest 30, oxlint + oxfmt, drop Lerna 3.
  - New `createTexture(gl)` helper exported from `webgltexture-loader` (throws
    with a clear message instead of returning null).
  - `LoadersRegistry.add` / `remove` are generic over the loader's input type;
    no more `as never` casts at registration sites.
  - Browser-side: `webgltexture-loader-ndarray` no longer crashes in browsers
    (`global is not defined` from `typedarray-pool` is shimmed in
    `globalShim.ts`, run before `typedarray-pool` evaluates).
  - ndarray: 16/32-bit integer dtypes (`uint16`, `int16`, `uint32`, `int32`,
    `int8`) now route to WebGL2 integer internalformats (`R16UI`, `RG16UI`,
    ...). Fall back to uint8 + one-time `console.warn` per dtype on WebGL1.
  - ndarray: `UNPACK_ALIGNMENT` save/set 1/restore around `texImage2D` (in
    `try/finally`) so non-aligned widths and 16/32-bit data uploads don't
    corrupt or leak the typedarray-pool buffer.
  - expo: drop deprecated `expo-asset-utils`. Replace
    `AssetUtils.resolveAsync(uri)` with `Asset.loadAsync(uri)` +
    `Image.getSize` (from `react-native`) so iOS/Android remote images get
    real width/height instead of `null`.
  - expo-camera: support modern `CameraView` API via duck-typed native-handle
    detection (`_nativeTag` / `__internalInstanceHandle` / `getNativeRef` /
    legacy `instanceof Camera`); drop deprecated `findNodeHandle`. Optional
    `{ camera, width, height }` wrapper input lets callers supply
    dimensions; one-time `console.warn` if omitted.

### Patch Changes

- Updated dependencies
  - webgltexture-loader@2.1.0-alpha.0
