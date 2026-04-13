const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  selectDatasetDirectory: async () => {
    return ipcRenderer.invoke("desktop:select-dataset-directory");
  },
});
