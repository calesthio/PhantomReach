import { describe, expect, it } from "vitest";

import { extractAgenticCompetitorsSafe } from "@/lib/agents/orchestrator";
import { repairMojibakeText, repairMojibakeValue } from "@/lib/text/repair";

describe("extractAgenticCompetitorsSafe", () => {
  it("extracts real competitors from markdown tables and skips prose scaffolding", () => {
    const summary = `
Here’s a structured, real competitor snapshot for the Seattle market.

| Business | Notes | Rating | Review Count | Location |
| --- | --- | --- | --- | --- |
| Seattle Sun Dental | Strong local visibility | 4.7 stars | 312 reviews | Seattle |
| Rainier Family Dentistry | Great reviews | 4.5/5 | 188 reviews | Seattle |
| I used the requested Seattle tourism/observation sources | Not a business | n/a | n/a | n/a |
`;

    const competitors = extractAgenticCompetitorsSafe(summary, {
      business_name: "Space Needle",
    } as any);

    expect(competitors).toHaveLength(2);
    expect(competitors.map((competitor) => competitor.name)).toEqual([
      "Seattle Sun Dental",
      "Rainier Family Dentistry",
    ]);
    expect(competitors[0]).toMatchObject({ rating: 4.7, review_count: 312 });
    expect(competitors[1]).toMatchObject({ rating: 4.5, review_count: 188 });
  });
});

describe("repairMojibake", () => {
  it("repairs common corrupted report strings recursively", () => {
    const repaired = repairMojibakeValue({
      title: "Dentists â€” Seattle",
      stats: ["4.8â˜…", "Line one â€¢ Line two", "Audited Â· Today"],
    });

    expect(repaired).toEqual({
      title: "Dentists - Seattle",
      stats: ["4.8*", "Line one - Line two", "Audited - Today"],
    });
  });

  it("repairs single strings without mangling normal text", () => {
    expect(repairMojibakeText("No website detected â€” losing traffic")).toBe(
      "No website detected - losing traffic",
    );
    expect(repairMojibakeText("Plain ASCII text")).toBe("Plain ASCII text");
  });
});
