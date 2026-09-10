import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const archiveName = "ffmpeg-n8.0.1-17-g27a297f186-win64-lgpl-shared-8.0.zip";
const expectedSha256 = "ceebf3f437c0a0c18d02ad284f998af3648c035d48ba6027f0b5a796645c38dc";
const release = "autobuild-2025-11-30-12-53";
const url = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${release}/${archiveName}`;
const vendorDirectory = "vendor";
const targetDirectory = join(vendorDirectory, "ffmpeg-win64");
const archivePath = join(vendorDirectory, archiveName);
const temporaryDirectory = join(vendorDirectory, ".ffmpeg-extract");
const archiveBinPath = `${archiveName.slice(0, -4)}/bin`;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

await mkdir(vendorDirectory, { recursive: true });
if (!await exists(archivePath)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download FFmpeg: HTTP ${response.status}`);
  await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
}

const digest = createHash("sha256").update(await readFile(archivePath)).digest("hex");
if (digest !== expectedSha256) {
  await rm(archivePath, { force: true });
  throw new Error(`FFmpeg checksum mismatch: expected ${expectedSha256}, received ${digest}`);
}

await rm(temporaryDirectory, { recursive: true, force: true });
await mkdir(temporaryDirectory, { recursive: true });
await run("tar", ["-xf", archivePath, "-C", temporaryDirectory, archiveBinPath]);
await rm(targetDirectory, { recursive: true, force: true });
await mkdir(targetDirectory, { recursive: true });
const extractedBinPath = join(temporaryDirectory, ...archiveBinPath.split("/"));
const runtimeFiles = (await readdir(extractedBinPath)).filter((name) => name === "ffmpeg.exe" || name.endsWith(".dll"));
if (!runtimeFiles.includes("ffmpeg.exe") || !runtimeFiles.some((name) => name.endsWith(".dll"))) {
  throw new Error("FFmpeg archive is missing required Windows runtime files");
}
for (const runtimeFile of runtimeFiles) {
  await copyFile(join(extractedBinPath, runtimeFile), join(targetDirectory, runtimeFile));
}
await rm(temporaryDirectory, { recursive: true, force: true });
console.log(`Verified and prepared pinned LGPL FFmpeg 8.0.1 in ${targetDirectory}.`);
