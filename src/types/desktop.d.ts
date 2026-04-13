type DesktopMenuCommand =
  | "tab-episodes"
  | "tab-statistics"
  | "tab-filtering"
  | "tab-frames"
  | "tab-insights"
  | "tab-urdf"
  | "toggle-theme"
  | "episode-next"
  | "episode-previous";

interface DesktopBridge {
  isElectron: boolean;
  selectDatasetDirectory(): Promise<string | null>;
  onMenuCommand?(listener: (command: DesktopMenuCommand) => void): () => void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export {};
