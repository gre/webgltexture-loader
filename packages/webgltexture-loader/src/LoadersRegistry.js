//@flow
import type WebGLTextureLoader from "./WebGLTextureLoader";

/**
 * LoadersRegistry
 * loaders can define a static priority number. more high is priority, more important the loader is to be used first.
 */
export default class LoadersRegistry {
  _loaders: Array<Class<WebGLTextureLoader<any>>> = [];

  /**
   * Add a TextureLoader class to extend texture format support.
   */
  add(loader: Class<WebGLTextureLoader<any>>) {
    this._loaders.push(loader);
    this._loaders.sort(
      (a, b) =>
        (typeof b.priority === "number" ? b.priority : 0) -
        (typeof a.priority === "number" ? a.priority : 0)
    );
  }

  /**
   * Remove a previously added WebGLTextureLoader class.
   */
  remove(loader: Class<WebGLTextureLoader<any>>) {
    const i = this._loaders.indexOf(loader);
    if (i !== -1) {
      this._loaders.splice(i, 1);
    }
  }

  /**
   * List the loaders ordered by most priority first
   */
  get() {
    return this._loaders;
  }
}
