import { cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
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

await rm("dist", { recursive: true, force: true });
const tsc = "node_modules/typescript/bin/tsc";
await run(process.execPath, [tsc, "-p", "tsconfig.electron.json"]);
await run(process.execPath, [tsc, "-p", "tsconfig.preload.json"]);
await mkdir("dist/desktop", { recursive: true });
await cp("src/desktop/renderer", "dist/desktop/renderer", { recursive: true });
