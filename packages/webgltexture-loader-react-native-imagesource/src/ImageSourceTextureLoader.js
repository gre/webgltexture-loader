//@flow
import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache
} from "webgltexture-loader";

type ImageSource = Object | number;

class ImageSourceTextureLoader extends WebGLTextureLoaderAsyncHashCache<
  ImageSource
> {
  rngl = this.gl.getExtension("RN");

  canLoad(input: any) {
    return (
      typeof input === "number" ||
      (input && typeof input === "object" && typeof input.uri === "string")
    );
  }

  disposeTexture(texture: WebGLTexture) {
    this.rngl.unloadTexture(texture);
  }

  inputHash(input: ImageSource) {
    if (typeof input === "number") return input;
    return input.uri;
  }

  loadNoCache(image: ImageSource) {
    const promise = this.rngl.loadTexture({ yflip: true, image });
    const dispose = () => {
      // FIXME not sure what we can do for now
    };
    return { promise, dispose };
  }
}

globalRegistry.add(ImageSourceTextureLoader);

export default ImageSourceTextureLoader;
