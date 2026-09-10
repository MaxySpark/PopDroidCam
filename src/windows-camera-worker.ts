import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { dirname } from "node:path";
import {
  AtomicFramePublisher,
  RawFrameAssembler,
  buildWindowsFfmpegArgs,
  buildWindowsScrcpyOutputArgs,
  isWindowsCameraWorkerConfig,
  type WindowsCameraWorkerConfig,
} from "./windows-camera.js";

function loadConfig(args: string[]): WindowsCameraWorkerConfig | null {
  const configIndex = args.indexOf("--config");
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  if (!configPath) return null;

  try {
    const value: unknown = JSON.parse(readFileSync(configPath, "utf-8"));
    return isWindowsCameraWorkerConfig(value) ? value : null;
  } catch {
    return null;
  }
}

function reportFailure(config: WindowsCameraWorkerConfig | null, message: string): never {
  if (config) {
    try {
      appendFileSync(config.logPath, `[worker] ${message}\n`);
      writeFileSync(config.errorPath, message);
    } catch {
      // The parent also detects an exited worker when state files are unavailable.
    }
  }
  process.exit(1);
}

const config = loadConfig(process.argv.slice(2));
if (!config) reportFailure(null, "Invalid Windows camera worker configuration");

mkdirSync(dirname(config.framePath), { recursive: true });
const pipePath = `\\\\.\\pipe\\popdroidcam-${process.pid}`;
let ready = false;
let publishFailures = 0;
const publisher = new AtomicFramePublisher(
  config.framePath,
  () => {
    publishFailures = 0;
    if (ready) return;
    ready = true;
    try {
      writeFileSync(config.readyPath, JSON.stringify({ pipePath, ffmpegPid: ffmpeg?.pid, scrcpyPid: scrcpy?.pid }));
    } catch (error) {
      reportFailure(config, error instanceof Error ? error.message : String(error));
    }
  },
  (error) => {
    publishFailures += 1;
    if (publishFailures >= 30) reportFailure(config, `Could not publish camera frames: ${error.message}`);
  },
);
const assembler = new RawFrameAssembler((frame) => publisher.publish(frame));
let ffmpeg: ChildProcess | null = null;
let scrcpy: ChildProcess | null = null;
let inputSocket: Socket | null = null;
let server: Server | null = null;
let shuttingDown = false;

process.once("exit", () => {
  inputSocket?.destroy();
  server?.close();
  if (scrcpy?.exitCode === null) scrcpy.kill("SIGTERM");
  if (ffmpeg?.exitCode === null) ffmpeg.kill("SIGTERM");
  rmSync(config.framePath, { force: true });
});

function shutdown(exitCode: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  inputSocket?.destroy();
  server?.close();
  if (scrcpy?.exitCode === null) scrcpy.kill("SIGTERM");
  if (ffmpeg?.exitCode === null) ffmpeg.kill("SIGTERM");
  process.exitCode = exitCode;
}

const logDescriptor = openSync(config.logPath, "a");
server = createServer((socket) => {
  if (inputSocket) {
    socket.destroy();
    return;
  }
  inputSocket = socket;
  const stdin = ffmpeg?.stdin;
  if (!stdin) {
    socket.destroy();
    shutdown(1);
    return;
  }
  socket.once("error", (error) => {
    if (!shuttingDown) reportFailure(config, `Named pipe connection failed: ${error.message}`);
  });
  stdin.once("error", (error) => {
    if (!shuttingDown) reportFailure(config, `FFmpeg input failed: ${error.message}`);
  });
  socket.pipe(stdin);
});

server.once("error", (error) => reportFailure(config, `Named pipe failed: ${error.message}`));
server.listen(pipePath, () => {
  ffmpeg = spawn(config.ffmpegExecutable, buildWindowsFfmpegArgs(), {
    stdio: ["pipe", "pipe", logDescriptor],
    windowsHide: true,
  });
  const stdout = ffmpeg.stdout;
  if (!stdout) reportFailure(config, "FFmpeg did not expose raw video output");
  stdout.on("data", (chunk: Buffer) => assembler.push(chunk));
  ffmpeg.once("error", (error) => reportFailure(config, `Could not start FFmpeg: ${error.message}`));
  ffmpeg.once("exit", (code) => {
    if (!shuttingDown) reportFailure(config, `FFmpeg exited with code ${code ?? "unknown"}`);
  });

  scrcpy = spawn(config.scrcpyExecutable, [...config.scrcpyArgs, ...buildWindowsScrcpyOutputArgs(pipePath)], {
    stdio: ["ignore", logDescriptor, logDescriptor],
    windowsHide: true,
  });
  scrcpy.once("error", (error) => reportFailure(config, `Could not start scrcpy: ${error.message}`));
  scrcpy.once("exit", (code) => {
    if (!shuttingDown) reportFailure(config, `scrcpy exited with code ${code ?? "unknown"}`);
  });

  closeSync(logDescriptor);
});

process.once("SIGTERM", () => shutdown(0));
process.once("SIGINT", () => shutdown(0));
