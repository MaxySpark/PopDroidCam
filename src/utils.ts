import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, posix, win32 } from "node:path";

export const PREFERRED_RESOLUTIONS = ["1920x1080", "1280x720", "1920x1440", "2560x1440", "3840x2160"];
export const WINDOWS_CAPTURE_TITLE = "PopDroidCam Camera";

export type Rotation = "0" | "90" | "180" | "270";
export const ROTATION_OPTIONS: Rotation[] = ["0", "90", "180", "270"];

export type Mirror = "off" | "on";
export const MIRROR_OPTIONS: Mirror[] = ["off", "on"];

export type ZoomLevel = "1x" | "1.5x" | "2x" | "3x" | "4x";
export const ZOOM_OPTIONS: ZoomLevel[] = ["1x", "1.5x", "2x", "3x", "4x"];
export const ZOOM_FACTORS: Record<ZoomLevel, number> = {
  "1x": 1,
  "1.5x": 1.5,
  "2x": 2,
  "3x": 3,
  "4x": 4,
};

export type VideoQuality = "low" | "medium" | "high" | "ultra";
export const VIDEO_QUALITY_OPTIONS: VideoQuality[] = ["low", "medium", "high", "ultra"];
export const VIDEO_QUALITY_BITRATES: Record<VideoQuality, string> = {
  low: "4M",
  medium: "8M",
  high: "16M",
  ultra: "32M",
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

export interface StatePaths {
  directory: string;
  pid: string;
  config: string;
  log: string;
}

export interface DependencyStatus {
  available: boolean;
  executable: string;
}

export interface RuntimeInfo {
  platform: NodeJS.Platform;
  output: "obs" | "v4l2";
  captureTitle?: string;
  obsInstalled?: boolean;
  stateDirectory: string;
  dependencies: {
    adb: DependencyStatus;
    scrcpy: DependencyStatus;
  };
}

export interface StartStreamOptions {
  cameraId: string;
  resolution: string;
  fps: string;
  serial?: string;
  rotation?: Rotation;
  quality?: VideoQuality;
  mirror?: Mirror;
  zoom?: ZoomLevel;
}

export type StartStreamResult =
  | { success: true; pid: number }
  | { success: false; error: string };

export type ScrcpyCommandResult =
  | { success: true; args: string[]; output: "obs" | "v4l2"; outputDevice: string }
  | { success: false; error: string };

export function getScrcpySpawnOptions(logDescriptor: number): SpawnOptions {
  return {
    detached: true,
    stdio: ["ignore", logDescriptor, logDescriptor],
    windowsHide: true,
  };
}

type Environment = NodeJS.ProcessEnv;
type PathExists = (path: string) => boolean;

let activeProcess: ChildProcess | null = null;
let streamStarting = false;

export function getStatePaths(
  platform: NodeJS.Platform = process.platform,
  environment: Environment = process.env,
  home: string = homedir(),
): StatePaths {
  const paths = platform === "win32" ? win32 : posix;
  const localAppData = environment.LOCALAPPDATA?.trim();
  const directory = platform === "win32"
    ? paths.join(localAppData || paths.join(home, "AppData", "Local"), "PopDroidCam")
    : paths.join(home, ".local", "state", "popdroidcam");

  return {
    directory,
    pid: paths.join(directory, "pid"),
    config: paths.join(directory, "config"),
    log: paths.join(directory, "scrcpy.log"),
  };
}

export function resolveExecutable(
  name: "adb" | "scrcpy",
  platform: NodeJS.Platform = process.platform,
  environment: Environment = process.env,
  executablePath: string = process.execPath,
  pathExists: PathExists = existsSync,
): string {
  const paths = platform === "win32" ? win32 : posix;
  const filename = platform === "win32" ? `${name}.exe` : name;
  const configuredDirectory = environment.POPDROIDCAM_BIN_DIR?.trim();
  if (configuredDirectory) {
    return paths.join(configuredDirectory, filename);
  }

  const executableDirectory = platform === "win32" ? win32.dirname(executablePath) : posix.dirname(executablePath);
  const bundledPath = paths.join(executableDirectory, "resources", "bin", filename);
  if (pathExists(bundledPath)) {
    return bundledPath;
  }

  if (platform === "win32") {
    const developmentPath = win32.join(process.cwd(), "vendor", "scrcpy-win64", filename);
    if (pathExists(developmentPath)) return developmentPath;
  }

  return filename;
}

const rotations = new Set<string>(ROTATION_OPTIONS);
const qualities = new Set<string>(VIDEO_QUALITY_OPTIONS);
const mirrors = new Set<string>(MIRROR_OPTIONS);
const zoomLevels = new Set<string>(ZOOM_OPTIONS);

export function isStartStreamOptions(value: unknown): value is StartStreamOptions {
  if (typeof value !== "object" || value === null) return false;
  if (!("cameraId" in value) || typeof value.cameraId !== "string") return false;
  if (!("resolution" in value) || typeof value.resolution !== "string") return false;
  if (!("fps" in value) || typeof value.fps !== "string") return false;
  if ("serial" in value && value.serial !== undefined && typeof value.serial !== "string") return false;
  if ("rotation" in value && value.rotation !== undefined && (typeof value.rotation !== "string" || !rotations.has(value.rotation))) return false;
  if ("quality" in value && value.quality !== undefined && (typeof value.quality !== "string" || !qualities.has(value.quality))) return false;
  if ("mirror" in value && value.mirror !== undefined && (typeof value.mirror !== "string" || !mirrors.has(value.mirror))) return false;
  if ("zoom" in value && value.zoom !== undefined && (typeof value.zoom !== "string" || !zoomLevels.has(value.zoom))) return false;
  return true;
}

export function findV4l2LoopbackDevice(): string {
  try {
    const videoDirectory = "/sys/devices/virtual/video4linux";
    if (!existsSync(videoDirectory)) return "/dev/video6";

    for (const entry of readdirSync(videoDirectory)) {
      const namePath = join(videoDirectory, entry, "name");
      if (!existsSync(namePath)) continue;

      const name = readFileSync(namePath, "utf-8");
      if (name.includes("PopDroidCam") || name.includes("Android") || name.includes("v4l2loopback")) {
        return `/dev/${entry}`;
      }
    }
  } catch {
    return "/dev/video6";
  }
  return "/dev/video6";
}

function removeFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Missing state is already clean.
  }
}

function clearProcessState(pid?: number): void {
  const paths = getStatePaths();
  try {
    if (pid && existsSync(paths.pid)) {
      const storedPid = Number.parseInt(readFileSync(paths.pid, "utf-8").trim(), 10);
      if (storedPid !== pid) return;
    }
  } catch {
    return;
  }
  removeFile(paths.pid);
}

export function isRunning(): number | null {
  if (activeProcess?.pid && activeProcess.exitCode === null && !activeProcess.killed) {
    return activeProcess.pid;
  }

  const paths = getStatePaths();
  if (!existsSync(paths.pid)) return null;

  let pid: number;
  try {
    pid = Number.parseInt(readFileSync(paths.pid, "utf-8").trim(), 10);
  } catch {
    return null;
  }
  if (!Number.isInteger(pid) || pid <= 0) {
    removeFile(paths.pid);
    return null;
  }

  try {
    process.kill(pid, 0);
  } catch {
    removeFile(paths.pid);
    return null;
  }

  if (!isScrcpyCommandLine(readProcessCommandLine(pid))) {
    removeFile(paths.pid);
    return null;
  }
  return pid;
}

function readProcessCommandLine(pid: number): string {
  if (process.platform === "linux") {
    try {
      return readFileSync(`/proc/${pid}/cmdline`, "utf-8").replace(/\0/g, " ");
    } catch {
      return "";
    }
  }

  if (process.platform !== "win32") return "";
  const command = `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf-8",
    timeout: 5000,
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function isScrcpyCommandLine(commandLine: string): boolean {
  return /(^|[/\\\s])scrcpy(?:\.exe)?(?=["\s]|$)/i.test(commandLine) && commandLine.includes("--video-source=camera");
}

export function getCurrentConfig(): Config {
  const config: Config = {};
  const configPath = getStatePaths().config;
  if (!existsSync(configPath)) return config;

  try {
    for (const line of readFileSync(configPath, "utf-8").split("\n")) {
      const separator = line.indexOf("=");
      if (separator <= 0) continue;

      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (key) config[key] = value;
    }
  } catch {
    return config;
  }
  return config;
}

function checkDependency(name: "adb" | "scrcpy"): DependencyStatus {
  const executable = resolveExecutable(name);
  const args = name === "adb" ? ["version"] : ["--version"];
  const result = spawnSync(executable, args, { timeout: 5000, encoding: "utf-8", windowsHide: true });
  return { available: !result.error && result.status === 0, executable };
}

function isObsInstalled(environment: Environment = process.env, pathExists: PathExists = existsSync): boolean {
  const candidates = [
    environment.ProgramFiles ? join(environment.ProgramFiles, "obs-studio", "bin", "64bit", "obs64.exe") : "",
    environment.LOCALAPPDATA ? join(environment.LOCALAPPDATA, "Programs", "obs-studio", "bin", "64bit", "obs64.exe") : "",
  ];
  return candidates.some((candidate) => candidate.length > 0 && pathExists(candidate));
}

export function getRuntimeInfo(): RuntimeInfo {
  const windows = process.platform === "win32";
  return {
    platform: process.platform,
    output: windows ? "obs" : "v4l2",
    captureTitle: windows ? WINDOWS_CAPTURE_TITLE : undefined,
    obsInstalled: windows ? isObsInstalled() : undefined,
    stateDirectory: getStatePaths().directory,
    dependencies: {
      adb: checkDependency("adb"),
      scrcpy: checkDependency("scrcpy"),
    },
  };
}

export function getBatteryInfo(serial?: string): { level: number; charging: boolean } | null {
  try {
    const args = serial ? ["-s", serial, "shell", "dumpsys", "battery"] : ["shell", "dumpsys", "battery"];
    const result = spawnSync(resolveExecutable("adb"), args, { timeout: 3000, encoding: "utf-8", windowsHide: true });
    if (result.status !== 0) return null;

    const levelMatch = result.stdout.match(/level:\s*(\d+)/);
    const statusMatch = result.stdout.match(/status:\s*(\d+)/);
    if (!levelMatch) return null;

    return {
      level: Number.parseInt(levelMatch[1], 10),
      charging: statusMatch ? Number.parseInt(statusMatch[1], 10) === 2 : false,
    };
  } catch {
    return null;
  }
}

export function getDevices(): Device[] {
  try {
    const result = spawnSync(resolveExecutable("adb"), ["devices", "-l"], {
      timeout: 5000,
      encoding: "utf-8",
      windowsHide: true,
    });
    if (result.error || result.status !== 0) return [];

    return parseAdbDevices(result.stdout).map((device) => {
      const batteryInfo = device.state === "device" ? getBatteryInfo(device.serial) : null;
      return {
        ...device,
        battery: batteryInfo?.level,
        charging: batteryInfo?.charging,
      };
    });
  } catch {
    return [];
  }
}

export function parseAdbDevices(output: string): Device[] {
  const devices: Device[] = [];
  for (const line of output.trim().split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue;

      const parts = line.trim().split(/\s+/);
      const serial = parts[0];
      const state = parts[1];
      if (!serial || !state) continue;

      const modelMatch = line.match(/model:(\S+)/);
      const model = modelMatch ? modelMatch[1].replace(/_/g, " ") : undefined;
      devices.push({
        serial,
        state,
        type: serial.includes(":") ? "WiFi" : "USB",
        model,
      });
  }
  return devices;
}

export function getCameraSizes(serial?: string): Record<string, Camera> {
  try {
    const args = ["--video-source=camera", "--list-camera-sizes"];
    if (serial) args.push(`--serial=${serial}`);

    const result = spawnSync(resolveExecutable("scrcpy"), args, { timeout: 15000, encoding: "utf-8", windowsHide: true });
    return parseCameraSizes(result.stdout + result.stderr);
  } catch {
    return {};
  }
}

export function parseCameraSizes(output: string): Record<string, Camera> {
  const cameras: Record<string, Camera> = {};
  let currentId: string | null = null;

  for (const line of output.split(/\r?\n/)) {
    const headerMatch = line.match(/--camera-id=(\d+)\s+\((\w+),\s*\d+x\d+,\s*fps=[{\[]([^}\]]+)[}\]]/);
    if (headerMatch) {
      currentId = headerMatch[1];
      cameras[currentId] = {
        facing: headerMatch[2],
        fps: headerMatch[3].split(",").map((fps) => fps.trim()),
        resolutions: [],
      };
      continue;
    }

    if (!currentId) continue;
    const resolutionMatch = line.match(/^\s+-\s*(\d+x\d+)/);
    if (resolutionMatch) cameras[currentId].resolutions.push(resolutionMatch[1]);
  }
  return cameras;
}

export function adbConnect(ip: string, port: string): boolean {
  if (!ip.trim() || !/^\d{1,5}$/.test(port)) return false;
  try {
    const result = spawnSync(resolveExecutable("adb"), ["connect", `${ip}:${port}`], {
      timeout: 10000,
      encoding: "utf-8",
      windowsHide: true,
    });
    return `${result.stdout}${result.stderr}`.toLowerCase().includes("connected");
  } catch {
    return false;
  }
}

export function adbPair(ip: string, port: string, code: string): boolean {
  if (!ip.trim() || !/^\d{1,5}$/.test(port) || !/^\d{6}$/.test(code)) return false;
  try {
    const result = spawnSync(resolveExecutable("adb"), ["pair", `${ip}:${port}`, code], {
      timeout: 15000,
      encoding: "utf-8",
      windowsHide: true,
    });
    const output = `${result.stdout}${result.stderr}`.toLowerCase();
    return output.includes("success") || output.includes("paired");
  } catch {
    return false;
  }
}

export function adbDisconnect(): void {
  spawnSync(resolveExecutable("adb"), ["disconnect"], { timeout: 5000, windowsHide: true });
}

export function adbKillServer(): void {
  spawnSync(resolveExecutable("adb"), ["kill-server"], { timeout: 5000, windowsHide: true });
}

export function buildScrcpyCommand(
  options: StartStreamOptions,
  platform: NodeJS.Platform = process.platform,
  v4l2Device: string = findV4l2LoopbackDevice(),
): ScrcpyCommandResult {
  if (!options.cameraId.trim()) return { success: false, error: "Select a camera" };
  if (!/^\d+x\d+$/.test(options.resolution)) return { success: false, error: "Invalid resolution" };
  if (!/^\d+(\.\d+)?$/.test(options.fps) || Number(options.fps) <= 0) {
    return { success: false, error: "Invalid frame rate" };
  }

  const quality = options.quality ?? "high";
  const args = [
    "--video-source=camera",
    `--camera-id=${options.cameraId}`,
    `--camera-size=${options.resolution}`,
    `--camera-fps=${options.fps}`,
    `--video-bit-rate=${VIDEO_QUALITY_BITRATES[quality]}`,
    "--video-codec=h264",
    "--no-audio",
  ];

  let output: "obs" | "v4l2";
  let outputDevice: string;
  if (platform === "linux") {
    output = "v4l2";
    outputDevice = v4l2Device;
    args.push(`--v4l2-sink=${v4l2Device}`, "--no-window");
  } else {
    output = "obs";
    outputDevice = "OBS Virtual Camera";
    args.push(`--window-title=${WINDOWS_CAPTURE_TITLE}`, "--window-borderless");
  }

  if (options.serial) args.push(`--serial=${options.serial}`);

  const zoom = options.zoom ?? "1x";
  if (zoom !== "1x") {
    const [widthText, heightText] = options.resolution.split("x");
    const width = Number(widthText);
    const height = Number(heightText);
    const factor = ZOOM_FACTORS[zoom];
    const cropWidth = Math.floor(width / factor);
    const cropHeight = Math.floor(height / factor);
    const cropX = Math.floor((width - cropWidth) / 2);
    const cropY = Math.floor((height - cropHeight) / 2);
    args.push(`--crop=${cropWidth}:${cropHeight}:${cropX}:${cropY}`);
  }

  const rotation = options.rotation ?? "0";
  const mirror = options.mirror ?? "off";
  if (mirror === "on" || rotation !== "0") {
    args.push(`--capture-orientation=${mirror === "on" ? `flip${rotation}` : rotation}`);
  }

  return { success: true, args, output, outputDevice };
}

export function isStartupReadyLog(log: string, platform: NodeJS.Platform): boolean {
  if (platform === "win32") return /INFO:\s+Texture:\s+\d+x\d+/i.test(log);
  if (platform === "linux") return /INFO:.*V4L2.*sink/i.test(log);
  return false;
}

export function shouldAcceptStartupTimeout(exitCode: number | null, killed: boolean): boolean {
  return exitCode === null && !killed;
}

function waitForStartup(child: ChildProcess, logPath: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout;
    let poller: NodeJS.Timeout;
    const finish = (error: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poller);
      resolve(error);
    };
    poller = setInterval(() => {
      try {
        if (isStartupReadyLog(readFileSync(logPath, "utf-8"), process.platform)) finish(null);
      } catch {
        // The log may not be readable until scrcpy initializes it.
      }
    }, 100);
    timer = setTimeout(() => {
      const error = shouldAcceptStartupTimeout(child.exitCode, child.killed)
        ? null
        : "scrcpy stopped before startup completed. Check the log for details.";
      finish(error);
    }, timeoutMs);
    child.once("error", (error) => finish(`Could not start scrcpy: ${error.message}`));
    child.once("exit", (code, signal) => {
      finish(`scrcpy exited during startup (${signal || `code ${code ?? "unknown"}`}). Check the log for details.`);
    });
  });
}

export function describeStartupFailure(log: string, fallback: string): string {
  const normalized = log.toLowerCase();
  if (normalized.includes("unauthorized")) {
    return "Android device is unauthorized. Approve the USB debugging prompt on the phone.";
  }
  if (normalized.includes("camera") && (normalized.includes("in use") || normalized.includes("busy"))) {
    return "The selected phone camera is already in use by another app.";
  }
  if (normalized.includes("camera") && (normalized.includes("not found") || normalized.includes("invalid camera"))) {
    return "The selected phone camera is unavailable. Detect cameras again.";
  }
  if (normalized.includes("encoder") && (normalized.includes("failed") || normalized.includes("error"))) {
    return "The phone could not start its video encoder. Try 1280x720 at 30 fps.";
  }
  const detail = log.split(/\r?\n/).reverse().find((line) => /error|failed|fatal|permission denied/i.test(line));
  if (detail) return `${fallback}: ${detail.trim().slice(0, 300)}`;
  return fallback;
}

async function startStreamOnce(options: StartStreamOptions): Promise<StartStreamResult> {
  if (isRunning()) return { success: false, error: "A stream is already running" };

  const command = buildScrcpyCommand(options);
  if (!command.success) return command;

  const scrcpy = checkDependency("scrcpy");
  if (!scrcpy.available) {
    return { success: false, error: `scrcpy was not found. Expected: ${scrcpy.executable}` };
  }

  const adb = checkDependency("adb");
  if (!adb.available) {
    return { success: false, error: `ADB was not found. Expected: ${adb.executable}` };
  }

  const devices = getDevices();
  const selectedDevice = options.serial
    ? devices.find((device) => device.serial === options.serial)
    : devices.find((device) => device.state === "device");
  if (!selectedDevice) return { success: false, error: "No authorized Android device found" };
  if (selectedDevice.state !== "device") {
    return { success: false, error: `Android device is ${selectedDevice.state}. Approve the USB debugging prompt on the phone.` };
  }

  const paths = getStatePaths();
  mkdirSync(paths.directory, { recursive: true });
  const logDescriptor = openSync(paths.log, "w");
  let child: ChildProcess;

  try {
    child = spawn(scrcpy.executable, command.args, getScrcpySpawnOptions(logDescriptor));
  } catch (error) {
    closeSync(logDescriptor);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  closeSync(logDescriptor);

  if (!child.pid) {
    child.kill("SIGTERM");
    return { success: false, error: "scrcpy started without a process ID" };
  }

  activeProcess = child;
  child.unref();
  const pid = child.pid;
  child.once("exit", () => {
    if (activeProcess === child) activeProcess = null;
    clearProcessState(pid);
  });

  const startupError = await waitForStartup(child, paths.log, 5000);
  if (startupError) {
    const log = existsSync(paths.log) ? readFileSync(paths.log, "utf-8") : "";
    if (activeProcess === child) activeProcess = null;
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
    return { success: false, error: describeStartupFailure(log, startupError) };
  }
  if (activeProcess !== child || child.exitCode !== null || child.killed) {
    return { success: false, error: "scrcpy stopped before startup completed" };
  }

  try {
    writeFileSync(paths.pid, String(child.pid));
    writeFileSync(paths.config, [
      `res=${options.resolution}`,
      `fps=${options.fps}`,
      `camera_id=${options.cameraId}`,
      `device=${command.outputDevice}`,
      `output=${command.output}`,
      `rotation=${options.rotation ?? "0"}`,
      `quality=${options.quality ?? "high"}`,
      `mirror=${options.mirror ?? "off"}`,
      `zoom=${options.zoom ?? "1x"}`,
      "",
    ].join("\n"));

    return { success: true, pid };
  } catch (error) {
    child.kill("SIGTERM");
    activeProcess = null;
    clearProcessState(pid);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function startStream(options: StartStreamOptions): Promise<StartStreamResult> {
  if (streamStarting) return { success: false, error: "A stream is already starting" };
  streamStarting = true;
  try {
    return await startStreamOnce(options);
  } finally {
    streamStarting = false;
  }
}

export function stopStream(): boolean {
  const pid = isRunning();
  if (!pid) return false;

  try {
    if (activeProcess?.pid === pid) {
      activeProcess.kill("SIGTERM");
      activeProcess = null;
    } else if (process.platform === "win32") {
      process.kill(pid, "SIGTERM");
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        process.kill(pid, "SIGTERM");
      }
    }
  } catch {
    clearProcessState(pid);
    return false;
  }

  clearProcessState(pid);
  return true;
}
