//@flow
import {
  WebGLTextureLoaderSyncHashCache,
  globalRegistry
} from "webgltexture-loader";
import type { NDArray } from "ndarray";
import drawNDArrayTexture from "./drawNDArrayTexture";

class NDArrayTextureLoader extends WebGLTextureLoaderSyncHashCache<NDArray> {
  canLoad(obj: any) {
    return obj.shape && obj.data && obj.stride;
  }

  inputHash(input: NDArray) {
    return input;
  }

  getNoCache(input: NDArray) {
    const { gl } = this;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const [width, height] = input.shape;
    drawNDArrayTexture(gl, texture, input);
    return { texture, width, height };
  }

  update(input: NDArray) {
    // For now we assume the NDArray always change & need a redraw but we might try to only update if changes later
    const { gl } = this;
    const { texture } = this.get(input);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    drawNDArrayTexture(gl, texture, input);
  }
}

globalRegistry.add(NDArrayTextureLoader);

export default NDArrayTextureLoader;
