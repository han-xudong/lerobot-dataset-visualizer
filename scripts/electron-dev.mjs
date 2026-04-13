import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const nextPort = process.env.NEXT_DEV_PORT ?? "3000";
const rendererUrl =
  process.env.ELECTRON_RENDERER_URL ?? `http://127.0.0.1:${nextPort}`;

let nextProcess;
let electronProcess;

function getLocalBinary(binaryName) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  return path.join(repoRoot, "node_modules", ".bin", `${binaryName}${suffix}`);
}

function spawnManaged(command, args, overrides = {}) {
  return spawn(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
    ...overrides,
  });
}

async function waitForUrl(url, timeoutMs = 60000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // The dev server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Next.js dev server at ${url}`);
}

function stopProcess(childProcess) {
  if (!childProcess || childProcess.killed) {
    return;
  }

  childProcess.kill("SIGTERM");
}

function shutdown(exitCode = 0) {
  stopProcess(electronProcess);
  stopProcess(nextProcess);
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => shutdown(0));
}

nextProcess = spawnManaged("bun", [
  "run",
  "dev",
  "--",
  "--hostname",
  "127.0.0.1",
  "--port",
  nextPort,
]);

nextProcess.once("exit", (code) => {
  if (!electronProcess) {
    process.exit(code ?? 0);
  }

  shutdown(code ?? 0);
});

try {
  await waitForUrl(rendererUrl);

  electronProcess = spawnManaged(
    getLocalBinary("electron"),
    ["electron/main.cjs"],
    {
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: rendererUrl,
      },
    },
  );

  electronProcess.once("exit", (code) => {
    shutdown(code ?? 0);
  });
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Failed to start Electron desktop mode.",
  );
  shutdown(1);
}
