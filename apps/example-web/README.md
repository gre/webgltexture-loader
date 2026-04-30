# example-web

Visual smoke test for every web-side `webgltexture-loader` so contributors can
quickly confirm the lib works end-to-end across all DOM and ndarray sources.

## Run

```bash
corepack yarn install
corepack yarn build               # build library packages first (lib/*) so workspace deps resolve
corepack yarn workspace example-web dev
```

The Vite dev server prints a local URL (default port `5173`). The `yarn build`
step is required because the workspace packages (e.g. `webgltexture-loader`)
declare `main: lib/index.js`, and `lib/` is only produced by their build.

## What it shows

A WebGL canvas split into a 2x2 grid, each quadrant sampling a different
loader:

| Quadrant     | Loader                       | Source                                   |
| ------------ | ---------------------------- | ---------------------------------------- |
| top-left     | `CanvasTextureLoader`        | A programmatic `HTMLCanvasElement` (gradient + circle + label). |
| top-right    | `ImageURLTextureLoader`      | A `data:image/png` URL generated at runtime (offline-friendly). |
| bottom-left  | `VideoTextureLoader`         | A CC0 webm streamed from MDN's media bucket (`Access-Control-Allow-Origin: *`, required for `crossOrigin="anonymous"`). |
| bottom-right | `NDArrayTextureLoader`       | A 64x64 RGBA `Uint8Array` plasma pattern wrapped with `ndarray`. |

The sidebar shows each source's resolved size, the loader class that handled
it, and a status indicator. The "Dispose all" button calls `resolver.dispose()`
and freezes the canvas to demonstrate cleanup.

## How it wires the loaders

```ts
import "webgltexture-loader-dom";   // registers Canvas/ImageURL/Video loaders
import "webgltexture-loader-ndarray"; // registers NDArrayTextureLoader
import { LoaderResolver } from "webgltexture-loader";

const resolver = new LoaderResolver(gl);
const loader = resolver.resolve(input);
await loader?.load(input);
loader?.update(input);            // only needed for live sources (e.g. <video>)
const { texture, width, height } = loader!.get(input)!;
```

Each frame the render loop calls `update()` only for live sources (the
`<video>`) so they re-upload their latest frame; static sources are uploaded
once by the loader's first `get()`.

## Notes

- The video uses `crossOrigin="anonymous"`; if it fails to play in your
  browser, drop a `sample.mp4` into `apps/example-web/public/` and edit
  `VIDEO_URL` in `src/main.ts`.
- The Expo and React Native loaders are intentionally not exercised here —
  they need a native runtime that can't run in a plain web demo.
- This app sits outside the library `yarn build` cascade. Run
  `corepack yarn workspace example-web build` to type-check and bundle it.
