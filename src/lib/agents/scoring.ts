/**
 * Context-Aware Scoring System
 *
 * Replaces the universal A-F grading with business-type-aware scoring.
 * Uses Phase 0 understanding to weight modules and apply appropriate labels.
 *
 * Key principles:
 * 1. No "F" grades — hostile language doesn't help anyone
 * 2. Grade labels adapt to business type (from Phase 0)
 * 3. Module weights vary by business type
 * 4. Scores are calibrated to what's realistic for the business type
 */

import type { Phase0Understanding } from "./prompts/phase0-understand";

// ---------------------------------------------------------------------------
// Grade tiers (replaces A-F)
// ---------------------------------------------------------------------------

export type GradeTier = "excellent" | "good" | "developing" | "needs_attention";

export interface GradeResult {
  tier: GradeTier;
  label: string;       // Human-readable label (from Phase 0 or default)
  score: number;       // 0-100 numeric score
  emoji: string;       // Visual indicator
  color: string;       // CSS color hint
}

const DEFAULT_LABELS: Record<GradeTier, string> = {
  excellent: "Strong",
  good: "Solid",
  developing: "Developing",
  needs_attention: "Needs Attention",
};

const TIER_EMOJI: Record<GradeTier, string> = {
  excellent: "🟢",
  good: "🔵",
  developing: "🟡",
  needs_attention: "🟠",
};

const TIER_COLORS: Record<GradeTier, string> = {
  excellent: "#22c55e",
  good: "#3b82f6",
  developing: "#eab308",
  needs_attention: "#f97316",
};

// ---------------------------------------------------------------------------
// Score to grade conversion
// ---------------------------------------------------------------------------

/**
 * Convert a numeric score to a grade tier.
 * Thresholds can be adjusted by Phase 0 understanding.
 */
export function scoreToGradeTier(score: number): GradeTier {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "developing";
  return "needs_attention";
}

/**
 * Convert a numeric score to a full grade result.
 * Uses Phase 0 labels if available, otherwise defaults.
 */
export function scoreToGrade(
  score: number,
  phase0?: Phase0Understanding | null
): GradeResult {
  const tier = scoreToGradeTier(score);

  const labels = phase0?.scoring_context?.grade_labels || DEFAULT_LABELS;
  const label = labels[tier] || DEFAULT_LABELS[tier];

  return {
    tier,
    label,
    score,
    emoji: TIER_EMOJI[tier],
    color: TIER_COLORS[tier],
  };
}

export function moduleScoreToGradeLabel(score: number): string {
  return DEFAULT_LABELS[scoreToGradeTier(score)];
}

/**
 * Legacy compatibility: convert score to a single-character grade.
 * Used only where the old A-F system is expected in existing UI.
 * Maps our tiers to less hostile letters.
 */
export function scoreToLetter(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D"; // Never F — "D" is the lowest
}

// ---------------------------------------------------------------------------
// Weighted overall score
// ---------------------------------------------------------------------------

interface ModuleScore {
  module: string;
  score: number;
  weight: number;
}

/**
 * Default module weights when Phase 0 doesn't provide adjustments.
 * GBP and Reviews are weighted higher because they have the most
 * direct impact on local business discovery.
 */
const DEFAULT_WEIGHTS: Record<string, number> = {
  gbp_health: 1.5,
  review_sentiment: 1.5,
  website_performance: 1.2,
  tech_stack: 0.8,
  social_presence: 0.8,
  citation_consistency: 1.0,
  competitive_comparison: 1.0,
  revenue_impact: 1.2,
};

/**
 * Calculate a weighted overall score across all modules.
 * Phase 0 scoring adjustments can modify weights.
 */
export function calculateWeightedScore(
  moduleScores: Record<string, number | undefined>,
  phase0?: Phase0Understanding | null
): number {
  const weights = { ...DEFAULT_WEIGHTS };

  // Apply Phase 0 scoring adjustments
  if (phase0?.scoring_context?.scoring_adjustments) {
    for (const adj of phase0.scoring_context.scoring_adjustments) {
      const moduleKey = adj.module.toLowerCase().replace(/\s+/g, "_");
      // Interpret adjustments: "weight higher", "weight lower", "de-emphasize"
      const adjText = adj.adjustment.toLowerCase();
      if (adjText.includes("higher") || adjText.includes("more important") || adjText.includes("increase")) {
        weights[moduleKey] = (weights[moduleKey] || 1.0) * 1.3;
      } else if (adjText.includes("lower") || adjText.includes("less important") || adjText.includes("decrease") || adjText.includes("de-emphasize")) {
        weights[moduleKey] = (weights[moduleKey] || 1.0) * 0.7;
      }
    }
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [module, score] of Object.entries(moduleScores)) {
    if (score === undefined || score === null) continue;
    const weight = weights[module] || 1.0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}
