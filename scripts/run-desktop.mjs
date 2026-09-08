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

await run("node", ["scripts/build-desktop.mjs"]);
await run(process.execPath, ["node_modules/electron/cli.js", "dist/desktop/main.js"], {
  ...process.env,
  NODE_ENV: "development",
});
