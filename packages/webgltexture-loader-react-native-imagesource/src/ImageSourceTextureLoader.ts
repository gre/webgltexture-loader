import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache,
  type TextureAndSize,
} from "webgltexture-loader";

type ImageSource = number | { uri: string };

interface RNGLExtension {
  loadTexture(config: { yflip?: boolean; image: ImageSource }): Promise<TextureAndSize>;
  unloadTexture(texture: WebGLTexture): void;
}

export default class ImageSourceTextureLoader extends WebGLTextureLoaderAsyncHashCache<ImageSource> {
  rngl: RNGLExtension = this.gl.getExtension("RN") as unknown as RNGLExtension;

  override canLoad(input: unknown): boolean {
    if (typeof input === "number") return true;
    return (
      typeof input === "object" &&
      input !== null &&
      typeof (input as { uri?: unknown }).uri === "string"
    );
  }

  override disposeTexture(texture: WebGLTexture): void {
    this.rngl.unloadTexture(texture);
  }

  override inputHash(input: ImageSource) {
    if (typeof input === "number") return input;
    return input.uri;
  }

  override loadNoCache(image: ImageSource) {
    const promise = this.rngl.loadTexture({ yflip: true, image });
    const dispose = () => {};
    return { promise, dispose };
  }
}

globalRegistry.add(ImageSourceTextureLoader);
