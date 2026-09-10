import assert from "node:assert/strict";
import test from "node:test";
import {
  RawFrameAssembler,
  WINDOWS_CAMERA_HEADER_BYTES,
  WINDOWS_CAMERA_HEIGHT,
  WINDOWS_CAMERA_PIXEL_BYTES,
  WINDOWS_CAMERA_STRIDE,
  WINDOWS_CAMERA_WIDTH,
  buildWindowsFfmpegArgs,
  buildWindowsScrcpyOutputArgs,
  createWindowsCameraFrame,
  isWindowsCameraWorkerConfig,
} from "../src/windows-camera.ts";

test("builds fixed BGRA 720p30 FFmpeg output", () => {
  const args = buildWindowsFfmpegArgs();
  assert.deepEqual(args.slice(0, 14), [
    "-hide_banner",
    "-loglevel", "warning",
    "-fflags", "nobuffer",
    "-flags", "low_delay",
    "-probesize", "32",
    "-analyzeduration", "0",
    "-threads", "1",
    "-f",
  ]);
  assert.ok(args.includes("pipe:0"));
  assert.ok(args.includes("bgra"));
  assert.ok(args.includes("rawvideo"));
  assert.ok(args.includes("passthrough"));
  assert.ok(args.some((arg) => arg.includes("scale=1280:720") && arg.includes("fps=30")));
});

test("records scrcpy Matroska into the named pipe without UI", () => {
  assert.deepEqual(buildWindowsScrcpyOutputArgs("\\\\.\\pipe\\camera"), [
    "--record=\\\\.\\pipe\\camera",
    "--record-format=mkv",
    "--no-playback",
    "--no-window",
  ]);
});

test("encodes the exact 24-byte little-endian frame header", () => {
  const pixels = Buffer.alloc(WINDOWS_CAMERA_PIXEL_BYTES, 0x7f);
  const output = createWindowsCameraFrame(pixels, 42n);
  if (!output) assert.fail("Expected a valid frame");

  assert.equal(output.length, WINDOWS_CAMERA_HEADER_BYTES + WINDOWS_CAMERA_PIXEL_BYTES);
  assert.equal(output.readInt32LE(0), WINDOWS_CAMERA_WIDTH);
  assert.equal(output.readInt32LE(4), WINDOWS_CAMERA_HEIGHT);
  assert.equal(output.readInt32LE(8), WINDOWS_CAMERA_STRIDE);
  assert.equal(output.readBigInt64LE(12), 42n);
  assert.equal(output.readInt32LE(20), WINDOWS_CAMERA_PIXEL_BYTES);
  assert.equal(output[WINDOWS_CAMERA_HEADER_BYTES], 0x7f);
  assert.equal(createWindowsCameraFrame(Buffer.alloc(10), 1n), null);
});

test("assembles split and coalesced raw frames", () => {
  const frames: Buffer[] = [];
  const assembler = new RawFrameAssembler((frame) => frames.push(Buffer.from(frame)));
  const first = Buffer.alloc(WINDOWS_CAMERA_PIXEL_BYTES, 1);
  const second = Buffer.alloc(WINDOWS_CAMERA_PIXEL_BYTES, 2);
  assembler.push(first.subarray(0, 100));
  assembler.push(Buffer.concat([first.subarray(100), second, Buffer.alloc(50, 3)]));

  assert.equal(frames.length, 2);
  assert.equal(frames[0]?.[0], 1);
  assert.equal(frames[1]?.[0], 2);
});

test("strictly validates worker configuration", () => {
  const config = {
    scrcpyExecutable: "scrcpy.exe",
    ffmpegExecutable: "ffmpeg.exe",
    scrcpyArgs: ["--video-source=camera"],
    framePath: "frame.dat",
    readyPath: "ready",
    errorPath: "error",
    logPath: "worker.log",
  };
  assert.equal(isWindowsCameraWorkerConfig(config), true);
  assert.equal(isWindowsCameraWorkerConfig({ ...config, scrcpyArgs: [1] }), false);
  assert.equal(isWindowsCameraWorkerConfig(null), false);
});
