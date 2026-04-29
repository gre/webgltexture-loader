import {
  createTexture,
  globalRegistry,
  WebGLTextureLoaderSyncHashCache,
} from "webgltexture-loader";

export default class CanvasTextureLoader extends WebGLTextureLoaderSyncHashCache<HTMLCanvasElement> {
  override canLoad(input: unknown): boolean {
    return input instanceof HTMLCanvasElement;
  }

  override inputHash(input: HTMLCanvasElement) {
    return input;
  }

  override getNoCache(input: HTMLCanvasElement) {
    const { gl } = this;
    const { width, height } = input;
    const texture = createTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
    return { texture, width, height };
  }

  override update(input: HTMLCanvasElement): void {
    const { gl } = this;
    const result = this.get(input);
    if (!result) return;
    gl.bindTexture(gl.TEXTURE_2D, result.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
  }
}

globalRegistry.add(CanvasTextureLoader);
