import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("data sources settings API", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phantom-data-sources-api-"));
    vi.stubEnv("PHANTOM_REACH_HOME", tempDir);
    vi.stubEnv("DATABASE_URL", `file:${path.join(tempDir, "phantom.db")}`);
  });

  afterEach(async () => {
    const mod = await import("@/lib/config/local-secrets").catch(() => null);
    mod?.closeLocalSecretsDatabase();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("saves a key and lists only masked metadata", async () => {
    const { GET } = await import("@/app/api/settings/data-sources/route");
    const { PUT } = await import("@/app/api/settings/data-sources/[key]/route");

    const saveResponse = await PUT(
      new NextRequest("http://localhost/api/settings/data-sources/google_places_api_key", {
        method: "PUT",
        body: JSON.stringify({ value: "saved-google-key" }),
      }),
      { params: Promise.resolve({ key: "google_places_api_key" }) }
    );
    expect(saveResponse.status).toBe(200);

    const listResponse = await GET();
    const body = await listResponse.json();

    expect(JSON.stringify(body)).not.toContain("saved-google-key");
    expect(body.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "google_places_api_key",
          configured: true,
          maskedValue: "save...key",
        }),
      ])
    );
  });

  it("deletes a saved key", async () => {
    const { PUT, DELETE } = await import("@/app/api/settings/data-sources/[key]/route");
    const { getProviderSecret } = await import("@/lib/config/provider-config");

    await PUT(
      new NextRequest("http://localhost/api/settings/data-sources/yelp_api_key", {
        method: "PUT",
        body: JSON.stringify({ value: "yelp-key" }),
      }),
      { params: Promise.resolve({ key: "yelp_api_key" }) }
    );

    await DELETE(
      new NextRequest("http://localhost/api/settings/data-sources/yelp_api_key", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ key: "yelp_api_key" }) }
    );

    expect(await getProviderSecret("yelp_api_key")).toBeUndefined();
  });

  it("tests Google Places with a submitted key and stores connected status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ status: "OK", results: [{ name: "Example Dental" }] }),
      })) as any
    );

    const { POST } = await import("@/app/api/settings/data-sources/[key]/test/route");
    const response = await POST(
      new NextRequest("http://localhost/api/settings/data-sources/google_places_api_key/test", {
        method: "POST",
        body: JSON.stringify({ value: "google-key-to-test" }),
      }),
      { params: Promise.resolve({ key: "google_places_api_key" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("connected");
    expect(body.message).toContain("responded");
    expect(JSON.stringify(body)).not.toContain("google-key-to-test");
  });
});
