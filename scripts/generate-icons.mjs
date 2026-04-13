import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const sourceJpgPath = path.join(
  repoRoot,
  "public",
  "assets",
  "icons",
  "lerobot-icon.jpg",
);
const sourcePngPath = path.join(
  repoRoot,
  "public",
  "assets",
  "icons",
  "lerobot-icon.png",
);
const generatedDir = path.join(
  repoRoot,
  "public",
  "assets",
  "icons",
  "generated",
);
const appIconPath = path.join(repoRoot, "src", "app", "icon.png");
const appleIconPath = path.join(repoRoot, "src", "app", "apple-icon.png");
const faviconPath = path.join(repoRoot, "public", "favicon.ico");

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    childProcess.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? 1}.`));
    });

    childProcess.once("error", reject);
  });
}

await fs.mkdir(generatedDir, { recursive: true });

await sharp(sourceJpgPath)
  .resize(1024, 1024, { fit: "cover" })
  .png()
  .toFile(sourcePngPath);

await runCommand("bunx", [
  "icon-gen",
  "-i",
  sourcePngPath,
  "-o",
  generatedDir,
  "--ico",
  "--ico-name",
  "lerobot",
  "--icns",
  "--icns-name",
  "lerobot",
  "--favicon",
  "--favicon-name",
  "favicon",
]);

await fs.copyFile(sourcePngPath, appIconPath);
await fs.copyFile(sourcePngPath, appleIconPath);
await fs.copyFile(path.join(generatedDir, "favicon.ico"), faviconPath);
