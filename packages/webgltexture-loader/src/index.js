//@flow
import WebGLTextureLoader from "./WebGLTextureLoader";
import WebGLTextureLoaderAsyncHashCache from "./WebGLTextureLoaderAsyncHashCache";
import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache";
import LoadersRegistry from "./LoadersRegistry";
import LoaderResolver from "./LoaderResolver";
import globalRegistry from "./globalRegistry";

const root = typeof window === "undefined" ? global : window;
if (root.__webglTextureLoaderLoaded) {
  root.__webglTextureLoaderLoaded++;
  console.warn(
    "webgltexture-loader is loaded " +
      (root.__webglTextureLoaderLoaded === 2
        ? "twice"
        : root.__webglTextureLoaderLoaded + " times") +
      " in your bundle. This is a problem because the globalRegistry won't discover all loaders. Make sure your package manager / build system is configured properly to dedup."
  );
} else {
  root.__webglTextureLoaderLoaded = 1;
}

export {
  globalRegistry,
  LoadersRegistry,
  LoaderResolver,
  WebGLTextureLoader,
  WebGLTextureLoaderAsyncHashCache,
  WebGLTextureLoaderSyncHashCache
};
