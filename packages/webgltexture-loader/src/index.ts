import WebGLTextureLoader, {
  createTexture,
  type TextureAndSize,
} from "./WebGLTextureLoader.js";
import WebGLTextureLoaderAsyncHashCache from "./WebGLTextureLoaderAsyncHashCache.js";
import WebGLTextureLoaderSyncHashCache from "./WebGLTextureLoaderSyncHashCache.js";
import LoadersRegistry from "./LoadersRegistry.js";
import LoaderResolver from "./LoaderResolver.js";
import globalRegistry from "./globalRegistry.js";

export {
  createTexture,
  globalRegistry,
  LoadersRegistry,
  LoaderResolver,
  WebGLTextureLoader,
  WebGLTextureLoaderAsyncHashCache,
  WebGLTextureLoaderSyncHashCache,
};

export type { TextureAndSize };
