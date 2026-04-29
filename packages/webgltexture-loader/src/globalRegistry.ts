import LoadersRegistry from "./LoadersRegistry.js";

const root = globalThis as unknown as Record<string, LoadersRegistry | undefined>;
const KEY = "__webglTextureLoader_registry";

// Singleton on globalThis so multiple bundled copies of this lib share one registry.
const ensureRegistry = (): LoadersRegistry => (root[KEY] ??= new LoadersRegistry());

export default ensureRegistry();
