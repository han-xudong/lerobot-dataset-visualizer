const fs = require("node:fs/promises");
const path = require("node:path");

const electronDist = require("./scripts/electron-builder-electron-dist.cjs");

async function copyNextRuntime(appOutDir) {
  const source = path.join(__dirname, ".next", "standalone");
  const destination = path.join(appOutDir, "resources", "next");

  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true });
}

module.exports = {
  appId: "com.hanxudong.lerobot-viewer",
  productName: "LeRobot Dataset Visualizer",
  icon: "public/assets/icons/lerobot-icon.png",
  compression: "normal",
  npmRebuild: false,
  electronDist: electronDist.default,
  directories: {
    output: "dist-electron",
  },
  files: ["electron/**/*", "package.json"],
  afterPack: async (context) => {
    await copyNextRuntime(context.appOutDir);
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Science",
    icon: "public/assets/icons/lerobot-icon.png",
  },
  win: {
    target: ["nsis"],
    icon: "public/assets/icons/generated/lerobot.ico",
  },
  mac: {
    target: ["dmg"],
    icon: "public/assets/icons/generated/lerobot.icns",
  },
};
