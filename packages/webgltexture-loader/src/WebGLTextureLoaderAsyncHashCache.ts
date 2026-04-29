import WebGLTextureLoader, { type TextureAndSize } from "./WebGLTextureLoader.js";

const neverEnding: Promise<never> = new Promise(() => {});

export default class WebGLTextureLoaderAsyncHashCache<T> extends WebGLTextureLoader<T> {
  inputHash(_input: T): unknown {
    return "";
  }

  loadNoCache(_input: T): {
    promise: Promise<TextureAndSize>;
    dispose: () => void;
  } {
    return {
      promise: Promise.reject(new Error("loadNoCache is not implemented")),
      dispose: () => {},
    };
  }

  disposes: Map<unknown, () => void> = new Map();
  inputs: Map<unknown, T> = new Map();
  promises: Map<unknown, Promise<TextureAndSize>> = new Map();
  results: Map<unknown, TextureAndSize> = new Map();

  _disposed = false;

  override dispose(): void {
    const { promises, results, inputs, disposes } = this;
    for (const d of disposes.values()) d();
    for (const result of results.values()) this.disposeTexture(result.texture);
    promises.clear();
    results.clear();
    inputs.clear();
    disposes.clear();
    this._disposed = true;
  }

  disposeTexture(texture: WebGLTexture): void {
    this.gl.deleteTexture(texture);
  }

  override load(input: T): Promise<TextureAndSize> {
    const hash = this.inputHash(input);
    const maybePromise = this.promises.get(hash);
    if (maybePromise) return maybePromise;
    const d = this.loadNoCache(input);
    this.disposes.set(hash, d.dispose);
    const promise = d.promise.then((result) => {
      if (!this.promises.has(hash)) {
        return neverEnding;
      }
      this.disposes.delete(hash);
      this.results.set(hash, result);
      return result;
    });
    this.promises.set(hash, promise);
    return promise;
  }

  override get(input: T): TextureAndSize | undefined {
    return this.results.get(this.inputHash(input));
  }

  cancelLoad(input: T): void {
    const hash = this.inputHash(input);
    this.promises.delete(hash);
    const dispose = this.disposes.get(hash);
    if (dispose) {
      dispose();
      this.disposes.delete(hash);
    }
  }
}
