//@flow
import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache
} from "webgltexture-loader";

type Config = Object;

class ConfigTextureLoader extends WebGLTextureLoaderAsyncHashCache<Config> {
  static priority = -100; // this loader accept any config object, so we need a low priority to make this a "last loader" fallback. we might later improve the granularity (making this paradigm first citizen in react-native-webgl?)

  rngl = this.gl.getExtension("RN");

  canLoad(input: any) {
    return typeof input === "object"; // technically any config object is possible, so we'll make sure to use a low priority
  }

  disposeTexture(texture: WebGLTexture) {
    this.rngl.unloadTexture(texture);
  }

  inputHash(config: Config) {
    // JSON.stringify is a quick way to hash the config object
    return JSON.stringify(config);
  }

  loadNoCache(config: Config) {
    const promise = this.rngl.loadTexture(config);
    const dispose = () => {
      // FIXME not sure what we can do for now
    };
    return { promise, dispose };
  }
}

globalRegistry.add(ConfigTextureLoader);

export default ConfigTextureLoader;
