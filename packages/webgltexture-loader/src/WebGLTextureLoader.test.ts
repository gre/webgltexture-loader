import { createTexture } from "./WebGLTextureLoader.js";

test("createTexture returns the texture from gl.createTexture", () => {
  const fakeTexture = { id: 1 } as unknown as WebGLTexture;
  const gl = {
    createTexture: () => fakeTexture,
  } as unknown as WebGLRenderingContext;
  expect(createTexture(gl)).toBe(fakeTexture);
});

test("createTexture throws when gl.createTexture returns null", () => {
  const gl = {
    createTexture: () => null,
  } as unknown as WebGLRenderingContext;
  expect(() => createTexture(gl)).toThrow(/createTexture\(\) returned null/);
});
