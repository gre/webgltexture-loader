import {
  WebGLTextureLoaderAsyncHashCache,
  createTexture,
  globalRegistry,
} from "webgltexture-loader";

export default class VideoTextureLoader extends WebGLTextureLoaderAsyncHashCache<HTMLVideoElement> {
  override canLoad(input: unknown): boolean {
    return input instanceof HTMLVideoElement;
  }

  override inputHash(input: HTMLVideoElement) {
    return input;
  }

  override loadNoCache(input: HTMLVideoElement) {
    const { gl } = this;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const dispose = () => {
      if (timeout !== undefined) clearTimeout(timeout);
    };
    const promise = new Promise<{
      texture: WebGLTexture;
      width: number;
      height: number;
    }>((resolve) => {
      const checkVideoReady = () => {
        if (input.videoWidth > 0) {
          const { videoWidth: width, videoHeight: height } = input;
          const texture = createTexture(gl);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            input
          );
          resolve({ texture, width, height });
        } else {
          timeout = setTimeout(checkVideoReady, 100);
        }
      };
      checkVideoReady();
    });
    return { dispose, promise };
  }

  override update(input: HTMLVideoElement): void {
    const { gl } = this;
    const res = this.get(input);
    if (!res) return;
    gl.bindTexture(gl.TEXTURE_2D, res.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
  }
}

globalRegistry.add(VideoTextureLoader);
