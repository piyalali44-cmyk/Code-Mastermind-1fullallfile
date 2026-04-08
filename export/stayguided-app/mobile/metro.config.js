const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const shakaStub = path.resolve(__dirname, "shims/shaka-player.js");

const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = config.resolver ?? {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "shaka-player" ||
    moduleName.startsWith("shaka-player/")
  ) {
    return { filePath: shakaStub, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
