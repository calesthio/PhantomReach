/**
 * Business Intelligence — Intent Signals
 *
 * Synthesises "Important Facts Uncovered" from:
 *  1. OpenCorporates API (free tier — 50 req/day, no auth)
 *     → LLC filings, incorporation date, registered agent changes
 *  2. Existing audit module data
 *     → domain age, rapid review growth, tech maturity gaps, missing profiles
 *
 * Each signal has a type, headline, detail, source, confidence, and icon hint
 * so the UI can render it with maximum visual impact.
 */

import type {
  BusinessIntelligenceSignal,
  BusinessIntelligenceResult,
  GBPHealthResult,
  ReviewSentimentResult,
  WebsitePerformanceResult,
  TechStackResult,
  SocialPresenceResult,
  CitationConsistencyResult,
} from "@/lib/db/types";
import { getProviderSecret } from "@/lib/config/provider-config";

interface IntentSignalsParams {
  businessName: string;
  city?: string;
  state?: string;
  // Module outputs for synthesis
  gbpHealth?: GBPHealthResult;
  reviewSentiment?: ReviewSentimentResult;
  websitePerformance?: WebsitePerformanceResult;
  techStack?: TechStackResult;
  socialPresence?: SocialPresenceResult;
  citationConsistency?: CitationConsistencyResult;
}

// ---------------------------------------------------------------------------
// OpenCorporates API (free, no auth, 50 req/day)
// ---------------------------------------------------------------------------

interface OpenCorpCompany {
  name: string;
  company_number: string;
  jurisdiction_code: string;
  incorporation_date?: string;
  company_type?: string;
  current_status?: string;
  registered_address_in_full?: string;
  agent_name?: string;
  opencorporates_url?: string;
}

async function searchOpenCorporates(
  businessName: string,
  state?: string
): Promise<OpenCorpCompany | null> {
  try {
    const jurisdiction = state
      ? `us_${state.toLowerCase()}`
      : undefined;

    const params = new URLSearchParams({ q: businessName });
    if (jurisdiction) params.set("jurisdiction_code", jurisdiction);
    params.set("per_page", "5");

    const res = await fetch(
      `https://api.opencorporates.com/v0.4/companies/search?${params}`,
      { signal: AbortSignal.timeout(6000) }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const companies = data?.results?.companies;
    if (!companies?.length) return null;

    // Find best match — prefer exact-ish name match
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = normalise(businessName);

    const match =
      companies.find(
        (c: any) => normalise(c.company?.name || "") === target
      ) || companies[0];

    const co = match.company;
    if (!co) return null;

    return {
      name: co.name,
      company_number: co.company_number,
      jurisdiction_code: co.jurisdiction_code,
      incorporation_date: co.incorporation_date || undefined,
      company_type: co.company_type || undefined,
      current_status: co.current_status || undefined,
      registered_address_in_full: co.registered_address_in_full || undefined,
      agent_name: co.agent_name || undefined,
      opencorporates_url: co.opencorporates_url || undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Signal generators
// ---------------------------------------------------------------------------

function signalsFromOpenCorporates(co: OpenCorpCompany): BusinessIntelligenceSignal[] {
  const signals: BusinessIntelligenceSignal[] = [];

  // Recent incorporation (< 2 years)
  if (co.incorporation_date) {
    const incDate = new Date(co.incorporation_date);
    const ageMonths = (Date.now() - incDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (ageMonths <= 24) {
      signals.push({
        type: "recent_incorporation",
        headline: `Recently incorporated (${incDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })})`,
        detail: `${co.name} was filed as ${co.company_type || "a business entity"} in ${co.jurisdiction_code.replace("us_", "").toUpperCase()} just ${Math.round(ageMonths)} months ago. New businesses typically invest heavily in digital presence within their first 2 years.`,
        source: "OpenCorporates",
        confidence: "high",
        date: co.incorporation_date,
        icon_hint: "file-text",
      });
    }

    // Business filing found (always informative)
    signals.push({
      type: "business_filing",
      headline: `Registered ${co.company_type || "business"} in ${co.jurisdiction_code.replace("us_", "").toUpperCase()}`,
      detail: `Official filing found: ${co.name} (${co.company_number}), status: ${co.current_status || "active"}. Incorporated ${incDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
      source: "OpenCorporates",
      confidence: "high",
      date: co.incorporation_date,
      icon_hint: "building",
    });
  }

  return signals;
}

function signalsFromModuleData(params: IntentSignalsParams): BusinessIntelligenceSignal[] {
  const signals: BusinessIntelligenceSignal[] = [];

  // Domain age signal
  if (params.techStack?.domain_age_years !== undefined) {
    if (params.techStack.domain_age_years < 1) {
      signals.push({
        type: "domain_age",
        headline: "Brand-new domain registered this year",
        detail: `The website domain is less than 1 year old — this often indicates a new business, rebrand, or expansion. Businesses with new domains need SEO and digital marketing the most.`,
        source: "Domain WHOIS",
        confidence: "high",
        icon_hint: "calendar",
      });
    } else if (params.techStack.domain_age_years > 10) {
      signals.push({
        type: "domain_age",
        headline: `Established online presence (${params.techStack.domain_age_years}+ year domain)`,
        detail: `Domain has been registered for over ${params.techStack.domain_age_years} years, indicating a well-established business with brand equity.`,
        source: "Domain WHOIS",
        confidence: "high",
        icon_hint: "building",
      });
    }
  }

  // Rapid review growth
  if (params.reviewSentiment?.review_velocity && params.reviewSentiment.review_velocity >= 8) {
    signals.push({
      type: "rapid_growth",
      headline: `High review velocity: ${params.reviewSentiment.review_velocity} reviews/month`,
      detail: `This business is receiving ${params.reviewSentiment.review_velocity} new Google reviews per month — significantly above average for local businesses (2-4/mo). This suggests rapid customer growth or an active review management strategy.`,
      source: "Google Reviews",
      confidence: "high",
      icon_hint: "trending-up",
    });
  }

  // Improving trend
  if (params.reviewSentiment?.trend_direction === "improving" && params.reviewSentiment?.google_rating && params.reviewSentiment.google_rating >= 4.0) {
    signals.push({
      type: "rapid_growth",
      headline: "Reputation trajectory is upward",
      detail: `Review sentiment is improving with a ${params.reviewSentiment.google_rating}-star Google rating. Businesses on an upswing typically invest in marketing to capitalize on momentum.`,
      source: "Sentiment Analysis",
      confidence: "medium",
      icon_hint: "trending-up",
    });
  }

  // No website — massive opportunity signal
  if (params.gbpHealth && !params.gbpHealth.website) {
    signals.push({
      type: "expansion_signal",
      headline: "No website linked to Google Business Profile",
      detail: `This business has a Google listing but no website. They are missing 70%+ of potential online leads. This is the strongest signal that they need digital services immediately.`,
      source: "Google Business Profile",
      confidence: "high",
      icon_hint: "zap",
    });
  }

  // Low digital maturity with good ratings
  if (
    params.techStack &&
    params.techStack.digital_maturity_score < 40 &&
    params.gbpHealth?.rating &&
    params.gbpHealth.rating >= 4.0
  ) {
    signals.push({
      type: "expansion_signal",
      headline: "Strong reputation but weak digital infrastructure",
      detail: `With a ${params.gbpHealth.rating}-star rating but only ${params.techStack.digital_maturity_score}/100 digital maturity, this business has loyal customers but isn't converting online traffic effectively. A huge opportunity for digital services.`,
      source: "Tech Stack + GBP Analysis",
      confidence: "high",
      icon_hint: "zap",
    });
  }

  // Missing from major directories - only emitted when real citation data exists.
  if (params.citationConsistency && params.citationConsistency.total_missing >= 5) {
    signals.push({
      type: "new_location",
      headline: `Missing from ${params.citationConsistency.total_missing} major directories`,
      detail: `This business is not listed on ${params.citationConsistency.total_missing} out of 12 major directories. This pattern often indicates a newer location, recent move, or a business that hasn't invested in directory management.`,
      source: "Citation Scan",
      confidence: "medium",
      icon_hint: "map-pin",
    });
  }

  // No social media at all
  if (params.socialPresence && params.socialPresence.platforms_found === 0) {
    signals.push({
      type: "expansion_signal",
      headline: "Zero social media presence detected",
      detail: `No social media profiles were found for this business. In 2024, this is extremely rare and indicates a business that has not yet embraced digital marketing. High opportunity for a full digital buildout.`,
      source: "Social Scan",
      confidence: "high",
      icon_hint: "users",
    });
  } else if (params.socialPresence && params.socialPresence.platforms_active === 0 && params.socialPresence.platforms_found > 0) {
    signals.push({
      type: "expansion_signal",
      headline: "Social accounts exist but are dormant",
      detail: `Found ${params.socialPresence.platforms_found} social profiles but none are actively posting. This business has set up accounts but abandoned them — they may be ready to re-engage with the right partner.`,
      source: "Social Scan",
      confidence: "medium",
      icon_hint: "users",
    });
  }

  // High review count + low website score
  if (
    params.gbpHealth?.review_count &&
    params.gbpHealth.review_count >= 50 &&
    params.websitePerformance &&
    params.websitePerformance.performance_score < 50
  ) {
    signals.push({
      type: "expansion_signal",
      headline: "Popular business with underperforming website",
      detail: `${params.gbpHealth.review_count} Google reviews show strong demand, but the website scores only ${params.websitePerformance.performance_score}/100 on performance. Customers are finding them despite the website, not because of it.`,
      source: "PageSpeed + GBP Analysis",
      confidence: "high",
      icon_hint: "zap",
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Free public data probes (no API keys — just HTTP requests)
// ---------------------------------------------------------------------------

/** Check Wayback Machine for site history — completely free, no auth */
async function probeWaybackMachine(url: string): Promise<BusinessIntelligenceSignal[]> {
  const signals: BusinessIntelligenceSignal[] = [];
  try {
    const domain = new URL(url).hostname;
    const res = await fetch(
      `https://archive.org/wayback/available?url=${domain}&timestamp=20100101`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return signals;
    const data = await res.json();
    const snapshot = data?.archived_snapshots?.closest;

    if (snapshot?.timestamp) {
      const ts = snapshot.timestamp; // format: YYYYMMDDhhmmss
      const year = parseInt(ts.slice(0, 4));
      const currentYear = new Date().getFullYear();
      const age = currentYear - year;

      if (age >= 10) {
        signals.push({
          type: "domain_age",
          headline: `Website archived since ${year} (${age}+ years online)`,
          detail: `The Wayback Machine has snapshots of this site going back to ${year}. A ${age}-year web presence indicates an established business with long-term brand equity.`,
          source: "Wayback Machine",
          confidence: "high",
          date: `${year}-01-01`,
          icon_hint: "building",
        });
      } else if (age <= 1) {
        signals.push({
          type: "domain_age",
          headline: "Website first appeared online recently",
          detail: `First Wayback Machine snapshot is from ${year}. This is a new or recently rebuilt website — the business may be in growth mode or undergoing a rebrand.`,
          source: "Wayback Machine",
          confidence: "medium",
          date: `${year}-01-01`,
          icon_hint: "calendar",
        });
      }
    } else {
      // No Wayback snapshots at all
      signals.push({
        type: "domain_age",
        headline: "No web archive history found",
        detail: "The Wayback Machine has no snapshots of this website. This usually means the site is very new, recently launched, or blocks archiving — all indicators of a business early in its digital journey.",
        source: "Wayback Machine",
        confidence: "medium",
        icon_hint: "calendar",
      });
    }
  } catch {
    // Timeout or network error — skip silently
  }
  return signals;
}

/** Check DNS MX records — reveals email provider (free, no auth) */
async function probeMXRecords(domain: string): Promise<BusinessIntelligenceSignal[]> {
  const signals: BusinessIntelligenceSignal[] = [];
  try {
    // Use public DNS-over-HTTPS (Google)
    const res = await fetch(
      `https://dns.google/resolve?name=${domain}&type=MX`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return signals;
    const data = await res.json();
    const answers = data?.Answer || [];

    const mxHosts = answers
      .filter((a: any) => a.type === 15) // MX records
      .map((a: any) => (a.data || "").toLowerCase());

    const mxString = mxHosts.join(" ");

    if (mxString.includes("google") || mxString.includes("gmail")) {
      if (mxString.includes("aspmx") || mxString.includes("googlemail")) {
        signals.push({
          type: "expansion_signal",
          headline: "Using Google Workspace for business email",
          detail: `Business email runs on Google Workspace — indicates some level of digital investment. However, many businesses on Google Workspace still lack proper marketing infrastructure.`,
          source: "DNS MX Records",
          confidence: "medium",
          icon_hint: "briefcase",
        });
      }
    } else if (mxString.includes("outlook") || mxString.includes("microsoft")) {
      signals.push({
        type: "expansion_signal",
        headline: "Using Microsoft 365 for business email",
        detail: `Business email runs on Microsoft 365 — suggests an established operations setup. May indicate a business that invests in tools but potentially underinvests in web presence.`,
        source: "DNS MX Records",
        confidence: "medium",
        icon_hint: "briefcase",
      });
    } else if (mxHosts.length === 0) {
      signals.push({
        type: "expansion_signal",
        headline: "No business email configured on domain",
        detail: `No MX records found for the business domain. They're likely using a free email provider (Gmail, Yahoo) for business communications — a strong signal they need digital infrastructure help.`,
        source: "DNS MX Records",
        confidence: "high",
        icon_hint: "zap",
      });
    }
  } catch {
    // DNS lookup failed — skip
  }
  return signals;
}

/** Check robots.txt and sitemap.xml — reveals SEO awareness (free, no auth) */
async function probeSEOBasics(url: string): Promise<BusinessIntelligenceSignal[]> {
  const signals: BusinessIntelligenceSignal[] = [];
  const origin = new URL(url).origin;

  const [robotsRes, sitemapRes] = await Promise.allSettled([
    fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(4000) }),
    fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(4000) }),
  ]);

  const hasRobots = robotsRes.status === "fulfilled" && robotsRes.value.ok;
  const hasSitemap = sitemapRes.status === "fulfilled" && sitemapRes.value.ok;

  if (!hasRobots && !hasSitemap) {
    signals.push({
      type: "expansion_signal",
      headline: "No robots.txt or sitemap.xml — SEO basics missing",
      detail: `The website has neither a robots.txt nor a sitemap.xml file. These are fundamental SEO requirements that help search engines discover and index content. Their absence suggests no SEO work has been done.`,
      source: "Website Probe",
      confidence: "high",
      icon_hint: "zap",
    });
  } else if (hasSitemap && hasRobots) {
    signals.push({
      type: "expansion_signal",
      headline: "SEO fundamentals are in place",
      detail: `Both robots.txt and sitemap.xml are present. This business has at least basic SEO awareness, though the quality and optimization of these files varies significantly.`,
      source: "Website Probe",
      confidence: "medium",
      icon_hint: "trending-up",
    });
  }

  return signals;
}

/** Check SSL certificate and security headers (free, no auth) */
async function probeSecurityPosture(url: string): Promise<BusinessIntelligenceSignal[]> {
  const signals: BusinessIntelligenceSignal[] = [];
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });

    const headers = res.headers;
    const hasHSTS = !!headers.get("strict-transport-security");
    const hasCSP = !!headers.get("content-security-policy");
    const hasXFrame = !!headers.get("x-frame-options");
    const securityScore = [hasHSTS, hasCSP, hasXFrame].filter(Boolean).length;

    if (securityScore === 0) {
      signals.push({
        type: "expansion_signal",
        headline: "No security headers detected on website",
        detail: `The website is missing all standard security headers (HSTS, CSP, X-Frame-Options). This indicates minimal security investment and potential vulnerability — a clear opportunity for web development services.`,
        source: "Security Headers",
        confidence: "high",
        icon_hint: "zap",
      });
    }

    // Check if site redirects HTTP → HTTPS properly
    if (url.startsWith("http://")) {
      const finalUrl = res.url;
      if (!finalUrl.startsWith("https://")) {
        signals.push({
          type: "expansion_signal",
          headline: "Website not using HTTPS",
          detail: `The site doesn't redirect to HTTPS. Google penalizes non-HTTPS sites in search rankings, and browsers show "Not Secure" warnings. This actively drives away customers.`,
          source: "SSL Check",
          confidence: "high",
          icon_hint: "zap",
        });
      }
    }
  } catch {
    // Fetch failed — site might be down or blocking HEAD requests
  }
  return signals;
}

// ---------------------------------------------------------------------------
// CrUX API — Chrome User Experience Report (uses GOOGLE_PLACES_API_KEY)
// Real-world Core Web Vitals from actual Chrome users. Far more credible
// than synthetic Lighthouse scores. Cost: $0 (quota: 150 req/day).
// ---------------------------------------------------------------------------

interface CrUXMetric {
  percentiles: { p75: number };
  histogram: { start: number; end?: number; density: number }[];
}

async function probeCrUX(url: string): Promise<BusinessIntelligenceSignal[]> {
  const signals: BusinessIntelligenceSignal[] = [];
  const apiKey = await getProviderSecret("google_places_api_key");
  if (!apiKey) return signals;

  try {
    const origin = new URL(url).origin;
    const res = await fetch(
      `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin }),
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!res.ok) {
      // 404 = site has no CrUX data (too little traffic)
      if (res.status === 404) {
        signals.push({
          type: "expansion_signal",
          headline: "No real-user web performance data (very low traffic)",
          detail: `Google's Chrome UX Report has no data for this site — meaning it gets too few visits to generate metrics. This is a strong signal the business has minimal web traffic and needs digital marketing.`,
          source: "Chrome UX Report",
          confidence: "high",
          icon_hint: "zap",
        });
      }
      return signals;
    }

    const data = await res.json();
    const metrics = data?.record?.metrics;
    if (!metrics) return signals;

    // LCP (Largest Contentful Paint) — p75
    const lcp = (metrics.largest_contentful_paint as CrUXMetric | undefined)
      ?.percentiles?.p75;
    // INP (Interaction to Next Paint) — p75
    const inp = (
      metrics.interaction_to_next_paint as CrUXMetric | undefined
    )?.percentiles?.p75;
    // CLS (Cumulative Layout Shift) — p75
    const cls = (
      metrics.cumulative_layout_shift as CrUXMetric | undefined
    )?.percentiles?.p75;

    // Count how many Core Web Vitals fail Google's thresholds
    let failures = 0;
    const failDetails: string[] = [];

    if (lcp !== undefined) {
      const lcpSec = (lcp / 1000).toFixed(1);
      if (lcp > 4000) {
        failures++;
        failDetails.push(`LCP ${lcpSec}s (poor — threshold 2.5s)`);
      } else if (lcp > 2500) {
        failDetails.push(`LCP ${lcpSec}s (needs improvement)`);
      }
    }
    if (inp !== undefined) {
      if (inp > 500) {
        failures++;
        failDetails.push(`INP ${inp}ms (poor — threshold 200ms)`);
      } else if (inp > 200) {
        failDetails.push(`INP ${inp}ms (needs improvement)`);
      }
    }
    if (cls !== undefined) {
      if (cls > 0.25) {
        failures++;
        failDetails.push(`CLS ${cls.toFixed(2)} (poor — threshold 0.1)`);
      } else if (cls > 0.1) {
        failDetails.push(`CLS ${cls.toFixed(2)} (needs improvement)`);
      }
    }

    if (failures >= 2) {
      signals.push({
        type: "expansion_signal",
        headline: `Failing ${failures} Core Web Vitals (real-user data)`,
        detail: `Real Chrome users experience: ${failDetails.join(", ")}. These are actual field metrics, not lab tests — this is what customers experience. Google uses these for search ranking.`,
        source: "Chrome UX Report",
        confidence: "high",
        icon_hint: "zap",
      });
    } else if (failures === 0 && failDetails.length === 0 && lcp !== undefined) {
      signals.push({
        type: "expansion_signal",
        headline: "All Core Web Vitals passing (real-user data)",
        detail: `Real Chrome user metrics show all Core Web Vitals are in the "good" range. This business has invested in website performance — they may be more digitally sophisticated than average.`,
        source: "Chrome UX Report",
        confidence: "high",
        icon_hint: "trending-up",
      });
    }
  } catch {
    // Timeout or network error — skip
  }
  return signals;
}

// ---------------------------------------------------------------------------
// crt.sh — Certificate Transparency Logs (free, no auth)
// Reveals every SSL cert issued for a domain → exposes subdomains,
// which tells us what the business is building (app.*, shop.*, staging.*)
// ---------------------------------------------------------------------------

async function probeCertTransparency(
  domain: string
): Promise<BusinessIntelligenceSignal[]> {
  const signals: BusinessIntelligenceSignal[] = [];
  try {
    const res = await fetch(
      `https://crt.sh/?q=%25.${domain}&output=json`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return signals;

    const certs: { common_name: string; name_value: string; not_before: string }[] =
      await res.json();

    if (!Array.isArray(certs) || certs.length === 0) {
      signals.push({
        type: "expansion_signal",
        headline: "No SSL certificates found for domain",
        detail: `No certificates have been issued for this domain in public transparency logs. This could mean the site uses a shared/free cert or has minimal HTTPS infrastructure.`,
        source: "Certificate Transparency (crt.sh)",
        confidence: "medium",
        icon_hint: "zap",
      });
      return signals;
    }

    // Extract unique subdomains
    const subdomains = new Set<string>();
    for (const cert of certs) {
      const names = (cert.name_value || "").split("\n");
      for (const name of names) {
        const clean = name.trim().replace(/^\*\./, "").toLowerCase();
        if (clean && clean !== domain && clean.endsWith(domain)) {
          subdomains.add(clean);
        }
      }
    }

    // Interesting subdomain patterns
    const interesting: string[] = [];
    const patterns: Record<string, string> = {
      app: "web application",
      shop: "e-commerce store",
      store: "e-commerce store",
      staging: "development environment",
      dev: "development environment",
      api: "API backend",
      admin: "admin panel",
      portal: "customer portal",
      mail: "email server",
      blog: "content marketing",
      booking: "booking system",
      pay: "payment system",
    };

    Array.from(subdomains).forEach((sub) => {
      const prefix = sub.replace(`.${domain}`, "").split(".").pop() || "";
      if (patterns[prefix]) {
        interesting.push(`${prefix}.${domain} (${patterns[prefix]})`);
      }
    });

    if (subdomains.size >= 5) {
      signals.push({
        type: "expansion_signal",
        headline: `${subdomains.size} subdomains detected — complex digital infrastructure`,
        detail: `SSL certificate logs reveal ${subdomains.size} subdomains${interesting.length > 0 ? ` including: ${interesting.slice(0, 4).join(", ")}` : ""}. This suggests a business with significant digital infrastructure investment.`,
        source: "Certificate Transparency (crt.sh)",
        confidence: "high",
        icon_hint: "building",
      });
    } else if (subdomains.size === 0) {
      signals.push({
        type: "expansion_signal",
        headline: "Single-domain setup — no subdomains",
        detail: `Only the main domain has SSL certificates. No subdomains like app.*, shop.*, or blog.* were found. This is a simple web presence with no additional digital services running.`,
        source: "Certificate Transparency (crt.sh)",
        confidence: "medium",
        icon_hint: "briefcase",
      });
    }

    // Check if they recently issued a new cert (signal of active management)
    const recentCerts = certs.filter((c) => {
      const issued = new Date(c.not_before);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return issued > threeMonthsAgo;
    });

    if (recentCerts.length >= 3) {
      signals.push({
        type: "expansion_signal",
        headline: `${recentCerts.length} new SSL certificates in last 3 months`,
        detail: `Active certificate issuance suggests ongoing development work or infrastructure changes. This business is actively investing in their web presence.`,
        source: "Certificate Transparency (crt.sh)",
        confidence: "medium",
        icon_hint: "trending-up",
      });
    }
  } catch {
    // Timeout or parse error — crt.sh can be slow
  }
  return signals;
}

// ---------------------------------------------------------------------------
// US Census Bureau — Demographic context (free, no auth, no key)
// Median household income + population for the business's ZIP code.
// Gives the agent context: a dentist in a $120k median income ZIP is a
// different sell than one in a $35k ZIP.
// ---------------------------------------------------------------------------

interface CensusData {
  median_household_income?: number;
  total_population?: number;
  zip: string;
}

function extractZipFromAddress(address: string): string | null {
  // Match 5-digit ZIP (with optional +4)
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

async function probeCensus(address: string): Promise<BusinessIntelligenceSignal[]> {
  const signals: BusinessIntelligenceSignal[] = [];
  const zip = extractZipFromAddress(address);
  if (!zip) return signals;

  try {
    // ACS 5-Year data: B19013_001E = median household income, B01003_001E = total population
    const res = await fetch(
      `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B01003_001E&for=zip%20code%20tabulation%20area:${zip}`,
      { signal: AbortSignal.timeout(6000) }
    );

    if (!res.ok) return signals;

    const data = await res.json();
    // Response format: [["B19013_001E","B01003_001E","zip..."], ["65000","32000","78701"]]
    if (!Array.isArray(data) || data.length < 2) return signals;

    const values = data[1];
    const income = parseInt(values[0]);
    const population = parseInt(values[1]);

    if (isNaN(income) || income < 0) return signals;

    const censusInfo: CensusData = {
      median_household_income: income,
      total_population: isNaN(population) ? undefined : population,
      zip,
    };

    // High-income area (> $85k median)
    if (censusInfo.median_household_income && censusInfo.median_household_income >= 85000) {
      signals.push({
        type: "expansion_signal",
        headline: `Located in high-income area ($${(censusInfo.median_household_income / 1000).toFixed(0)}k median income)`,
        detail: `ZIP ${zip} has a median household income of $${censusInfo.median_household_income.toLocaleString()}${censusInfo.total_population ? ` and a population of ${censusInfo.total_population.toLocaleString()}` : ""}. High-income areas mean customers with more spending power — digital marketing ROI is typically higher here.`,
        source: "US Census Bureau (ACS 5-Year)",
        confidence: "high",
        icon_hint: "map-pin",
      });
    }
    // Low-income area (< $40k median)
    else if (censusInfo.median_household_income && censusInfo.median_household_income < 40000) {
      signals.push({
        type: "expansion_signal",
        headline: `Located in value-conscious area ($${(censusInfo.median_household_income / 1000).toFixed(0)}k median income)`,
        detail: `ZIP ${zip} has a median household income of $${censusInfo.median_household_income.toLocaleString()}${censusInfo.total_population ? ` and a population of ${censusInfo.total_population.toLocaleString()}` : ""}. In lower-income areas, businesses benefit most from high-visibility, cost-effective digital strategies.`,
        source: "US Census Bureau (ACS 5-Year)",
        confidence: "high",
        icon_hint: "map-pin",
      });
    }
    // Mid-range — still useful context
    else if (censusInfo.median_household_income) {
      signals.push({
        type: "expansion_signal",
        headline: `Service area demographics: $${(censusInfo.median_household_income / 1000).toFixed(0)}k median income`,
        detail: `ZIP ${zip} has a median household income of $${censusInfo.median_household_income.toLocaleString()}${censusInfo.total_population ? ` serving a population of ${censusInfo.total_population.toLocaleString()}` : ""}. This provides context for pricing strategy and digital marketing spend expectations.`,
        source: "US Census Bureau (ACS 5-Year)",
        confidence: "medium",
        icon_hint: "map-pin",
      });
    }
  } catch {
    // Census API timeout or error — skip
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Lightweight scout intel (parallel probes, no module data needed)
// ---------------------------------------------------------------------------

export interface QuickIntelParams {
  businessName: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  rating?: number;
  reviewCount?: number;
}

/**
 * Fast intelligence gathering for scout mode.
 * Runs all free probes in parallel — no module data required.
 * Designed to run per-business during scout without being expensive.
 */
export async function gatherQuickIntel(
  params: QuickIntelParams
): Promise<BusinessIntelligenceResult> {
  const allSignals: BusinessIntelligenceSignal[] = [];

  // Run all probes in parallel — they're all free HTTP requests
  const probes: Promise<BusinessIntelligenceSignal[]>[] = [];

  // OpenCorporates (free, no auth, 50 req/day)
  probes.push(
    searchOpenCorporates(params.businessName, params.state).then(
      (co) => (co ? signalsFromOpenCorporates(co) : [])
    )
  );

  // Website-dependent probes
  if (params.website) {
    probes.push(probeWaybackMachine(params.website));
    probes.push(probeSEOBasics(params.website));
    probes.push(probeSecurityPosture(params.website));
    probes.push(probeCrUX(params.website));

    try {
      const domain = new URL(params.website).hostname;
      probes.push(probeMXRecords(domain));
      probes.push(probeCertTransparency(domain));
    } catch {
      // Invalid URL — skip domain-based probes
    }
  } else {
    // No website is itself a strong signal
    allSignals.push({
      type: "expansion_signal",
      headline: "No website detected",
      detail: `This business appears to have no website. They're missing 70%+ of potential online leads — the strongest possible signal they need digital services.`,
      source: "Business Profile",
      confidence: "high",
      icon_hint: "zap",
    });
  }

  // Census demographics (address-based — works with or without website)
  if (params.address) {
    probes.push(probeCensus(params.address));
  }

  // Review-based signals (no API needed — derived from Places data)
  if (params.rating !== undefined && params.reviewCount !== undefined) {
    if (params.rating < 3.5) {
      allSignals.push({
        type: "rapid_growth",
        headline: `Low Google rating: ${params.rating} stars`,
        detail: `A ${params.rating}-star rating is suppressing this business's visibility in Google Maps and driving customers to competitors. Reputation management is urgently needed.`,
        source: "Google Reviews",
        confidence: "high",
        icon_hint: "trending-up",
      });
    }
    if (params.reviewCount < 10) {
      allSignals.push({
        type: "rapid_growth",
        headline: `Only ${params.reviewCount} Google reviews`,
        detail: `With just ${params.reviewCount} reviews, this business lacks the social proof modern consumers expect. Review generation is a quick win.`,
        source: "Google Reviews",
        confidence: "high",
        icon_hint: "trending-up",
      });
    }
    if (params.rating >= 4.5 && params.reviewCount >= 50) {
      allSignals.push({
        type: "rapid_growth",
        headline: `Strong reputation: ${params.rating}★ with ${params.reviewCount} reviews`,
        detail: `This business has excellent social proof but may be under-leveraging it digitally. Great reputation + weak website = highest ROI opportunity.`,
        source: "Google Reviews",
        confidence: "medium",
        icon_hint: "trending-up",
      });
    }
  }

  // Wait for all probes
  const probeResults = await Promise.allSettled(probes);
  for (const result of probeResults) {
    if (result.status === "fulfilled") {
      allSignals.push(...result.value);
    }
  }

  // Sort and deduplicate
  const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  allSignals.sort((a, b) => (confidenceOrder[a.confidence] ?? 1) - (confidenceOrder[b.confidence] ?? 1));

  const seen = new Set<string>();
  const dedupedSignals: BusinessIntelligenceSignal[] = [];
  for (const sig of allSignals) {
    if (!seen.has(sig.type)) {
      seen.add(sig.type);
      dedupedSignals.push(sig);
    }
  }

  return {
    signals: dedupedSignals,
    signal_count: dedupedSignals.length,
    top_signal: dedupedSignals[0]?.headline,
  };
}

// ---------------------------------------------------------------------------
// Full audit intelligence (existing — uses module data)
// ---------------------------------------------------------------------------

export async function gatherBusinessIntelligence(
  params: IntentSignalsParams
): Promise<BusinessIntelligenceResult> {
  const allSignals: BusinessIntelligenceSignal[] = [];

  // 1. Run all probes in parallel (OpenCorporates + free web probes)
  const probes: Promise<BusinessIntelligenceSignal[]>[] = [];

  probes.push(
    searchOpenCorporates(params.businessName, params.state).then(
      (co) => (co ? signalsFromOpenCorporates(co) : [])
    )
  );

  // Website-dependent probes (if we know the website from GBP)
  const website = params.gbpHealth?.website;
  if (website) {
    probes.push(probeCrUX(website));
    try {
      const domain = new URL(website).hostname;
      probes.push(probeCertTransparency(domain));
    } catch {
      // Invalid URL
    }
  }

  // Census demographics (if we have an address)
  const address = params.gbpHealth?.address;
  if (address) {
    probes.push(probeCensus(address));
  }

  const probeResults = await Promise.allSettled(probes);
  for (const result of probeResults) {
    if (result.status === "fulfilled") {
      allSignals.push(...result.value);
    }
  }

  // 2. Synthesize signals from existing module data
  allSignals.push(...signalsFromModuleData(params));

  // Sort: high confidence first, then by type importance
  const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  allSignals.sort((a, b) => (confidenceOrder[a.confidence] ?? 1) - (confidenceOrder[b.confidence] ?? 1));

  // Deduplicate by type (keep first = highest confidence)
  const seen = new Set<string>();
  const dedupedSignals: BusinessIntelligenceSignal[] = [];
  for (const sig of allSignals) {
    const key = sig.type;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedSignals.push(sig);
    }
  }

  return {
    signals: dedupedSignals,
    signal_count: dedupedSignals.length,
    top_signal: dedupedSignals[0]?.headline,
  };
}
