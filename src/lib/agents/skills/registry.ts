/**
 * Category Skill registry — matches Google Places categories to skills
 * and converts skills into prompt sections for injection.
 */

import type { CategorySkill } from "./types";
import { restaurantSkill } from "./categories/restaurant";
import { dentalSkill } from "./categories/dental";
import { homeServicesSkill } from "./categories/home-services";
import { legalSkill } from "./categories/legal";
import { medicalSkill } from "./categories/medical";
import { beautySkill } from "./categories/beauty";
import { automotiveSkill } from "./categories/automotive";
import { defaultSkill } from "./categories/_default";

const SKILL_REGISTRY: CategorySkill[] = [
  restaurantSkill,
  dentalSkill,
  homeServicesSkill,
  legalSkill,
  medicalSkill,
  beautySkill,
  automotiveSkill,
];

/**
 * Match a Google Places category string to the best CategorySkill.
 * Falls back to defaultSkill if no match found.
 */
export function matchCategorySkill(category?: string): CategorySkill {
  if (!category) return defaultSkill;

  const normalized = category.toLowerCase().replace(/[_-]/g, " ");

  for (const skill of SKILL_REGISTRY) {
    for (const pattern of skill.category_patterns) {
      const normalizedPattern = pattern.toLowerCase().replace(/[_-]/g, " ");
      if (normalized.includes(normalizedPattern) || normalizedPattern.includes(normalized)) {
        return skill;
      }
    }
  }

  return defaultSkill;
}

/**
 * Convert a CategorySkill into an XML prompt section for injection
 * into the master analysis system prompt.
 */
export function buildSkillPromptSection(skill: CategorySkill): string {
  return `<category_expertise category="${skill.name}">

<review_intelligence>
CRITICAL SIGNALS TO LOOK FOR:
${skill.review_intelligence.critical_signals.map(s => `- ${s}`).join("\n")}

POSITIVE INDICATORS (what good actually looks like in ${skill.name}):
${skill.review_intelligence.positive_indicators.map(s => `- ${s}`).join("\n")}

NEGATIVE INDICATORS (what bad actually means in ${skill.name}):
${skill.review_intelligence.negative_indicators.map(s => `- ${s}`).join("\n")}

CUSTOMER DECISION FACTORS (what the customer is really asking):
${skill.review_intelligence.customer_decision_factors.map(s => `- ${s}`).join("\n")}
</review_intelligence>

<gbp_priorities>
CRITICAL ATTRIBUTES FOR ${skill.name.toUpperCase()}:
${skill.gbp_priorities.critical_attributes.map(s => `- ${s}`).join("\n")}

PHOTO EXPECTATIONS:
${skill.gbp_priorities.photo_expectations.map(s => `- ${s}`).join("\n")}

CATEGORY-SPECIFIC FEATURES TO CHECK:
${skill.gbp_priorities.category_features.map(s => `- ${s}`).join("\n")}
</gbp_priorities>

<website_conversion>
MUST-HAVE ELEMENTS FOR ${skill.name.toUpperCase()} WEBSITES:
${skill.website_conversion.must_have_elements.map(s => `- ${s}`).join("\n")}

TRUST SIGNALS:
${skill.website_conversion.trust_signals.map(s => `- ${s}`).join("\n")}

FRICTION POINTS TO IDENTIFY:
${skill.website_conversion.friction_points.map(s => `- ${s}`).join("\n")}
</website_conversion>

<tech_expectations>
EXPECTED TOOLS FOR ${skill.name.toUpperCase()}:
${skill.tech_expectations.expected_tools.map(s => `- ${s}`).join("\n")}

CRITICAL GAPS (each is a revenue leak):
${skill.tech_expectations.critical_gaps.map(s => `- ${s}`).join("\n")}

BASELINE: ${skill.tech_expectations.maturity_baseline}
</tech_expectations>

<social_priorities>
PLATFORM PRIORITY (ranked by importance for ${skill.name}):
${skill.social_priorities.platform_ranking.map((p, i) => `${i + 1}. ${p.platform} — ${p.why}`).join("\n")}

CONTENT EXPECTATIONS:
${skill.social_priorities.content_expectations.map(s => `- ${s}`).join("\n")}
</social_priorities>

<competitive_lens>
REAL DIFFERENTIATORS IN ${skill.name.toUpperCase()}:
${skill.competitive_lens.real_differentiators.map(s => `- ${s}`).join("\n")}

KEY COMPARISON METRICS:
${skill.competitive_lens.key_comparison_metrics.map(s => `- ${s}`).join("\n")}

BLIND SPOTS TO AVOID:
${skill.competitive_lens.blind_spots.map(s => `- ${s}`).join("\n")}
</competitive_lens>

<revenue_context>
AVERAGE CUSTOMER LTV: ${skill.revenue_context.avg_customer_ltv}

DIGITAL REVENUE DRIVERS:
${skill.revenue_context.digital_revenue_drivers.map(s => `- ${s}`).join("\n")}

CATEGORY-SPECIFIC LEAKAGE PATTERNS:
${skill.revenue_context.leakage_patterns.map(s => `- ${s}`).join("\n")}
</revenue_context>

<insider_knowledge>
USE THESE INSIGHTS TO MAKE THE REPORT FEEL LIKE IT WAS WRITTEN BY AN INDUSTRY INSIDER:
${skill.insider_knowledge.map(s => `- ${s}`).join("\n")}
</insider_knowledge>

</category_expertise>`;
}
