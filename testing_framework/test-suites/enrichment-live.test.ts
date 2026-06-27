import { loadEnvConfig } from "@next/env";
import { describe, expect, it } from "vitest";

import {
  collectCensus,
  collectCrux,
  collectOpenCorporates,
  collectWayback,
} from "@/lib/agents/tools/business-enrichment";

loadEnvConfig(process.cwd());

const liveDescribe = process.env.RUN_LIVE_ENRICHMENT === "1" ? describe : describe.skip;

function summarize(result: { facts: { id: string; label: string; value: string; source: { label: string } }[]; warnings: string[] }) {
  return {
    facts: result.facts.map((fact) => ({
      id: fact.id,
      label: fact.label,
      value: fact.value,
      source: fact.source.label,
    })),
    warnings: result.warnings,
  };
}

liveDescribe("live business enrichment collectors", () => {
  const now = new Date().toISOString();

  it("runs each deterministic collector against Bellevue Dental Arts", async () => {
    const params = {
      businessName: "Bellevue Dental Arts",
      state: "WA",
      address: "13333 NE Bel Red Rd #200, Bellevue, WA 98005, USA",
      website: "http://www.bellevuedentalarts.com/",
    };

    const results = {
      openCorporates: summarize(await collectOpenCorporates(params, now)),
      census: summarize(await collectCensus(params.address, now)),
      wayback: summarize(await collectWayback(params.website, now)),
      crux: summarize(await collectCrux(params.website, now)),
    };

    console.log("LIVE_ENRICHMENT_BELLEVUE_DENTAL_ARTS", JSON.stringify(results, null, 2));
    expect(results.wayback.facts.length + results.wayback.warnings.length).toBeGreaterThan(0);
  }, 45000);

  it("runs keyless-friendly collectors against a high-traffic public website", async () => {
    const results = {
      wayback: summarize(await collectWayback("https://www.starbucks.com/", now)),
      crux: summarize(await collectCrux("https://www.starbucks.com/", now)),
    };

    console.log("LIVE_ENRICHMENT_STARBUCKS", JSON.stringify(results, null, 2));
    expect(results.wayback.facts.length + results.wayback.warnings.length).toBeGreaterThan(0);
  }, 45000);
});
