import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("local secret encryption", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phantom-secrets-"));
    vi.stubEnv("PHANTOM_REACH_HOME", tempDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("generates and reuses a 32-byte local instance key", async () => {
    const { loadInstanceKey } = await import("@/lib/config/instance-key");

    const first = loadInstanceKey();
    const second = loadInstanceKey();
    const keyPath = path.join(tempDir, ".phantom-reach", "instance.key");

    expect(first).toHaveLength(32);
    expect(second.equals(first)).toBe(true);
    expect(fs.existsSync(keyPath)).toBe(true);
    expect(fs.readFileSync(keyPath, "utf8").trim()).toHaveLength(64);
  });

  it("encrypts and decrypts without storing plaintext in the encrypted payload", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/config/crypto");
    const key = Buffer.alloc(32, 7);
    const plaintext = "sk-test-secret-value";

    const encrypted = encryptSecret(plaintext, key);

    expect(encrypted.encryptedValue).not.toContain(plaintext);
    expect(encrypted.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(encrypted.authTag).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decryptSecret(encrypted, key)).toBe(plaintext);
  });

  it("throws when decrypting with the wrong key", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/config/crypto");
    const encrypted = encryptSecret("secret", Buffer.alloc(32, 1));

    expect(() => decryptSecret(encrypted, Buffer.alloc(32, 2))).toThrow();
  });
});

describe("local SQLite secret store", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phantom-secrets-db-"));
    vi.stubEnv("PHANTOM_REACH_HOME", tempDir);
    vi.stubEnv("DATABASE_URL", `file:${path.join(tempDir, "phantom.db")}`);
  });

  afterEach(async () => {
    const mod = await import("@/lib/config/local-secrets").catch(() => null);
    mod?.closeLocalSecretsDatabase();
    vi.unstubAllEnvs();
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores encrypted values and returns decrypted secrets", async () => {
    const { setSecret, getSecret, listSecretMetadata } = await import("@/lib/config/local-secrets");

    await setSecret("google_places_api_key", "Google Places", "google", "places-secret-value");

    expect(await getSecret("google_places_api_key")).toBe("places-secret-value");
    const metadata = await listSecretMetadata();
    expect(metadata).toEqual([
      expect.objectContaining({
        key: "google_places_api_key",
        provider: "google",
        label: "Google Places",
        configured: true,
        maskedValue: "plac...lue",
      }),
    ]);
  });

  it("does not store plaintext in SQLite", async () => {
    const { setSecret } = await import("@/lib/config/local-secrets");
    await setSecret("google_pagespeed_api_key", "Google PageSpeed", "google", "pagespeed-secret-value");

    const dbBytes = fs.readFileSync(path.join(tempDir, "phantom.db"), "utf8");
    expect(dbBytes).not.toContain("pagespeed-secret-value");
  });

  it("updates secrets immediately", async () => {
    const { setSecret, getSecret } = await import("@/lib/config/local-secrets");

    await setSecret("google_places_api_key", "Google Places", "google", "old-key");
    expect(await getSecret("google_places_api_key")).toBe("old-key");

    await setSecret("google_places_api_key", "Google Places", "google", "new-key");
    expect(await getSecret("google_places_api_key")).toBe("new-key");
  });

  it("deletes secrets", async () => {
    const { setSecret, getSecret, deleteSecret } = await import("@/lib/config/local-secrets");

    await setSecret("yelp_api_key", "Yelp", "yelp", "yelp-secret");
    await deleteSecret("yelp_api_key");

    expect(await getSecret("yelp_api_key")).toBeUndefined();
  });
});

describe("provider config lookup", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phantom-provider-config-"));
    vi.stubEnv("PHANTOM_REACH_HOME", tempDir);
    vi.stubEnv("DATABASE_URL", `file:${path.join(tempDir, "phantom.db")}`);
  });

  afterEach(async () => {
    const mod = await import("@/lib/config/local-secrets").catch(() => null);
    mod?.closeLocalSecretsDatabase();
    vi.unstubAllEnvs();
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("uses env fallback when SQLite secret is absent", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "env-google-key");
    const { getProviderSecret } = await import("@/lib/config/provider-config");

    expect(await getProviderSecret("google_places_api_key")).toBe("env-google-key");
  });

  it("uses SQLite secret before env fallback", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "env-google-key");
    const { setSecret } = await import("@/lib/config/local-secrets");
    const { getProviderSecret } = await import("@/lib/config/provider-config");

    await setSecret("google_places_api_key", "Google Places", "google", "sqlite-google-key");

    expect(await getProviderSecret("google_places_api_key")).toBe("sqlite-google-key");
  });

  it("lists all configured and missing data sources with masked values only", async () => {
    const { setSecret } = await import("@/lib/config/local-secrets");
    const { listDataSources } = await import("@/lib/config/provider-config");

    await setSecret("google_places_api_key", "Google Places", "google", "sqlite-google-key");
    const sources = await listDataSources();

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "google_places_api_key",
          configured: true,
          maskedValue: "sqli...key",
        }),
        expect.objectContaining({
          key: "google_pagespeed_api_key",
          configured: false,
          status: "optional",
        }),
      ])
    );
    expect(JSON.stringify(sources)).not.toContain("sqlite-google-key");
  });
});

describe("collectors read updated local secrets without restart", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phantom-runtime-secrets-"));
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

  it("Google Maps lookup uses the latest SQLite Google Places key", async () => {
    const seenUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seenUrls.push(url);
        if (url.includes("/textsearch/")) {
          return {
            ok: true,
            json: async () => ({
              status: "OK",
              results: [{ place_id: "place-1", name: "Example Dental" }],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            status: "OK",
            result: {
              place_id: "place-1",
              name: "Example Dental",
              formatted_address: "100 Main St, Seattle, WA",
              types: ["dentist", "establishment"],
              geometry: { location: { lat: 47.6, lng: -122.3 } },
              rating: 4.7,
              user_ratings_total: 120,
              photos: [{}],
            },
          }),
        };
      }) as any
    );

    const { setSecret } = await import("@/lib/config/local-secrets");
    const { lookupGoogleMaps } = await import("@/lib/agents/tools/google-maps");

    await setSecret("google_places_api_key", "Google Places", "google", "first-key");
    await lookupGoogleMaps({ businessName: "Example Dental", city: "Seattle" });

    await setSecret("google_places_api_key", "Google Places", "google", "second-key");
    await lookupGoogleMaps({ businessName: "Example Dental", city: "Seattle" });

    expect(seenUrls.some((url) => url.includes("key=first-key"))).toBe(true);
    expect(seenUrls.some((url) => url.includes("key=second-key"))).toBe(true);
  });
});
