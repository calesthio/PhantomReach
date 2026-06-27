/**
 * Scoring Engine Tests
 *
 * Tests for src/lib/agents/scoring.ts — the weighted scoring system
 * that produces grades and overall scores from module results.
 */

import { describe, it, expect } from "vitest";

// Dynamic import to handle potential module resolution
const scoringPath = "../../src/lib/agents/scoring";

describe("Scoring Engine", () => {
  describe("scoreToGrade / scoreToGradeTier", () => {
    it("should grade 80+ as excellent/A", async () => {
      const { scoreToGrade } = await import(scoringPath);
      const result = scoreToGrade(85);
      expect(result.tier).toBe("excellent");
    });

    it("should grade 60-79 as good/B", async () => {
      const { scoreToGrade } = await import(scoringPath);
      const result = scoreToGrade(70);
      expect(result.tier).toBe("good");
    });

    it("should grade 40-59 as developing/C", async () => {
      const { scoreToGrade } = await import(scoringPath);
      const result = scoreToGrade(50);
      expect(result.tier).toBe("developing");
    });

    it("should grade below 40 as needs_attention/D", async () => {
      const { scoreToGrade } = await import(scoringPath);
      const result = scoreToGrade(25);
      expect(result.tier).toBe("needs_attention");
    });

    it("should handle boundary values correctly (exact 80)", async () => {
      const { scoreToGrade } = await import(scoringPath);
      const result = scoreToGrade(80);
      expect(result.tier).toBe("excellent");
    });

    it("should handle score of 0", async () => {
      const { scoreToGrade } = await import(scoringPath);
      const result = scoreToGrade(0);
      expect(result).toBeDefined();
      expect(result.tier).toBe("needs_attention");
    });

    it("should handle score of 100", async () => {
      const { scoreToGrade } = await import(scoringPath);
      const result = scoreToGrade(100);
      expect(result).toBeDefined();
      expect(result.tier).toBe("excellent");
    });

    it("should handle negative score without crashing", async () => {
      const { scoreToGrade } = await import(scoringPath);
      expect(() => scoreToGrade(-5)).not.toThrow();
    });

    it("should handle score > 100 without crashing", async () => {
      const { scoreToGrade } = await import(scoringPath);
      expect(() => scoreToGrade(150)).not.toThrow();
    });

    it("should use stable generic labels for module grades", async () => {
      const { moduleScoreToGradeLabel } = await import(scoringPath);
      expect(moduleScoreToGradeLabel(90)).toBe("Strong");
      expect(moduleScoreToGradeLabel(70)).toBe("Solid");
      expect(moduleScoreToGradeLabel(50)).toBe("Developing");
      expect(moduleScoreToGradeLabel(20)).toBe("Needs Attention");
    });
  });

  describe("calculateWeightedScore", () => {
    it("should return 0 for empty module scores", async () => {
      const { calculateWeightedScore } = await import(scoringPath);
      const result = calculateWeightedScore({});
      expect(result).toBe(0);
    });

    it("should calculate weighted average for single module", async () => {
      const { calculateWeightedScore } = await import(scoringPath);
      const result = calculateWeightedScore({ gbp_health: 75 });
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it("should calculate weighted average for all modules", async () => {
      const { calculateWeightedScore } = await import(scoringPath);
      const result = calculateWeightedScore({
        gbp_health: 72,
        review_sentiment: 68,
        website_performance: 55,
        tech_stack: 45,
        social_presence: 30,
        citation_consistency: 70,
        competitive_comparison: 50,
        revenue_impact: 45,
      });
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it("should handle Phase0 scoring adjustments", async () => {
      const { calculateWeightedScore } = await import(scoringPath);
      // Use scores far apart so the weight shift produces a visible rounded difference
      const baseScore = calculateWeightedScore({ gbp_health: 95, review_sentiment: 20 });

      const adjustedScore = calculateWeightedScore(
        { gbp_health: 95, review_sentiment: 20 },
        {
          scoring_context: {
            scoring_adjustments: [
              { module: "gbp_health", adjustment: "weight higher — critical for restaurants" },
            ],
          },
        }
      );

      // With gbp_health weighted higher (1.5→1.95), overall should shift toward 95
      expect(adjustedScore).toBeGreaterThan(baseScore);
    });

    it("should handle Phase0 with unrecognized module names gracefully", async () => {
      const { calculateWeightedScore } = await import(scoringPath);
      // This tests the key normalization — Phase0 might say "GBP Health" vs "gbp_health"
      expect(() =>
        calculateWeightedScore(
          { gbp_health: 75 },
          {
            scoring_context: {
              scoring_adjustments: [
                { module: "Nonexistent Module XYZ", adjustment: "weight higher" },
              ],
            },
          }
        )
      ).not.toThrow();
    });

    it("should return integer score (not float)", async () => {
      const { calculateWeightedScore } = await import(scoringPath);
      const result = calculateWeightedScore({
        gbp_health: 73,
        review_sentiment: 67,
      });
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe("scoreToLetter", () => {
    it("should return valid letter grades", async () => {
      const { scoreToLetter } = await import(scoringPath);
      expect(scoreToLetter(90)).toBe("A");
      expect(scoreToLetter(70)).toBe("B");
      expect(scoreToLetter(50)).toBe("C");
      expect(scoreToLetter(30)).toBe("D");
    });

    it("should handle 0 score", async () => {
      const { scoreToLetter } = await import(scoringPath);
      const result = scoreToLetter(0);
      expect(["A", "B", "C", "D", "F"]).toContain(result);
    });
  });
});
