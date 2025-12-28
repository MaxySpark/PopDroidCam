import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getDevices: () => ipcRenderer.invoke("get-devices"),
  getCameras: (serial?: string) => ipcRenderer.invoke("get-cameras", serial),
  
  getStatus: () => ipcRenderer.invoke("get-status"),
  startStream: (options: {
    cameraId: string;
    resolution: string;
    fps: string;
    serial?: string;
    rotation?: string;
    quality?: string;
    mirror?: string;
    zoom?: string;
    effect?: string;
  }) => ipcRenderer.invoke("start-stream", options),
  stopStream: () => ipcRenderer.invoke("stop-stream"),
  
  adbConnect: (ip: string, port: string) => ipcRenderer.invoke("adb-connect", ip, port),
  adbPair: (ip: string, port: string, code: string) => ipcRenderer.invoke("adb-pair", ip, port, code),
  adbDisconnect: () => ipcRenderer.invoke("adb-disconnect"),
});

declare global {
  interface Window {
    electronAPI: {
      getDevices: () => Promise<Array<{ serial: string; state: string; type: "WiFi" | "USB"; model?: string }>>;
      getCameras: (serial?: string) => Promise<Record<string, { facing: string; fps: string[]; resolutions: string[] }>>;
      getStatus: () => Promise<{ running: boolean; pid: number | null; config: Record<string, string> }>;
      startStream: (options: {
        cameraId: string;
        resolution: string;
        fps: string;
        serial?: string;
        rotation?: string;
        quality?: string;
        mirror?: string;
        zoom?: string;
        effect?: string;
      }) => Promise<{ success: boolean; pid?: number; error?: string }>;
      stopStream: () => Promise<boolean>;
      adbConnect: (ip: string, port: string) => Promise<boolean>;
      adbPair: (ip: string, port: string, code: string) => Promise<boolean>;
      adbDisconnect: () => Promise<boolean>;
    };
  }
}
