import { createTexture } from "./WebGLTextureLoader.js";

let createGL: ((w: number, h: number) => WebGLRenderingContext) | null = null;
try {
  // headless-gl is optional locally (compiled native binding may be missing).
  // CI installs it, so the tests run there.
  createGL = require("gl");
} catch {
  createGL = null;
}

const describeGL = createGL ? describe : describe.skip;

describeGL("createTexture against headless-gl", () => {
  let gl: WebGLRenderingContext;

  beforeEach(() => {
    gl = createGL!(2, 2);
  });

  afterEach(() => {
    (gl.getExtension("STACKGL_destroy_context") as { destroy(): void } | null)?.destroy();
  });

  test("returns a real WebGLTexture", () => {
    const tex = createTexture(gl);
    expect(tex).toBeTruthy();
    // WebGL: isTexture returns true only after the texture has been bound.
    gl.bindTexture(gl.TEXTURE_2D, tex);
    expect(gl.isTexture(tex)).toBe(true);
    gl.deleteTexture(tex);
    expect(gl.isTexture(tex)).toBe(false);
  });
});
