export * from "./types";

import { createLocalSqliteDb } from "./local-sqlite";
import type {
  User,
  Report,
  Plan,
  ReportType,
  AuditInput,
  ScoutInput,
  WidgetLead,
  ApiUsage,
  UsageAction,
} from "./types";

// ---------------------------------------------------------------------------
// Unified DB interface
// ---------------------------------------------------------------------------
// Active local app calls go through SQLite. The interface stays stable so app
// routes and report pages do not need to know which storage backend is used.
// ---------------------------------------------------------------------------

export interface DbInterface {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByAuthUserId(authUserId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByWidgetApiKey(apiKey: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  createUser(data: {
    id?: string;
    auth_user_id?: string;
    email: string;
    name?: string;
    plan?: Plan;
    stripe_customer_id?: string;
    widget_api_key?: string;
  }): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Reports
  getReport(id: string): Promise<Report | undefined>;
  getReportPublic(id: string): Promise<Report | undefined>;
  getReportsByUser(userId: string): Promise<Report[]>;
  getExpiredReports(nowIso: string): Promise<Report[]>;
  createReport(data: {
    user_id: string;
    type: ReportType;
    input: AuditInput | ScoutInput;
    is_widget_generated?: boolean;
  }): Promise<Report>;
  updateReport(id: string, data: Partial<Report>): Promise<Report | undefined>;

  // Usage
  trackUsage(data: {
    user_id: string;
    action: UsageAction;
    credits_consumed: number;
    stripe_metered_event_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApiUsage>;
  getUserUsage(userId: string): Promise<ApiUsage[]>;
  getMonthlyUsageCount(userId: string, action: UsageAction): Promise<number>;

  // Widget leads
  createWidgetLead(data: Omit<WidgetLead, "id" | "created_at">): Promise<WidgetLead>;
  getWidgetLeads(userId: string): Promise<WidgetLead[]>;
}

// ---------------------------------------------------------------------------
// Exported `db` -- the single entry point consumers should use.
// ---------------------------------------------------------------------------

let _db: DbInterface | null = null;

/**
 * Returns the unified database interface backed by local SQLite.
 */
export function getDb(): DbInterface {
  if (_db) return _db;
  _db = createLocalSqliteDb();
  return _db;
}

/**
 * Convenience default -- `db` can be imported directly for the common case.
 * This lazy getter creates the SQLite file only when app code first needs
 * storage.
 */
export const db: DbInterface = new Proxy({} as DbInterface, {
  get(_target, prop: string) {
    const instance = getDb();
    const value = (instance as unknown as Record<string, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
