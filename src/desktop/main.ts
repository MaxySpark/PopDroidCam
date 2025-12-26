import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getDevices,
  getCameraSizes,
  startStream,
  stopStream,
  isRunning,
  getCurrentConfig,
  adbConnect,
  adbPair,
  adbDisconnect,
  type StartStreamOptions,
} from "../utils.js";

// ESM polyfill for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: "PopDroidCam",
    icon: join(__dirname, "../../assets/icon.png"),
    backgroundColor: "#09090b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "preload.js"),
    },
  });

  // Load the HTML file
  const htmlPath = join(__dirname, "renderer/index.html");
  if (isDev) {
    mainWindow.loadFile(htmlPath);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Hide menu bar on Linux
  mainWindow.setMenuBarVisibility(false);
}

function createTray() {
  // Create a simple tray icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: "Open PopDroidCam", 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: "separator" },
    { 
      label: "Start Camera", 
      click: () => {
        // Quick start with defaults
        const devices = getDevices();
        if (devices.length > 0) {
          const cameras = getCameraSizes(devices[0].serial);
          const camIds = Object.keys(cameras);
          if (camIds.length > 0) {
            startStream({
              cameraId: camIds[0],
              resolution: "1920x1080",
              fps: "30",
              serial: devices[0].serial,
            });
          }
        }
      }
    },
    { 
      label: "Stop Camera", 
      click: () => stopStream()
    },
    { type: "separator" },
    { 
      label: "Quit", 
      click: () => {
        stopStream();
        app.quit();
      }
    }
  ]);

  tray.setToolTip("PopDroidCam");
  tray.setContextMenu(contextMenu);
  
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

// IPC Handlers - expose utils to renderer
function setupIPC() {
  ipcMain.handle("get-devices", () => {
    return getDevices();
  });

  ipcMain.handle("get-cameras", (_event: Electron.IpcMainInvokeEvent, serial?: string) => {
    return getCameraSizes(serial);
  });

  ipcMain.handle("get-status", () => {
    const pid = isRunning();
    const config = getCurrentConfig();
    return { running: pid !== null, pid, config };
  });

  ipcMain.handle("start-stream", (_event: Electron.IpcMainInvokeEvent, options: StartStreamOptions) => {
    return startStream(options);
  });

  ipcMain.handle("stop-stream", () => {
    return stopStream();
  });

  ipcMain.handle("adb-connect", (_event: Electron.IpcMainInvokeEvent, ip: string, port: string) => {
    return adbConnect(ip, port);
  });

  ipcMain.handle("adb-pair", (_event: Electron.IpcMainInvokeEvent, ip: string, port: string, code: string) => {
    return adbPair(ip, port, code);
  });

  ipcMain.handle("adb-disconnect", () => {
    adbDisconnect();
    return true;
  });
}

// App lifecycle
app.whenReady().then(() => {
  setupIPC();
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Keep app running in tray on Linux
  if (process.platform !== "darwin") {
    // Don't quit, just hide to tray
  }
});

app.on("before-quit", () => {
  // Stop stream before quitting
  stopStream();
});
