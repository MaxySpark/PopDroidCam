import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const version = "4.1";
const archiveName = `scrcpy-win64-v${version}.zip`;
const expectedSha256 = "5b12172b3264b2889f4583ee64752ce832e29bc8b1089dca81093459697165db";
const url = `https://github.com/Genymobile/scrcpy/releases/download/v${version}/${archiveName}`;
const vendorDirectory = "vendor";
const targetDirectory = join(vendorDirectory, "scrcpy-win64");
const archivePath = join(vendorDirectory, archiveName);
const temporaryDirectory = join(vendorDirectory, ".scrcpy-extract");

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
  if (!response.ok) throw new Error(`Could not download scrcpy: HTTP ${response.status}`);
  await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
}

const digest = createHash("sha256").update(await readFile(archivePath)).digest("hex");
if (digest !== expectedSha256) {
  await rm(archivePath, { force: true });
  throw new Error(`scrcpy checksum mismatch: expected ${expectedSha256}, received ${digest}`);
}

await rm(temporaryDirectory, { recursive: true, force: true });
await mkdir(temporaryDirectory, { recursive: true });
await run("tar", ["-xf", archivePath, "-C", temporaryDirectory]);

const entries = await readdir(temporaryDirectory, { withFileTypes: true });
const root = entries.find((entry) => entry.isDirectory());
if (!root) throw new Error("scrcpy archive did not contain a directory");

await rm(targetDirectory, { recursive: true, force: true });
await rename(join(temporaryDirectory, root.name), targetDirectory);
await rm(temporaryDirectory, { recursive: true, force: true });
if (!await exists(join(targetDirectory, "scrcpy.exe")) || !await exists(join(targetDirectory, "adb.exe"))) {
  throw new Error("scrcpy archive is missing required Windows executables");
}
console.log(`Verified and prepared scrcpy ${version} in ${targetDirectory}.`);
