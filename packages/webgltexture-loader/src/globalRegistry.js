import LoadersRegistry from "./LoadersRegistry";

const root = typeof window === "undefined" ? global : window;
const key = "__webglTextureLoader_registry";

// This is a convenient loader registry that store all imported registry
// it needs to be in global state so it does not get lost across potential many lib instances
export default root[key] || (root[key] = new LoadersRegistry());
