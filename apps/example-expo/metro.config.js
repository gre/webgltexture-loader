// Metro config for a Yarn workspaces monorepo. Without `watchFolders` +
// `nodeModulesPaths` Metro can't resolve the symlinked `webgltexture-loader*`
// packages and Expo Go fails with "Unable to resolve module".
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Yarn workspaces hoist most deps to the root `node_modules`. Hierarchical
// lookup would also follow `..`, which can resolve duplicate copies of
// `react`/`react-native` from sibling packages and break the bundler.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
