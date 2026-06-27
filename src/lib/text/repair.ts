const MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ["â€”", "-"],
  ["â€“", "-"],
  ["â€¢", "-"],
  ["â†’", "->"],
  ["âœ“", "Verified"],
  ["â˜…", "*"],
  ["â€œ", "\""],
  ["â€", "\""],
  ["â€˜", "'"],
  ["â€™", "'"],
  ["Â·", " - "],
  ["Â", ""],
];

export function repairMojibakeText(value: string): string {
  let repaired = value;

  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    repaired = repaired.split(from).join(to);
  }

  return repaired.replace(/\s{2,}/g, " ").trim();
}

export function repairMojibakeValue<T>(value: T): T {
  if (typeof value === "string") {
    return repairMojibakeText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => repairMojibakeValue(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, repairMojibakeValue(entry)]),
    ) as T;
  }

  return value;
}
