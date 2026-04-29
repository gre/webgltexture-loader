import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache,
  type TextureAndSize,
} from "webgltexture-loader";

type Config = Record<string, unknown>;

interface RNGLExtension {
  loadTexture(config: unknown): Promise<TextureAndSize>;
  unloadTexture(texture: WebGLTexture): void;
}

/**
 * Fallback loader that accepts any object as a react-native-webgl
 * config. Low priority so concrete loaders win.
 */
export default class ConfigTextureLoader extends WebGLTextureLoaderAsyncHashCache<Config> {
  static priority = -100;

  rngl: RNGLExtension = this.gl.getExtension("RN") as unknown as RNGLExtension;

  override canLoad(input: unknown): boolean {
    return typeof input === "object" && input !== null;
  }

  override disposeTexture(texture: WebGLTexture): void {
    this.rngl.unloadTexture(texture);
  }

  override inputHash(config: Config) {
    // JSON.stringify is a quick way to hash the config object.
    return JSON.stringify(config);
  }

  override loadNoCache(config: Config) {
    const promise = this.rngl.loadTexture(config);
    const dispose = () => {};
    return { promise, dispose };
  }
}

globalRegistry.add(ConfigTextureLoader);
