const INTERNAL_REPORT_LANGUAGE_PATTERNS = [
  /\b(this|the)\s+(model|module|report|pipeline|prompt|schema|formula|calculator)\b/i,
  /\bmodel(ed|ing)?\b/i,
  /\bmodule\b/i,
  /\breported\s+total\b/i,
  /\bcannot\s+be\s+independently\s+validated\b/i,
  /\bdata\s+quality\b/i,
  /\bmock\b/i,
  /\bplaceholder\b/i,
  /\bfabricated\b/i,
  /\bnot\s+implemented\b/i,
  /\bprovided\s+data\b/i,
  /\bscore_override\b/i,
  /\brebuild\s+.*model\b/i,
];

export function isClientFacingReportItem(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  return !INTERNAL_REPORT_LANGUAGE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function filterClientFacingReportItems(values: string[] | undefined | null): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => isClientFacingReportItem(String(value)));
}
