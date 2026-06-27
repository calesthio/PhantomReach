import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const workspaces: string[] = [];

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("local preflight", () => {
  it("initializes local key and SQLite workspace in an isolated directory", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "phantom-local-"));
    workspaces.push(workspace);

    const preflightUrl = pathToFileURL(join(process.cwd(), "scripts", "local-preflight.mjs")).href;
    const { runPreflight } = await import(preflightUrl);

    await runPreflight({
      cwd: workspace,
      cleanNext: false,
      quiet: true,
    });

    const key = readFileSync(join(workspace, ".phantom-reach", "instance.key"), "utf8").trim();
    expect(key).toMatch(/^[a-f0-9]{64}$/);

    const db = new Database(join(workspace, "data", "phantom-reach.db"));
    try {
      const user = db
        .prepare("SELECT email, plan, audit_credits_remaining FROM users WHERE email = ?")
        .get("local@phantomreach.local") as
        | { email: string; plan: string; audit_credits_remaining: number }
        | undefined;

      expect(user).toEqual({
        email: "local@phantomreach.local",
        plan: "agency",
        audit_credits_remaining: 999999,
      });
    } finally {
      db.close();
    }
  });
});
