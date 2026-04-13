const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { fork } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = Number(process.env.ELECTRON_INTERNAL_PORT ?? "3210");

let mainWindow = null;
let nextServerProcess = null;

function getAppRoot() {
  return app.isPackaged ? process.resourcesPath : app.getAppPath();
}

function getStandaloneDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "next")
    : path.join(getAppRoot(), ".next", "standalone");
}

function getPreloadPath() {
  return path.join(__dirname, "preload.cjs");
}

async function validateDatasetDirectory(directoryPath) {
  const metadataPath = path.join(directoryPath, "meta", "info.json");
  const stats = await fs.stat(directoryPath);

  if (!stats.isDirectory()) {
    throw new Error("Selected path is not a directory.");
  }

  await fs.access(metadataPath);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Next.js server at ${url}`);
}

async function startBundledNextServer() {
  if (DEV_SERVER_URL || nextServerProcess) {
    return;
  }

  const standaloneDirectory = getStandaloneDirectory();
  const serverEntry = path.join(standaloneDirectory, "server.js");

  nextServerProcess = fork(serverEntry, [], {
    cwd: standaloneDirectory,
    env: {
      ...process.env,
      HOSTNAME: SERVER_HOST,
      PORT: String(SERVER_PORT),
    },
    stdio: "inherit",
  });

  nextServerProcess.once("exit", (code) => {
    nextServerProcess = null;

    if (!app.isQuitting && code && code !== 0) {
      dialog.showErrorBox(
        "Next.js Server Stopped",
        `The embedded Next.js server exited with code ${code}.`,
      );
      app.quit();
    }
  });
}

async function createMainWindow() {
  const targetUrl = DEV_SERVER_URL ?? `http://${SERVER_HOST}:${SERVER_PORT}`;

  if (!DEV_SERVER_URL) {
    await startBundledNextServer();
  }

  await waitForServer(targetUrl);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#06080d",
    title: "LeRobot Dataset Visualizer",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(targetUrl);

  if (DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopNextServer() {
  if (!nextServerProcess || nextServerProcess.killed) {
    return;
  }

  nextServerProcess.kill("SIGTERM");
}

ipcMain.handle("desktop:select-dataset-directory", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose Local Dataset Directory",
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];

  try {
    await validateDatasetDirectory(selectedPath);
  } catch {
    throw new Error(
      "Selected directory does not look like a LeRobot dataset. Expected meta/info.json.",
    );
  }

  return selectedPath;
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopNextServer();
});

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    dialog.showErrorBox(
      "Failed to Launch Desktop App",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
