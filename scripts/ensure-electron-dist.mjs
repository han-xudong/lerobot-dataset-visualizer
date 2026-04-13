import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const localElectronDist = path.join(
  repoRoot,
  "node_modules",
  "electron",
  "dist",
);
const customElectronDist = process.env.ELECTRON_BUILDER_ELECTRON_DIST;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    });

    childProcess.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`Electron install script exited with code ${code ?? 1}.`),
      );
    });

    childProcess.once("error", reject);
  });
}

if (customElectronDist) {
  const resolvedCustomDist = path.resolve(customElectronDist);

  if (!(await pathExists(resolvedCustomDist))) {
    throw new Error(
      `ELECTRON_BUILDER_ELECTRON_DIST does not exist: ${resolvedCustomDist}`,
    );
  }

  console.log(`Using Electron dist from ${resolvedCustomDist}`);
  process.exit(0);
}

if (await pathExists(localElectronDist)) {
  console.log(`Electron dist is ready at ${localElectronDist}`);
  process.exit(0);
}

console.log("Electron dist is missing. Running electron/install.js...");
await runNodeScript(
  path.join(repoRoot, "node_modules", "electron", "install.js"),
);

if (!(await pathExists(localElectronDist))) {
  throw new Error(
    "Electron install completed, but node_modules/electron/dist was not created.",
  );
}

console.log(`Electron dist is ready at ${localElectronDist}`);
