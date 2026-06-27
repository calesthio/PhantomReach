import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { runPreflight } from "./local-preflight.mjs";

const HOST = "127.0.0.1";
const PORT = 3000;

function commandName(name) {
  return process.platform === "win32" && ["npm", "npx"].includes(name) ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  return spawn(commandName(command), args, {
    cwd: process.cwd(),
    stdio: options.stdio ?? "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...options.env },
  });
}

function runSync(command, args, options = {}) {
  execFileSync(commandName(command), args, {
    cwd: process.cwd(),
    stdio: options.stdio ?? "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...options.env },
  });
}

function ensureNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isFinite(major) || major < 20) {
    throw new Error(
      `Phantom Reach needs Node.js 20 or newer. Current version: ${process.version}`
    );
  }
}

function ensureNpmAvailable() {
  runSync("npm", ["--version"], { stdio: "ignore" });
}

function dependenciesInstalled() {
  return fs.existsSync(path.join(process.cwd(), "node_modules", "next"));
}

function ensureDependencies() {
  if (dependenciesInstalled()) return;
  console.log("Installing local dependencies. This can take a few minutes the first time...");
  runSync("npm", ["install"]);
}

function getJson(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve({ status: response.statusCode ?? 0, body: JSON.parse(body) });
        } catch {
          resolve({ status: response.statusCode ?? 0, body: null });
        }
      });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
  });
}

async function isPhantomReachOnPort() {
  const response = await getJson(`http://${HOST}:${PORT}/api/health`);
  return response?.status === 200 && response.body?.service === "Phantom Reach API";
}

function pidsOnPortWindows(port) {
  let output = "";
  try {
    output = execFileSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
    ], { encoding: "utf8" });
  } catch {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function pidsOnPortUnix(port) {
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" });
    return output
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

function pidsOnPort(port) {
  return process.platform === "win32" ? pidsOnPortWindows(port) : pidsOnPortUnix(port);
}

function commandLineForPid(pid) {
  try {
    if (process.platform === "win32") {
      return execFileSync("powershell.exe", [
        "-NoProfile",
        "-Command",
        `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
      ], { encoding: "utf8" }).trim();
    }

    return execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function isWorkspaceNextProcess(pid) {
  const commandLine = commandLineForPid(pid).toLowerCase();
  const workspace = process.cwd().toLowerCase();
  return (
    commandLine.includes(workspace) &&
    commandLine.includes("node_modules") &&
    commandLine.includes("next")
  );
}

function killPidTree(pid) {
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch {
      // Fall through to the regular kill path.
    }
  }
  process.kill(pid);
}

async function waitForPortFree(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pidsOnPort(port).length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for port ${port} to become available.`);
}

async function restartStalePhantomServerIfNeeded() {
  const pids = pidsOnPort(PORT);
  if (pids.length === 0) return;

  const isHealthyPhantom = await isPhantomReachOnPort();
  const isWorkspaceServer = pids.every(isWorkspaceNextProcess);

  if (!isHealthyPhantom && !isWorkspaceServer) {
    throw new Error(
      `Port ${PORT} is already in use by another app. Close that app or set a different port before starting Phantom Reach.`
    );
  }

  console.log(`Restarting existing Phantom Reach server on port ${PORT}...`);
  for (const pid of pids) {
    try {
      killPidTree(pid);
    } catch {
      // The process may have exited between detection and kill.
    }
  }
  await waitForPortFree(PORT);
}

function startNextDev() {
  console.log(`Starting Phantom Reach at http://${HOST}:${PORT}`);
  const child = run("npm", ["run", "dev", "--", "--hostname", HOST, "--port", String(PORT)]);

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

try {
  ensureNodeVersion();
  ensureNpmAvailable();
  ensureDependencies();
  await restartStalePhantomServerIfNeeded();
  await runPreflight({ cleanNext: true });
  startNextDev();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
