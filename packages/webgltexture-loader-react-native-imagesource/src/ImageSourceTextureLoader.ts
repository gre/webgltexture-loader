import {
  globalRegistry,
  type TextureAndSize,
  WebGLTextureLoaderAsyncHashCache,
} from "webgltexture-loader";

type ImageSource = number | { uri: string };

interface RNGLExtension {
  loadTexture(config: { yflip?: boolean; image: ImageSource }): Promise<TextureAndSize>;
  unloadTexture(texture: WebGLTexture): void;
}

export default class ImageSourceTextureLoader extends WebGLTextureLoaderAsyncHashCache<ImageSource> {
  rngl: RNGLExtension | null = this.gl.getExtension("RN") as unknown as RNGLExtension | null;

  override canLoad(input: unknown): boolean {
    if (!this.rngl) return false;
    if (typeof input === "number") return true;
    return (
      typeof input === "object" &&
      input !== null &&
      typeof (input as { uri?: unknown }).uri === "string"
    );
  }

  override disposeTexture(texture: WebGLTexture): void {
    this.rngl?.unloadTexture(texture);
  }

  override inputHash(input: ImageSource) {
    if (typeof input === "number") return input;
    return input.uri;
  }

  override loadNoCache(image: ImageSource) {
    const promise = this.rngl
      ? this.rngl.loadTexture({ yflip: true, image })
      : Promise.reject(new Error("react-native-webgl 'RN' extension not available"));
    const dispose = () => {};
    return { promise, dispose };
  }
}

globalRegistry.add(ImageSourceTextureLoader);
