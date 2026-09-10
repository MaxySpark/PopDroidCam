import { rename, rm, writeFile } from "node:fs/promises";

export const WINDOWS_CAMERA_WIDTH = 1280;
export const WINDOWS_CAMERA_HEIGHT = 720;
export const WINDOWS_CAMERA_STRIDE = WINDOWS_CAMERA_WIDTH * 4;
export const WINDOWS_CAMERA_PIXEL_BYTES = WINDOWS_CAMERA_STRIDE * WINDOWS_CAMERA_HEIGHT;
export const WINDOWS_CAMERA_HEADER_BYTES = 24;

export interface WindowsCameraWorkerConfig {
  scrcpyExecutable: string;
  ffmpegExecutable: string;
  scrcpyArgs: string[];
  framePath: string;
  readyPath: string;
  errorPath: string;
  logPath: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function isWindowsCameraWorkerConfig(value: unknown): value is WindowsCameraWorkerConfig {
  if (typeof value !== "object" || value === null) return false;
  if (!("scrcpyExecutable" in value) || typeof value.scrcpyExecutable !== "string") return false;
  if (!("ffmpegExecutable" in value) || typeof value.ffmpegExecutable !== "string") return false;
  if (!("scrcpyArgs" in value) || !isStringArray(value.scrcpyArgs)) return false;
  if (!("framePath" in value) || typeof value.framePath !== "string") return false;
  if (!("readyPath" in value) || typeof value.readyPath !== "string") return false;
  if (!("errorPath" in value) || typeof value.errorPath !== "string") return false;
  if (!("logPath" in value) || typeof value.logPath !== "string") return false;
  return true;
}

export function buildWindowsFfmpegArgs(): string[] {
  return [
    "-hide_banner",
    "-loglevel", "warning",
    "-fflags", "nobuffer",
    "-flags", "low_delay",
    "-probesize", "32",
    "-analyzeduration", "0",
    "-threads", "1",
    "-f", "matroska",
    "-i", "pipe:0",
    "-an",
    "-vf", `scale=${WINDOWS_CAMERA_WIDTH}:${WINDOWS_CAMERA_HEIGHT}:force_original_aspect_ratio=decrease,pad=${WINDOWS_CAMERA_WIDTH}:${WINDOWS_CAMERA_HEIGHT}:(ow-iw)/2:(oh-ih)/2,fps=30`,
    "-pix_fmt", "bgra",
    "-fps_mode", "passthrough",
    "-f", "rawvideo",
    "pipe:1",
  ];
}

export function buildWindowsScrcpyOutputArgs(pipePath: string): string[] {
  return [
    `--record=${pipePath}`,
    "--record-format=mkv",
    "--no-playback",
    "--no-window",
  ];
}

export function createWindowsCameraFrame(frame: Buffer, sequence: bigint): Buffer | null {
  if (frame.length !== WINDOWS_CAMERA_PIXEL_BYTES || sequence < 0n) return null;

  const output = Buffer.allocUnsafe(WINDOWS_CAMERA_HEADER_BYTES + frame.length);
  output.writeInt32LE(WINDOWS_CAMERA_WIDTH, 0);
  output.writeInt32LE(WINDOWS_CAMERA_HEIGHT, 4);
  output.writeInt32LE(WINDOWS_CAMERA_STRIDE, 8);
  output.writeBigInt64LE(sequence, 12);
  output.writeInt32LE(WINDOWS_CAMERA_PIXEL_BYTES, 20);
  frame.copy(output, WINDOWS_CAMERA_HEADER_BYTES);
  return output;
}

export class RawFrameAssembler {
  readonly #onFrame: (frame: Buffer) => void;
  #frame = Buffer.allocUnsafe(WINDOWS_CAMERA_PIXEL_BYTES);
  #offset = 0;

  constructor(onFrame: (frame: Buffer) => void) {
    this.#onFrame = onFrame;
  }

  push(chunk: Buffer): void {
    if (chunk.length === 0) return;
    let chunkOffset = 0;
    while (chunkOffset < chunk.length) {
      const bytesToCopy = Math.min(WINDOWS_CAMERA_PIXEL_BYTES - this.#offset, chunk.length - chunkOffset);
      chunk.copy(this.#frame, this.#offset, chunkOffset, chunkOffset + bytesToCopy);
      this.#offset += bytesToCopy;
      chunkOffset += bytesToCopy;
      if (this.#offset !== WINDOWS_CAMERA_PIXEL_BYTES) continue;

      this.#onFrame(this.#frame);
      this.#frame = Buffer.allocUnsafe(WINDOWS_CAMERA_PIXEL_BYTES);
      this.#offset = 0;
    }
  }
}

export class AtomicFramePublisher {
  readonly #framePath: string;
  readonly #onPublished: () => void;
  readonly #onFailure: (error: Error) => void;
  #sequence = 0n;
  #publishing = false;
  #queuedFrame: Buffer | null = null;

  constructor(framePath: string, onPublished: () => void = () => undefined, onFailure: (error: Error) => void = () => undefined) {
    this.#framePath = framePath;
    this.#onPublished = onPublished;
    this.#onFailure = onFailure;
  }

  publish(frame: Buffer): void {
    this.#queuedFrame = Buffer.from(frame);
    if (this.#publishing) return;
    void this.#drain();
  }

  async #drain(): Promise<void> {
    this.#publishing = true;
    while (this.#queuedFrame) {
      const frame = this.#queuedFrame;
      this.#queuedFrame = null;
      this.#sequence += 1n;
      const output = createWindowsCameraFrame(frame, this.#sequence);
      if (!output) continue;

      const temporaryPath = `${this.#framePath}.${process.pid}.tmp`;
      try {
        await writeFile(temporaryPath, output);
        await rename(temporaryPath, this.#framePath);
        this.#onPublished();
      } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => undefined);
        this.#onFailure(error instanceof Error ? error : new Error(String(error)));
      }
    }
    this.#publishing = false;
  }
}
