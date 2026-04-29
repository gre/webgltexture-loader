export type TextureAndSize = {
  texture: WebGLTexture;
  width: number;
  height: number;
};

/**
 * Calls `gl.createTexture()` and throws if it returns null (typically
 * because the WebGL context has been lost).
 */
export function createTexture(gl: WebGLRenderingContext): WebGLTexture {
  const t = gl.createTexture();
  if (!t) throw new Error("gl.createTexture() returned null (context lost?)");
  return t;
}

/**
 * a WebGLTextureLoader handles the loading of a WebGLTexture for a
 * given input object. Subclasses should typically extend
 * `WebGLTextureLoaderAsyncHashCache` or `WebGLTextureLoaderSyncHashCache`
 * rather than this base class directly.
 */
export default class WebGLTextureLoader<T> {
  gl: WebGLRenderingContext;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /** Cancel anything pending and free all GPU resources owned by this loader. */
  dispose(): void {}

  /** Whether this loader can handle a given input. */
  canLoad(_input: unknown): boolean {
    return false;
  }

  /**
   * Load the resource for a given input.
   *
   * Idempotent: calling `load()` twice with the same input returns the
   * same Promise. Once resolved, `get(input)` returns the same value
   * (`===`) as the resolved promise.
   */
  load(_input: T): Promise<TextureAndSize> {
    return Promise.reject(new Error("load() is not implemented"));
  }

  /**
   * Synchronously fetch the texture for an input that has already been
   * loaded. Returns null/undefined if not loaded yet — call `load()` to
   * trigger loading.
   */
  get(_input: T): TextureAndSize | undefined | null {
    return null;
  }

  /**
   * Re-sync the WebGL texture with a loaded input. For dynamic sources
   * (`<video>`, `<canvas>`) this should be called recurrently (typically
   * in a `requestAnimationFrame` loop). Only call `update()` on inputs
   * for which `get(input)` would return a result.
   */
  update(_input: T): void {}
}
