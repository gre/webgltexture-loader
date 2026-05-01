# webgltexture-loader-ndarray

## 2.1.1

### Patch Changes

- Re-publish v2.1.0 with the missing `lib/` directory.

  The 2.1.0 release was published from a tree where `tsc` had not been run,
  so the tarballs shipped only `src/` and every `require()` failed with
  "Cannot find module 'lib/index.js'". This release re-ships every package
  with the compiled JS + `.d.ts` artifacts.

  Defense in depth:

  - Each publishable package now has `"prepack": "tsc"`, so `npm publish`
    rebuilds `lib/` regardless of how it's invoked.
  - The root `release` script is now a guard wrapper (`scripts/release.sh`)
    that runs `yarn build`, then verifies each package's declared `main`
    file actually exists on disk before delegating to `changeset publish`.
    Aborts with a clear error if any artifact is missing.

- Updated dependencies
  - webgltexture-loader@2.1.1

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

- Updated dependencies [57bfb68]
  - webgltexture-loader@2.1.0

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
