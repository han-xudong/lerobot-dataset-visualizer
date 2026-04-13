interface DesktopBridge {
  isElectron: boolean;
  selectDatasetDirectory(): Promise<string | null>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export {};
