import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function getPhantomHome(): string {
  return process.env.PHANTOM_REACH_HOME || process.cwd();
}

export function getInstanceKeyPath(): string {
  return path.join(getPhantomHome(), ".phantom-reach", "instance.key");
}

export function loadInstanceKey(): Buffer {
  const keyPath = getInstanceKeyPath();
  const dir = path.dirname(keyPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(keyPath)) {
    const key = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(keyPath, `${key}\n`, { encoding: "utf8", mode: 0o600 });
  }

  const hex = fs.readFileSync(keyPath, "utf8").trim();
  if (!/^[a-f0-9]{64}$/i.test(hex)) {
    throw new Error(
      "Invalid Phantom Reach instance key. Delete .phantom-reach/instance.key and re-enter saved keys."
    );
  }

  return Buffer.from(hex, "hex");
}
