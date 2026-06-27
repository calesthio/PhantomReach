import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { decryptSecret, encryptSecret } from "./crypto";
import { loadInstanceKey } from "./instance-key";

export type LocalSecretKey =
  | "google_places_api_key"
  | "google_pagespeed_api_key"
  | "google_crux_api_key"
  | "census_api_key"
  | "opencorporates_api_token"
  | "llm_provider"
  | "openai_api_key"
  | "anthropic_api_key"
  | "google_ai_api_key"
  | "yelp_api_key";

export type SecretStatus =
  | "connected"
  | "missing"
  | "invalid"
  | "needs_attention"
  | "optional";

export interface SecretMetadata {
  key: LocalSecretKey;
  provider: string;
  label: string;
  configured: boolean;
  maskedValue?: string;
  status: SecretStatus;
  lastTestedAt?: string;
  lastTestStatus?: string;
  lastTestMessage?: string;
}

interface SecretRow {
  key: LocalSecretKey;
  provider: string;
  label: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
}

let db: Database.Database | undefined;

function resolveDbPath(): string {
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    return process.env.DATABASE_URL.slice("file:".length);
  }

  return join(process.cwd(), "data", "phantom-reach.local.sqlite");
}

function getSecretsDatabase(): Database.Database {
  if (db) return db;

  const dbPath = resolveDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  return db;
}

export function closeLocalSecretsDatabase(): void {
  db?.close();
  db = undefined;
}

function ensureTable(): void {
  getSecretsDatabase().exec(`
    CREATE TABLE IF NOT EXISTS local_secrets (
      key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      label TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_tested_at TEXT,
      last_test_status TEXT,
      last_test_message TEXT
    )
  `);
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "....";
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

function rowToMetadata(row: SecretRow): SecretMetadata {
  try {
    const value = decryptSecret(
      { encryptedValue: row.encrypted_value, iv: row.iv, authTag: row.auth_tag },
      loadInstanceKey()
    );

    return {
      key: row.key,
      provider: row.provider,
      label: row.label,
      configured: true,
      maskedValue: maskSecret(value),
      status: (row.last_test_status as SecretStatus | null) || "connected",
      lastTestedAt: row.last_tested_at || undefined,
      lastTestStatus: row.last_test_status || undefined,
      lastTestMessage: row.last_test_message || undefined,
    };
  } catch {
    return {
      key: row.key,
      provider: row.provider,
      label: row.label,
      configured: true,
      status: "needs_attention",
      lastTestedAt: row.last_tested_at || undefined,
      lastTestStatus: "needs_attention",
      lastTestMessage: "This saved key could not be read. Delete and re-enter it.",
    };
  }
}

export async function setSecret(
  key: LocalSecretKey,
  label: string,
  provider: string,
  value: string
): Promise<void> {
  ensureTable();
  const now = new Date().toISOString();
  const encrypted = encryptSecret(value, loadInstanceKey());

  getSecretsDatabase()
    .prepare(`
      INSERT INTO local_secrets (
        key, provider, label, encrypted_value, iv, auth_tag, created_at, updated_at
      ) VALUES (
        @key, @provider, @label, @encryptedValue, @iv, @authTag, @now, @now
      )
      ON CONFLICT(key) DO UPDATE SET
        provider = excluded.provider,
        label = excluded.label,
        encrypted_value = excluded.encrypted_value,
        iv = excluded.iv,
        auth_tag = excluded.auth_tag,
        updated_at = excluded.updated_at,
        last_tested_at = NULL,
        last_test_status = NULL,
        last_test_message = NULL
    `)
    .run({ key, provider, label, ...encrypted, now });
}

export async function getSecret(key: LocalSecretKey): Promise<string | undefined> {
  ensureTable();
  const row = getSecretsDatabase()
    .prepare("SELECT * FROM local_secrets WHERE key = ?")
    .get(key) as SecretRow | undefined;

  if (!row) return undefined;

  return decryptSecret(
    { encryptedValue: row.encrypted_value, iv: row.iv, authTag: row.auth_tag },
    loadInstanceKey()
  );
}

export async function deleteSecret(key: LocalSecretKey): Promise<void> {
  ensureTable();
  getSecretsDatabase().prepare("DELETE FROM local_secrets WHERE key = ?").run(key);
}

export async function listSecretMetadata(): Promise<SecretMetadata[]> {
  ensureTable();
  const rows = getSecretsDatabase()
    .prepare("SELECT * FROM local_secrets ORDER BY provider, label")
    .all() as SecretRow[];

  return rows.map(rowToMetadata);
}

export async function updateSecretTestStatus(
  key: LocalSecretKey,
  status: SecretStatus,
  message: string
): Promise<void> {
  ensureTable();
  const now = new Date().toISOString();
  getSecretsDatabase()
    .prepare(`
      UPDATE local_secrets
      SET last_tested_at = ?, last_test_status = ?, last_test_message = ?, updated_at = ?
      WHERE key = ?
    `)
    .run(now, status, message, now, key);
}
