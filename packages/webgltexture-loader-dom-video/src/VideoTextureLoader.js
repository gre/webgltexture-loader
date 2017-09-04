//@flow
import {
  WebGLTextureLoaderAsyncHashCache,
  globalRegistry
} from "webgltexture-loader";

class VideoTextureLoader extends WebGLTextureLoaderAsyncHashCache<
  HTMLVideoElement
> {
  canLoad(input: any) {
    return input instanceof HTMLVideoElement;
  }

  inputHash(input: HTMLVideoElement) {
    return input;
  }

  loadNoCache(input: HTMLVideoElement) {
    const { gl } = this;
    const { width, height } = input;

    let timeout;
    const dispose = () => {
      clearTimeout(timeout);
    };

    const promise = new Promise((resolve, reject) => {
      const checkVideoReady = () => {
        if (input.videoWidth > 0) {
          const texture = gl.createTexture();
          const { videoWidth: width, videoHeight: height } = input;
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            input
          );
          resolve({
            texture,
            width,
            height
          });
        } else {
          timeout = setTimeout(checkVideoReady, 100);
        }
      };
      checkVideoReady();
    });

    return { dispose, promise };
  }

  update(input: HTMLVideoElement) {
    const { gl } = this;
    const res = this.get(input);
    if (!res) return;
    gl.bindTexture(gl.TEXTURE_2D, res.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
  }
}

globalRegistry.add(VideoTextureLoader);

export default VideoTextureLoader;
