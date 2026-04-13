const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  selectDatasetDirectory: async () => {
    return ipcRenderer.invoke("desktop:select-dataset-directory");
  },
  onMenuCommand: (listener) => {
    const wrappedListener = (_event, command) => {
      listener(command);
    };

    ipcRenderer.on("desktop:menu-command", wrappedListener);

    return () => {
      ipcRenderer.removeListener("desktop:menu-command", wrappedListener);
    };
  },
});
