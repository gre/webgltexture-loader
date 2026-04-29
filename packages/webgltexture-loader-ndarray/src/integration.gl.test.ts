import ndarray from "ndarray";
import { LoaderResolver, LoadersRegistry } from "webgltexture-loader";
import NDArrayTextureLoader from "./NDArrayTextureLoader.js";

let createGL: ((w: number, h: number) => WebGLRenderingContext) | null = null;
try {
  createGL = require("gl");
} catch {
  createGL = null;
}

const describeGL = createGL ? describe : describe.skip;

describeGL("LoaderResolver + NDArrayTextureLoader end-to-end", () => {
  let gl: WebGLRenderingContext;

  beforeEach(() => {
    gl = createGL!(2, 2);
  });

  afterEach(() => {
    (gl.getExtension("STACKGL_destroy_context") as { destroy(): void } | null)?.destroy();
  });

  test("resolves an ndarray input and uploads it", () => {
    const registry = new LoadersRegistry();
    registry.add(NDArrayTextureLoader);
    const resolver = new LoaderResolver(gl, registry);

    const arr = ndarray(new Uint8Array([255, 0, 0, 255]), [1, 1, 4]);
    const loader = resolver.resolve(arr);
    expect(loader).toBeInstanceOf(NDArrayTextureLoader);

    const result = loader!.get(arr);
    expect(result?.width).toBe(1);
    expect(result?.height).toBe(1);
    expect(gl.isTexture(result!.texture)).toBe(true);

    expect(resolver.resolve(42)).toBeUndefined();
    expect(resolver.resolve("foo")).toBeUndefined();

    resolver.dispose();
    expect(gl.isTexture(result!.texture)).toBe(false);
  });
});
