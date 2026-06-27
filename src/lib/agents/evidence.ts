import type {
  EvidenceModule,
  EvidenceModuleKey,
  EvidenceReport,
  EvidenceStatus,
} from "@/lib/db/types";
import type { UnavailableResult } from "./tools/unavailable";

const MODULE_META: Record<
  EvidenceModuleKey,
  { label: string; source: string; settingsKey?: string }
> = {
  gbp_health: {
    label: "Google Business Profile",
    source: "Google Places",
    settingsKey: "google_places_api_key",
  },
  review_sentiment: {
    label: "Reviews & Reputation",
    source: "Google Places / Yelp",
  },
  website_performance: {
    label: "Website Performance",
    source: "Google PageSpeed",
    settingsKey: "google_pagespeed_api_key",
  },
  tech_stack: {
    label: "Technology Stack",
    source: "Website HTML",
  },
  social_presence: {
    label: "Social Presence",
    source: "Website links",
  },
  citation_consistency: {
    label: "Citation Consistency",
    source: "Directory listings",
  },
  competitive_comparison: {
    label: "Competitive Comparison",
    source: "Google Places",
    settingsKey: "google_places_api_key",
  },
  revenue_impact: {
    label: "Revenue Impact",
    source: "Local calculation",
  },
  business_intelligence: {
    label: "Business Intelligence",
    source: "Local probes",
  },
  business_enrichment: {
    label: "Business Context",
    source: "Public sources",
  },
};

const SOURCE_SETTINGS: Record<string, string> = {
  google_maps: "google_places_api_key",
  google_reviews: "google_places_api_key",
  yelp_reviews: "yelp_api_key",
  pagespeed: "google_pagespeed_api_key",
  competitors: "google_places_api_key",
};

function moduleMeta(key: EvidenceModuleKey) {
  return MODULE_META[key];
}

export function evidenceModule(
  key: EvidenceModuleKey,
  status: EvidenceStatus,
  reason?: string,
  settingsKey?: string
): EvidenceModule {
  const meta = moduleMeta(key);
  return {
    key,
    label: meta.label,
    status,
    source: meta.source,
    reason,
    settings_key: settingsKey ?? meta.settingsKey,
  };
}

export function collectedEvidence(
  key: EvidenceModuleKey,
  reason = "Collected real data for this area."
): EvidenceModule {
  return evidenceModule(key, "collected", reason);
}

export function skippedEvidence(
  key: EvidenceModuleKey,
  reason: string
): EvidenceModule {
  return evidenceModule(key, "skipped", reason, undefined);
}

export function notImplementedEvidence(
  key: EvidenceModuleKey,
  reason: string
): EvidenceModule {
  return evidenceModule(key, "not_implemented", reason, undefined);
}

export function failedEvidence(
  key: EvidenceModuleKey,
  reason: string
): EvidenceModule {
  return evidenceModule(key, "failed", reason);
}

export function unavailableEvidence(
  key: EvidenceModuleKey,
  result: UnavailableResult
): EvidenceModule {
  const settingsKey = SOURCE_SETTINGS[result.source] ?? moduleMeta(key).settingsKey;
  return evidenceModule(key, "unavailable", result.reason, settingsKey);
}

export function buildEvidenceReport(modules: EvidenceModule[]): EvidenceReport {
  const summary = {
    collected: 0,
    unavailable: 0,
    skipped: 0,
    failed: 0,
    not_implemented: 0,
  };

  for (const module of modules) {
    summary[module.status] += 1;
  }

  return {
    generated_at: new Date().toISOString(),
    modules,
    summary,
  };
}
