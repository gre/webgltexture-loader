import {
  createTexture,
  globalRegistry,
  WebGLTextureLoaderAsyncHashCache,
} from "webgltexture-loader";

function loadImage(
  src: string,
  success: (img: HTMLImageElement) => void,
  failure: (e: unknown) => void
): () => void {
  let img: HTMLImageElement | null = new window.Image();
  if (src.slice(0, 5) !== "data:") {
    img.crossOrigin = "anonymous";
  }
  img.onload = () => {
    if (img) success(img);
    img = null;
  };
  img.onabort = failure;
  img.onerror = failure;
  img.src = src;
  return () => {
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.onabort = null;
      img.src = "";
      img = null;
    }
  };
}

export default class ImageURLTextureLoader extends WebGLTextureLoaderAsyncHashCache<string> {
  override canLoad(input: unknown): boolean {
    return typeof input === "string";
  }

  override inputHash(input: string) {
    return input;
  }

  override loadNoCache(src: string) {
    const { gl } = this;
    let dispose: () => void = () => {};
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      dispose = loadImage(src, resolve, (e) =>
        reject(new Error("image load failed", { cause: e }))
      );
    }).then((img) => {
      const { width, height } = img;
      const texture = createTexture(gl);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      return { texture, width, height };
    });
    return { promise, dispose: () => dispose() };
  }
}

globalRegistry.add(ImageURLTextureLoader);
