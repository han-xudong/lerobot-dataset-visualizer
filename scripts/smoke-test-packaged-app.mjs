import process from "node:process";
import { execSync, spawn } from "node:child_process";

const commandArgs = process.argv.slice(2);

if (commandArgs.length === 0) {
  throw new Error(
    "Usage: node scripts/smoke-test-packaged-app.mjs <command> [args...]",
  );
}

const [command, ...args] = commandArgs;
const port = process.env.ELECTRON_INTERNAL_PORT ?? "3210";
const url = `http://127.0.0.1:${port}/`;
const timeoutMs = Number(process.env.SMOKE_TEST_TIMEOUT_MS ?? "60000");
const cleanupCommand = process.env.SMOKE_TEST_CLEANUP_COMMAND;

const childProcess = spawn(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    DESKTOP_SMOKE_TEST: "1",
    ELECTRON_INTERNAL_PORT: port,
    ELECTRON_SERVER_READY_TIMEOUT_MS: String(timeoutMs),
  },
});

let childExited = false;
let cleanupRan = false;

function cleanup(signal = "SIGTERM") {
  if (cleanupRan) {
    return;
  }

  cleanupRan = true;

  if (!childExited && !childProcess.killed) {
    childProcess.kill(signal);
  }

  if (cleanupCommand) {
    try {
      execSync(cleanupCommand, {
        env: process.env,
        shell: true,
        stdio: "inherit",
      });
    } catch {
      // Cleanup is best-effort and should not hide the original failure.
    }
  }
}

process.on("exit", () => cleanup());
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

childProcess.once("error", (error) => {
  childExited = true;
  console.error(
    `Failed to launch packaged app command: ${command} ${args.join(" ")}`,
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

childProcess.once("exit", (code, signal) => {
  childExited = true;

  if (code !== null && code !== 0) {
    console.error(`Packaged app exited early with code ${code}.`);
    process.exit(code);
  }

  if (signal) {
    console.error(`Packaged app exited early with signal ${signal}.`);
    process.exit(1);
  }
});

const start = Date.now();

while (Date.now() - start < timeoutMs) {
  if (childExited) {
    throw new Error(
      "Packaged app exited before the internal server became ready.",
    );
  }

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (response.ok) {
      console.log(
        `Smoke test passed: ${url} responded with ${response.status}.`,
      );
      cleanup();
      process.exit(0);
    }
  } catch {
    // The packaged app is still starting.
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
}

cleanup();
throw new Error(`Timed out waiting for packaged app to respond at ${url}.`);
