import assert from "node:assert/strict";
import test from "node:test";
import {
  WINDOWS_CAMERA_DEVICE,
  buildScrcpyCommand,
  describeStartupFailure,
  getScrcpySpawnOptions,
  getStatePaths,
  getWindowsFramePath,
  getWindowsTaskkillArgs,
  getWindowsWorkerSpawnOptions,
  isStartStreamOptions,
  isScrcpyCommandLine,
  isStartupReadyLog,
  isWindowsCameraWorkerCommandLine,
  parseAdbDevices,
  parseCameraSizes,
  resolveExecutable,
  resolveNativeCameraRegistrar,
  shouldAcceptStartupTimeout,
} from "../src/utils.ts";

test("starts scrcpy without opening a Windows console", () => {
  const options = getScrcpySpawnOptions(42);

  assert.equal(options.detached, true);
  assert.equal(options.windowsHide, true);
  assert.deepEqual(options.stdio, ["ignore", 42, 42]);
});

test("starts the Windows camera worker detached under Electron's Node runtime", () => {
  const options = getWindowsWorkerSpawnOptions(42);

  assert.equal(options.detached, true);
  assert.equal(options.windowsHide, true);
  assert.deepEqual(options.stdio, ["ignore", 42, 42]);
  assert.equal(options.env?.ELECTRON_RUN_AS_NODE, "1");
});

test("uses LocalAppData for Windows state", () => {
  const paths = getStatePaths("win32", { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" }, "C:\\Users\\test");
  assert.equal(paths.directory, "C:\\Users\\test\\AppData\\Local\\PopDroidCam");
  assert.equal(paths.log, "C:\\Users\\test\\AppData\\Local\\PopDroidCam\\scrcpy.log");
});

test("preserves Linux state location", () => {
  const paths = getStatePaths("linux", {}, "/home/test");
  assert.equal(paths.directory, "/home/test/.local/state/popdroidcam");
});

test("prefers configured and packaged executables", () => {
  assert.equal(
    resolveExecutable("adb", "win32", { POPDROIDCAM_BIN_DIR: "C:\\tools" }, "C:\\app\\PopDroidCam.exe", () => false),
    "C:\\tools\\adb.exe",
  );
  assert.equal(
    resolveExecutable("scrcpy", "win32", {}, "C:\\app\\PopDroidCam.exe", () => true),
    "C:\\app\\resources\\bin\\scrcpy.exe",
  );
  assert.equal(resolveExecutable("scrcpy", "linux", {}, "/usr/bin/node", () => false), "scrcpy");
  assert.equal(
    resolveExecutable("ffmpeg", "win32", {}, "C:\\app\\PopDroidCam.exe", () => true),
    "C:\\app\\resources\\native\\ffmpeg.exe",
  );
  assert.equal(
    resolveExecutable("ffmpeg", "win32", { POPDROIDCAM_BIN_DIR: "C:\\scrcpy" }, "C:\\app\\PopDroidCam.exe", () => true),
    "C:\\app\\resources\\native\\ffmpeg.exe",
  );
  assert.equal(
    resolveExecutable("ffmpeg", "win32", { POPDROIDCAM_FFMPEG_DIR: "C:\\ffmpeg" }, "C:\\app\\PopDroidCam.exe", () => false),
    "C:\\ffmpeg\\ffmpeg.exe",
  );
});

test("resolves the packaged and development native camera registrar", () => {
  assert.equal(
    resolveNativeCameraRegistrar("win32", "C:\\app\\PopDroidCam.exe", (path) => path.startsWith("C:\\app")),
    "C:\\app\\resources\\native-vcam\\PopDroidCamCameraRegistrar.exe",
  );
  assert.match(
    resolveNativeCameraRegistrar("win32", "C:\\app\\PopDroidCam.exe", (path) => path.includes("vendor")),
    /vendor\\native-vcam\\dist\\PopDroidCamCameraRegistrar\.exe$/,
  );
  assert.equal(resolveNativeCameraRegistrar("linux"), "");
});

test("publishes Windows frames under the public profile", () => {
  assert.equal(
    getWindowsFramePath({ PUBLIC: "D:\\Public" }),
    "D:\\Public\\PopDroidCam\\virtual-camera-frame.dat",
  );
});

test("parses USB, Wi-Fi, and unauthorized ADB devices", () => {
  const devices = parseAdbDevices([
    "List of devices attached",
    "abc123 device product:test model:OnePlus_7T transport_id:1",
    "192.168.1.8:37123 device product:test model:Vivo_T4x transport_id:2",
    "blocked unauthorized usb:1-1 transport_id:3",
    "",
  ].join("\r\n"));

  assert.deepEqual(devices, [
    { serial: "abc123", state: "device", type: "USB", model: "OnePlus 7T" },
    { serial: "192.168.1.8:37123", state: "device", type: "WiFi", model: "Vivo T4x" },
    { serial: "blocked", state: "unauthorized", type: "USB", model: undefined },
  ]);
});

test("parses scrcpy 4.1 camera FPS braces", () => {
  const output = [
    "[server] INFO: List of cameras:",
    "    --camera-id=0    (back, 4000x3000, fps={15, 23, 28, 30}, zoom-range=[1, 10])",
    "        - 1920x1080",
    "        - 1280x720",
    "    --camera-id=1    (front, 4656x3496, fps=[15, 30], zoom-range=[1, 10])",
    "        - 1920x1080",
  ].join("\r\n");

  assert.deepEqual(parseCameraSizes(output), {
    "0": { facing: "back", fps: ["15", "23", "28", "30"], resolutions: ["1920x1080", "1280x720"] },
    "1": { facing: "front", fps: ["15", "30"], resolutions: ["1920x1080"] },
  });
});

test("builds the Linux V4L2 command", () => {
  const result = buildScrcpyCommand({ cameraId: "0", resolution: "1920x1080", fps: "30" }, "linux", "/dev/video9");
  if (!result.success) assert.fail(result.error);

  assert.equal(result.output, "v4l2");
  assert.ok(result.args.includes("--v4l2-sink=/dev/video9"));
  assert.ok(result.args.includes("--no-window"));
  assert.ok(!result.args.some((arg) => arg.startsWith("--window-title=")));
});

test("builds the Windows native camera source command", () => {
  const result = buildScrcpyCommand({
    cameraId: "1",
    resolution: "1920x1080",
    fps: "30",
    serial: "abc123",
    quality: "medium",
    mirror: "on",
    rotation: "90",
    zoom: "2x",
  }, "win32");
  if (!result.success) assert.fail(result.error);

  assert.equal(result.output, "windows-native");
  assert.equal(result.outputDevice, WINDOWS_CAMERA_DEVICE);
  assert.ok(!result.args.some((arg) => arg.startsWith("--window-title=")));
  assert.ok(!result.args.includes("--window-borderless"));
  assert.ok(result.args.includes("--video-bit-rate=8M"));
  assert.ok(result.args.includes("--serial=abc123"));
  assert.ok(result.args.includes("--capture-orientation=flip90"));
  assert.ok(result.args.includes("--crop=960:540:480:270"));
  assert.ok(!result.args.some((arg) => arg.startsWith("--v4l2-sink=")));
});

test("rejects malformed stream options", () => {
  assert.deepEqual(
    buildScrcpyCommand({ cameraId: "0", resolution: "full-hd", fps: "30" }, "win32"),
    { success: false, error: "Invalid resolution" },
  );
  assert.deepEqual(
    buildScrcpyCommand({ cameraId: "0", resolution: "1920x1080", fps: "0" }, "win32"),
    { success: false, error: "Invalid frame rate" },
  );
});

test("validates IPC stream options", () => {
  assert.equal(isStartStreamOptions({ cameraId: "0", resolution: "1920x1080", fps: "30", quality: "medium" }), true);
  assert.equal(isStartStreamOptions({ cameraId: "0", resolution: "1920x1080", fps: "30", quality: "maximum" }), false);
  assert.equal(isStartStreamOptions(null), false);
});

test("classifies actionable scrcpy startup failures", () => {
  assert.equal(
    describeStartupFailure("ERROR: camera device is already in use", "fallback"),
    "The selected phone camera is already in use by another app.",
  );
  assert.equal(
    describeStartupFailure("ERROR: video encoder failed", "fallback"),
    "The phone could not start its video encoder. Try 1280x720 at 30 fps.",
  );
  assert.equal(describeStartupFailure("unknown failure", "fallback"), "fallback");
});

test("recognizes owned Linux scrcpy camera processes", () => {
  assert.equal(isScrcpyCommandLine("/usr/local/bin/scrcpy --video-source=camera --no-window"), true);
  assert.equal(isScrcpyCommandLine('"C:\\Program Files\\PopDroidCam\\resources\\bin\\scrcpy.exe" --video-source=camera'), true);
  assert.equal(isScrcpyCommandLine("/usr/bin/other --video-source=camera"), false);
  assert.equal(isScrcpyCommandLine("/usr/local/bin/scrcpy --video-source=display"), false);
});

test("recognizes the detached Windows camera worker", () => {
  assert.equal(
    isWindowsCameraWorkerCommandLine('"C:\\Program Files\\PopDroidCam\\PopDroidCam.exe" "C:\\app\\windows-camera-worker.js" --config state.json'),
    true,
  );
  assert.equal(isWindowsCameraWorkerCommandLine("scrcpy.exe --video-source=camera"), false);
});

test("kills the complete Windows worker process tree", () => {
  assert.deepEqual(getWindowsTaskkillArgs(1234), ["/PID", "1234", "/T", "/F"]);
});

test("requires platform-specific scrcpy readiness markers", () => {
  assert.equal(isStartupReadyLog("INFO: Renderer: direct3d\nINFO: Texture: 1920x1080", "win32"), false);
  assert.equal(isStartupReadyLog("INFO: V4L2 sink started to device: /dev/video9", "linux"), true);
  assert.equal(isStartupReadyLog("INFO: Device connected", "win32"), false);
});

test("accepts a live scrcpy process when its readiness log is delayed", () => {
  assert.equal(shouldAcceptStartupTimeout(null, false), true);
  assert.equal(shouldAcceptStartupTimeout(1, false), false);
  assert.equal(shouldAcceptStartupTimeout(null, true), false);
});

test("includes an unknown scrcpy error in the startup response", () => {
  assert.equal(
    describeStartupFailure("INFO: connected\nERROR: Failed to open output device\n", "startup failed"),
    "startup failed: ERROR: Failed to open output device",
  );
});
