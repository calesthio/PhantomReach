import { describe, expect, it } from "vitest";

import { parseAgentResearchOutput } from "@/lib/agents/tools/business-enrichment";

describe("business enrichment", () => {
  it("keeps only cited research findings supported by their excerpt", () => {
    const parsed = parseAgentResearchOutput(
      JSON.stringify({
        search_strategy: {
          business_type_assumption: "Dental practice",
          queries_run: ["Bellevue Dental Arts emergency dentistry"],
          relevance_rules_used: ["Prefer official business pages"],
        },
        findings: [
          {
            claim: "The practice promotes emergency dental care.",
            source_label: "Bellevue Dental Arts services page",
            source_url: "https://www.bellevuedentalarts.com/services/emergency-dentistry",
            confidence: "high",
            relevance: "high",
            evidence_excerpt: "Emergency dental care is available for urgent tooth pain and broken teeth.",
            why_it_matters: "Emergency demand is high-intent and needs a fast path to call.",
            verified_status: "verified",
          },
          {
            claim: "The practice offers same-day implants.",
            source_label: "Unknown",
            confidence: "high",
            relevance: "high",
            evidence_excerpt: "Implants are available.",
            why_it_matters: "Implants can be a premium service line.",
            verified_status: "verified",
          },
          {
            claim: "The practice has Saturday appointments.",
            source_label: "Homepage",
            source_url: "https://www.bellevuedentalarts.com/",
            confidence: "medium",
            relevance: "medium",
            evidence_excerpt: "Welcome to Bellevue Dental Arts.",
            why_it_matters: "Weekend access can improve conversion.",
            verified_status: "verified",
          },
        ],
        rejected_results: [{ source_label: "Directory clone", reason: "No unique evidence" }],
      }),
      "2026-06-26T00:00:00.000Z"
    );

    expect(parsed.searchStrategy.queriesRun).toEqual(["Bellevue Dental Arts emergency dentistry"]);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0]).toMatchObject({
      claim: "The practice promotes emergency dental care.",
      confidence: "high",
      relevance: "high",
      verified_status: "verified",
      source: {
        label: "Bellevue Dental Arts services page",
        url: "https://www.bellevuedentalarts.com/services/emergency-dentistry",
        source_type: "public_web",
      },
    });
    expect(parsed.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing source URL"),
        expect.stringContaining("excerpt did not support"),
      ])
    );
  });
});
