import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { randomUUID } from "crypto";
import type {
  ApiUsage,
  AuditInput,
  Plan,
  Report,
  ReportStatus,
  ReportType,
  ScoutInput,
  UsageAction,
  User,
  WidgetLead,
} from "./types";
import type { DbInterface } from "./index";

const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
const LOCAL_USER_EMAIL = "local@phantomreach.local";
const LOCAL_CREDITS = 999999;
const STALE_PROCESSING_MS = 30 * 60 * 1000;

export interface LocalSqliteDb extends DbInterface {
  getLocalWorkspaceUser(): Promise<User>;
  close(): void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return randomUUID();
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null || value === "") return fallback;
  const parsed = JSON.parse(value);
  return parsed == null ? fallback : parsed as T;
}

function normalizeDbPath(dbPath?: string): string {
  const fromEnv = process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.slice("file:".length)
    : undefined;
  return resolve(dbPath ?? fromEnv ?? "./data/phantom-reach.db");
}

function initSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      auth_user_id TEXT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      plan TEXT NOT NULL DEFAULT 'agency',
      stripe_customer_id TEXT,
      audit_credits_remaining INTEGER NOT NULL DEFAULT 999999,
      scout_credits_remaining INTEGER NOT NULL DEFAULT 999999,
      widget_api_key TEXT,
      white_label_config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      input TEXT NOT NULL,
      result TEXT,
      scores TEXT,
      pdf_storage_path TEXT,
      email_sent_at TEXT,
      expires_at TEXT,
      is_widget_generated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      credits_consumed INTEGER NOT NULL DEFAULT 1,
      stripe_metered_event_id TEXT,
      created_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS widget_leads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      visitor_email TEXT NOT NULL,
      visitor_name TEXT,
      business_audited TEXT NOT NULL,
      report_id TEXT,
      created_at TEXT NOT NULL,
      delivered_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_user_action_created ON api_usage(user_id, action, created_at);
    CREATE INDEX IF NOT EXISTS idx_widget_leads_user_id ON widget_leads(user_id);
  `);
}

function seedLocalWorkspace(sqlite: Database.Database): void {
  const existing = sqlite.prepare("SELECT id FROM users WHERE id = ?").get(LOCAL_USER_ID);
  if (existing) return;

  const now = nowIso();
  sqlite.prepare(`
    INSERT INTO users (
      id, auth_user_id, email, name, plan, stripe_customer_id,
      audit_credits_remaining, scout_credits_remaining, widget_api_key,
      white_label_config, created_at, updated_at
    ) VALUES (
      @id, NULL, @email, @name, 'agency', NULL,
      @audit_credits_remaining, @scout_credits_remaining, NULL,
      @white_label_config, @created_at, @updated_at
    )
  `).run({
    id: LOCAL_USER_ID,
    email: LOCAL_USER_EMAIL,
    name: "Local Workspace",
    audit_credits_remaining: LOCAL_CREDITS,
    scout_credits_remaining: LOCAL_CREDITS,
    white_label_config: "{}",
    created_at: now,
    updated_at: now,
  });
}

function reconcileStaleProcessingReports(sqlite: Database.Database): void {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  sqlite
    .prepare(`
      UPDATE reports
      SET status = 'failed', updated_at = @now
      WHERE status IN ('queued', 'processing')
        AND result IS NULL
        AND updated_at < @cutoff
    `)
    .run({ now: nowIso(), cutoff });
}

function mapUser(row: any): User {
  return {
    id: row.id,
    auth_user_id: row.auth_user_id ?? undefined,
    email: row.email,
    name: row.name ?? undefined,
    plan: row.plan as Plan,
    stripe_customer_id: row.stripe_customer_id ?? undefined,
    audit_credits_remaining: row.audit_credits_remaining,
    scout_credits_remaining: row.scout_credits_remaining,
    widget_api_key: row.widget_api_key ?? undefined,
    white_label_config: parseJson(row.white_label_config, {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapReport(row: any): Report {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    status: row.status,
    input: parseJson(row.input, {}),
    result: parseJson(row.result, undefined),
    scores: parseJson(row.scores, undefined),
    pdf_storage_path: row.pdf_storage_path ?? undefined,
    email_sent_at: row.email_sent_at ?? undefined,
    expires_at: row.expires_at ?? undefined,
    is_widget_generated: row.is_widget_generated === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  } as Report;
}

function mapUsage(row: any): ApiUsage {
  return {
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    credits_consumed: row.credits_consumed,
    stripe_metered_event_id: row.stripe_metered_event_id ?? undefined,
    created_at: row.created_at,
    metadata: parseJson(row.metadata, {}),
  } as ApiUsage;
}

function mapWidgetLead(row: any): WidgetLead {
  return {
    id: row.id,
    user_id: row.user_id,
    visitor_email: row.visitor_email,
    visitor_name: row.visitor_name ?? undefined,
    business_audited: row.business_audited,
    report_id: row.report_id ?? undefined,
    created_at: row.created_at,
    delivered_at: row.delivered_at ?? undefined,
  };
}

function firstRow<T>(stmt: Database.Statement, ...params: unknown[]): T | undefined {
  const row = stmt.get(...params);
  return row as T | undefined;
}

function buildUpdate(
  table: "users" | "reports",
  id: string,
  data: Record<string, unknown>,
  sqlite: Database.Database,
): void {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const assignments = entries.map(([key]) => `${key} = @${key}`).join(", ");
  sqlite.prepare(`UPDATE ${table} SET ${assignments} WHERE id = @id`).run({
    ...Object.fromEntries(entries),
    id,
  });
}

export function createLocalSqliteDb(dbPath?: string): LocalSqliteDb {
  const resolvedPath = normalizeDbPath(dbPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });

  const sqlite = new Database(resolvedPath);
  sqlite.pragma("journal_mode = WAL");
  initSchema(sqlite);
  seedLocalWorkspace(sqlite);

  const getUserByColumn = async (column: string, value: string): Promise<User | undefined> => {
    const row = firstRow<any>(sqlite.prepare(`SELECT * FROM users WHERE ${column} = ?`), value);
    return row ? mapUser(row) : undefined;
  };

  const getReportById = async (id: string): Promise<Report | undefined> => {
    reconcileStaleProcessingReports(sqlite);
    const row = firstRow<any>(sqlite.prepare("SELECT * FROM reports WHERE id = ?"), id);
    return row ? mapReport(row) : undefined;
  };

  const db: LocalSqliteDb = {
    async getLocalWorkspaceUser(): Promise<User> {
      const user = await getUserByColumn("id", LOCAL_USER_ID);
      if (!user) {
        seedLocalWorkspace(sqlite);
        const seeded = await getUserByColumn("id", LOCAL_USER_ID);
        if (!seeded) throw new Error("Failed to initialize local workspace user.");
        return seeded;
      }
      return user;
    },

    close(): void {
      sqlite.close();
    },

    getUser: (id) => getUserByColumn("id", id),
    getUserByAuthUserId: (authUserId) => getUserByColumn("auth_user_id", authUserId),
    getUserByEmail: (email) => getUserByColumn("email", email),
    getUserByWidgetApiKey: (apiKey) => getUserByColumn("widget_api_key", apiKey),
    getUserByStripeCustomerId: (customerId) => getUserByColumn("stripe_customer_id", customerId),

    async createUser(data): Promise<User> {
      const now = nowIso();
      const id = data.id ?? randomId();
      sqlite.prepare(`
        INSERT INTO users (
          id, auth_user_id, email, name, plan, stripe_customer_id,
          audit_credits_remaining, scout_credits_remaining, widget_api_key,
          white_label_config, created_at, updated_at
        ) VALUES (
          @id, @auth_user_id, @email, @name, @plan, @stripe_customer_id,
          @audit_credits_remaining, @scout_credits_remaining, @widget_api_key,
          @white_label_config, @created_at, @updated_at
        )
      `).run({
        id,
        auth_user_id: data.auth_user_id ?? null,
        email: data.email,
        name: data.name ?? null,
        plan: data.plan ?? "agency",
        stripe_customer_id: data.stripe_customer_id ?? null,
        audit_credits_remaining: LOCAL_CREDITS,
        scout_credits_remaining: LOCAL_CREDITS,
        widget_api_key: data.widget_api_key ?? null,
        white_label_config: "{}",
        created_at: now,
        updated_at: now,
      });

      const user = await db.getUser(id);
      if (!user) throw new Error(`Failed to create local user ${id}`);
      return user;
    },

    async updateUser(id, data): Promise<User | undefined> {
      const { id: _id, created_at: _createdAt, ...safeData } = data as Record<string, unknown>;
      const payload: Record<string, unknown> = {
        ...safeData,
        updated_at: nowIso(),
      };

      if ("white_label_config" in payload) {
        payload.white_label_config = stringifyJson(payload.white_label_config);
      }

      buildUpdate("users", id, payload, sqlite);
      return db.getUser(id);
    },

    getReport: getReportById,

    async getReportPublic(id): Promise<Report | undefined> {
      const report = await getReportById(id);
      if (!report || report.status !== "completed") return undefined;
      if (report.expires_at && new Date(report.expires_at) < new Date()) return undefined;
      return report;
    },

    async getReportsByUser(userId): Promise<Report[]> {
      reconcileStaleProcessingReports(sqlite);
      const rows = sqlite
        .prepare("SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC")
        .all(userId) as any[];
      return rows.map(mapReport);
    },

    async getExpiredReports(nowIsoValue): Promise<Report[]> {
      const rows = sqlite
        .prepare("SELECT * FROM reports WHERE expires_at IS NOT NULL AND expires_at < ? AND status != 'failed'")
        .all(nowIsoValue) as any[];
      return rows.map(mapReport);
    },

    async createReport(data: {
      user_id: string;
      type: ReportType;
      input: AuditInput | ScoutInput;
      is_widget_generated?: boolean;
    }): Promise<Report> {
      const now = nowIso();
      const id = randomId();
      sqlite.prepare(`
        INSERT INTO reports (
          id, user_id, type, status, input, result, scores, pdf_storage_path,
          email_sent_at, expires_at, is_widget_generated, created_at, updated_at
        ) VALUES (
          @id, @user_id, @type, 'queued', @input, NULL, NULL, NULL,
          NULL, NULL, @is_widget_generated, @created_at, @updated_at
        )
      `).run({
        id,
        user_id: data.user_id,
        type: data.type,
        input: stringifyJson(data.input),
        is_widget_generated: data.is_widget_generated ? 1 : 0,
        created_at: now,
        updated_at: now,
      });

      const report = await getReportById(id);
      if (!report) throw new Error(`Failed to create local report ${id}`);
      return report;
    },

    async updateReport(id, data): Promise<Report | undefined> {
      const { id: _id, created_at: _createdAt, ...safeData } = data as Record<string, unknown>;
      const payload: Record<string, unknown> = {
        ...safeData,
        updated_at: nowIso(),
      };

      if ("input" in payload) payload.input = stringifyJson(payload.input);
      if ("result" in payload) payload.result = stringifyJson(payload.result);
      if ("scores" in payload) payload.scores = stringifyJson(payload.scores);
      if ("is_widget_generated" in payload) {
        payload.is_widget_generated = payload.is_widget_generated ? 1 : 0;
      }

      buildUpdate("reports", id, payload, sqlite);
      return getReportById(id);
    },

    async trackUsage(data: {
      user_id: string;
      action: UsageAction;
      credits_consumed: number;
      stripe_metered_event_id?: string;
      metadata?: Record<string, unknown>;
    }): Promise<ApiUsage> {
      const id = randomId();
      sqlite.prepare(`
        INSERT INTO api_usage (
          id, user_id, action, credits_consumed, stripe_metered_event_id,
          created_at, metadata
        ) VALUES (
          @id, @user_id, @action, @credits_consumed, @stripe_metered_event_id,
          @created_at, @metadata
        )
      `).run({
        id,
        user_id: data.user_id,
        action: data.action,
        credits_consumed: data.credits_consumed,
        stripe_metered_event_id: data.stripe_metered_event_id ?? null,
        created_at: nowIso(),
        metadata: stringifyJson(data.metadata ?? {}),
      });

      const row = firstRow<any>(sqlite.prepare("SELECT * FROM api_usage WHERE id = ?"), id);
      if (!row) throw new Error(`Failed to track local usage ${id}`);
      return mapUsage(row);
    },

    async getUserUsage(userId): Promise<ApiUsage[]> {
      const rows = sqlite
        .prepare("SELECT * FROM api_usage WHERE user_id = ? ORDER BY created_at DESC")
        .all(userId) as any[];
      return rows.map(mapUsage);
    },

    async getMonthlyUsageCount(userId, action): Promise<number> {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const row = firstRow<{ count: number }>(
        sqlite.prepare("SELECT COUNT(*) as count FROM api_usage WHERE user_id = ? AND action = ? AND created_at >= ?"),
        userId,
        action,
        startOfMonth,
      );
      return row?.count ?? 0;
    },

    async createWidgetLead(data: Omit<WidgetLead, "id" | "created_at">): Promise<WidgetLead> {
      const id = randomId();
      sqlite.prepare(`
        INSERT INTO widget_leads (
          id, user_id, visitor_email, visitor_name, business_audited,
          report_id, created_at, delivered_at
        ) VALUES (
          @id, @user_id, @visitor_email, @visitor_name, @business_audited,
          @report_id, @created_at, @delivered_at
        )
      `).run({
        id,
        user_id: data.user_id,
        visitor_email: data.visitor_email,
        visitor_name: data.visitor_name ?? null,
        business_audited: data.business_audited,
        report_id: data.report_id ?? null,
        created_at: nowIso(),
        delivered_at: data.delivered_at ?? null,
      });

      const row = firstRow<any>(sqlite.prepare("SELECT * FROM widget_leads WHERE id = ?"), id);
      if (!row) throw new Error(`Failed to create local widget lead ${id}`);
      return mapWidgetLead(row);
    },

    async getWidgetLeads(userId): Promise<WidgetLead[]> {
      const rows = sqlite
        .prepare("SELECT * FROM widget_leads WHERE user_id = ? ORDER BY created_at DESC")
        .all(userId) as any[];
      return rows.map(mapWidgetLead);
    },
  };

  return db;
}
