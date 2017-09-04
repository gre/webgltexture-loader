//@flow
import type LoadersRegistry from "./LoadersRegistry";
import type WebGLTextureLoader from "./WebGLTextureLoader";
import globalRegistry from "./globalRegistry";

export default class LoaderResolver {
  loaders: Array<WebGLTextureLoader<*>>;

  constructor(
    gl: WebGLRenderingContext,
    registry: LoadersRegistry = globalRegistry
  ) {
    this.loaders = registry.get().map(L => new L(gl));
  }

  dispose() {
    this.loaders.forEach(l => l.dispose());
  }

  resolve<T>(input: T): ?WebGLTextureLoader<T> {
    return this.loaders.find(loader => loader.canLoad(input));
  }
}
