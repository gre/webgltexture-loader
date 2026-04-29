import type WebGLTextureLoader from "./WebGLTextureLoader.js";

export type LoaderClass = new (gl: WebGLRenderingContext) => WebGLTextureLoader<unknown>;

/**
 * Loaders may declare a static `priority` number; higher priority is
 * tried first. Default priority is 0.
 */
export default class LoadersRegistry {
  private _loaders: LoaderClass[] = [];

  /** Add a TextureLoader class to extend texture format support. */
  add<T>(loader: new (gl: WebGLRenderingContext) => WebGLTextureLoader<T>): void {
    this._loaders.push(loader as LoaderClass);
    this._loaders.sort((a, b) => {
      const ap = (a as { priority?: number }).priority;
      const bp = (b as { priority?: number }).priority;
      return (typeof bp === "number" ? bp : 0) - (typeof ap === "number" ? ap : 0);
    });
  }

  /** Remove a previously added WebGLTextureLoader class. */
  remove<T>(loader: new (gl: WebGLRenderingContext) => WebGLTextureLoader<T>): void {
    const i = this._loaders.indexOf(loader as LoaderClass);
    if (i !== -1) {
      this._loaders.splice(i, 1);
    }
  }

  /** Loaders ordered by highest priority first. */
  get(): LoaderClass[] {
    return this._loaders;
  }
}
