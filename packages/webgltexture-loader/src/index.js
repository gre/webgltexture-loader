//@flow
import WebGLTextureLoader from "./WebGLTextureLoader";
import WebGLTextureLoaderAsyncHashCache from "./WebGLTextureLoaderAsyncHashCache";
import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache";
import LoadersRegistry from "./LoadersRegistry";
import LoaderResolver from "./LoaderResolver";
import globalRegistry from "./globalRegistry";

if (global.__webglTextureLoaderLoaded) {
  global.__webglTextureLoaderLoaded++;
  console.warn(
    "webgltexture-loader is loaded " +
      (global.__webglTextureLoaderLoaded === 2
        ? "twice"
        : global.__webglTextureLoaderLoaded + " times") +
      " in your bundle. This is a problem because the globalRegistry won't discover all loaders. Make sure your package manager / build system is configured properly to dedup."
  );
} else {
  global.__webglTextureLoaderLoaded = 1;
}

export {
  globalRegistry,
  LoadersRegistry,
  LoaderResolver,
  WebGLTextureLoader,
  WebGLTextureLoaderAsyncHashCache,
  WebGLTextureLoaderSyncHashCache
};
