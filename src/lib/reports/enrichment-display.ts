const TECHNICAL_FAILURE_PATTERN = /http\s*\d+|unexpected token|not valid json|<html|forbidden|unauthorized|aborted|timeout|timed out|api key/i;

export function formatCollectionNote(note: string): string | null {
  const normalized = note.trim();
  if (!normalized) return null;

  if (/opencorporates/i.test(normalized)) {
    if (/low-confidence/i.test(normalized)) {
      return "Business filing lookup returned a low-confidence match.";
    }
    return "Business filing lookup was not available for this run.";
  }

  if (/census|acs/i.test(normalized)) {
    return "ZIP-level Census context was not available for this run.";
  }

  if (/wayback|archive/i.test(normalized)) {
    if (/timeout|timed out|aborted/i.test(normalized)) {
      return "Website archive history was not available before the source timed out.";
    }
    return "Website archive history was not available for this run.";
  }

  if (/crux|chrome/i.test(normalized)) {
    return "Chrome field-performance data was not available for this run.";
  }

  if (/google dns|mx/i.test(normalized)) {
    return "Business email-provider lookup was not available for this run.";
  }

  if (/dropped .*finding|agent research returned invalid json|missing source|missing excerpt/i.test(normalized)) {
    return null;
  }

  if (TECHNICAL_FAILURE_PATTERN.test(normalized)) {
    return "One enrichment source was not available for this run.";
  }

  return normalized;
}

export function visibleCollectionNotes(notes: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const visible: string[] = [];

  for (const note of notes ?? []) {
    const formatted = formatCollectionNote(note);
    if (!formatted || seen.has(formatted)) continue;

    seen.add(formatted);
    visible.push(formatted);
  }

  return visible.slice(0, 4);
}
