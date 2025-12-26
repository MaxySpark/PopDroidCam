import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Device management
  getDevices: () => ipcRenderer.invoke("get-devices"),
  getCameras: (serial?: string) => ipcRenderer.invoke("get-cameras", serial),
  
  // Stream control
  getStatus: () => ipcRenderer.invoke("get-status"),
  startStream: (options: {
    cameraId: string;
    resolution: string;
    fps: string;
    serial?: string;
    rotation?: string;
  }) => ipcRenderer.invoke("start-stream", options),
  stopStream: () => ipcRenderer.invoke("stop-stream"),
  
  // ADB connection
  adbConnect: (ip: string, port: string) => ipcRenderer.invoke("adb-connect", ip, port),
  adbPair: (ip: string, port: string, code: string) => ipcRenderer.invoke("adb-pair", ip, port, code),
  adbDisconnect: () => ipcRenderer.invoke("adb-disconnect"),
});

// Type declarations for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getDevices: () => Promise<Array<{ serial: string; state: string; type: "WiFi" | "USB" }>>;
      getCameras: (serial?: string) => Promise<Record<string, { facing: string; fps: string[]; resolutions: string[] }>>;
      getStatus: () => Promise<{ running: boolean; pid: number | null; config: Record<string, string> }>;
      startStream: (options: {
        cameraId: string;
        resolution: string;
        fps: string;
        serial?: string;
        rotation?: string;
      }) => Promise<{ success: boolean; pid?: number; error?: string }>;
      stopStream: () => Promise<boolean>;
      adbConnect: (ip: string, port: string) => Promise<boolean>;
      adbPair: (ip: string, port: string, code: string) => Promise<boolean>;
      adbDisconnect: () => Promise<boolean>;
    };
  }
}
