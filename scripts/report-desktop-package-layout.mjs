import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const target = process.argv[2];

const layouts = {
  linux: {
    appDir: path.join(repoRoot, "dist-electron", "linux-unpacked"),
    resourcesDir: path.join(
      repoRoot,
      "dist-electron",
      "linux-unpacked",
      "resources",
    ),
  },
  win: {
    appDir: path.join(repoRoot, "dist-electron", "win-unpacked"),
    resourcesDir: path.join(
      repoRoot,
      "dist-electron",
      "win-unpacked",
      "resources",
    ),
  },
  mac: {
    appDir: path.join(repoRoot, "dist-electron", "mac"),
    resourcesDir: path.join(
      repoRoot,
      "dist-electron",
      "mac",
      "LeRobot Dataset Visualizer.app",
      "Contents",
      "Resources",
    ),
  },
};

if (!target || !(target in layouts)) {
  console.error(
    "Usage: node scripts/report-desktop-package-layout.mjs <linux|win|mac>",
  );
  process.exit(1);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getPathSize(targetPath) {
  const stats = await fs.stat(targetPath);

  if (!stats.isDirectory()) {
    return stats.size;
  }

  let totalSize = 0;
  const entries = await fs.readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    totalSize += await getPathSize(path.join(targetPath, entry.name));
  }

  return totalSize;
}

function formatSize(sizeInBytes) {
  const units = ["B", "KB", "MB", "GB"];
  let size = sizeInBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const { appDir, resourcesDir } = layouts[target];
const appAsarPath = path.join(resourcesDir, "app.asar");
const appAsarUnpackedPath = path.join(resourcesDir, "app.asar.unpacked");
const nextRuntimePath = path.join(resourcesDir, "next");

for (const requiredPath of [
  appDir,
  resourcesDir,
  appAsarPath,
  nextRuntimePath,
]) {
  if (!(await pathExists(requiredPath))) {
    console.error(`Missing expected package path: ${requiredPath}`);
    process.exit(1);
  }
}

if (await pathExists(appAsarUnpackedPath)) {
  console.error(
    `Unexpected duplicated dependency tree: ${appAsarUnpackedPath}`,
  );
  process.exit(1);
}

const [appSize, resourcesSize, appAsarSize, nextRuntimeSize] =
  await Promise.all([
    getPathSize(appDir),
    getPathSize(resourcesDir),
    getPathSize(appAsarPath),
    getPathSize(nextRuntimePath),
  ]);

console.log(`Desktop package layout check passed for ${target}`);
console.log(`  app dir: ${appDir} (${formatSize(appSize)})`);
console.log(`  resources: ${resourcesDir} (${formatSize(resourcesSize)})`);
console.log(`  app.asar: ${appAsarPath} (${formatSize(appAsarSize)})`);
console.log(
  `  next runtime: ${nextRuntimePath} (${formatSize(nextRuntimeSize)})`,
);
