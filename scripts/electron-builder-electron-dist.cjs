const fs = require("node:fs");
const path = require("node:path");

function resolveExistingPath(candidatePath) {
  if (!candidatePath) {
    return null;
  }

  const resolvedPath = path.resolve(candidatePath);
  return fs.existsSync(resolvedPath) ? resolvedPath : null;
}

exports.default = function electronDist(prepareOptions) {
  const overridePath = resolveExistingPath(
    process.env.ELECTRON_BUILDER_ELECTRON_DIST,
  );

  if (overridePath) {
    return overridePath;
  }

  if (prepareOptions?.platformName !== "linux") {
    return null;
  }

  const localElectronDist = resolveExistingPath(
    path.join(process.cwd(), "node_modules", "electron", "dist"),
  );

  if (localElectronDist) {
    return localElectronDist;
  }

  throw new Error(
    "Unable to find a local Electron distribution. Install dependencies first or set ELECTRON_BUILDER_ELECTRON_DIST.",
  );
};
