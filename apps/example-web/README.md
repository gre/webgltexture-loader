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

The demo requests a **WebGL2** context first and falls back to WebGL1 if the
browser doesn't have one (the sidebar pill makes the choice visible).

### WebGL2 (3x2 grid, default)

| Cell        | Loader                  | Source                                                                                                  |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| top-left    | `CanvasTextureLoader`   | A programmatic `HTMLCanvasElement` (gradient + circle + label).                                         |
| top-mid     | `ImageURLTextureLoader` | A `data:image/png` URL generated at runtime (offline-friendly).                                         |
| top-right   | `VideoTextureLoader`    | A CC0 webm from MDN's media bucket.                                                                     |
| bottom-left | `NDArrayTextureLoader`  | A 256x256 RGBA gamma-ramp gradient downcast from Uint16 (`v >> 8`) — same pixels as the cell to its right but uploaded as `uint8`. |
| bottom-mid  | `NDArrayTextureLoader`  | The same 256x256 gradient as a `Uint16Array` ndarray, uploaded via the WebGL2 integer-texture path (`RGBA16UI`) and sampled through a `usampler2D` divided by `65535.0`. |
| bottom-right| —                       | Flat info panel (no texture).                                                                           |

The bottom row is the precision comparison: a steep gamma ramp is laid out so
the dark end stretches over many 16-bit codes that all collapse to a few 8-bit
codes — the uint8 cell shows visible banding at the dark end while the uint16
cell stays smooth.

### WebGL1 fallback (2x2 grid)

WebGL1 has no integer textures. The demo falls back to the original 2x2 grid
(canvas + image + video + a 64x64 plasma `Uint8` ndarray) and the sidebar pill
flips to a yellow `WebGL1` indicator.

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
