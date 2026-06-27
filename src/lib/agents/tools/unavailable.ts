export type EvidenceStatus =
  | "missing_api_key"
  | "not_found"
  | "blocked"
  | "failed"
  | "not_applicable";

export interface UnavailableResult {
  unavailable: true;
  status: EvidenceStatus;
  source: string;
  reason: string;
}

export function unavailable(
  source: string,
  status: EvidenceStatus,
  reason: string,
): UnavailableResult {
  return {
    unavailable: true,
    status,
    source,
    reason,
  };
}

export function isUnavailable(value: unknown): value is UnavailableResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "unavailable" in value &&
      (value as { unavailable?: unknown }).unavailable === true,
  );
}
