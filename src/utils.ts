import { spawn, spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, openSync, close } from "fs";
import { homedir } from "os";
import { join } from "path";

const STATE_DIR = join(homedir(), ".local/state/popdroidcam");
const PID_FILE = join(STATE_DIR, "pid");
const CONFIG_FILE = join(STATE_DIR, "config");

// Hardware encoders work best with standard resolutions
export const PREFERRED_RESOLUTIONS = ["1920x1080", "1280x720", "1920x1440", "2560x1440", "3840x2160"];

export type Rotation = "0" | "90" | "180" | "270";
export const ROTATION_OPTIONS: Rotation[] = ["0", "90", "180", "270"];

export type Mirror = "off" | "on";
export const MIRROR_OPTIONS: Mirror[] = ["off", "on"];

// Video quality presets (bitrate in Mbps)
export type VideoQuality = "low" | "medium" | "high" | "ultra";
export const VIDEO_QUALITY_OPTIONS: VideoQuality[] = ["low", "medium", "high", "ultra"];
export const VIDEO_QUALITY_BITRATES: Record<VideoQuality, string> = {
  low: "4M",      // 4 Mbps - saves bandwidth, lower quality
  medium: "8M",   // 8 Mbps - scrcpy default, balanced
  high: "16M",    // 16 Mbps - good quality
  ultra: "32M",   // 32 Mbps - best quality, highest bandwidth
};

export interface Device {
  serial: string;
  state: string;
  type: "WiFi" | "USB";
  model?: string;
  battery?: number;
  charging?: boolean;
}

export interface Camera {
  facing: string;
  fps: string[];
  resolutions: string[];
}

export interface Config {
  [key: string]: string;
}

export function findV4l2LoopbackDevice(): string {
  try {
    const videoDir = "/sys/devices/virtual/video4linux";
    if (!existsSync(videoDir)) return "/dev/video6";

    const entries = readdirSync(videoDir);
    for (const entry of entries) {
      const namePath = join(videoDir, entry, "name");
      if (existsSync(namePath)) {
        const name = readFileSync(namePath, "utf-8");
        if (name.includes("PopDroidCam") || name.includes("Android") || name.includes("v4l2loopback")) {
          return `/dev/${entry}`;
        }
      }
    }
  } catch (_) {
    return "/dev/video6";
  }
  return "/dev/video6";
}

export function isRunning(): number | null {
  try {
    if (existsSync(PID_FILE)) {
      const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
      process.kill(pid, 0);
      return pid;
    }
  } catch (_) {
    return null;
  }
  return null;
}

export function getCurrentConfig(): Config {
  const config: Config = {};
  if (!existsSync(CONFIG_FILE)) return config;
  
  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    for (const line of content.split("\n")) {
      if (line.includes("=")) {
        const [key, value] = line.split("=", 2);
        config[key.trim()] = value.trim();
      }
    }
  } catch (_) {
    return config;
  }
  return config;
}

export function getBatteryInfo(serial?: string): { level: number; charging: boolean } | null {
  try {
    const args = serial ? ["-s", serial, "shell", "dumpsys", "battery"] : ["shell", "dumpsys", "battery"];
    const result = spawnSync("adb", args, { timeout: 3000, encoding: "utf-8" });
    if (result.status !== 0) return null;
    
    const levelMatch = result.stdout.match(/level:\s*(\d+)/);
    const statusMatch = result.stdout.match(/status:\s*(\d+)/);
    
    if (levelMatch) {
      const level = parseInt(levelMatch[1], 10);
      const charging = statusMatch ? parseInt(statusMatch[1], 10) === 2 : false;
      return { level, charging };
    }
  } catch (_) {
    return null;
  }
  return null;
}

export function getDevices(): Device[] {
  try {
    const result = spawnSync("adb", ["devices", "-l"], { timeout: 5000, encoding: "utf-8" });
    const devices: Device[] = [];
    const lines = result.stdout.trim().split("\n").slice(1);
    
    for (const line of lines) {
      if (line.trim()) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const serial = parts[0];
          const state = parts[1];
          const modelMatch = line.match(/model:(\S+)/);
          const model = modelMatch ? modelMatch[1].replace(/_/g, " ") : undefined;
          
          let battery: number | undefined;
          let charging: boolean | undefined;
          if (state === "device") {
            const batteryInfo = getBatteryInfo(serial);
            if (batteryInfo) {
              battery = batteryInfo.level;
              charging = batteryInfo.charging;
            }
          }
          
          devices.push({
            serial,
            state,
            type: serial.includes(":") ? "WiFi" : "USB",
            model,
            battery,
            charging,
          });
        }
      }
    }
    return devices;
  } catch (_) {
    return [];
  }
}

export function getCameraSizes(serial?: string): Record<string, Camera> {
  const cameras: Record<string, Camera> = {};
  try {
    const args = ["--video-source=camera", "--list-camera-sizes"];
    if (serial) {
      args.push(`--serial=${serial}`);
    }
    const result = spawnSync("scrcpy", args, { timeout: 15000, encoding: "utf-8" });
    const output = result.stdout + result.stderr;

    let currentId: string | null = null;
    for (const line of output.split("\n")) {
      // Regex: --camera-id=0 (back, 4080x3060, fps=[10, 15, 20, 24, 30])
      const headerMatch = line.match(/--camera-id=(\d+)\s+\((\w+),\s*\d+x\d+,\s*fps=\[([^\]]+)\]/);
      if (headerMatch) {
        currentId = headerMatch[1];
        cameras[currentId] = {
          facing: headerMatch[2],
          fps: headerMatch[3].split(",").map((f) => f.trim()),
          resolutions: [],
        };
      } else if (currentId) {
        const resMatch = line.match(/^\s+-\s*(\d+x\d+)/);
        if (resMatch) {
          cameras[currentId].resolutions.push(resMatch[1]);
        }
      }
    }
  } catch (_) {
    return cameras;
  }
  return cameras;
}

export function adbConnect(ip: string, port: string): boolean {
  try {
    const result = spawnSync("adb", ["connect", `${ip}:${port}`], { timeout: 10000, encoding: "utf-8" });
    const output = (result.stdout + result.stderr).toLowerCase();
    return output.includes("connected");
  } catch (_) {
    return false;
  }
}

export function adbPair(ip: string, port: string, code: string): boolean {
  try {
    const result = spawnSync("adb", ["pair", `${ip}:${port}`, code], { timeout: 15000, encoding: "utf-8" });
    const output = (result.stdout + result.stderr).toLowerCase();
    return output.includes("success") || output.includes("paired");
  } catch (_) {
    return false;
  }
}

export function adbDisconnect(): void {
  try {
    spawnSync("adb", ["disconnect"], { timeout: 5000 });
  } catch (_) {
    void 0;
  }
}

export interface StartStreamOptions {
  cameraId: string;
  resolution: string;
  fps: string;
  serial?: string;
  rotation?: Rotation;
  quality?: VideoQuality;
  mirror?: Mirror;
}

export function startStream(options: StartStreamOptions): { success: boolean; pid?: number; error?: string } {
  if (isRunning()) {
    return { success: false, error: "Already running" };
  }

  const v4l2Device = findV4l2LoopbackDevice();
  const quality = options.quality || "high";
  const bitrate = VIDEO_QUALITY_BITRATES[quality];
  
  const args = [
    "--video-source=camera",
    `--camera-id=${options.cameraId}`,
    `--camera-size=${options.resolution}`,
    `--camera-fps=${options.fps}`,
    `--video-bit-rate=${bitrate}`,
    `--v4l2-sink=${v4l2Device}`,
    "--no-window",
    "--no-audio",
  ];
  
  if (options.serial) {
    args.push(`--serial=${options.serial}`);
  }

  const rotation = options.rotation || "0";
  const mirror = options.mirror || "off";
  
  if (mirror === "on" || rotation !== "0") {
    const orientationValue = mirror === "on" ? `flip${rotation}` : rotation;
    args.push(`--capture-orientation=${orientationValue}`);
  }

  try {
    mkdirSync(STATE_DIR, { recursive: true });
    const logPath = join(STATE_DIR, "scrcpy.log");
    const logFd = openSync(logPath, "w");
    
    const proc = spawn("scrcpy", args, {
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });

    proc.unref();
    close(logFd);
    const pid = proc.pid;

    if (pid) {
      writeFileSync(PID_FILE, String(pid));
      writeFileSync(CONFIG_FILE, `res=${options.resolution}\nfps=${options.fps}\ncamera_id=${options.cameraId}\ndevice=${v4l2Device}\nrotation=${options.rotation || "0"}\nquality=${quality}\nmirror=${options.mirror || "off"}\n`);
      return { success: true, pid };
    }
    return { success: false, error: "Failed to start process" };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export function stopStream(): boolean {
  const pid = isRunning();
  if (!pid) return false;
  
  try {
    try {
      process.kill(-pid, "SIGTERM");
    } catch (_) {
      process.kill(pid, "SIGTERM");
    }
  } catch (_) {
    void 0;
  }
  
  try {
    unlinkSync(PID_FILE);
  } catch (_) {
    void 0;
  }
  
  return true;
}
