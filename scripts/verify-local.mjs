import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import process from "node:process";
import { runPreflight } from "./local-preflight.mjs";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 3100;

function commandName(name) {
  return process.platform === "win32" && ["npm", "npx"].includes(name) ? `${name}.cmd` : name;
}

function runStep(label, command, args, options = {}) {
  console.log(`\n==> ${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(commandName(command), args, {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...options.env },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
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

async function waitForHealth(deadlineMs = 90_000) {
  const baseUrl = `http://${HOST}:${activePort}`;
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const response = await getJson(`${baseUrl}/api/health`);
    if (response?.status === 200 && response.body?.service === "Phantom Reach API") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${baseUrl}/api/health`);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free local port found from ${startPort} to ${startPort + 19}.`);
}

function stopChild(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch {
      // Fall through to the regular kill path.
    }
  }
  child.kill();
}

let activePort = DEFAULT_PORT;

async function withDevServer(fn) {
  activePort = await findFreePort(DEFAULT_PORT);
  const baseUrl = `http://${HOST}:${activePort}`;
  console.log(`\n==> Starting temporary dev server at ${baseUrl}`);
  const child = spawn(commandName("npm"), [
    "run",
    "dev",
    "--",
    "--hostname",
    HOST,
    "--port",
    String(activePort),
  ], {
    cwd: process.cwd(),
    stdio: "pipe",
    shell: process.platform === "win32",
    env: process.env,
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  try {
    await waitForHealth();
    await fn();
  } finally {
    stopChild(child);
  }
}

try {
  await runPreflight({ cleanNext: false, quiet: true });
  await runStep("TypeScript", "npx", ["tsc", "--noEmit"]);
  await runStep("Vitest", "npx", ["vitest", "run"]);
  await withDevServer(async () => {
    const baseUrl = `http://${HOST}:${activePort}`;
    await runStep("Playwright visual smoke", "node", ["testing_framework/visual-smoke.mjs"], {
      env: { PHANTOM_REACH_BASE_URL: baseUrl },
    });
  });
  console.log("\nLocal verification passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
