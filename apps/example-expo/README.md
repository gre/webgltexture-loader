# example-expo

Manual smoke test for the Expo loaders, specifically the camera-texture path
exercised by `webgltexture-loader-expo-camera`. A contributor with a phone
running Expo Go (or a local iOS / Android simulator) can verify the loader
end-to-end on real Expo SDK 54 native modules. It is **not** wired into CI.

## What it does

1. Asks for camera permission on launch.
2. Mounts an off-screen `<CameraView ref={...} facing="front" />` so the
   native ref gets a valid `nativeTag`.
3. Mounts a fullscreen `<GLView>` whose `onContextCreate` callback:
   - Constructs a `LoaderResolver` against the GL context.
   - Resolves the camera ref through the registry (the side-effect import of
     `webgltexture-loader-expo-camera` registers `ExpoCameraTextureLoader`).
   - Calls `loader.load({ camera, width, height })` to attach the camera as
     an EXGL external texture.
   - Compiles a tiny grayscale-invert fragment shader and runs a
     `requestAnimationFrame` loop that calls `loader.update()` then
     `gl.endFrameEXP()` every frame.
4. Overlays a status bar showing the current state, resolved texture size,
   and any error message surfaced by the loader.

The grayscale-invert effect is intentionally chosen so the output is
visibly different from the raw camera frames: if you see a normal-looking
preview, the GLView is not using the loader output.

## Prerequisites

- Either Expo Go on a physical iPhone or Android device, **or** a local
  iOS Simulator / Android Emulator with the Expo dev client.
- Yarn 4 via Corepack (the project's pinned package manager).

## Run

```bash
corepack yarn install
corepack yarn build                       # build library packages first so workspace deps resolve
corepack yarn workspace example-expo start
```

Then scan the QR code with Expo Go (or press `i` / `a` to launch a
simulator). Grant camera access when prompted. You should see an inverted
grayscale view of the front camera with a `status: rendering` and
`texture: 720x1280` line at the bottom.

## What it tests

The PR that introduced this app fixed the camera-texture path on Expo SDK
54 by routing the EXGL camera-texture call through `requireNativeModule`
instead of the broken `glView.createCameraTextureAsync` extension. The
demo exercises that exact code path:

- `LoaderResolver.resolve(cameraRef)` -> `ExpoCameraTextureLoader.canLoad`.
- `loader.load(input)` -> `loadNoCache` -> native
  `ExponentGLObjectManager.createCameraTextureAsync`.
- `loader.update(input)` per RAF tick (the loader contract for live
  sources, even though the EXGL-side texture handle is reused).

## Notes

- This package is private (`"private": true`) so it is excluded from the
  root `corepack yarn build` cascade by the `--no-private` filter. It is
  also intentionally not type-checked from the root: run
  `corepack yarn workspace example-expo exec tsc --noEmit` to verify
  the TypeScript independently.
- Metro needs the `metro.config.js` shipped here to resolve symlinked
  workspace packages; do not delete it without testing on a device.
- The `expo-camera` peer-dep on the published loader is `*`; this app
  pins to `~17.0.10`, the version verified against the SDK 54 fix.
