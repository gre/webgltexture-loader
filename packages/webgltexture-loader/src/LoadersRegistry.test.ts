import LoadersRegistry from "./LoadersRegistry.js";
import WebGLTextureLoader from "./WebGLTextureLoader.js";

class A extends WebGLTextureLoader<unknown> {}
class B extends WebGLTextureLoader<unknown> {}
class C extends WebGLTextureLoader<unknown> {
  static priority = 10;
}
class D extends WebGLTextureLoader<unknown> {
  static priority = -5;
}

test("empty registry returns []", () => {
  const r = new LoadersRegistry();
  expect(r.get()).toEqual([]);
});

test("add appends loader classes", () => {
  const r = new LoadersRegistry();
  r.add(A);
  r.add(B);
  expect(r.get()).toEqual([A, B]);
});

test("higher static priority comes first; default priority is 0", () => {
  const r = new LoadersRegistry();
  r.add(A);
  r.add(D);
  r.add(C);
  r.add(B);
  expect(r.get()).toEqual([C, A, B, D]);
});

test("remove takes a class out and is a no-op for unknown classes", () => {
  const r = new LoadersRegistry();
  r.add(A);
  r.add(B);
  r.remove(A);
  expect(r.get()).toEqual([B]);
  r.remove(C);
  expect(r.get()).toEqual([B]);
});
