import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Linux desktop launcher uses an installed package manager", () => {
  const launcher = readFileSync("popdroidcam", "utf-8");
  assert.match(launcher, /pnpm exec electron dist\/desktop\/main\.js/);
  assert.doesNotMatch(launcher, /npx electron/);
});

test("Arch setup installs Electron runtime libraries", () => {
  const setup = readFileSync("setup.sh", "utf-8");
  assert.match(setup, /gtk3/);
  assert.match(setup, /nss/);
  assert.match(setup, /alsa-lib/);
});

test("Windows package includes the CLI and native virtual camera", () => {
  const packageConfig = readFileSync("package.json", "utf-8");
  const electronConfig = readFileSync("tsconfig.electron.json", "utf-8");
  const installer = readFileSync("scripts/installer.nsh", "utf-8");
  assert.match(packageConfig, /scripts\/installer\.nsh/);
  assert.match(electronConfig, /src\/cli\.ts/);
  assert.match(packageConfig, /prepare:ffmpeg:win/);
  assert.match(packageConfig, /build:native:camera/);
  assert.match(packageConfig, /vendor\/ffmpeg-win64/);
  assert.match(packageConfig, /vendor\/native-vcam\/dist/);
  assert.match(installer, /regsvr32\.exe.*PopDroidCamVirtualCameraSource\.dll/);
  assert.match(installer, /regsvr32\.exe.*\/u \/s/);
  assert.match(installer, /PopDroidCamCameraRegistrar\.exe.*register/);
  assert.match(installer, /PopDroidCamCameraRegistrar\.exe.*remove/);
  assert.match(installer, /DisableX64FSRedirection/);
  assert.match(installer, /taskkill\.exe.*PopDroidCam\.exe.*\/T \/F/);
});
