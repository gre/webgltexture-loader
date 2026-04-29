import LoadersRegistry from "./LoadersRegistry.js";

const root = globalThis as unknown as Record<
  string,
  LoadersRegistry | undefined
>;
const KEY = "__webglTextureLoader_registry";

// Singleton on globalThis so multiple bundled copies of this lib share one registry.
export default (root[KEY] ??= new LoadersRegistry());
