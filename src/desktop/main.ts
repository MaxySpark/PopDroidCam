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
  adbKillServer,
  getRuntimeInfo,
  isStartStreamOptions,
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
    backgroundColor: "#09090b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "preload.cjs"),
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
  const size = 16;
  const bitmap = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const insideBody = x >= 2 && x <= 13 && y >= 4 && y <= 12;
      const insideLens = (x - 8) ** 2 + (y - 8) ** 2 <= 9;
      bitmap[index] = insideLens ? 24 : 94;
      bitmap[index + 1] = insideLens ? 24 : 197;
      bitmap[index + 2] = insideLens ? 24 : 34;
      bitmap[index + 3] = insideBody ? 255 : 0;
    }
  }
  const icon = nativeImage.createFromBitmap(bitmap, { width: size, height: size, scaleFactor: 1 });
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
            void startStream({
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

  ipcMain.handle("get-runtime-info", () => getRuntimeInfo());

  ipcMain.handle("start-stream", (_event: Electron.IpcMainInvokeEvent, options: unknown) => {
    if (!isStartStreamOptions(options)) return { success: false, error: "Invalid stream options" };
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

  ipcMain.handle("adb-kill-server", () => {
    adbKillServer();
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
  stopStream();
});
