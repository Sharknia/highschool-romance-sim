import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { resolveWebDevServerConfig } from "./dev-server-config.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const viteCommand = isWindows ? "vite.cmd" : "vite";
const children = new Set();

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      env: { ...process.env, ...options.env },
      stdio: options.stdio || "inherit"
    });
    children.add(child);
    child.on("exit", (code, signal) => {
      children.delete(child);
      if (signal) {
        reject(new Error(`${command} ${args.join(" ")} exited with ${signal}`));
        return;
      }
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: appRoot,
    env: { ...process.env, ...options.env },
    stdio: options.stdio || "inherit"
  });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown && code !== 0 && signal !== "SIGTERM") {
      process.stderr.write(`${command} ${args.join(" ")} exited unexpectedly\n`);
      shutdown(code || 1);
    }
  });
  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exitCode = code;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const devServerConfig = resolveWebDevServerConfig(process.env);

await run(npmCommand, ["run", "build:server"]);
start(process.execPath, ["dist/server/server.js"], {
  env: {
    PORT: devServerConfig.apiPort,
    VN_MAKER_API_ONLY: "1"
  }
});
start(viteCommand, ["--host", "127.0.0.1", "--port", devServerConfig.vitePort]);
