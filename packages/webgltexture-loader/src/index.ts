import globalRegistry from "./globalRegistry.js";
import LoaderResolver from "./LoaderResolver.js";
import LoadersRegistry from "./LoadersRegistry.js";
import WebGLTextureLoader, { createTexture, type TextureAndSize } from "./WebGLTextureLoader.js";
import WebGLTextureLoaderAsyncHashCache from "./WebGLTextureLoaderAsyncHashCache.js";
import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache.js";

export type { TextureAndSize };
export {
  createTexture,
  globalRegistry,
  LoaderResolver,
  LoadersRegistry,
  WebGLTextureLoader,
  WebGLTextureLoaderAsyncHashCache,
  WebGLTextureLoaderSyncHashCache,
};
