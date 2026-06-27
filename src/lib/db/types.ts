// Core types for Phantom Reach database schema

export type Plan = "free" | "starter" | "pro" | "agency";
export type ReportType = "audit" | "scout";
export type ReportStatus = "queued" | "processing" | "completed" | "failed" | "partial";
export type UsageAction = "audit" | "scout" | "pdf_export" | "widget_audit";

export interface User {
  id: string;
  auth_user_id?: string;
  email: string;
  name?: string;
  plan: Plan;
  stripe_customer_id?: string;
  audit_credits_remaining: number;
  scout_credits_remaining: number;
  widget_api_key?: string;
  white_label_config?: WhiteLabelConfig;
  created_at: string;
  updated_at: string;
}

export interface WhiteLabelConfig {
  logo_url?: string;
  company_name?: string;
  primary_color?: string;
  secondary_color?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface Report {
  id: string;
  user_id: string;
  type: ReportType;
  status: ReportStatus;
  input: AuditInput | ScoutInput;
  result?: AuditResult | ScoutResult;
  scores?: ReportScores;
  pdf_storage_path?: string;
  email_sent_at?: string;
  expires_at?: string;
  is_widget_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditInput {
  businessName: string;
  city?: string;
  state?: string;
  url?: string;
  googleMapsUrl?: string;
  customDirection?: string;
}

export interface ScoutInput {
  city: string;
  category: string;
  resultCount: number;
  customDirection?: string;
}

export interface ReportScores {
  overall_grade: string; // A-F
  overall_score: number; // 0-100
  module_grades: {
    gbp_health?: string;
    review_sentiment?: string;
    website_performance?: string;
    tech_stack?: string;
    social_presence?: string;
    citation_consistency?: string;
    competitive_position?: string;
    revenue_impact?: string;
  };
}

// Module result types
export interface GBPHealthResult {
  grade: string;
  score: number;
  business_name: string;
  address?: string;
  phone?: string;
  website?: string;
  category?: string;
  rating?: number;
  review_count?: number;
  hours_complete: boolean;
  photos_count: number;
  posts_recent: boolean;
  attributes_filled: number;
  attributes_available: number;
  completeness_pct: number;
  findings: string[];
  recommendations: string[];
}

export interface ReviewSentimentResult {
  grade: string;
  score: number;
  google_rating?: number;
  google_review_count?: number;
  yelp_rating?: number;
  yelp_review_count?: number;
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  top_praise_themes: string[];
  top_complaint_themes: string[];
  owner_response_rate?: number;
  review_velocity?: number; // reviews per month
  trend_direction: "improving" | "stable" | "declining";
  findings: string[];
  recommendations: string[];
}

export interface WebsitePerformanceResult {
  grade: string;
  score: number;
  url: string;
  performance_score: number;
  accessibility_score: number;
  seo_score: number;
  best_practices_score: number;
  core_web_vitals: {
    lcp?: number;
    inp?: number;
    cls?: number;
    lcp_pass: boolean;
    inp_pass: boolean;
    cls_pass: boolean;
  };
  mobile_friendly: boolean;
  ssl_valid: boolean;
  page_weight_mb?: number;
  has_schema_markup: boolean;
  has_clear_cta: boolean;
  findings: string[];
  recommendations: string[];
}

export interface TechStackResult {
  grade: string;
  score: number;
  digital_maturity_score: number;
  cms?: string;
  analytics: string[];
  marketing_automation: string[];
  booking_system?: string;
  chat_widget?: string;
  payment_processor?: string;
  ecommerce?: string;
  hosting_cdn?: string;
  domain_age_years?: number;
  email_provider?: string;
  ssl_issuer?: string;
  technology_gaps: string[];
  findings: string[];
  recommendations: string[];
}

export interface SocialPresenceResult {
  grade: string;
  score: number;
  platforms: {
    name: string;
    url?: string;
    found: boolean;
    follower_count?: number;
    post_frequency?: string;
    last_post_date?: string;
    is_active: boolean;
    engagement_rate?: number;
  }[];
  platforms_found: number;
  platforms_active: number;
  total_following: number;
  nap_consistent: boolean;
  findings: string[];
  recommendations: string[];
}

export interface CitationConsistencyResult {
  grade: string;
  score: number;
  directories: {
    name: string;
    status: "found_correct" | "found_inconsistent" | "not_found" | "unchecked";
    nap_match: boolean;
    url?: string;
    issues: string[];
  }[];
  total_found: number;
  total_correct: number;
  total_inconsistent: number;
  total_missing: number;
  findings: string[];
  recommendations: string[];
  /** True when the directory data is synthetically generated (no real API call was made). Downstream consumers should treat all specific findings as illustrative only. */
  is_mock?: boolean;
}

export interface CompetitiveComparisonResult {
  grade: string;
  score: number;
  target_business: string;
  competitors: {
    name: string;
    address?: string;
    rating?: number;
    review_count?: number;
    website?: string;
    estimated_position: "leader" | "challenger" | "laggard";
    /** Where this competitor was found — agentic research is more category-accurate than geo-search */
    data_source?: "agentic_research" | "geo_search" | "phase0_query";
  }[];
  target_position: "leader" | "challenger" | "laggard";
  strengths: string[];
  weaknesses: string[];
  findings: string[];
  recommendations: string[];
  /** True when competitors were found by the Phase 1.5 agentic loop (category-aware), false when from geo-search */
  agentic_reconciled?: boolean;
}

export interface RevenueImpactResult {
  grade: string;
  score: number;
  revenue_basis?: "unverified_estimate" | "verified_public" | "user_provided";
  show_revenue_dollars?: boolean;
  opportunity_assessment?: {
    impact_level: "high" | "medium" | "low" | "not_material" | "insufficient_evidence";
    confidence: "high" | "medium" | "low";
    evidence_basis: string[];
    summary: string;
  };
  total_monthly_leakage: {
    low: number;
    mid: number;
    high: number;
  };
  leaks: {
    category: string;
    description: string;
    low_estimate: number;
    mid_estimate: number;
    high_estimate: number;
    contributing_factors: string[];
    confidence?: number;                                      // 0-10 scale
    severity?: "critical" | "major" | "moderate" | "minor";
  }[];
  annual_impact: {
    low: number;
    mid: number;
    high: number;
  };
  roi_if_fixed: string;
  findings: string[];
  recommendations: string[];
}

export interface BusinessIntelligenceSignal {
  type:
  | "business_filing"
  | "recent_incorporation"
  | "permit_activity"
  | "expansion_signal"
  | "hiring_signal"
  | "ownership_change"
  | "domain_age"
  | "rapid_growth"
  | "new_location"
  | "funding_signal";
  headline: string;
  detail: string;
  source: string;
  confidence: "high" | "medium" | "low";
  date?: string;
  icon_hint: "building" | "file-text" | "trending-up" | "users" | "map-pin" | "briefcase" | "calendar" | "zap";
  signal_category?: SignalCategory;
  severity_score?: number;      // 1-10
  pattern_name?: string;        // e.g., "Demand–Execution Gap"
}

export interface BusinessIntelligenceResult {
  signals: BusinessIntelligenceSignal[];
  signal_count: number;
  top_signal?: string;
}

export type EnrichmentConfidence = "high" | "medium" | "low";
export type EnrichmentRelevance = "high" | "medium" | "low";
export type EnrichmentKind =
  | "entity"
  | "market"
  | "website"
  | "reputation"
  | "services"
  | "local_presence"
  | "competitive"
  | "news"
  | "warning";

export interface EnrichmentSource {
  label: string;
  url?: string;
  source_type: "api" | "public_web" | "business_website" | "google_places" | "derived";
  collected_at: string;
}

export interface BusinessEnrichmentFact {
  id: string;
  kind: EnrichmentKind;
  label: string;
  value: string;
  detail?: string;
  source: EnrichmentSource;
  confidence: EnrichmentConfidence;
  relevance: EnrichmentRelevance;
  why_it_matters?: string;
}

export interface AgentResearchFinding {
  claim: string;
  source: EnrichmentSource;
  confidence: EnrichmentConfidence;
  relevance: EnrichmentRelevance;
  evidence_excerpt?: string;
  why_it_matters: string;
  verified_status: "verified" | "inferred";
}

export interface BusinessEnrichmentResult {
  generated_at: string;
  facts: BusinessEnrichmentFact[];
  research_findings: AgentResearchFinding[];
  warnings: string[];
  coverage: {
    deterministic_sources_checked: string[];
    agent_searches_run: string[];
    pages_fetched: string[];
  };
}

/**
 * Executive Summary — v2 schema with small containers.
 * Every field has strict max word counts enforced by the prompt.
 * The UI renders these as visual components, not paragraphs.
 */
export interface ExecutiveSummaryData {
  verdict_tier: "strong" | "solid" | "moderate" | "developing" | "needs_attention" | "weak";
  /** MAX 8 WORDS — bold headline */
  verdict_headline: string;
  /** MAX 20 WORDS — one-line context */
  verdict_subline: string;
  /** Dashboard strip of 4-6 key metrics */
  key_stats: {
    label: string;   // MAX 3 WORDS
    value: string;   // MAX 6 CHARS
    sentiment: "positive" | "negative" | "neutral";
  }[];
  top_strength: {
    module: string;
    headline: string;  // MAX 10 WORDS
    detail: string;    // MAX 25 WORDS
  };
  critical_gap: {
    module: string;
    headline: string;  // MAX 10 WORDS
    detail: string;    // MAX 25 WORDS
  };
  /** Three punchy insights — MAX 25 WORDS each */
  three_insights: string[];
  /** MAX 25 WORDS */
  hidden_opportunity: string;
  path_forward: {
    priority: number;
    action: string;    // MAX 15 WORDS
    outcome: string;   // MAX 20 WORDS
  }[];
  /** MAX 25 WORDS */
  bottom_line: string;

  // Legacy compatibility fields (optional — old reports may have these)
  /** @deprecated Use verdict_headline */
  verdict_context?: string;
  /** @deprecated Use critical_gap */
  critical_weakness?: {
    module: string;
    metric: string;
    description: string;
  };
  /** @deprecated Use key_stats */
  key_data_points?: {
    label: string;
    value: string;
    sentiment: "positive" | "negative" | "neutral";
  }[];
  /** @deprecated Use three_insights */
  core_story?: string[];
  /** @deprecated Use bottom_line */
  closing_statement?: string;
}

/** Extract plain text from an executive summary (structured or legacy string). */
export function getExecutiveSummaryText(summary: ExecutiveSummaryData | string): string {
  if (typeof summary === "string") return summary;
  const parts: string[] = [];
  // v2 fields
  if (summary.verdict_headline) parts.push(summary.verdict_headline);
  if (summary.verdict_subline) parts.push(summary.verdict_subline);
  if (Array.isArray(summary.three_insights)) parts.push(...summary.three_insights);
  if (summary.hidden_opportunity) parts.push(summary.hidden_opportunity);
  if (summary.bottom_line) parts.push(summary.bottom_line);
  // Legacy fallback
  if (parts.length === 0) {
    if (summary.verdict_context) parts.push(summary.verdict_context);
    if (Array.isArray(summary.core_story)) parts.push(...summary.core_story);
    if (summary.closing_statement) parts.push(summary.closing_statement);
  }
  return parts.join(" ");
}

export type EvidenceModuleKey =
  | "gbp_health"
  | "review_sentiment"
  | "website_performance"
  | "tech_stack"
  | "social_presence"
  | "citation_consistency"
  | "competitive_comparison"
  | "revenue_impact"
  | "business_intelligence"
  | "business_enrichment";

export type EvidenceStatus =
  | "collected"
  | "unavailable"
  | "skipped"
  | "failed"
  | "not_implemented";

export interface EvidenceModule {
  key: EvidenceModuleKey;
  label: string;
  status: EvidenceStatus;
  source: string;
  reason?: string;
  settings_key?: string;
}

export interface EvidenceSummary {
  collected: number;
  unavailable: number;
  skipped: number;
  failed: number;
  not_implemented: number;
}

export interface EvidenceReport {
  generated_at: string;
  modules: EvidenceModule[];
  summary: EvidenceSummary;
}

export interface AuditResult {
  executive_summary: ExecutiveSummaryData | string; // Support legacy string summaries
  gbp_health?: GBPHealthResult;
  review_sentiment?: ReviewSentimentResult;
  website_performance?: WebsitePerformanceResult;
  tech_stack?: TechStackResult;
  social_presence?: SocialPresenceResult;
  citation_consistency?: CitationConsistencyResult;
  competitive_comparison?: CompetitiveComparisonResult;
  revenue_impact?: RevenueImpactResult;
  business_intelligence?: BusinessIntelligenceResult;
  business_enrichment?: BusinessEnrichmentResult;
  recommendations: Recommendation[];
  // AI deep analysis (Phase 2 frontier model output)
  ai_analysis?: AIAnalysisResult;
  enhanced_recommendations?: EnhancedRecommendation[];
  category_skill_used?: string;
  evidence?: EvidenceReport;
}

export interface Recommendation {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  module: string;
  estimated_revenue_impact?: string;
}

export interface ScoutWarmLead {
  business_name: string;
  intent_score: number;
  why_now: string;
  opening_angle: string;
  key_signals: string[];
}

// ---------------------------------------------------------------------------
// City Scout v2 — Market Intelligence Types
// ---------------------------------------------------------------------------

/** Market-level snapshot computed from scanned businesses */
export interface ScoutMarketSnapshot {
  businesses_scanned: number;
  avg_rating: number;
  avg_reviews: number;
  avg_response_rate: number | null;
  pct_mobile_issues: number;
  pct_missing_booking_cta: number;
  pct_low_photos: number;  // < 20 photos
  pct_no_website: number;
  median_household_income: number | null;
  income_tier: "high" | "moderate" | "value" | null;
}

/** Classification of businesses into opportunity buckets */
export type OpportunityClassification =
  | "market_leader"
  | "demand_rich_conversion_leaking"
  | "reputation_vulnerable"
  | "visibility_suppressed"
  | "low_visibility_underdog"
  | "high_arbitrage";

/** Opportunity distribution counts across classifications */
export interface ScoutOpportunityDistribution {
  market_leaders: number;
  demand_rich_conversion_leaking: number;
  reputation_vulnerable: number;
  visibility_suppressed: number;
  low_visibility_underdogs: number;
  high_arbitrage: number;
}

/** Demand, risk, and opportunity scores for opportunity cards */
export type SignalLevel = "high" | "medium" | "low";

/** Revenue opportunity band */
export type OpportunityEstimate = "low" | "moderate" | "high";

/** Sort modes for ranked opportunity list */
export type ScoutSortMode =
  | "highest_arbitrage"
  | "highest_revenue_leak"
  | "easiest_win"
  | "most_at_risk"
  | "default";

/** City-level Market Heat Index (0-100) */
export interface MarketHeatIndex {
  score: number;
  label: string;      // e.g., "High Opportunity", "Moderate", "Saturated"
  factors: string[];   // What drove the score
}

export interface ScoutResult {
  city: string;
  category: string;
  businesses: ScoutBusiness[];
  market_summary: string;
  avg_digital_maturity: number;
  total_scanned: number;
  /** AI-synthesized warm leads (businesses with strongest buying intent) */
  warm_leads?: ScoutWarmLead[];
  /** AI-generated market intelligence narrative */
  warm_leads_narrative?: string;

  // ── City Scout v2 fields ──────────────────────────────────────────
  /** Market-level stats computed from all scanned businesses */
  market_snapshot?: ScoutMarketSnapshot;
  /** Classification distribution across opportunity buckets */
  opportunity_distribution?: ScoutOpportunityDistribution;
  /** City-level opportunity index (0-100) */
  market_heat_index?: MarketHeatIndex;
  /** AI-generated city-level insights (3-5 strategic bullet points) */
  city_insights?: string[];
}

export interface ScoutBusiness {
  rank: number;
  business_name: string;
  address?: string;
  phone?: string;
  website?: string;
  google_rating?: number;
  review_count?: number;
  photos_count?: number;
  place_id?: string;
  priority_score: number;
  top_pain_hypothesis: string;
  estimated_revenue_leak?: string;
  mini_audit: Partial<AuditResult>;
  /** Quick intelligence signals gathered per-business during scout */
  intelligence?: BusinessIntelligenceResult;

  // ── City Scout v2 fields ──────────────────────────────────────────
  /** Demand level: high/medium/low based on rating + reviews + income proxy */
  demand_score?: SignalLevel;
  /** Execution risk: based on mobile score, response rate, CTA presence */
  execution_risk?: SignalLevel;
  /** Digital opportunity estimate band */
  opportunity_estimate?: OpportunityEstimate;
  /** AI-generated hook line — feels AI-derived, not scraped */
  hook_line?: string;
  /** Strategic classification badge */
  classification?: OpportunityClassification;
  /** Arbitrage score for sort (0-100) — higher = more opportunity */
  arbitrage_score?: number;
  /** Easiest-win score for sort (0-100) */
  ease_score?: number;
  /** Risk score for sort (0-100) — higher = more at risk */
  risk_score?: number;
}

export interface WidgetLead {
  id: string;
  user_id: string;
  visitor_email: string;
  visitor_name?: string;
  business_audited: string;
  report_id?: string;
  created_at: string;
  delivered_at?: string;
}

export interface ApiUsage {
  id: string;
  user_id: string;
  action: UsageAction;
  credits_consumed: number;
  stripe_metered_event_id?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// AI Deep Analysis types (produced by Phase 2 frontier model call)
// ---------------------------------------------------------------------------

/** Per-module AI findings produced by the frontier model */
export interface ModuleDeepAnalysis {
  expert_findings: string[];
  hidden_insights: string[];
  category_specific_observations: string[];
  score_override?: number | null;
  score_rationale?: string;
  recommendations: EnhancedRecommendation[];
  confidence: number;
}

/** Extended recommendation with outcome and timeframe */
export interface EnhancedRecommendation {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  expected_outcome: string;
  timeframe: string;
  module?: string;
}

/** Cross-module synthesis identifying causal chains and patterns */
export interface CrossModuleSynthesis {
  causal_chains: {
    chain: string;
    modules_involved: string[];
    business_impact: string;
    fix_sequence: string;
  }[];
  compounding_gaps: {
    description: string;
    combined_impact: string;
    involved_modules: string[];
  }[];
  hidden_strengths: {
    strength: string;
    leverage_opportunity: string;
  }[];
  contradictions: {
    observation: string;
    possible_explanation: string;
    investigation_needed: string;
  }[];
  competitive_narrative: string;
}

/** Prioritized action from the AI analysis */
export interface PriorityAction {
  priority: number;
  action: string;
  rationale: string;
  expected_roi: string;
  unlocks: string;
  timeframe: string;
}

/** Self-assessment of data quality by the AI */
export interface DataQualityAssessment {
  modules_with_rich_data: string[];
  modules_with_limited_data: string[];
  modules_with_no_data: string[];
  overall_confidence: number;
  caveats: string[];
}

/** Complete AI analysis result from Phase 2 */
export interface AIAnalysisResult {
  module_analyses: Record<string, ModuleDeepAnalysis>;
  cross_module_synthesis: CrossModuleSynthesis;
  priority_action_plan: PriorityAction[];
  data_quality_assessment: DataQualityAssessment;
  strategic_intelligence?: StrategicIntelligence;
}

// ---------------------------------------------------------------------------
// Strategic Intelligence types (produced by Phase 2.5 frontier model)
// ---------------------------------------------------------------------------

/** How the AI categorizes a business intelligence signal */
export type SignalCategory =
  | "demand_mismatch"      // Popular business + underperforming digital
  | "technical_debt"       // Outdated infrastructure holding back growth
  | "reputation_risk"      // Review trends or sentiment threatening trust
  | "authority_gap"        // Missing authority signals vs competitors
  | "visibility_loss"      // Declining or missing presence in key channels
  | "growth_signal"        // Positive momentum indicators
  | "competitive_threat";  // Competitor actions that threaten position

/** Digital maturity tier derived from tech stack + overall digital posture */
export type DigitalMaturityTier =
  | "foundational"   // Basic web presence, minimal digital tools
  | "developing"     // Some tools in place, significant gaps
  | "competent"      // Solid foundation, room for optimization
  | "advanced"       // Strong digital posture, minor gaps
  | "leading";       // Best-in-class for category

/** "Do nothing" cost projection — what inaction costs over time */
export interface DoNothingProjection {
  month_3_cumulative: number;
  month_6_cumulative: number;
  month_12_cumulative: number;
  narrative: string;  // MAX 50 words — what specifically degrades
}

/** Competitive gap analysis for a single competitor across key dimensions */
export interface CompetitiveGapRow {
  competitor_name: string;
  dimensions: Record<string, {
    target_value: string;
    competitor_value: string;
    gap: string;
    gap_severity: "critical" | "major" | "moderate" | "minor";
  }>;
}

/** Upside projection — what fixing a specific issue could yield */
export interface UpsideProjection {
  action: string;
  estimated_weeks: number;
  revenue_upside: string;
  secondary_benefits: string;
}

/** Complete strategic intelligence block — all fields agent-produced */
export interface StrategicIntelligence {
  contextual_anchors: {
    module: string;
    anchor: string;
    business_position: string;
  }[];
  digital_maturity_tier: DigitalMaturityTier;
  digital_maturity_rationale: string;
  sentiment_momentum: number;
  sentiment_momentum_label: string;
  do_nothing_projection: DoNothingProjection;
  competitive_gap_matrix: CompetitiveGapRow[];
  upside_projections: UpsideProjection[];
}

// Tier limits configuration
export const TIER_LIMITS: Record<Plan, {
  audits_per_month: number;
  scouts_per_month: number;
  scout_results: number;
  modules_available: number;
  api_calls_per_min: number;
  has_custom_direction: boolean;
  has_widget: boolean;
  has_white_label: boolean;
  report_formats: string[];
  competitive_limit: number;
  historical_months: number;
  team_members: number;
}> = {
  free: {
    audits_per_month: 3,
    scouts_per_month: 1,
    scout_results: 5,
    modules_available: 4,
    api_calls_per_min: 5,
    has_custom_direction: false,
    has_widget: false,
    has_white_label: false,
    report_formats: ["web"],
    competitive_limit: 0,
    historical_months: 0,
    team_members: 1,
  },
  starter: {
    audits_per_month: 15,
    scouts_per_month: 5,
    scout_results: 25,
    modules_available: 6,
    api_calls_per_min: 20,
    has_custom_direction: false,
    has_widget: false,
    has_white_label: false,
    report_formats: ["web", "email"],
    competitive_limit: 3,
    historical_months: 3,
    team_members: 1,
  },
  pro: {
    audits_per_month: 50,
    scouts_per_month: 15,
    scout_results: 50,
    modules_available: 8,
    api_calls_per_min: 50,
    has_custom_direction: true,
    has_widget: true,
    has_white_label: false,
    report_formats: ["web", "email", "pdf", "widget"],
    competitive_limit: 5,
    historical_months: 12,
    team_members: 3,
  },
  agency: {
    audits_per_month: 200,
    scouts_per_month: 999999,
    scout_results: 100,
    modules_available: 8,
    api_calls_per_min: 100,
    has_custom_direction: true,
    has_widget: true,
    has_white_label: true,
    report_formats: ["web", "email", "pdf", "widget"],
    competitive_limit: 10,
    historical_months: 24,
    team_members: 10,
  },
};
