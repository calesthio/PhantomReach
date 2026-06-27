/**
 * Mock Factory Functions
 *
 * Creates realistic mock data for testing Phantom Reach modules.
 * Each factory returns a complete, valid object with optional overrides.
 */

import type {
  User,
  Report,
  AuditInput,
  ScoutInput,
  AuditResult,
  ScoutResult,
  ReportScores,
  GBPHealthResult,
  ReviewSentimentResult,
  WebsitePerformanceResult,
  TechStackResult,
  SocialPresenceResult,
  CitationConsistencyResult,
  CompetitiveComparisonResult,
  RevenueImpactResult,
  BusinessIntelligenceResult,
  BusinessIntelligenceSignal,
  ExecutiveSummaryData,
  Recommendation,
  ScoutBusiness,
  ScoutMarketSnapshot,
  Plan,
  ReportStatus,
  EnhancedRecommendation,
  AIAnalysisResult,
  ModuleDeepAnalysis,
  CrossModuleSynthesis,
  PriorityAction,
  DataQualityAssessment,
} from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

let _counter = 0;
function uid(prefix = "mock"): string {
  return `${prefix}_${Date.now()}_${++_counter}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: uid("user"),
    email: "test@phantomreach.io",
    name: "Test User",
    plan: "pro" as Plan,
    audit_credits_remaining: 50,
    scout_credits_remaining: 15,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function createMockAuditInput(
  overrides: Partial<AuditInput> = {}
): AuditInput {
  return {
    businessName: "Joe's Pizza",
    city: "Seattle",
    state: "WA",
    url: "https://joespizza.com",
    ...overrides,
  };
}

export function createMockScoutInput(
  overrides: Partial<ScoutInput> = {}
): ScoutInput {
  return {
    city: "Seattle",
    category: "restaurants",
    resultCount: 10,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Module Results
// ---------------------------------------------------------------------------

export function createMockGBPHealth(
  overrides: Partial<GBPHealthResult> = {}
): GBPHealthResult {
  return {
    grade: "B",
    score: 72,
    business_name: "Joe's Pizza",
    address: "123 Main St, Seattle, WA 98101",
    phone: "(206) 555-0100",
    website: "https://joespizza.com",
    category: "Pizza restaurant",
    rating: 4.2,
    review_count: 87,
    hours_complete: true,
    photos_count: 12,
    posts_recent: false,
    attributes_filled: 8,
    attributes_available: 15,
    completeness_pct: 72,
    findings: [
      "GBP profile is 72% complete",
      "No Google Posts in last 30 days",
    ],
    recommendations: [
      "Add Google Posts weekly",
      "Fill missing GBP attributes",
    ],
    ...overrides,
  };
}

export function createMockReviewSentiment(
  overrides: Partial<ReviewSentimentResult> = {}
): ReviewSentimentResult {
  return {
    grade: "B",
    score: 68,
    google_rating: 4.2,
    google_review_count: 87,
    yelp_rating: 3.8,
    yelp_review_count: 42,
    sentiment_breakdown: { positive: 65, neutral: 20, negative: 15 },
    top_praise_themes: ["great food", "friendly staff"],
    top_complaint_themes: ["slow service", "parking"],
    owner_response_rate: 35,
    review_velocity: 4.5,
    trend_direction: "stable",
    findings: ["Owner responds to 35% of reviews"],
    recommendations: ["Respond to all negative reviews within 24h"],
    ...overrides,
  };
}

export function createMockWebsitePerformance(
  overrides: Partial<WebsitePerformanceResult> = {}
): WebsitePerformanceResult {
  return {
    grade: "C",
    score: 55,
    url: "https://joespizza.com",
    performance_score: 45,
    accessibility_score: 72,
    seo_score: 68,
    best_practices_score: 80,
    core_web_vitals: {
      lcp: 3200,
      inp: 250,
      cls: 0.15,
      lcp_pass: false,
      inp_pass: false,
      cls_pass: false,
    },
    mobile_friendly: false,
    ssl_valid: true,
    page_weight_mb: 3.2,
    has_schema_markup: false,
    has_clear_cta: true,
    findings: ["LCP is 3.2s (threshold: 2.5s)"],
    recommendations: ["Optimize images to reduce LCP"],
    ...overrides,
  };
}

export function createMockTechStack(
  overrides: Partial<TechStackResult> = {}
): TechStackResult {
  return {
    grade: "C",
    score: 45,
    digital_maturity_score: 40,
    cms: "WordPress",
    analytics: ["Google Analytics"],
    marketing_automation: [],
    booking_system: undefined,
    chat_widget: undefined,
    payment_processor: undefined,
    technology_gaps: ["No booking system", "No chat widget", "No CRM"],
    findings: ["Using WordPress with GA4"],
    recommendations: ["Add online booking system"],
    ...overrides,
  };
}

export function createMockSocialPresence(
  overrides: Partial<SocialPresenceResult> = {}
): SocialPresenceResult {
  return {
    grade: "D",
    score: 30,
    platforms: [
      {
        name: "Facebook",
        url: "https://facebook.com/joespizza",
        found: true,
        follower_count: 850,
        post_frequency: "monthly",
        is_active: false,
      },
      {
        name: "Instagram",
        found: false,
        is_active: false,
      },
    ],
    platforms_found: 1,
    platforms_active: 0,
    total_following: 850,
    nap_consistent: true,
    findings: ["Only 1 social platform found"],
    recommendations: ["Create Instagram profile"],
    ...overrides,
  };
}

export function createMockCitationConsistency(
  overrides: Partial<CitationConsistencyResult> = {}
): CitationConsistencyResult {
  return {
    grade: "B",
    score: 70,
    directories: [
      {
        name: "Yelp",
        status: "found_correct",
        nap_match: true,
        url: "https://yelp.com/biz/joes-pizza",
        issues: [],
      },
      {
        name: "Yellow Pages",
        status: "found_inconsistent",
        nap_match: false,
        issues: ["Phone number mismatch"],
      },
      {
        name: "BBB",
        status: "not_found",
        nap_match: false,
        issues: ["Not listed"],
      },
    ],
    total_found: 2,
    total_correct: 1,
    total_inconsistent: 1,
    total_missing: 1,
    findings: ["1 directory has inconsistent NAP"],
    recommendations: ["Fix phone number on Yellow Pages"],
    is_mock: true,
    ...overrides,
  };
}

export function createMockCompetitiveComparison(
  overrides: Partial<CompetitiveComparisonResult> = {}
): CompetitiveComparisonResult {
  return {
    grade: "C",
    score: 50,
    target_business: "Joe's Pizza",
    competitors: [
      {
        name: "Mario's Pizzeria",
        rating: 4.5,
        review_count: 200,
        website: "https://mariospizzeria.com",
        estimated_position: "leader",
      },
      {
        name: "Pizza Palace",
        rating: 3.9,
        review_count: 65,
        website: "https://pizzapalace.com",
        estimated_position: "laggard",
      },
    ],
    target_position: "challenger",
    strengths: ["Good food quality"],
    weaknesses: ["Fewer reviews than leader"],
    findings: ["Positioned as challenger in local market"],
    recommendations: ["Increase review volume to compete"],
    ...overrides,
  };
}

export function createMockRevenueImpact(
  overrides: Partial<RevenueImpactResult> = {}
): RevenueImpactResult {
  return {
    grade: "C",
    score: 45,
    total_monthly_leakage: { low: 1200, mid: 2800, high: 4500 },
    leaks: [
      {
        category: "Search Visibility",
        description: "Missing from local pack results",
        low_estimate: 500,
        mid_estimate: 1200,
        high_estimate: 2000,
        contributing_factors: ["Low review count", "Incomplete GBP"],
      },
      {
        category: "Website Conversion",
        description: "No online ordering or booking",
        low_estimate: 700,
        mid_estimate: 1600,
        high_estimate: 2500,
        contributing_factors: ["No booking system", "Slow page speed"],
      },
    ],
    annual_impact: { low: 14400, mid: 33600, high: 54000 },
    roi_if_fixed: "8-12x within 6 months",
    findings: ["Estimated $2,800/mo revenue leakage"],
    recommendations: ["Prioritize GBP optimization for quickest ROI"],
    ...overrides,
  };
}

export function createMockBusinessIntelligence(
  overrides: Partial<BusinessIntelligenceResult> = {}
): BusinessIntelligenceResult {
  return {
    signals: [
      {
        type: "domain_age",
        headline: "Domain registered 8 years ago",
        detail: "Established online presence since 2018",
        source: "WHOIS",
        confidence: "high",
        icon_hint: "calendar",
      },
      {
        type: "hiring_signal",
        headline: "Job posting detected",
        detail: "Looking for delivery drivers — possible expansion",
        source: "Indeed",
        confidence: "medium",
        icon_hint: "users",
      },
    ],
    signal_count: 2,
    top_signal: "Job posting detected — possible expansion",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

export function createMockExecutiveSummary(
  overrides: Partial<ExecutiveSummaryData> = {}
): ExecutiveSummaryData {
  return {
    verdict_tier: "moderate",
    verdict_headline: "Solid Foundation, Digital Gaps Holding Back Growth",
    verdict_subline:
      "Joe's Pizza has loyal customers but leaks revenue through poor digital execution.",
    key_stats: [
      { label: "Score", value: "58/100", sentiment: "neutral" },
      { label: "Rating", value: "4.2★", sentiment: "positive" },
      { label: "Reviews", value: "87", sentiment: "neutral" },
      { label: "Leak/mo", value: "$2.8k", sentiment: "negative" },
    ],
    top_strength: {
      module: "Reviews",
      headline: "Strong customer loyalty and satisfaction",
      detail: "4.2 stars with consistent praise for food quality and service.",
    },
    critical_gap: {
      module: "Website",
      headline: "Slow website losing mobile visitors",
      detail:
        "3.2s load time fails Core Web Vitals, no online ordering available.",
    },
    three_insights: [
      "Reviews praise food quality but slow service hurts conversion.",
      "Competitors outpace in digital maturity with booking systems.",
      "Social media is nearly dormant — missing engagement channel.",
    ],
    hidden_opportunity:
      "Adding online ordering could capture $1,600/mo in missed delivery revenue.",
    path_forward: [
      {
        priority: 1,
        action: "Fix website speed and add online ordering",
        outcome: "Capture $1,600/mo in delivery revenue immediately",
      },
      {
        priority: 2,
        action: "Launch review response campaign",
        outcome: "Improve owner response rate from 35% to 90%",
      },
    ],
    bottom_line:
      "Joe's Pizza has the product — it needs the digital infrastructure to match.",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export function createMockRecommendation(
  overrides: Partial<Recommendation> = {}
): Recommendation {
  return {
    title: "Optimize website loading speed",
    description:
      "Current LCP of 3.2s exceeds the 2.5s threshold. Compress images and enable caching.",
    impact: "high",
    effort: "medium",
    module: "Website Performance",
    ...overrides,
  };
}

export function createMockEnhancedRecommendation(
  overrides: Partial<EnhancedRecommendation> = {}
): EnhancedRecommendation {
  return {
    title: "Add online ordering system",
    description: "Integrate with DoorDash or build native ordering page.",
    impact: "high",
    effort: "medium",
    expected_outcome: "Capture estimated $1,600/mo in delivery revenue",
    timeframe: "2-4 weeks",
    module: "Tech Stack",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AI Analysis
// ---------------------------------------------------------------------------

export function createMockModuleDeepAnalysis(
  overrides: Partial<ModuleDeepAnalysis> = {}
): ModuleDeepAnalysis {
  return {
    expert_findings: ["Strong review sentiment but declining velocity"],
    hidden_insights: ["Competitor review volume growing 2x faster"],
    category_specific_observations: ["Pizza restaurants average 150+ reviews"],
    score_override: null,
    score_rationale: "Score aligns with data",
    recommendations: [createMockEnhancedRecommendation()],
    confidence: 0.82,
    ...overrides,
  };
}

export function createMockAIAnalysis(
  overrides: Partial<AIAnalysisResult> = {}
): AIAnalysisResult {
  return {
    module_analyses: {
      gbp_health: createMockModuleDeepAnalysis(),
      review_sentiment: createMockModuleDeepAnalysis(),
    },
    cross_module_synthesis: {
      causal_chains: [
        {
          chain: "Incomplete GBP → Lower visibility → Fewer reviews → Lower ranking",
          modules_involved: ["gbp_health", "review_sentiment"],
          business_impact: "Estimated 30% fewer new customer discoveries",
          fix_sequence: "Complete GBP first, then launch review campaign",
        },
      ],
      compounding_gaps: [],
      hidden_strengths: [
        {
          strength: "High review quality despite low volume",
          leverage_opportunity: "Use in marketing materials",
        },
      ],
      contradictions: [],
      competitive_narrative: "Positioned as a quality challenger in a crowded market.",
    },
    priority_action_plan: [
      {
        priority: 1,
        action: "Complete GBP profile",
        rationale: "Fastest path to improved visibility",
        expected_roi: "15-20% more discovery searches within 30 days",
        unlocks: "Eligible for local pack results",
        timeframe: "1 week",
      },
    ],
    data_quality_assessment: {
      modules_with_rich_data: ["gbp_health", "review_sentiment"],
      modules_with_limited_data: ["social_presence"],
      modules_with_no_data: [],
      overall_confidence: 0.78,
      caveats: ["Social data is estimated, not verified"],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Full Audit Result
// ---------------------------------------------------------------------------

export function createMockAuditResult(
  overrides: Partial<AuditResult> = {}
): AuditResult {
  return {
    executive_summary: createMockExecutiveSummary(),
    gbp_health: createMockGBPHealth(),
    review_sentiment: createMockReviewSentiment(),
    website_performance: createMockWebsitePerformance(),
    tech_stack: createMockTechStack(),
    social_presence: createMockSocialPresence(),
    citation_consistency: createMockCitationConsistency(),
    competitive_comparison: createMockCompetitiveComparison(),
    revenue_impact: createMockRevenueImpact(),
    business_intelligence: createMockBusinessIntelligence(),
    recommendations: [
      createMockRecommendation(),
      createMockRecommendation({
        title: "Create Instagram profile",
        module: "Social Presence",
        impact: "medium",
      }),
    ],
    ai_analysis: createMockAIAnalysis(),
    enhanced_recommendations: [createMockEnhancedRecommendation()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Report Scores
// ---------------------------------------------------------------------------

export function createMockReportScores(
  overrides: Partial<ReportScores> = {}
): ReportScores {
  return {
    overall_grade: "C",
    overall_score: 58,
    module_grades: {
      gbp_health: "B",
      review_sentiment: "B",
      website_performance: "C",
      tech_stack: "C",
      social_presence: "D",
      citation_consistency: "B",
      competitive_position: "C",
      revenue_impact: "C",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Full Report
// ---------------------------------------------------------------------------

export function createMockReport(overrides: Partial<Report> = {}): Report {
  return {
    id: uid("report"),
    user_id: uid("user"),
    type: "audit",
    status: "completed" as ReportStatus,
    input: createMockAuditInput(),
    result: createMockAuditResult(),
    scores: createMockReportScores(),
    is_widget_generated: false,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scout Business
// ---------------------------------------------------------------------------

export function createMockScoutBusiness(
  overrides: Partial<ScoutBusiness> = {}
): ScoutBusiness {
  return {
    rank: 1,
    business_name: "Downtown Dental",
    address: "456 Broadway, Seattle, WA",
    phone: "(206) 555-0200",
    website: "https://downtowndental.com",
    google_rating: 3.8,
    review_count: 45,
    photos_count: 5,
    place_id: "ChIJ_mock_place_id",
    priority_score: 78,
    top_pain_hypothesis: "Low review count and no booking system",
    estimated_revenue_leak: "$2,100-$4,800/mo",
    mini_audit: {},
    demand_score: "high",
    execution_risk: "high",
    opportunity_estimate: "high",
    hook_line: "High demand area with 3.8★ rating — booking system gap is costing them.",
    classification: "demand_rich_conversion_leaking",
    arbitrage_score: 82,
    ease_score: 65,
    risk_score: 70,
    ...overrides,
  };
}

export function createMockScoutResult(
  overrides: Partial<ScoutResult> = {}
): ScoutResult {
  return {
    city: "Seattle",
    category: "dentists",
    businesses: [
      createMockScoutBusiness(),
      createMockScoutBusiness({
        rank: 2,
        business_name: "Smile Center",
        google_rating: 4.5,
        review_count: 120,
        priority_score: 45,
      }),
    ],
    market_summary: "Seattle dental market has moderate competition.",
    avg_digital_maturity: 42,
    total_scanned: 10,
    warm_leads: [
      {
        business_name: "Downtown Dental",
        intent_score: 85,
        why_now: "Recent hiring signal + low digital maturity",
        opening_angle: "Their competitors have booking systems — they don't.",
        key_signals: ["hiring_signal", "no_booking"],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Edge Case Factories (for adversarial testing)
// ---------------------------------------------------------------------------

/** Audit result with all modules undefined (minimum viable) */
export function createEmptyAuditResult(): AuditResult {
  return {
    executive_summary: "No data available.",
    recommendations: [],
  };
}

/** Audit result with only a string executive summary (legacy format) */
export function createLegacyAuditResult(): AuditResult {
  return {
    executive_summary: "This is a legacy text-only executive summary from an older report version.",
    recommendations: [createMockRecommendation()],
    gbp_health: createMockGBPHealth(),
  };
}

/** Report with failed status and no result */
export function createFailedReport(): Report {
  return createMockReport({
    status: "failed",
    result: undefined,
    scores: undefined,
  });
}

/** User with zero credits */
export function createExhaustedUser(): User {
  return createMockUser({
    plan: "free",
    audit_credits_remaining: 0,
    scout_credits_remaining: 0,
  });
}

/** Scout business with all optional fields undefined */
export function createBareScoutBusiness(): ScoutBusiness {
  return {
    rank: 1,
    business_name: "Unknown Business",
    priority_score: 0,
    top_pain_hypothesis: "",
    mini_audit: {},
  };
}
