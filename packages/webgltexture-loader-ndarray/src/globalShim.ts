// typedarray-pool references `global` at module top-level (e.g. `global.__TYPEDARRAY_POOL`).
// In browsers there is no `global` — only `globalThis` / `window`. The recommended
// fix is for the consumer's bundler to map `global` to `globalThis` (Vite, Webpack,
// esbuild all support this via `define`). This file is the runtime fallback for
// consumers who don't configure that, and also shims `Buffer.isBuffer` which
// typedarray-pool calls at runtime.
//
// Use Object.defineProperty so the assignment isn't DCE'd by esbuild's tree-shaker
// (which can otherwise consider `globalThis.global = globalThis` a dead store).
const root = globalThis as unknown as Record<string, unknown>;

if (typeof root.global === "undefined") {
  Object.defineProperty(root, "global", {
    value: root,
    writable: true,
    configurable: true,
  });
}

if (typeof root.Buffer === "undefined") {
  Object.defineProperty(root, "Buffer", {
    value: { isBuffer: () => false },
    writable: true,
    configurable: true,
  });
}
