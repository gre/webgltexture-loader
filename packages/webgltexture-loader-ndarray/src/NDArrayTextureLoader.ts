// Imported first so the `global`/`Buffer` polyfills run before any transitive
// import of `typedarray-pool` (which references `global` at module top-level).
// Anchored here — the package's published entry point — so the shim is always
// loaded by any consumer of this loader.
import "./globalShim.js";
import type { NdArray } from "ndarray";
import {
  createTexture,
  globalRegistry,
  WebGLTextureLoaderSyncHashCache,
} from "webgltexture-loader";
import drawNDArrayTexture from "./drawNDArrayTexture.js";

export default class NDArrayTextureLoader extends WebGLTextureLoaderSyncHashCache<NdArray> {
  floatSupported: boolean;

  constructor(gl: WebGLRenderingContext) {
    super(gl);
    this.floatSupported = !!gl.getExtension("OES_texture_float_linear");
  }

  override canLoad(input: unknown): boolean {
    const obj = input as { shape?: unknown; data?: unknown; stride?: unknown };
    return !!(obj?.shape && obj.data && obj.stride);
  }

  override inputHash(input: NdArray) {
    return input;
  }

  override getNoCache(input: NdArray) {
    const { gl } = this;
    const texture = createTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const [width, height] = input.shape;
    drawNDArrayTexture(gl, input, this.floatSupported);
    return { texture, width, height };
  }

  override update(input: NdArray): void {
    const { gl } = this;
    const result = this.get(input);
    if (!result) return;
    gl.bindTexture(gl.TEXTURE_2D, result.texture);
    drawNDArrayTexture(gl, input, this.floatSupported);
  }
}

globalRegistry.add(NDArrayTextureLoader);
