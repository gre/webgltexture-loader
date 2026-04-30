// Side-effect imports register each loader on the global registry.
import "webgltexture-loader-dom";
import "webgltexture-loader-ndarray";

import { LoaderResolver, type WebGLTextureLoader } from "webgltexture-loader";
import type { NdArray } from "ndarray";

import {
  createFullscreenQuad,
  createProgram,
  FRAG_SRC_GL1,
  FRAG_SRC_GL2,
  getGL,
  VERT_SRC_GL1,
  VERT_SRC_GL2,
} from "./gl.js";
import {
  makeCanvasSource,
  makeImageURL,
  makeNdArray,
  makeUint16Gradient,
  makeVideo,
} from "./sources.js";

type Status = "loading" | "loaded" | "failed" | "disposed";

type SourceInput =
  | HTMLCanvasElement
  | HTMLVideoElement
  | string
  | NdArray<Uint8Array>
  | NdArray<Uint16Array>;

interface Source {
  readonly name: string;
  readonly position: string;
  readonly uniform: string;
  readonly input: SourceInput;
  readonly textureUnit: number;
  /** Whether this source mutates over time and needs `update()` every frame. */
  readonly live: boolean;
  /**
   * Whether the underlying texture is a WebGL2 integer texture (uint16 etc.).
   * Such textures must use NEAREST filtering — most GPUs reject LINEAR for
   * integer internalformats, and the bound `usampler2D` returns `uvec4` so
   * filtering would have nothing meaningful to interpolate.
   */
  readonly integerTexture?: boolean;
  /**
   * Optional promise that rejects to signal the input cannot become ready
   * (e.g. video errored or timed out). Raced against `loader.load()` so the
   * demo doesn't hang in `loading` forever when the loader's poll-loop never
   * resolves.
   */
  readonly failOn?: Promise<never>;
  /**
   * Optional callback invoked when `loader.load()` eventually resolves; lets
   * the source clean up bookkeeping (e.g. cancel a readiness timeout) so a
   * late-arriving `failOn` rejection can't flip the status back to `failed`.
   */
  readonly onReady?: () => void;
  loader?: WebGLTextureLoader<SourceInput>;
  /** True once we've configured tex params for the bound texture. */
  paramsSet: boolean;
  status: Status;
  error?: string;
}

// CC0 sample on MDN's media bucket; advertises `Access-Control-Allow-Origin: *`,
// required for `crossOrigin="anonymous"` so `gl.texImage2D(<video>)` doesn't
// taint the canvas.
const VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm";

function need<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`required DOM node #${id} not found`);
  return el as T;
}
const canvasEl = need<HTMLCanvasElement>("gl");
const sourcesEl = need<HTMLUListElement>("sources");
const disposeBtn = need<HTMLButtonElement>("dispose");
const glVersionEl = need<HTMLSpanElement>("gl-version");
const noteEl = need<HTMLParagraphElement>("note");

const { gl, isWebGL2 } = getGL(canvasEl);
glVersionEl.textContent = isWebGL2 ? "WebGL2" : "WebGL1";
glVersionEl.className = isWebGL2 ? "pill ok" : "pill warn";
noteEl.textContent = isWebGL2
  ? "Bottom row: same gradient rendered as Uint8 (left) vs Uint16 (mid). The dark end of Uint8 shows visible banding because the gamma ramp under-utilises the 8-bit code space."
  : "WebGL2 unavailable: showing the 2x2 fallback grid. The Uint16 ndarray cell needs WebGL2 integer textures.";
// Match canvas aspect to the grid so each cell stays square: 3:2 for
// WebGL2's 3x2 layout, 1:1 for the WebGL1 2x2 fallback.
document.documentElement.style.setProperty("--aspect", isWebGL2 ? "1.5" : "1");
const resolver = new LoaderResolver(gl);

const { video, failed: videoFailed, cancelTimeout: cancelVideoTimeout } = makeVideo(VIDEO_URL);
const { uint16: ndUint16, uint8: ndUint16AsUint8 } = makeUint16Gradient();

// Texture units are assigned by demo-grid position so the uniform map below is
// stable across the WebGL1 / WebGL2 layouts. The WebGL2 fragment shader
// references `u_uint16` (a usampler2D); on WebGL1 we render only the 2x2
// subset (canvas/image/video/ndarray-uint8) and skip the integer cell.
const sources: Source[] = [
  {
    name: "HTMLCanvasElement",
    position: "top-left",
    uniform: "u_canvas",
    input: makeCanvasSource(),
    textureUnit: 0,
    live: false,
    paramsSet: false,
    status: "loading",
  },
  {
    name: "Image URL (data:)",
    position: isWebGL2 ? "top-mid" : "top-right",
    uniform: "u_image",
    input: makeImageURL(),
    textureUnit: 1,
    live: false,
    paramsSet: false,
    status: "loading",
  },
  {
    name: "HTMLVideoElement",
    position: isWebGL2 ? "top-right" : "bottom-left",
    uniform: "u_video",
    input: video,
    textureUnit: 2,
    live: true,
    failOn: videoFailed,
    onReady: cancelVideoTimeout,
    paramsSet: false,
    status: "loading",
  },
  {
    name: isWebGL2 ? "ndarray (RGBA Uint8, downcast from Uint16)" : "ndarray (RGBA Uint8, plasma)",
    position: isWebGL2 ? "bottom-left" : "bottom-right",
    // Slot maps to `u_ndarray` on WebGL1 (existing 2x2 grid) and `u_uint8`
    // on WebGL2 (precision-comparison cell). The fragment shader picks the
    // matching uniform name; the unused name simply doesn't get a location.
    uniform: isWebGL2 ? "u_uint8" : "u_ndarray",
    // On WebGL2 use the uint8-downcast of the gradient so the bottom row
    // pairs with the uint16 cell for a direct precision comparison; on
    // WebGL1 keep the legacy plasma since there's nothing to compare to.
    input: isWebGL2 ? ndUint16AsUint8 : makeNdArray(),
    textureUnit: 3,
    live: false,
    paramsSet: false,
    status: "loading",
  },
];

if (isWebGL2) {
  sources.push({
    name: "ndarray (RGBA Uint16, integer texture)",
    position: "bottom-mid",
    uniform: "u_uint16",
    input: ndUint16,
    textureUnit: 4,
    live: false,
    integerTexture: true,
    paramsSet: false,
    status: "loading",
  });
}

const program = createProgram(
  gl,
  isWebGL2 ? VERT_SRC_GL2 : VERT_SRC_GL1,
  isWebGL2 ? FRAG_SRC_GL2 : FRAG_SRC_GL1,
);
gl.useProgram(program);
createFullscreenQuad(gl, gl.getAttribLocation(program, "a_position"));
for (const s of sources) {
  const loc = gl.getUniformLocation(program, s.uniform);
  if (loc) gl.uniform1i(loc, s.textureUnit);
}

// Resolve loaders once per source and kick off async loads.
for (const s of sources) {
  s.loader = resolver.resolve<SourceInput>(s.input);
  if (!s.loader) {
    s.status = "failed";
    s.error = "no loader matched";
    continue;
  }
  const load = s.loader.load(s.input);
  load
    .then(() => {
      // `disposed` is terminal: don't flip status / clear error after the
      // user pressed "Dispose all" or after `failOn` settled the source.
      if (s.status === "disposed") return;
      s.onReady?.();
      // If a stale failOn rejection already flipped us to "failed", restore
      // "loaded" once load actually resolves so the UI matches reality.
      s.status = "loaded";
      s.error = undefined;
    })
    .catch((e: unknown) => {
      if (s.status === "disposed" || s.status === "failed") return;
      s.status = "failed";
      s.error = e instanceof Error ? e.message : String(e);
    });
  // Race against an optional input-level failure signal so a stuck source
  // (e.g. video that never gets `videoWidth > 0`) surfaces as `failed`
  // promptly. If `load` later resolves the .then above will re-flip us.
  s.failOn?.catch((e: unknown) => {
    if (s.status === "loaded" || s.status === "disposed") return;
    s.status = "failed";
    s.error = e instanceof Error ? e.message : String(e);
  });
}

let disposed = false;

function bindAndUpdate(s: Source): boolean {
  if (!s.loader) return false;
  // Activate the dedicated unit *before* anything that may bind a texture:
  // sync loaders can perform their first upload inside `get()` and would
  // bind onto whichever unit was active otherwise; same applies to
  // `update()` for live sources.
  gl.activeTexture(gl.TEXTURE0 + s.textureUnit);
  const result = s.loader.get(s.input);
  if (!result) return false;
  gl.bindTexture(gl.TEXTURE_2D, result.texture);
  // Only re-upload sources that actually mutate (video). Static sources are
  // uploaded once by the loader's first `get()` call.
  if (s.live) s.loader.update(s.input);
  if (!s.paramsSet) {
    // Integer textures (e.g. RGBA16UI) reject LINEAR filtering on every
    // mainstream WebGL2 implementation; force NEAREST for that path.
    const filter = s.integerTexture ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    s.paramsSet = true;
  }
  return true;
}

function render(): void {
  resizeIfNeeded();
  // Always sync the viewport so `gl.clear()` paths (loading / disposed) cover
  // the full canvas after a resize, not just the previous frame's region.
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  if (disposed) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return;
  }
  let allReady = true;
  for (const s of sources) {
    if (!bindAndUpdate(s)) allReady = false;
  }
  if (allReady) {
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } else {
    gl.clearColor(0.05, 0.06, 0.08, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

function resizeIfNeeded(): void {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvasEl.clientWidth;
  const cssH = canvasEl.clientHeight;
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w;
    canvasEl.height = h;
  }
}

interface Row {
  statusEl: HTMLSpanElement;
  sizeEl: Text;
  /** Last rendered values, used to skip no-op DOM writes. */
  lastStatus: string;
  lastSize: string;
}

function buildSidebar(): Row[] {
  const rows: Row[] = [];
  for (const s of sources) {
    const li = document.createElement("li");
    li.className = "source";

    const header = document.createElement("header");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = s.name;
    const pos = document.createElement("span");
    pos.className = "pos";
    pos.textContent = s.position;
    header.appendChild(name);
    header.appendChild(pos);
    li.appendChild(header);

    const dl = document.createElement("dl");
    const statusEl = document.createElement("span");
    statusEl.className = "status loading";
    statusEl.textContent = "loading";
    appendRow(dl, "status", statusEl);

    const sizeEl = document.createTextNode("—");
    appendRow(dl, "size", sizeEl);

    appendRow(dl, "loader", document.createTextNode(s.loader?.constructor.name ?? "—"));

    li.appendChild(dl);
    sourcesEl.appendChild(li);
    rows.push({ statusEl, sizeEl, lastStatus: "", lastSize: "" });
  }
  return rows;
}

const rows = buildSidebar();

function refreshSidebar(): void {
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]!;
    const row = rows[i]!;
    const statusText = s.error ? `failed: ${s.error}` : s.status;
    if (statusText !== row.lastStatus) {
      row.statusEl.className = "status " + s.status;
      row.statusEl.textContent = statusText;
      row.lastStatus = statusText;
    }
    const tex = disposed ? undefined : s.loader?.get(s.input);
    const sizeText = tex ? `${tex.width}×${tex.height}` : "—";
    if (sizeText !== row.lastSize) {
      row.sizeEl.nodeValue = sizeText;
      row.lastSize = sizeText;
    }
  }
}

function appendRow(dl: HTMLDListElement, label: string, value: Node): void {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.appendChild(value);
  dl.appendChild(dt);
  dl.appendChild(dd);
}

disposeBtn.addEventListener("click", () => {
  if (disposed) return;
  resolver.dispose();
  // Cancel the video readiness timer / error listener and stop playback so
  // disposal terminates *all* outstanding work, not just GPU resources.
  cancelVideoTimeout();
  video.pause();
  video.removeAttribute("src");
  video.load();
  disposed = true;
  for (const s of sources) {
    s.status = "disposed";
    // Clear any prior error so the sidebar doesn't render "failed: ..." on
    // a disposed source (refreshSidebar surfaces `error` whenever it's set).
    s.error = undefined;
  }
  disposeBtn.disabled = true;
  disposeBtn.textContent = "Disposed";
});

function tick(): void {
  render();
  refreshSidebar();
  requestAnimationFrame(tick);
}
tick();
