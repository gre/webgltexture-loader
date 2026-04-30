import ndarray, { type NdArray } from "ndarray";

/** Build a 256x256 canvas with a gradient, a circle, and a label. */
export function makeCanvasSource(): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#1f2c4a");
  grad.addColorStop(1, "#7a3fa6");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
  ctx.fillStyle = "#f0c419";
  ctx.fill();

  ctx.fillStyle = "#0e1014";
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("canvas", size / 2, size / 2);

  return canvas;
}

/**
 * Returns a `data:image/png` URL so the demo runs offline and exercises the
 * image-URL loader path (which keys off `typeof input === "string"`).
 */
export function makeImageURL(): string {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = (x * 255) / (size - 1);
      const g = (y * 255) / (size - 1);
      const b = 200 - ((x + y) * 100) / (2 * (size - 1));
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(2, size - 18, size - 4, 14);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("image-url", size / 2, size - 11);

  return canvas.toDataURL("image/png");
}

/**
 * Make a <video> for the public-domain Big Buck Bunny snippet.
 *
 * Returns the element along with a `failed` promise that rejects on a media
 * error or after `timeoutMs` of no readiness, plus a `cancelTimeout` that
 * the caller should invoke once the video is actually ready (e.g. after
 * `loader.load()` resolves). `VideoTextureLoader.load()` polls `videoWidth >
 * 0` and never rejects on its own — the demo watches `failed` so the UI can
 * surface CORS / network / autoplay problems instead of hanging in
 * `loading` forever, and clears the timeout on success so a delayed
 * resolution doesn't spuriously flip the UI to `failed`.
 */
export function makeVideo(
  src: string,
  timeoutMs = 10000,
): {
  video: HTMLVideoElement;
  failed: Promise<never>;
  cancelTimeout: () => void;
} {
  const video = document.createElement("video");
  // crossOrigin must be set *before* src so the request is issued in CORS
  // mode; otherwise the response can taint the media and break WebGL
  // texture uploads in some browsers.
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.src = src;
  // start playback as soon as we can; ignore the rejected promise (autoplay
  // policy may delay until first user gesture, which is fine — the loader
  // just waits for videoWidth > 0).
  video.play().catch(() => {});

  let timer: ReturnType<typeof setTimeout> | undefined;
  let onError: (() => void) | undefined;
  const cleanup = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (onError) {
      video.removeEventListener("error", onError);
      onError = undefined;
    }
  };
  const failed = new Promise<never>((_, reject) => {
    onError = () => {
      const err = video.error;
      cleanup();
      reject(new Error(err ? `video error (code ${err.code}): ${err.message}` : "video error"));
    };
    video.addEventListener("error", onError);
    timer = setTimeout(() => {
      cleanup();
      if (video.videoWidth === 0) {
        reject(new Error(`video not ready after ${timeoutMs}ms (CORS/network/autoplay?)`));
      }
    }, timeoutMs);
  });
  // suppress the default unhandled-rejection if nothing races against it
  failed.catch(() => {});
  return { video, failed, cancelTimeout: cleanup };
}

/** Build a 64x64 RGBA Uint8Array with a plasma-ish pattern. */
export function makeNdArray(): NdArray<Uint8Array> {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const r = Math.sin(u * 8) * 0.5 + 0.5;
      const g = Math.sin(v * 8 + 1.0) * 0.5 + 0.5;
      const b = Math.sin((u + v) * 6 + 2.0) * 0.5 + 0.5;
      const i = (y * size + x) * 4;
      data[i] = (r * 255) | 0;
      data[i + 1] = (g * 255) | 0;
      data[i + 2] = (b * 255) | 0;
      data[i + 3] = 255;
    }
  }
  return ndarray(data, [size, size, 4]);
}

/**
 * Build a 256x256 RGBA gradient using the full uint16 range with a steep gamma
 * curve, so the precision difference between uint16 and uint8 is visible at
 * the dark end (subtle banding when the same data is downcast to 8-bit).
 *
 * Returns both the uint16 source and an 8-bit copy (`value >> 8`) of the same
 * gradient for side-by-side comparison.
 */
export function makeUint16Gradient(): {
  uint16: NdArray<Uint16Array>;
  uint8: NdArray<Uint8Array>;
} {
  const size = 256;
  const u16 = new Uint16Array(size * size * 4);
  const u8 = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Horizontal gamma ramp on R/G/B; the dark end stretches over many
      // 16-bit codes that all collapse to 0..a few in 8-bit, producing
      // visible banding in the uint8 quadrant.
      const t = x / (size - 1);
      const ramp = Math.round(Math.pow(t, 2.2) * 65535);
      // Vertical secondary modulation so each channel differs slightly,
      // making the comparison visually distinct from pure greyscale.
      const m = Math.round((y / (size - 1)) * 65535);
      const i = (y * size + x) * 4;
      u16[i] = ramp;
      u16[i + 1] = (ramp + m) >>> 1;
      u16[i + 2] = m;
      u16[i + 3] = 65535;
      // High-byte truncation matches what uint16 -> uint8 normalization
      // would produce after dividing by 65535 and re-quantizing to 255.
      u8[i] = u16[i]! >> 8;
      u8[i + 1] = u16[i + 1]! >> 8;
      u8[i + 2] = u16[i + 2]! >> 8;
      u8[i + 3] = 255;
    }
  }
  return {
    uint16: ndarray(u16, [size, size, 4]),
    uint8: ndarray(u8, [size, size, 4]),
  };
}
