import globalRegistry from "./globalRegistry.js";
import type LoadersRegistry from "./LoadersRegistry.js";
import type WebGLTextureLoader from "./WebGLTextureLoader.js";

export default class LoaderResolver {
  loaders: WebGLTextureLoader<unknown>[];

  constructor(gl: WebGLRenderingContext, registry: LoadersRegistry = globalRegistry) {
    this.loaders = registry.get().map((L) => new L(gl));
  }

  dispose(): void {
    for (const l of this.loaders) l.dispose();
  }

  resolve<T>(input: T): WebGLTextureLoader<T> | undefined {
    return this.loaders.find((loader) => loader.canLoad(input)) as
      | WebGLTextureLoader<T>
      | undefined;
  }
}
