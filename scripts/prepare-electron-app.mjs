import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const appDir = path.join(os.tmpdir(), "lerobot-viewer-electron-app");
const sourceElectronDir = path.join(repoRoot, "electron");
const targetElectronDir = path.join(appDir, "electron");
const rootPackageJsonPath = path.join(repoRoot, "package.json");

const rootPackageJson = JSON.parse(
  await fs.readFile(rootPackageJsonPath, "utf8"),
);

const homepage =
  rootPackageJson.homepage ??
  "https://github.com/huggingface/lerobot-dataset-visualizer";
const repository = rootPackageJson.repository ?? {
  type: "git",
  url: "https://github.com/huggingface/lerobot-dataset-visualizer.git",
};

const stagingPackageJson = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  private: true,
  description: rootPackageJson.description,
  author: rootPackageJson.author,
  homepage,
  repository,
  main: "electron/main.cjs",
};

await fs.rm(appDir, { recursive: true, force: true });
await fs.mkdir(targetElectronDir, { recursive: true });
await fs.cp(sourceElectronDir, targetElectronDir, {
  recursive: true,
  force: true,
});
await fs.writeFile(
  path.join(appDir, "package.json"),
  `${JSON.stringify(stagingPackageJson, null, 2)}\n`,
);

console.log(`Prepared Electron staging app at ${appDir}`);
