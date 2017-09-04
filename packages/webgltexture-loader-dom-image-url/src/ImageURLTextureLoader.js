//@flow
import {
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache
} from "webgltexture-loader";

function loadImage(
  src: string,
  success: (img: Image) => void,
  failure: (e: Error) => void
) {
  let img = new window.Image();
  if (src.slice(0, 5) !== "data:") {
    img.crossOrigin = true;
  }
  img.onload = function() {
    if (img) {
      success(img);
    }
    img = null;
  };
  img.onabort = img.onerror = failure;
  img.src = src;
  return function() {
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.onabort = null;
      img.src = "";
      img = null;
    }
  };
}
class ImageURLTextureLoader extends WebGLTextureLoaderAsyncHashCache<string> {
  canLoad(input: any) {
    return typeof input === "string";
  }

  inputHash(input: string) {
    return input;
  }

  loadNoCache(src: string) {
    const { gl } = this;
    let dispose;
    const promise = new Promise(
      (success, failure) => (dispose = loadImage(src, success, failure))
    ).then(img => {
      const { width, height } = img;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      return { texture, width, height };
    });
    return { promise, dispose: () => dispose() };
  }
}

globalRegistry.add(ImageURLTextureLoader);

export default ImageURLTextureLoader;
