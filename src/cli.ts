import {
  adbConnect,
  adbDisconnect,
  adbPair,
  getCameraSizes,
  getCurrentConfig,
  getDevices,
  isRunning,
  startStream,
  stopStream,
  type Mirror,
  type Rotation,
  type VideoQuality,
  type ZoomLevel,
} from "./utils.js";

function printHelp(): void {
  console.log(`PopDroidCam - Use an Android phone as a webcam

Usage: popdroidcam <command> [options]

Commands:
  devices                         List connected devices
  list [--device <serial>]        List phone cameras
  start [options]                 Start the camera
  stop                            Stop the camera
  status                          Show stream status
  connect <ip> <port>             Connect through wireless debugging
  pair <ip> <port> <code>        Pair through wireless debugging
  disconnect                      Disconnect wireless devices
  help                            Show this help

Start options:
  --device <serial>               Select a phone
  --camera <back|front>           Select camera facing (default: back)
  --camera-id <id>                Select an exact camera
  --res <720p|1080p|4k|WxH>       Set resolution (default: 1080p)
  --fps <number>                  Set frame rate (default: 30)
  --quality <low|medium|high|ultra>
  --rotation <0|90|180|270>
  --mirror <off|on>
  --zoom <1x|1.5x|2x|3x|4x>`);
}

function valueAfter(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  if (index < 0) return undefined;
  return args[index + 1];
}

function parseResolution(value: string | undefined): string {
  if (!value || value === "1080p" || value === "1080") return "1920x1080";
  if (value === "720p" || value === "720") return "1280x720";
  if (value === "4k" || value === "4K" || value === "2160p") return "3840x2160";
  return value;
}

function parseRotation(value: string | undefined): Rotation | undefined {
  if (value === "0" || value === "90" || value === "180" || value === "270") return value;
  return undefined;
}

function parseQuality(value: string | undefined): VideoQuality | undefined {
  if (value === "low" || value === "medium" || value === "high" || value === "ultra") return value;
  return undefined;
}

function parseMirror(value: string | undefined): Mirror | undefined {
  if (value === "off" || value === "on") return value;
  return undefined;
}

function parseZoom(value: string | undefined): ZoomLevel | undefined {
  if (value === "1x" || value === "1.5x" || value === "2x" || value === "3x" || value === "4x") return value;
  return undefined;
}

function printDevices(): void {
  const devices = getDevices();
  if (devices.length === 0) {
    console.log("No Android devices found.");
    return;
  }
  for (const device of devices) {
    console.log(`${device.serial}\t${device.state}\t${device.model ?? device.type}`);
  }
}

function printCameras(args: string[]): void {
  const cameras = getCameraSizes(valueAfter(args, "--device"));
  const entries = Object.entries(cameras);
  if (entries.length === 0) {
    console.log("No cameras found.");
    return;
  }
  for (const [id, camera] of entries) {
    console.log(`${id}\t${camera.facing}\t${camera.resolutions.join(", ")}\t${camera.fps.join(", ")} fps`);
  }
}

async function start(args: string[]): Promise<number> {
  const serial = valueAfter(args, "--device");
  const facing = valueAfter(args, "--camera") ?? "back";
  const cameras = getCameraSizes(serial);
  const requestedCameraId = valueAfter(args, "--camera-id");
  const cameraId = requestedCameraId
    ?? Object.keys(cameras).find((id) => cameras[id]?.facing === facing)
    ?? Object.keys(cameras)[0];
  if (!cameraId) {
    console.error("No phone camera found. Run `popdroidcam list` first.");
    return 1;
  }

  const result = await startStream({
    cameraId,
    resolution: parseResolution(valueAfter(args, "--res")),
    fps: valueAfter(args, "--fps") ?? "30",
    serial,
    rotation: parseRotation(valueAfter(args, "--rotation")),
    quality: parseQuality(valueAfter(args, "--quality")),
    mirror: parseMirror(valueAfter(args, "--mirror")),
    zoom: parseZoom(valueAfter(args, "--zoom")),
  });
  if (!result.success) {
    console.error(result.error);
    return 1;
  }
  const output = process.platform === "win32" ? " Select PopDroidCam in your camera app." : "";
  console.log(`Camera started (PID: ${result.pid}).${output}`);
  return 0;
}

async function main(args: string[]): Promise<number> {
  const command = args[0] ?? "help";
  const commandArgs = args.slice(1);
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }
  if (command === "devices") {
    printDevices();
    return 0;
  }
  if (command === "list") {
    printCameras(commandArgs);
    return 0;
  }
  if (command === "start") return start(commandArgs);
  if (command === "stop") {
    console.log(stopStream() ? "Camera stopped." : "Camera is not running.");
    return 0;
  }
  if (command === "status") {
    const pid = isRunning();
    console.log(pid ? `Camera is running (PID: ${pid}).` : "Camera is stopped.");
    if (pid) console.log(getCurrentConfig());
    return 0;
  }
  if (command === "connect") {
    const [ip, port] = commandArgs;
    if (!ip || !port) return 1;
    return adbConnect(ip, port) ? 0 : 1;
  }
  if (command === "pair") {
    const [ip, port, code] = commandArgs;
    if (!ip || !port || !code) return 1;
    return adbPair(ip, port, code) ? 0 : 1;
  }
  if (command === "disconnect") {
    adbDisconnect();
    return 0;
  }
  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}

process.exitCode = await main(process.argv.slice(2));
