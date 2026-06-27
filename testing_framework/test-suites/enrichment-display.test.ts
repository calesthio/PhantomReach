import { describe, expect, it } from "vitest";

import { visibleCollectionNotes } from "@/lib/reports/enrichment-display";

describe("enrichment display notes", () => {
  it("translates raw collector failures into marketer-readable notes", () => {
    const notes = visibleCollectionNotes([
      "OpenCorporates returned HTTP 401.",
      "US Census ACS 5-Year enrichment failed: Unexpected token '<', \" <html> \"... is not valid JSON",
      "Wayback Machine enrichment failed: The operation was aborted due to timeout",
      "CrUX returned HTTP 403.",
    ]);

    expect(notes).toEqual([
      "Business filing lookup was not available for this run.",
      "ZIP-level Census context was not available for this run.",
      "Website archive history was not available before the source timed out.",
      "Chrome field-performance data was not available for this run.",
    ]);
    expect(notes.join(" ")).not.toMatch(/HTTP|JSON|token|<html>|aborted|403|401/i);
  });

  it("deduplicates notes with the same user-facing meaning", () => {
    const notes = visibleCollectionNotes([
      "CrUX returned HTTP 403.",
      "CrUX returned HTTP 404.",
      "No CrUX field data available for this website.",
    ]);

    expect(notes).toEqual(["Chrome field-performance data was not available for this run."]);
  });
});
