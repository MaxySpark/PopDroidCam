import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getDevices: () => ipcRenderer.invoke("get-devices"),
  getCameras: (serial?: string) => ipcRenderer.invoke("get-cameras", serial),
  
  getStatus: () => ipcRenderer.invoke("get-status"),
  getRuntimeInfo: () => ipcRenderer.invoke("get-runtime-info"),
  startStream: (options: {
    cameraId: string;
    resolution: string;
    fps: string;
    serial?: string;
    rotation?: string;
    quality?: string;
  }) => ipcRenderer.invoke("start-stream", options),
  stopStream: () => ipcRenderer.invoke("stop-stream"),
  
  adbConnect: (ip: string, port: string) => ipcRenderer.invoke("adb-connect", ip, port),
  adbPair: (ip: string, port: string, code: string) => ipcRenderer.invoke("adb-pair", ip, port, code),
  adbDisconnect: () => ipcRenderer.invoke("adb-disconnect"),
  adbKillServer: () => ipcRenderer.invoke("adb-kill-server"),
});

declare global {
  interface Window {
    electronAPI: {
      getDevices: () => Promise<Array<{ serial: string; state: string; type: "WiFi" | "USB"; model?: string }>>;
      getCameras: (serial?: string) => Promise<Record<string, { facing: string; fps: string[]; resolutions: string[] }>>;
      getStatus: () => Promise<{ running: boolean; pid: number | null; config: Record<string, string> }>;
      getRuntimeInfo: () => Promise<{
        platform: NodeJS.Platform;
        output: "obs" | "v4l2";
        captureTitle?: string;
        obsInstalled?: boolean;
        stateDirectory: string;
        dependencies: {
          adb: { available: boolean; executable: string };
          scrcpy: { available: boolean; executable: string };
        };
      }>;
      startStream: (options: {
        cameraId: string;
        resolution: string;
        fps: string;
        serial?: string;
        rotation?: "0" | "90" | "180" | "270";
        quality?: "low" | "medium" | "high" | "ultra";
        mirror?: "off" | "on";
        zoom?: "1x" | "1.5x" | "2x" | "3x" | "4x";
      }) => Promise<{ success: boolean; pid?: number; error?: string }>;
      stopStream: () => Promise<boolean>;
      adbConnect: (ip: string, port: string) => Promise<boolean>;
      adbPair: (ip: string, port: string, code: string) => Promise<boolean>;
      adbDisconnect: () => Promise<boolean>;
      adbKillServer: () => Promise<boolean>;
    };
  }
}
