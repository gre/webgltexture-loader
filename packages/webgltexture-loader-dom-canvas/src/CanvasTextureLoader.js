//@flow
import {
  WebGLTextureLoaderSyncHashCache,
  globalRegistry
} from "webgltexture-loader";

class CanvasTextureLoader extends WebGLTextureLoaderSyncHashCache<
  HTMLCanvasElement
> {
  disposes = {};

  canLoad(input: any) {
    return input instanceof HTMLCanvasElement;
  }

  inputHash(input: HTMLCanvasElement) {
    return input;
  }

  getNoCache(input: HTMLCanvasElement) {
    const { gl } = this;
    const { width, height } = input;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
    return { texture, width, height };
  }

  update(input: HTMLCanvasElement) {
    const { gl } = this;
    const { texture } = this.get(input);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
  }
}

globalRegistry.add(CanvasTextureLoader);

export default CanvasTextureLoader;
