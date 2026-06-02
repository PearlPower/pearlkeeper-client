/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
// apps/mobile/metro.config.js
// Source: Expo SDK 52+ changelog — EXPO_USE_METRO_WORKSPACE_ROOT enabled by default
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// SDK 52+ configures monorepo resolution automatically when using expo/metro-config.
// If workspace packages (dist/) fail to resolve, add:
// config.watchFolders = [workspaceRoot];
// config.resolver.nodeModulesPaths = [
// path.resolve(projectRoot, 'node_modules'),
// path.resolve(workspaceRoot, 'node_modules'),
// ];

module.exports = config;
