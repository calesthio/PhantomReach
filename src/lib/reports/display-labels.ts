const MODULE_LABELS: Record<string, string> = {
  gbp_health: "Google profile",
  review_sentiment: "Reviews",
  website_performance: "Website",
  tech_stack: "Tech stack",
  social_presence: "Social",
  citation_consistency: "Directories",
  competitive_comparison: "Competition",
  competitive_position: "Competition",
  revenue_impact: "Business impact",
};

export function humanizeModuleKey(value: string | undefined): string {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  if (MODULE_LABELS[normalized]) return MODULE_LABELS[normalized];

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function humanizeModuleReferences(text: string | undefined): string {
  if (!text) return "";

  const withModuleLabels = Object.entries(MODULE_LABELS).reduce((current, [key, label]) => {
    return current.replace(new RegExp(`\\b${key}\\b`, "gi"), label);
  }, text);

  return withModuleLabels
    .replace(/\brevenue_basis\b/gi, "revenue basis")
    .replace(/\bunverified_estimate\b/gi, "unverified estimate")
    .replace(/\bverified_public\b/gi, "verified public")
    .replace(/\buser_provided\b/gi, "user provided");
}

export function cleanCategorySkillLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const clean = value.replace(/^dynamic:/i, "").trim();
  const lower = clean.toLowerCase();

  if (lower.includes("dent")) return "Dental practice";
  if (lower.includes("ice cream")) return "Ice cream shop";
  if (lower.includes("restaurant") || lower.includes("cafe")) return "Restaurant";
  if (lower.includes("medical") || lower.includes("healthcare")) return "Healthcare practice";
  if (lower.includes("legal") || lower.includes("law")) return "Law firm";
  if (lower.includes("home service") || lower.includes("contractor")) return "Home services";

  if (clean.length > 34 || /^independent\b/i.test(clean)) return "Local business";
  return clean;
}

export function priorityPlanSubtitle(showRevenueDollars: boolean): string {
  if (showRevenueDollars) {
    return "Sequenced actions ranked by ROI and execution order.";
  }

  return "Sequenced actions ranked by expected business impact and ease of execution.";
}
