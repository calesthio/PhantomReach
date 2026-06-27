/**
 * Category Skills — domain expertise per business vertical.
 * This is the product moat: knowledge a $400/hr vertical consultant has
 * that a generalist AI prompt never would.
 */

export interface CategorySkill {
  id: string;
  name: string;
  category_patterns: string[];

  review_intelligence: {
    critical_signals: string[];
    positive_indicators: string[];
    negative_indicators: string[];
    customer_decision_factors: string[];
  };

  gbp_priorities: {
    critical_attributes: string[];
    photo_expectations: string[];
    category_features: string[];
  };

  website_conversion: {
    must_have_elements: string[];
    trust_signals: string[];
    friction_points: string[];
  };

  tech_expectations: {
    expected_tools: string[];
    critical_gaps: string[];
    maturity_baseline: string;
  };

  social_priorities: {
    platform_ranking: { platform: string; why: string }[];
    content_expectations: string[];
  };

  competitive_lens: {
    real_differentiators: string[];
    key_comparison_metrics: string[];
    blind_spots: string[];
  };

  revenue_context: {
    avg_customer_ltv: string;
    digital_revenue_drivers: string[];
    leakage_patterns: string[];
  };

  insider_knowledge: string[];
}
