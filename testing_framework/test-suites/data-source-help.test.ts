import { describe, expect, it } from "vitest";

import { listDataSources } from "@/lib/config/provider-config";

describe("data source setup help", () => {
  it("includes setup links for enrichment sources that require external keys", async () => {
    const sources = await listDataSources();
    const census = sources.find((source) => source.key === "census_api_key");
    const openCorporates = sources.find((source) => source.key === "opencorporates_api_token");

    expect(census?.setup).toMatchObject({
      docsUrl: "https://api.census.gov/data/key_signup.html",
      envVar: "CENSUS_API_KEY",
    });
    expect(census?.setup?.steps.join(" ")).toContain("Request a key");

    expect(openCorporates?.setup).toMatchObject({
      docsUrl: "https://api.opencorporates.com/documentation/API-Reference",
      envVar: "OPENCORPORATES_API_TOKEN",
    });
    expect(openCorporates?.setup?.steps.join(" ")).toContain("API Account");
  });
});
