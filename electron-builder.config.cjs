const fs = require("node:fs/promises");
const path = require("node:path");

const electronDist = require("./scripts/electron-builder-electron-dist.cjs");
const electronPackage = require("electron/package.json");
const PRODUCT_NAME = "LeRobot Dataset Visualizer";
const ROOT_DIR = __dirname;
const APP_SLUG = "lerobot-dataset-visualizer";

function getResourcesDirectory(appOutDir, electronPlatformName) {
  if (electronPlatformName === "darwin") {
    return path.join(appOutDir, `${PRODUCT_NAME}.app`, "Contents", "Resources");
  }

  return path.join(appOutDir, "resources");
}

async function copyNextRuntime(appOutDir, electronPlatformName) {
  const source = path.join(__dirname, ".next", "standalone");
  const destination = path.join(
    getResourcesDirectory(appOutDir, electronPlatformName),
    "next",
  );

  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true });
}

module.exports = {
  appId: "com.hanxudong.lerobot-dataset-visualizer",
  productName: PRODUCT_NAME,
  electronVersion: electronPackage.version,
  artifactName: `${APP_SLUG}-\${version}-\${os}-\${arch}.\${ext}`,
  icon: path.join(ROOT_DIR, "public", "assets", "icons", "lerobot-icon.png"),
  compression: "normal",
  npmRebuild: false,
  electronDist: electronDist.default,
  directories: {
    output: path.join(ROOT_DIR, "dist-electron"),
  },
  files: ["**/*"],
  afterPack: async (context) => {
    await copyNextRuntime(context.appOutDir, context.electronPlatformName);
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Science",
    executableName: APP_SLUG,
    icon: path.join(ROOT_DIR, "public", "assets", "icons", "lerobot-icon.png"),
  },
  win: {
    target: ["nsis"],
    icon: path.join(
      ROOT_DIR,
      "public",
      "assets",
      "icons",
      "generated",
      "lerobot.ico",
    ),
  },
  mac: {
    target: ["dmg"],
    icon: path.join(
      ROOT_DIR,
      "public",
      "assets",
      "icons",
      "generated",
      "lerobot.icns",
    ),
  },
};
