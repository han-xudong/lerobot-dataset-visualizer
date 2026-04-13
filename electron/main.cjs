const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
} = require("electron");
const { fork } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const APP_NAME = "LeRobot Dataset Visualizer";
const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = Number(process.env.ELECTRON_INTERNAL_PORT ?? "3210");
const IS_SMOKE_TEST =
  process.env.DESKTOP_SMOKE_TEST === "1" ||
  process.argv.includes("--desktop-smoke-test");
const SERVER_READY_TIMEOUT_MS = Number(
  process.env.ELECTRON_SERVER_READY_TIMEOUT_MS ??
    (IS_SMOKE_TEST ? "90000" : "30000"),
);

let mainWindow = null;
let nextServerProcess = null;

function stripTrailingSlashes(value) {
  return value.replace(/[\\/]+$/, "");
}

function encodeLocalDatasetPath(localPath) {
  return encodeURIComponent(stripTrailingSlashes(localPath.trim()));
}

function buildDatasetRoute(input, episode = 0) {
  const trimmed = input.trim();
  const isLikelyLocalPath =
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("~/") ||
    trimmed.startsWith("file://") ||
    /^[A-Za-z]:[\\/]/.test(trimmed);

  if (isLikelyLocalPath) {
    return `/local/${encodeLocalDatasetPath(trimmed)}/episode_${episode}`;
  }

  return `/${trimmed.replace(/^https?:\/\/huggingface\.co\/datasets\//, "")}/episode_${episode}`;
}

function getAppBaseUrl() {
  return DEV_SERVER_URL ?? `http://${SERVER_HOST}:${SERVER_PORT}`;
}

function buildAppUrl(route = "/") {
  return new URL(route, `${getAppBaseUrl()}/`).toString();
}

async function navigateMainWindow(route) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createMainWindow(route);
    return;
  }

  await mainWindow.loadURL(buildAppUrl(route));
}

function sendMenuCommand(command) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("desktop:menu-command", command);
}

async function promptForDatasetDirectory() {
  const result = await dialog.showOpenDialog({
    title: "Choose Local Dataset Directory",
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  await validateDatasetDirectory(selectedPath);
  return selectedPath;
}

async function openLocalDatasetFromMenu() {
  try {
    const selectedPath = await promptForDatasetDirectory();

    if (!selectedPath) {
      return;
    }

    await navigateMainWindow(buildDatasetRoute(selectedPath));
  } catch (error) {
    handleLaunchFailure(
      "Failed to Open Local Dataset",
      error instanceof Error
        ? error
        : new Error("Failed to choose a dataset directory."),
    );
  }
}

function buildAppMenuTemplate() {
  const isMac = process.platform === "darwin";

  return [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+Shift+H",
          click: () => navigateMainWindow("/"),
        },
        {
          label: "Explore Datasets",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => navigateMainWindow("/explore"),
        },
        {
          label: "Open Local Dataset Directory...",
          accelerator: "CmdOrCtrl+O",
          click: () => openLocalDatasetFromMenu(),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Previous Episode",
          accelerator: "Alt+Up",
          click: () => sendMenuCommand("episode-previous"),
        },
        {
          label: "Next Episode",
          accelerator: "Alt+Down",
          click: () => sendMenuCommand("episode-next"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        {
          label: "Toggle Theme",
          accelerator: "CmdOrCtrl+Alt+T",
          click: () => sendMenuCommand("toggle-theme"),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "GitHub Repository",
          click: () =>
            shell.openExternal(
              "https://github.com/han-xudong/lerobot-dataset-visualizer",
            ),
        },
        {
          label: "LeRobot Docs",
          click: () =>
            shell.openExternal("https://huggingface.co/docs/lerobot"),
        },
      ],
    },
  ];
}

function installAppMenu() {
  const menu = Menu.buildFromTemplate(buildAppMenuTemplate());
  Menu.setApplicationMenu(menu);
}

function handleLaunchFailure(title, error) {
  const message = error instanceof Error ? error.message : String(error);

  if (IS_SMOKE_TEST) {
    console.error(`${title}: ${message}`);
    app.exit(1);
    return;
  }

  dialog.showErrorBox(title, message);
  app.quit();
}

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

  await fs.access(serverEntry);

  if (IS_SMOKE_TEST) {
    console.log(`Starting bundled Next.js server from ${serverEntry}`);
  }

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
      handleLaunchFailure(
        "Next.js Server Stopped",
        `The embedded Next.js server exited with code ${code}.`,
      );
    }
  });

  nextServerProcess.once("error", (error) => {
    nextServerProcess = null;

    if (!app.isQuitting) {
      handleLaunchFailure("Failed to Start Next.js Server", error);
    }
  });
}

async function createMainWindow(initialRoute = "/") {
  const targetUrl = buildAppUrl(initialRoute);

  if (!DEV_SERVER_URL) {
    await startBundledNextServer();
  }

  await waitForServer(getAppBaseUrl(), SERVER_READY_TIMEOUT_MS);

  if (IS_SMOKE_TEST) {
    console.log(`Desktop smoke test server ready at ${getAppBaseUrl()}`);
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#06080d",
    title: APP_NAME,
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
  const selectedPath = await promptForDatasetDirectory();

  if (!selectedPath) {
    return null;
  }

  return selectedPath;
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopNextServer();
});

app.whenReady().then(async () => {
  app.setName(APP_NAME);
  installAppMenu();

  try {
    await createMainWindow();
  } catch (error) {
    handleLaunchFailure("Failed to Launch Desktop App", error);
  }

  app.on("activate", async () => {
    if (IS_SMOKE_TEST) {
      return;
    }

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
