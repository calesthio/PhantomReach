/**
 * Test Helpers
 *
 * Common utilities for Phantom Reach testing: assertions, async helpers,
 * error matchers, and environment setup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Environment Helpers
// ---------------------------------------------------------------------------

/**
 * Temporarily set environment variables for a test, restore after.
 * Usage:
 *   const restore = setTestEnv({ ANTHROPIC_API_KEY: "test-key" });
 *   // ... run test ...
 *   restore();
 */
export function setTestEnv(
  vars: Record<string, string | undefined>
): () => void {
  const originals: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    originals[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

/**
 * Clear all API keys so tests exercise mock/fallback paths.
 */
export function clearAllApiKeys(): () => void {
  return setTestEnv({
    ANTHROPIC_API_KEY: undefined,
    ANTHROPIC_OAUTH_TOKEN: undefined,
    OPENAI_API_KEY: undefined,
    OPENAI_OAUTH_TOKEN: undefined,
    GOOGLE_API_KEY: undefined,
    GOOGLE_VERTEX_PROJECT: undefined,
    GOOGLE_PLACES_API_KEY: undefined,
    GOOGLE_PAGESPEED_API_KEY: undefined,
    RESEND_API_KEY: undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
    INNGEST_SIGNING_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
  });
}

// ---------------------------------------------------------------------------
// Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a value is within a numeric range (inclusive).
 */
export function expectInRange(
  value: number,
  min: number,
  max: number,
  label?: string
): void {
  const msg = label ? `${label}: ${value}` : `${value}`;
  expect(value, `${msg} should be >= ${min}`).toBeGreaterThanOrEqual(min);
  expect(value, `${msg} should be <= ${max}`).toBeLessThanOrEqual(max);
}

/**
 * Assert that an object has all required keys (non-undefined).
 */
export function expectRequiredKeys(
  obj: Record<string, unknown>,
  keys: string[]
): void {
  for (const key of keys) {
    expect(obj, `Missing key: ${key}`).toHaveProperty(key);
    expect(obj[key], `Key ${key} is undefined`).not.toBeUndefined();
  }
}

/**
 * Assert that a grade string is valid (A-F or N/A).
 */
export function expectValidGrade(grade: string): void {
  expect(["A", "B", "C", "D", "F", "N/A"]).toContain(grade);
}

/**
 * Assert a score is in 0-100 range.
 */
export function expectValidScore(score: number): void {
  expectInRange(score, 0, 100, "score");
}

// ---------------------------------------------------------------------------
// Async Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that an async function does NOT throw.
 */
export async function expectNoThrow(fn: () => Promise<unknown>): Promise<void> {
  let error: unknown;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  expect(error, `Expected no throw, got: ${error}`).toBeUndefined();
}

/**
 * Assert that an async function throws with a message containing `substr`.
 */
export async function expectThrowContaining(
  fn: () => Promise<unknown>,
  substr: string
): Promise<void> {
  let error: unknown;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  expect(error).toBeDefined();
  expect(String(error)).toContain(substr);
}

/**
 * Run a function with a timeout. Rejects if it takes longer than `ms`.
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Mock Console (capture logs)
// ---------------------------------------------------------------------------

export interface CapturedLogs {
  logs: string[];
  warns: string[];
  errors: string[];
}

/**
 * Capture console output during a function call.
 */
export function captureConsole(): {
  captured: CapturedLogs;
  restore: () => void;
} {
  const captured: CapturedLogs = { logs: [], warns: [], errors: [] };
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    captured.logs.push(args.map(String).join(" "));
  };
  console.warn = (...args: unknown[]) => {
    captured.warns.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    captured.errors.push(args.map(String).join(" "));
  };

  return {
    captured,
    restore: () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    },
  };
}

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/**
 * Check if an object looks like a valid AuditResult (has executive_summary + recommendations).
 */
export function isAuditResultShaped(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const record = obj as Record<string, unknown>;
  return (
    "executive_summary" in record &&
    "recommendations" in record &&
    Array.isArray(record.recommendations)
  );
}

/**
 * Check if an object looks like a valid ScoutResult.
 */
export function isScoutResultShaped(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const record = obj as Record<string, unknown>;
  return (
    "city" in record &&
    "category" in record &&
    "businesses" in record &&
    Array.isArray(record.businesses)
  );
}
