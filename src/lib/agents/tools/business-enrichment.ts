import { completeWithTools, isAIConfigured } from "@/lib/ai/claude";
import type { Phase0Understanding } from "@/lib/agents/prompts/phase0-understand";
import { AGENTIC_TOOL_DEFINITIONS, executeAgenticTool } from "@/lib/agents/tools/agentic-tools";
import { getProviderSecret } from "@/lib/config/provider-config";
import type {
  AgentResearchFinding,
  BusinessEnrichmentFact,
  BusinessEnrichmentResult,
  EnrichmentConfidence,
  EnrichmentRelevance,
  GBPHealthResult,
} from "@/lib/db/types";

interface BusinessEnrichmentParams {
  businessName: string;
  city?: string;
  state?: string;
  address?: string;
  website?: string;
  phone?: string;
  category?: string;
  gbpHealth?: GBPHealthResult;
  phase0?: Phase0Understanding | null;
  agenticResearchSummary?: string;
}

type FetchLike = typeof fetch;
type GetSecretLike = typeof getProviderSecret;

interface CollectorOptions {
  fetchFn?: FetchLike;
  getSecretFn?: GetSecretLike;
}

interface ParsedAgentResearch {
  searchStrategy: {
    businessTypeAssumption?: string;
    queriesRun: string[];
    relevanceRulesUsed: string[];
  };
  findings: AgentResearchFinding[];
  warnings: string[];
  rejectedResults: { source_label: string; reason: string }[];
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "they", "their", "practice",
  "business", "offers", "promotes", "available", "service", "services", "care",
]);

function collectedAt(now: string): string {
  return now;
}

function normalizeConfidence(value: unknown): EnrichmentConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function normalizeRelevance(value: unknown): EnrichmentRelevance {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeVerifiedStatus(value: unknown): "verified" | "inferred" {
  return value === "verified" ? "verified" : "inferred";
}

function parseJsonObject(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        return null;
      }
    }
    const object = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!object) return null;
    try {
      return JSON.parse(object);
    } catch {
      return null;
    }
  }
}

function importantTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 5 && !STOP_WORDS.has(token));
}

function excerptSupportsClaim(claim: string, excerpt: string): boolean {
  const excerptLower = excerpt.toLowerCase();
  const tokens = importantTokens(claim);
  if (tokens.length === 0) return false;
  const matches = tokens.filter((token) => excerptLower.includes(token));
  return matches.length >= Math.min(2, tokens.length);
}

export function parseAgentResearchOutput(raw: string, now = new Date().toISOString()): ParsedAgentResearch {
  const parsed = parseJsonObject(raw);
  const warnings: string[] = [];
  const findings: AgentResearchFinding[] = [];

  if (!parsed || typeof parsed !== "object") {
    return {
      searchStrategy: { queriesRun: [], relevanceRulesUsed: [] },
      findings,
      warnings: ["Agent research returned invalid JSON."],
      rejectedResults: [],
    };
  }

  for (const item of Array.isArray(parsed.findings) ? parsed.findings : []) {
    const claim = String(item.claim ?? "").trim();
    const sourceLabel = String(item.source_label ?? item.source?.label ?? "").trim();
    const sourceUrl = String(item.source_url ?? item.source?.url ?? "").trim();
    const excerpt = String(item.evidence_excerpt ?? "").trim();
    const whyItMatters = String(item.why_it_matters ?? "").trim();

    if (!claim || !sourceLabel) {
      warnings.push("Dropped research finding because it was missing a claim or source label.");
      continue;
    }
    if (!sourceUrl) {
      warnings.push(`Dropped "${claim}" because it was missing source URL.`);
      continue;
    }
    if (!excerptSupportsClaim(claim, excerpt)) {
      warnings.push(`Dropped "${claim}" because the evidence excerpt did not support the claim.`);
      continue;
    }

    findings.push({
      claim,
      source: {
        label: sourceLabel,
        url: sourceUrl,
        source_type: "public_web",
        collected_at: collectedAt(now),
      },
      confidence: normalizeConfidence(item.confidence),
      relevance: normalizeRelevance(item.relevance),
      evidence_excerpt: excerpt,
      why_it_matters: whyItMatters || "This public fact can sharpen marketing context.",
      verified_status: normalizeVerifiedStatus(item.verified_status),
    });
  }

  const strategy = parsed.search_strategy ?? {};
  return {
    searchStrategy: {
      businessTypeAssumption: typeof strategy.business_type_assumption === "string" ? strategy.business_type_assumption : undefined,
      queriesRun: Array.isArray(strategy.queries_run) ? strategy.queries_run.map(String).filter(Boolean) : [],
      relevanceRulesUsed: Array.isArray(strategy.relevance_rules_used) ? strategy.relevance_rules_used.map(String).filter(Boolean) : [],
    },
    findings,
    warnings,
    rejectedResults: Array.isArray(parsed.rejected_results) ? parsed.rejected_results : [],
  };
}

function fact(
  id: string,
  label: string,
  value: string,
  sourceLabel: string,
  now: string,
  options: Partial<BusinessEnrichmentFact> & { url?: string; detail?: string } = {}
): BusinessEnrichmentFact {
  return {
    id,
    kind: options.kind ?? "website",
    label,
    value,
    detail: options.detail,
    source: {
      label: sourceLabel,
      url: options.url,
      source_type: options.source?.source_type ?? "api",
      collected_at: now,
    },
    confidence: options.confidence ?? "medium",
    relevance: options.relevance ?? "medium",
    why_it_matters: options.why_it_matters,
  };
}

function domainFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function zipFromAddress(address?: string): string | undefined {
  return address?.match(/\b\d{5}\b/)?.[0];
}

async function readJsonResponse(res: Response, sourceName: string): Promise<{ data?: any; warning?: string }> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!contentType.toLowerCase().includes("json")) {
    return { warning: `${sourceName} returned a non-JSON response.` };
  }

  try {
    return { data: text ? JSON.parse(text) : null };
  } catch {
    return { warning: `${sourceName} returned invalid JSON.` };
  }
}

function googlePermissionWarning(sourceName: string, data: any): string | undefined {
  const message = String(data?.error?.message ?? "");
  const status = String(data?.error?.status ?? "");
  const reason = String(data?.error?.details?.[0]?.reason ?? "");
  if (/PERMISSION_DENIED|API_KEY_SERVICE_BLOCKED/i.test(`${status} ${reason} ${message}`)) {
    return `${sourceName} API is blocked or not enabled for the configured Google key.`;
  }
  return undefined;
}

export async function collectOpenCorporates(
  params: BusinessEnrichmentParams,
  now: string,
  options: CollectorOptions = {}
): Promise<{ facts: BusinessEnrichmentFact[]; warnings: string[] }> {
  const getSecretFn = options.getSecretFn ?? getProviderSecret;
  const apiToken = await getSecretFn("opencorporates_api_token");
  if (!apiToken) return { facts: [], warnings: ["OpenCorporates API token is not configured."] };

  const fetchFn = options.fetchFn ?? fetch;
  const jurisdiction = params.state ? `us_${params.state.toLowerCase()}` : undefined;
  const query = new URLSearchParams({ q: params.businessName, per_page: "5", api_token: apiToken });
  if (jurisdiction) query.set("jurisdiction_code", jurisdiction);

  const res = await fetchFn(`https://api.opencorporates.com/v0.4/companies/search?${query}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return { facts: [], warnings: [`OpenCorporates returned HTTP ${res.status}.`] };
  const { data, warning } = await readJsonResponse(res, "OpenCorporates");
  if (warning) return { facts: [], warnings: [warning] };
  const companies = data?.results?.companies ?? [];
  if (!companies.length) return { facts: [], warnings: ["No business filing match found in OpenCorporates."] };

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = normalize(params.businessName);
  const match = companies.find((entry: any) => normalize(entry.company?.name ?? "") === target) ?? companies[0];
  const company = match.company;
  if (!company?.name) return { facts: [], warnings: ["OpenCorporates result did not include a usable company name."] };

  const confidence: EnrichmentConfidence = normalize(company.name) === target ? "high" : "low";
  const warnings = confidence === "low" ? [`OpenCorporates returned a low-confidence entity match: ${company.name}.`] : [];

  return {
    facts: [
      fact("entity-filing", "Registered entity", company.name, "OpenCorporates", now, {
        kind: "entity",
        confidence,
        relevance: "medium",
        url: company.opencorporates_url,
        detail: [company.company_type, company.current_status, company.jurisdiction_code].filter(Boolean).join(" | "),
        why_it_matters: "Entity records help distinguish verified business facts from marketing assumptions.",
      }),
      ...(company.incorporation_date
        ? [fact("entity-incorporation-date", "Incorporation date", company.incorporation_date, "OpenCorporates", now, {
            kind: "entity",
            confidence,
            relevance: "low",
            url: company.opencorporates_url,
          })]
        : []),
    ],
    warnings,
  };
}

export async function collectCensus(
  address: string | undefined,
  now: string,
  options: CollectorOptions = {}
): Promise<{ facts: BusinessEnrichmentFact[]; warnings: string[] }> {
  const zip = zipFromAddress(address);
  if (!zip) return { facts: [], warnings: ["No ZIP code available for Census context."] };
  const getSecretFn = options.getSecretFn ?? getProviderSecret;
  const apiKey = await getSecretFn("census_api_key");
  if (!apiKey) return { facts: [], warnings: ["US Census API key is not configured."] };

  const fetchFn = options.fetchFn ?? fetch;
  const query = new URLSearchParams({
    get: "NAME,B19013_001E,B01003_001E",
    for: `zip code tabulation area:${zip}`,
    key: apiKey,
  });
  const url = `https://api.census.gov/data/2022/acs/acs5?${query}`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return { facts: [], warnings: [`US Census returned HTTP ${res.status}.`] };
  const { data: rows, warning } = await readJsonResponse(res, "US Census");
  if (warning) {
    return { facts: [], warnings: [`${warning} Check the configured Census API key.`] };
  }
  const row = rows?.[1];
  if (!row) return { facts: [], warnings: [`No Census ACS context found for ZIP ${zip}.`] };
  const [, income, population] = row;
  return {
    facts: [
      fact("market-median-income", "ZIP median household income", `$${Number(income).toLocaleString("en-US")}`, "US Census ACS 5-Year", now, {
        kind: "market",
        confidence: "high",
        relevance: "medium",
        url,
        why_it_matters: "Local income context helps calibrate premium positioning and offer strategy.",
      }),
      fact("market-population", "ZIP population", Number(population).toLocaleString("en-US"), "US Census ACS 5-Year", now, {
        kind: "market",
        confidence: "high",
        relevance: "low",
        url,
      }),
    ],
    warnings: [],
  };
}

export async function collectWayback(
  website: string | undefined,
  now: string,
  options: CollectorOptions = {}
): Promise<{ facts: BusinessEnrichmentFact[]; warnings: string[] }> {
  const domain = domainFromUrl(website);
  if (!domain) return { facts: [], warnings: ["No website domain available for Wayback history."] };
  const fetchFn = options.fetchFn ?? fetch;
  const url = `https://web.archive.org/cdx?url=${encodeURIComponent(domain)}&output=json&fl=timestamp,original,statuscode&filter=statuscode:200&limit=20`;
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(22000) });
    if (!res.ok) return { facts: [], warnings: [`Wayback Machine returned HTTP ${res.status}.`] };
    const { data: rows, warning } = await readJsonResponse(res, "Wayback Machine");
    if (warning) return { facts: [], warnings: [warning] };
    const captures = Array.isArray(rows) ? rows.slice(1) : [];
    if (captures.length) {
      const earliest = String(captures[0][0]);
      const year = earliest.slice(0, 4);
      return {
        facts: [
          fact("website-wayback-first-seen", "Earliest web archive snapshot", year, "Wayback Machine", now, {
            kind: "website",
            confidence: "medium",
            relevance: "medium",
            url: `https://web.archive.org/web/*/${domain}`,
            detail: `${captures.length} archive rows returned by CDX.`,
          }),
        ],
        warnings: [],
      };
    }
  } catch {
    // Fall through to the lighter availability endpoint below.
  }

  const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(domain)}`;
  const res = await fetchFn(availabilityUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return { facts: [], warnings: [`Wayback Machine returned HTTP ${res.status}.`] };
  const { data, warning } = await readJsonResponse(res, "Wayback Machine");
  if (warning) return { facts: [], warnings: [warning] };
  const closest = data?.archived_snapshots?.closest;
  if (!closest?.available || !closest.timestamp) return { facts: [], warnings: [`No Wayback snapshots found for ${domain}.`] };
  return {
    facts: [
      fact("website-wayback-known-snapshot", "Web archive snapshot", String(closest.timestamp).slice(0, 4), "Wayback Machine", now, {
        kind: "website",
        confidence: "medium",
        relevance: "medium",
        url: closest.url ?? `https://web.archive.org/web/*/${domain}`,
        detail: "Archive availability endpoint returned a known snapshot.",
      }),
    ],
    warnings: [],
  };
}

function mxProvider(exchange: string): string {
  const lower = exchange.toLowerCase();
  if (lower.includes("google")) return "Google Workspace";
  if (lower.includes("outlook") || lower.includes("protection.outlook") || lower.includes("microsoft")) return "Microsoft 365";
  if (lower.includes("secureserver") || lower.includes("godaddy")) return "GoDaddy email";
  return exchange.replace(/\.$/, "");
}

async function collectMx(website: string | undefined, now: string): Promise<{ facts: BusinessEnrichmentFact[]; warnings: string[] }> {
  const domain = domainFromUrl(website);
  if (!domain) return { facts: [], warnings: ["No website domain available for MX lookup."] };
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return { facts: [], warnings: [`Google DNS returned HTTP ${res.status}.`] };
  const data = await res.json();
  const answer = data.Answer?.[0]?.data;
  if (!answer) return { facts: [], warnings: [`No MX records found for ${domain}.`] };
  return {
    facts: [
      fact("website-email-provider", "Email provider", mxProvider(String(answer)), "Google DNS", now, {
        kind: "website",
        confidence: "medium",
        relevance: "low",
        url: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      }),
    ],
    warnings: [],
  };
}

async function collectSeoBasics(website: string | undefined, now: string): Promise<{ facts: BusinessEnrichmentFact[]; warnings: string[] }> {
  if (!website) return { facts: [], warnings: ["No website available for SEO basics."] };
  const origin = new URL(website).origin;
  const [robots, sitemap] = await Promise.allSettled([
    fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) }),
    fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(5000) }),
  ]);
  const robotsPresent = robots.status === "fulfilled" && robots.value.ok;
  const sitemapPresent = sitemap.status === "fulfilled" && sitemap.value.ok;
  return {
    facts: [
      fact("website-robots", "robots.txt", robotsPresent ? "Found" : "Not found", "Website check", now, {
        kind: "website",
        confidence: "medium",
        relevance: "low",
        source: { label: "Website check", source_type: "business_website", collected_at: now },
      }),
      fact("website-sitemap", "sitemap.xml", sitemapPresent ? "Found" : "Not found", "Website check", now, {
        kind: "website",
        confidence: "medium",
        relevance: "medium",
        source: { label: "Website check", source_type: "business_website", collected_at: now },
      }),
    ],
    warnings: [],
  };
}

async function collectSecurityBasics(website: string | undefined, now: string): Promise<{ facts: BusinessEnrichmentFact[]; warnings: string[] }> {
  if (!website) return { facts: [], warnings: ["No website available for security basics."] };
  const res = await fetch(website, { signal: AbortSignal.timeout(7000), redirect: "follow" });
  const headers = res.headers;
  return {
    facts: [
      fact("website-https", "HTTPS final URL", res.url.startsWith("https://") ? "Yes" : "No", "Website headers", now, {
        kind: "website",
        confidence: "medium",
        relevance: "high",
        source: { label: "Website headers", source_type: "business_website", collected_at: now },
      }),
      fact("website-hsts", "HSTS header", headers.has("strict-transport-security") ? "Present" : "Not detected", "Website headers", now, {
        kind: "website",
        confidence: "medium",
        relevance: "medium",
        source: { label: "Website headers", source_type: "business_website", collected_at: now },
      }),
      fact("website-csp", "Content Security Policy", headers.has("content-security-policy") ? "Present" : "Not detected", "Website headers", now, {
        kind: "website",
        confidence: "medium",
        relevance: "low",
        source: { label: "Website headers", source_type: "business_website", collected_at: now },
      }),
    ],
    warnings: [],
  };
}

export async function collectCrux(
  website: string | undefined,
  now: string,
  options: CollectorOptions = {}
): Promise<{ facts: BusinessEnrichmentFact[]; warnings: string[] }> {
  if (!website) return { facts: [], warnings: ["No website available for CrUX lookup."] };
  const getSecretFn = options.getSecretFn ?? getProviderSecret;
  const fetchFn = options.fetchFn ?? fetch;
  const apiKey =
    await getSecretFn("google_crux_api_key") ??
    await getSecretFn("google_pagespeed_api_key") ??
    await getSecretFn("google_places_api_key");
  if (!apiKey) return { facts: [], warnings: ["Google API key not configured for CrUX lookup."] };
  const origin = new URL(website).origin;
  const res = await fetchFn(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    signal: AbortSignal.timeout(7000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, formFactor: "PHONE" }),
  });
  if (res.status === 404) return { facts: [], warnings: ["No CrUX field data available for this website."] };
  const { data, warning } = await readJsonResponse(res, "Chrome UX Report");
  if (!res.ok) {
    return {
      facts: [],
      warnings: [googlePermissionWarning("Chrome UX Report", data) ?? `Chrome UX Report returned HTTP ${res.status}.`],
    };
  }
  if (warning) return { facts: [], warnings: [warning] };
  return {
    facts: [
      fact("website-crux", "Chrome UX field data", "Available", "Chrome UX Report", now, {
        kind: "website",
        confidence: "high",
        relevance: "medium",
      }),
    ],
    warnings: [],
  };
}

function researchPrompt(params: BusinessEnrichmentParams, deterministicFacts: BusinessEnrichmentFact[]): string {
  const location = [params.city, params.state].filter(Boolean).join(", ");
  const businessType = params.phase0?.business_understanding.true_category ?? params.category ?? "local business";
  const competitorQueries = params.phase0?.competitor_search_strategy.search_queries ?? [];

  return `Research "${params.businessName}" (${businessType}) in ${location || "its local market"}.

First create a search plan, then use tools. Search the official business and category-relevant public pages before directories. Use at most 6 tool calls total.

Known official facts:
- Website: ${params.website ?? "not found"}
- Address: ${params.address ?? "not found"}
- Phone: ${params.phone ?? "not found"}
- Google category: ${params.gbpHealth?.category ?? params.category ?? "unknown"}
- Deterministic facts: ${JSON.stringify(deterministicFacts.slice(0, 12))}

Use these category-aware competitor/search hints when relevant:
${competitorQueries.map((query) => `- ${query}`).join("\n") || "- Build relevant queries from the business category and city."}

Find facts a marketer can use, such as service lines, booking/conversion paths, trust markers, local press, official profile signals, or category-specific differentiators.

Reject wrong-city, wrong-business, stale, generic directory, or unsupported results.

Return ONLY JSON with this shape:
{
  "search_strategy": {
    "business_type_assumption": "string",
    "queries_run": ["string"],
    "relevance_rules_used": ["string"]
  },
  "findings": [
    {
      "claim": "specific public fact",
      "source_label": "source name",
      "source_url": "https://...",
      "confidence": "high|medium|low",
      "relevance": "high|medium|low",
      "evidence_excerpt": "short excerpt supporting the claim",
      "why_it_matters": "why a marketer should care",
      "verified_status": "verified|inferred"
    }
  ],
  "rejected_results": [
    { "source_label": "string", "reason": "string" }
  ]
}

Never make revenue, market share, customer volume, or legal claims unless the source explicitly states them.`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function researchBusinessContext(params: BusinessEnrichmentParams, facts: BusinessEnrichmentFact[], now: string): Promise<ParsedAgentResearch> {
  if (!isAIConfigured()) {
    return {
      searchStrategy: { queriesRun: [], relevanceRulesUsed: [] },
      findings: [],
      warnings: ["AI research was skipped because no AI provider is configured."],
      rejectedResults: [],
    };
  }

  const response = await withTimeout(
    completeWithTools({
      system: "You are a senior local-market research analyst. Search intentionally, prefer authoritative sources, use no more than 6 tool calls, and return only cited facts supported by excerpts. Never fabricate.",
      prompt: researchPrompt(params, facts),
      tools: AGENTIC_TOOL_DEFINITIONS,
      executeTools: executeAgenticTool,
      maxTurns: 4,
    }),
    90000,
    "Agent-led enrichment research"
  );

  const parsed = parseAgentResearchOutput(response.text ?? "", now);
  const queriesFromTools = response.toolCalls
    .filter((call) => call.name === "web_search" || call.name === "search_google_places")
    .map((call) => String((call.input as any).query ?? ""))
    .filter(Boolean);
  const fetchedPages = response.toolCalls
    .filter((call) => call.name === "fetch_webpage")
    .map((call) => String((call.input as any).url ?? ""))
    .filter(Boolean);

  return {
    ...parsed,
    searchStrategy: {
      ...parsed.searchStrategy,
      queriesRun: parsed.searchStrategy.queriesRun.length > 0 ? parsed.searchStrategy.queriesRun : queriesFromTools,
    },
    rejectedResults: [
      ...parsed.rejectedResults,
      ...fetchedPages.map((url) => ({ source_label: url, reason: "Fetched page was considered during research." })),
    ],
  };
}

export async function gatherBusinessEnrichment(params: BusinessEnrichmentParams): Promise<BusinessEnrichmentResult> {
  const now = new Date().toISOString();
  const deterministicSources = [
    ["OpenCorporates", () => collectOpenCorporates(params, now)] as const,
    ["US Census ACS 5-Year", () => collectCensus(params.address ?? params.gbpHealth?.address, now)] as const,
    ["Wayback Machine", () => collectWayback(params.website ?? params.gbpHealth?.website, now)] as const,
    ["Google DNS", () => collectMx(params.website ?? params.gbpHealth?.website, now)] as const,
    ["SEO basics", () => collectSeoBasics(params.website ?? params.gbpHealth?.website, now)] as const,
    ["Security headers", () => collectSecurityBasics(params.website ?? params.gbpHealth?.website, now)] as const,
    ["Chrome UX Report", () => collectCrux(params.website ?? params.gbpHealth?.website, now)] as const,
  ];

  const settled = await Promise.allSettled(deterministicSources.map(([, run]) => run()));
  const facts: BusinessEnrichmentFact[] = [];
  const warnings: string[] = [];
  const checked: string[] = [];

  settled.forEach((result, index) => {
    const sourceName = deterministicSources[index][0];
    checked.push(sourceName);
    if (result.status === "fulfilled") {
      facts.push(...result.value.facts);
      warnings.push(...result.value.warnings);
    } else {
      warnings.push(`${sourceName} enrichment failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });

  let research: ParsedAgentResearch = {
    searchStrategy: { queriesRun: [], relevanceRulesUsed: [] },
    findings: [],
    warnings: [],
    rejectedResults: [],
  };

  try {
    research = await researchBusinessContext(params, facts, now);
    warnings.push(...research.warnings);
  } catch (error) {
    warnings.push(`Agent-led research failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    generated_at: now,
    facts,
    research_findings: research.findings,
    warnings: Array.from(new Set(warnings)).slice(0, 12),
    coverage: {
      deterministic_sources_checked: checked,
      agent_searches_run: research.searchStrategy.queriesRun,
      pages_fetched: research.rejectedResults
        .map((item) => item.source_label)
        .filter((value) => value.startsWith("http")),
    },
  };
}
