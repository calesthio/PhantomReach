import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import { createLocalSqliteDb } from "@/lib/db/local-sqlite";

describe("local sqlite db", () => {
  it("initializes a local workspace and persists reports", async () => {
    const dir = mkdtempSync(join(tmpdir(), "phantom-reach-sqlite-"));
    const dbPath = join(dir, "phantom-reach.db");

    const db = createLocalSqliteDb(dbPath);

    try {
      const user = await db.getLocalWorkspaceUser();

      expect(user.email).toBe("local@phantomreach.local");
      expect(user.plan).toBe("agency");

      const report = await db.createReport({
        user_id: user.id,
        type: "audit",
        input: { businessName: "Test Business", city: "Seattle" },
      });

      expect(report.status).toBe("queued");

      await db.updateReport(report.id, {
        status: "completed",
        scores: {
          overall_grade: "Local",
          overall_score: 0,
          module_grades: {},
        },
      });

      const fetched = await db.getReport(report.id);
      expect(fetched?.status).toBe("completed");
      expect(fetched?.input).toEqual({ businessName: "Test Business", city: "Seattle" });

      const reports = await db.getReportsByUser(user.id);
      expect(reports).toHaveLength(1);
      expect(reports[0].id).toBe(report.id);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tracks usage without decrementing local credits", async () => {
    const dir = mkdtempSync(join(tmpdir(), "phantom-reach-sqlite-"));
    const dbPath = join(dir, "phantom-reach.db");
    const db = createLocalSqliteDb(dbPath);

    try {
      const user = await db.getLocalWorkspaceUser();

      await db.trackUsage({
        user_id: user.id,
        action: "audit",
        credits_consumed: 1,
      });

      const updated = await db.getUser(user.id);
      expect(updated?.audit_credits_remaining).toBe(999999);

      const usage = await db.getUserUsage(user.id);
      expect(usage).toHaveLength(1);
      expect(usage[0].action).toBe("audit");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks orphaned processing reports as failed when reports are read", async () => {
    const dir = mkdtempSync(join(tmpdir(), "phantom-reach-sqlite-"));
    const dbPath = join(dir, "phantom-reach.db");
    const db = createLocalSqliteDb(dbPath);

    try {
      const user = await db.getLocalWorkspaceUser();
      const stale = await db.createReport({
        user_id: user.id,
        type: "audit",
        input: { businessName: "Stale Dental", city: "Bellevue" },
      });
      const fresh = await db.createReport({
        user_id: user.id,
        type: "audit",
        input: { businessName: "Fresh Dental", city: "Bellevue" },
      });

      await db.updateReport(stale.id, { status: "processing" });
      await db.updateReport(fresh.id, { status: "processing" });

      const sqlite = new Database(dbPath);
      try {
        sqlite
          .prepare("UPDATE reports SET updated_at = ? WHERE id = ?")
          .run(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), stale.id);
      } finally {
        sqlite.close();
      }

      const reports = await db.getReportsByUser(user.id);
      const staleReport = reports.find((report) => report.id === stale.id);
      const freshReport = reports.find((report) => report.id === fresh.id);

      expect(staleReport?.status).toBe("failed");
      expect(freshReport?.status).toBe("processing");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
