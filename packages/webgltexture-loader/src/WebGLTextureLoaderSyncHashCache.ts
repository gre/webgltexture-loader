import WebGLTextureLoader, { type TextureAndSize } from "./WebGLTextureLoader.js";

export default class WebGLTextureLoaderSyncHashCache<
  T
> extends WebGLTextureLoader<T> {
  inputHash(_input: T): unknown {
    return "";
  }

  getNoCache(_input: T): TextureAndSize {
    throw new Error("getNoCache must be implemented");
  }

  results: Map<unknown, TextureAndSize> = new Map();
  promises: Map<unknown, Promise<TextureAndSize>> = new Map();

  _disposed = false;

  override dispose(): void {
    const { results, promises } = this;
    results.forEach((r) => {
      this.disposeTexture(r.texture);
    });
    results.clear();
    promises.clear();
    this._disposed = true;
  }

  disposeTexture(texture: WebGLTexture): void {
    this.gl.deleteTexture(texture);
  }

  override get(input: T): TextureAndSize {
    const hash = this.inputHash(input);
    const result = this.results.get(hash);
    if (result) return result;
    const freshResult = this.getNoCache(input);
    this.results.set(hash, freshResult);
    return freshResult;
  }

  override load(input: T): Promise<TextureAndSize> {
    const hash = this.inputHash(input);
    const existing = this.promises.get(hash);
    if (existing) return existing;
    const promise = Promise.resolve(this.get(input));
    this.promises.set(hash, promise);
    return promise;
  }
}
