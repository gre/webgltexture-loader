import { defineConfig } from "vite";

// typedarray-pool (transitive of webgltexture-loader-ndarray) references `global`
// at module top-level. Map it to `globalThis` so the bundle works in browsers.
// Required in BOTH the main `define` (used by `vite build` and user code in dev)
// AND inside `optimizeDeps.esbuildOptions.define`, because Vite's dep pre-bundling
// step runs esbuild standalone and doesn't inherit the main define — without it
// `global.__TYPEDARRAY_POOL` survives unrewritten in the pre-bundled chunk and
// crashes the page on first import.
const GLOBAL_DEFINE = { global: "globalThis" } as const;

export default defineConfig({
  define: GLOBAL_DEFINE,
  optimizeDeps: {
    esbuildOptions: {
      define: GLOBAL_DEFINE,
    },
    // The workspace packages publish CommonJS (`tsc` default with NodeNext +
    // CJS-shaped runtime). Force-include them in Vite's pre-bundling so they
    // get the CJS-to-ESM interop, otherwise Rollup can't trace named exports
    // and `vite build` errors out with "X is not exported".
    include: [
      "webgltexture-loader",
      "webgltexture-loader-dom",
      "webgltexture-loader-dom-canvas",
      "webgltexture-loader-dom-image-url",
      "webgltexture-loader-dom-video",
      "webgltexture-loader-ndarray",
      "ndarray",
    ],
  },
  build: {
    commonjsOptions: {
      include: [/webgltexture-loader/, /ndarray/],
    },
  },
});
