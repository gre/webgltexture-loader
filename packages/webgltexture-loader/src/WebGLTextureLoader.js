//@flow

export type TextureAndSize = {
  texture: WebGLTexture,
  width: number,
  height: number
};

/**
 * a WebGLTextureLoader handle the loading of WebGLTexture for a given input object.
 */
export default class WebGLTextureLoader<T> {
  /**
   * @property {WebGLRenderingContext} gl - the contextual rendering context
   */
  gl: WebGLRenderingContext;

  /**
   *
   */
  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * Cancel and clear everything
   */
  +dispose: () => void;

  /**
   * Check if the loader can handle a given input
   */
  +canLoad: (input: any) => boolean;

  /**
   * Load the resource by its input. returns a promise of {texture,width,height}.
   * idempotent: If load() is called twice with the same input, same promise is returned.
   */
  +load: (input: T) => Promise<TextureAndSize>;

  /**
   * try to get in sync the texture for a given input. otherwise null/undefined.
   * If null is returned, load() can be called in order to load the resource that will then be available in a future get() call.
   */
  +get: (input: T) => ?TextureAndSize;

  /**
   * sync the webgl texture with a loaded input. for instance for <video>/<canvas> elements this needs to be called recurrently (like in a requestAnimationFrame loop) to get the texture updated.
   * update should only get called IF get(input) was returning a result.
   */
  update(input: T): void {
    // Default implementation don't do anything which works for all static content like an image
  }
}
