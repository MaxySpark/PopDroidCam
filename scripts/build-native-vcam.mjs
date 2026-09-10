import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const projectDirectory = join("vendor", "native-vcam");
const sourceProject = join(projectDirectory, "PopDroidCamVirtualCameraSource.vcxproj");
const registrarProject = join(projectDirectory, "PopDroidCamCameraRegistrar.vcxproj");
const buildDirectory = join(projectDirectory, "build", "Release", "x64");
const outputDirectory = join(projectDirectory, "dist");
const dllName = "PopDroidCamVirtualCameraSource.dll";
const registrarName = "PopDroidCamCameraRegistrar.exe";

function findMsBuild() {
  const vswhere = join(
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  const result = spawnSync(
    vswhere,
    ["-latest", "-products", "*", "-requires", "Microsoft.Component.MSBuild", "-find", "MSBuild\\**\\Bin\\MSBuild.exe"],
    { encoding: "utf8", windowsHide: true },
  );
  const discovered = result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : undefined;
  return discovered || "MSBuild.exe";
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

if (process.platform !== "win32") {
  throw new Error("The native virtual camera can only be built on Windows.");
}

await rm(join(projectDirectory, "build"), { recursive: true, force: true });
await rm(outputDirectory, { recursive: true, force: true });
const msBuild = findMsBuild();
const buildArguments = ["/restore", "/m", "/p:Configuration=Release", "/p:Platform=x64"];
await run(msBuild, [sourceProject, ...buildArguments]);
await run(msBuild, [registrarProject, ...buildArguments]);

const builtDll = join(buildDirectory, dllName);
const builtRegistrar = join(buildDirectory, registrarName);
const builtDllStats = await stat(builtDll).catch(() => undefined);
if (!builtDllStats?.isFile()) {
  throw new Error(`Native virtual-camera build did not produce ${builtDll}.`);
}
const builtRegistrarStats = await stat(builtRegistrar).catch(() => undefined);
if (!builtRegistrarStats?.isFile()) {
  throw new Error(`Native virtual-camera build did not produce ${builtRegistrar}.`);
}

await mkdir(outputDirectory, { recursive: true });
await copyFile(builtDll, join(outputDirectory, dllName));
await copyFile(builtRegistrar, join(outputDirectory, registrarName));
await copyFile(join(projectDirectory, "LICENSE-OverlayCamera.txt"), join(outputDirectory, "LICENSE-OverlayCamera.txt"));
await copyFile(join(projectDirectory, "LICENSE-VCamSample.txt"), join(outputDirectory, "LICENSE-VCamSample.txt"));
