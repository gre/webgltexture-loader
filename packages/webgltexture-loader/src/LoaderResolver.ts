import type LoadersRegistry from "./LoadersRegistry.js";
import type WebGLTextureLoader from "./WebGLTextureLoader.js";
import globalRegistry from "./globalRegistry.js";

export default class LoaderResolver {
  loaders: WebGLTextureLoader<unknown>[];

  constructor(
    gl: WebGLRenderingContext,
    registry: LoadersRegistry = globalRegistry
  ) {
    this.loaders = registry.get().map((L) => new L(gl));
  }

  dispose(): void {
    this.loaders.forEach((l) => l.dispose());
  }

  resolve<T>(input: T): WebGLTextureLoader<T> | undefined {
    return this.loaders.find((loader) => loader.canLoad(input)) as
      | WebGLTextureLoader<T>
      | undefined;
  }
}
