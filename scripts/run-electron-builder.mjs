import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const electronAppDir = path.join(
  os.tmpdir(),
  "lerobot-dataset-visualizer-electron-app",
);
const electronBuilderCli = path.join(
  repoRoot,
  "node_modules",
  "electron-builder",
  "cli.js",
);
const forwardedArgs = process.argv.slice(2);

function normalizeConfigPath(args) {
  const normalizedArgs = [...args];
  const configFlagIndex = normalizedArgs.findIndex(
    (arg) => arg === "--config" || arg === "-c",
  );

  if (configFlagIndex === -1 || !normalizedArgs[configFlagIndex + 1]) {
    return normalizedArgs;
  }

  normalizedArgs[configFlagIndex + 1] = path.resolve(
    repoRoot,
    normalizedArgs[configFlagIndex + 1],
  );

  return normalizedArgs;
}

const normalizedArgs = normalizeConfigPath(forwardedArgs);

const childProcess = spawn(
  process.execPath,
  [electronBuilderCli, "--projectDir", electronAppDir, ...normalizedArgs],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  },
);

childProcess.once("error", (error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Failed to start electron-builder.",
  );
  process.exit(1);
});

childProcess.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
