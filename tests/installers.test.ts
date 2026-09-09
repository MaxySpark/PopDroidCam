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

test("Windows package includes a command shim and CLI entrypoint", () => {
  const packageConfig = readFileSync("package.json", "utf-8");
  const electronConfig = readFileSync("tsconfig.electron.json", "utf-8");
  assert.match(packageConfig, /scripts\/installer\.nsh/);
  assert.match(electronConfig, /src\/cli\.ts/);
});
