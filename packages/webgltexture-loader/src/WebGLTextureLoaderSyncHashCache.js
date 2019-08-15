//@flow
import WebGLTextureLoader from "./WebGLTextureLoader";
import type { TextureAndSize } from "./WebGLTextureLoader";

class WebGLTextureLoaderSyncHashCache<T> extends WebGLTextureLoader<T> {
  // return a unique representation of the input (typically a hash, or anything that can be used as ref identifier)
  inputHash(input: T) {
    return "";
  }
  // An async load function that does not cache (WebGLTextureLoaderAsyncHashCache do the caching with inputHash). it also should return a dispose function to cancel a pending load
  getNoCache(input: T): TextureAndSize {
    throw new Error("getNoCache must be implemented");
  }

  results: Map<*, TextureAndSize> = new Map();
  promises: Map<*, Promise<TextureAndSize>> = new Map();

  _disposed = false;
  dispose() {
    const { gl, results, promises } = this;
    results.forEach(r => {
      this.disposeTexture(r.texture);
    });
    results.clear();
    promises.clear();
    this._disposed = true;
  }

  disposeTexture(texture: WebGLTexture) {
    this.gl.deleteTexture(texture);
  }

  get(input: T) {
    const hash = this.inputHash(input);
    const result = this.results.get(hash);
    if (result) return result;
    const freshResult = this.getNoCache(input);
    this.results.set(hash, freshResult);
    return freshResult;
  }

  // load() implementation is a dumb fallback on get() but still need to save the promise to guarantee idempotent
  load(input: T) {
    const hash = this.inputHash(input);
    const existing = this.promises.get(hash);
    if (existing) return existing;
    const promise = Promise.resolve(this.get(input));
    this.promises.set(hash, promise);
    return promise;
  }
}

export default WebGLTextureLoaderSyncHashCache;
