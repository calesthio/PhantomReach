"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradeBadge } from "@/components/reports/grade-badge";
import { ScoreRing } from "@/components/reports/score-ring";
import type { ExecutiveSummaryData, ReportScores } from "@/lib/db/types";
import { ModuleCard } from "@/components/reports/module-card";
import { IntelligenceCard } from "@/components/reports/intelligence-card";
import { AuditLoading } from "@/components/reports/audit-loading";
import { AIAnalysisCard } from "@/components/reports/ai-analysis-card";
import { StrategicIntelligenceCard } from "@/components/reports/strategic-intelligence-card";
import { BusinessContextCard } from "@/components/reports/business-context-card";
import { repairMojibakeText, repairMojibakeValue } from "@/lib/text/repair";
import { filterClientFacingReportItems } from "@/lib/reports/content-quality";
import { sanitizeAuditResultContent } from "@/lib/reports/content-contract";
import { buildAuditCoverageSummary } from "@/lib/reports/coverage";
import {
  filterUnverifiedRevenueStats,
  shouldShowRevenueDollars,
  stripDollarClaims,
  visibleRevenueFindings,
} from "@/lib/reports/revenue-display";
import { humanizeModuleKey, humanizeModuleReferences } from "@/lib/reports/display-labels";
import {
  MapPin, Star, Globe, Cpu, Users, BookOpen, Trophy, DollarSign,
  Loader2, AlertCircle, ArrowLeft, Download, Share2, CheckCircle2, XCircle,
  FileText, Presentation, Sheet, ChevronDown, Zap, TrendingUp, AlertOctagon, Target, Sparkles,
  Activity, Settings
} from "lucide-react";
import Link from "next/link";
import type { Report, AuditResult, AuditInput, Recommendation } from "@/lib/db/types";

function formatCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Maps overall score to an interpretability tier label + color */
function getScoreTier(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Top Tier", color: "text-emerald-400" };
  if (score >= 70) return { label: "Competitive", color: "text-blue-300" };
  if (score >= 55) return { label: "At Risk", color: "text-amber-300" };
  return { label: "Critical", color: "text-red-400" };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Expert Findings — surfaces per-module AI deep analysis                    */
/* ─────────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────── */
/*  AI-first module content resolver                                          */
/*                                                                             */
/*  Priority:                                                                  */
/*    1. AI expert_findings + AI recommendations (from Phase 2 analysis)       */
/*    2. Raw module findings + recommendations (fallback, shows isEstimated)   */
/* ─────────────────────────────────────────────────────────────────────────── */

function getModuleContent(
  moduleKey: string,
  rawFindings: string[],
  rawRecommendations: string[],
  rawScore: number,
  aiAnalysis?: AuditResult["ai_analysis"]
): {
  findings: string[];
  recommendations: string[];
  score: number;
  isEstimated: boolean;
} {
  const aiModule = aiAnalysis?.module_analyses?.[moduleKey];

  // Combine expert_findings + hidden_insights for a richer primary finding list
  const aiFindings = filterClientFacingReportItems([
    ...(aiModule?.expert_findings ?? []),
    ...(aiModule?.hidden_insights ?? []),
    ...(aiModule?.category_specific_observations ?? []),
  ]);

  const aiRecs = (aiModule?.recommendations ?? []).map(
    (r: { title?: string; description?: string }) => r.title || r.description || ""
  ).filter(Boolean);
  const clientFacingAiRecs = filterClientFacingReportItems(aiRecs);

  const hasAI = aiFindings.length > 0;

  return {
    findings: hasAI ? aiFindings : filterClientFacingReportItems(rawFindings),
    recommendations: hasAI && clientFacingAiRecs.length > 0 ? clientFacingAiRecs : filterClientFacingReportItems(rawRecommendations),
    score: aiModule?.score_override ?? rawScore,
    isEstimated: !hasAI,
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Module grades config                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

const moduleGradesMeta: { key: keyof ReportScores["module_grades"]; label: string; icon: typeof MapPin }[] = [
  { key: "gbp_health", label: "GBP", icon: MapPin },
  { key: "review_sentiment", label: "Reviews", icon: Star },
  { key: "website_performance", label: "Website", icon: Globe },
  { key: "tech_stack", label: "Tech", icon: Cpu },
  { key: "social_presence", label: "Social", icon: Users },
  { key: "citation_consistency", label: "Citations", icon: BookOpen },
  { key: "competitive_position", label: "Compete", icon: Trophy },
  { key: "revenue_impact", label: "Revenue", icon: DollarSign },
];

/** Module grade badge colors — used on the dark purple hero, so these use bright text on translucent bg. */
const gradeColor: Record<string, string> = {
  // New context-aware grade labels
  Strong: "bg-green-500/20 text-green-300 border-green-400/30",
  Solid: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  Developing: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  "Needs Attention": "bg-orange-500/20 text-orange-300 border-orange-400/30",
  // Legacy A-F grades
  A: "bg-green-500/20 text-green-300 border-green-400/30",
  B: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  C: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  D: "bg-orange-500/20 text-orange-300 border-orange-400/30",
  F: "bg-red-500/20 text-red-300 border-red-400/30",
};

// Removed boldNumbers helper as per user request to drop highlight splitting

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Executive Summary Section                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function ExecutiveSummarySection({ scores, result }: { scores: ReportScores; result: AuditResult }) {
  const summaryData = result.executive_summary;
  const isStructured = typeof summaryData === "object" && summaryData !== null && "verdict_tier" in summaryData;
  const s = isStructured ? (summaryData as ExecutiveSummaryData) : null;

  // Revenue impact for the callout
  const revMid = result.revenue_impact?.total_monthly_leakage?.mid;
  const revAnnual = result.revenue_impact?.annual_impact?.mid;
  const showRevenueDollars = shouldShowRevenueDollars(result.revenue_impact);

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      {/* ── Hero bar: Score ring + verdict + module grades ─────────────── */}
      <div className="bg-[#4d3399] border-b border-[#3e297a] text-white px-6 py-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Score ring */}
          <div className="flex-shrink-0 text-center">
            <ScoreRing score={scores.overall_score} grade={scores.overall_grade} size={150} variant="dark" />
            {(() => {
              const tier = getScoreTier(scores.overall_score);
              return (
                <p className={`text-xs font-semibold tracking-widest uppercase mt-2 ${tier.color}`}>
                  {tier.label}
                </p>
              );
            })()}
          </div>

          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold tracking-tight mb-1 animate-fade-in-up text-white">
              {s?.verdict_headline || "Overall Executive Summary & Score"}
            </h2>
            {s && (
              <p className="text-purple-100 text-sm leading-relaxed max-w-xl animate-fade-in-up stagger-1">
                {s.verdict_subline || s.verdict_context || ""}
              </p>
            )}

            {/* ── Module grades strip ──────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 mt-5 animate-fade-in-up stagger-2">
              {moduleGradesMeta.map(({ key, label, icon: Icon }) => {
                const grade = scores.module_grades[key];
                if (!grade) return null;
                const displayLabel = key === "revenue_impact" && !showRevenueDollars ? "Impact" : label;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${gradeColor[grade] || gradeColor.F}`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{displayLabel}</span>
                    <span className="font-bold">{grade}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Revenue impact callout (right side) ────────────────────── */}
          {showRevenueDollars && revMid && revMid > 0 && (
            <div className="flex-shrink-0 text-center bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-6 py-4 animate-fade-in-up stagger-3">
              <p className="text-xs text-white/60 font-medium uppercase tracking-wider mb-1">Est. Revenue Leak</p>
              <p className="text-3xl font-bold text-amber-300 tracking-tight">
                {formatCurrency(revMid)}
                <span className="text-sm font-normal text-amber-300/70">/mo</span>
              </p>
              {revAnnual && (
                <p className="text-xs text-white/50 mt-1">~{formatCurrency(revAnnual)} annually</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Body: Structured summary OR legacy text ────────────────────── */}
      <CardContent className="py-6">
        {s ? (
          <div className="space-y-8">
            {/* ── Section 1: Key Metrics at a Glance ────────────────────── */}
            {(() => {
              const statsData = filterUnverifiedRevenueStats(s.key_stats || s.key_data_points || [], result.revenue_impact);
              if (!Array.isArray(statsData) || statsData.length === 0) return null;
              return (
                <div className="animate-fade-in-up stagger-1">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5" /> Key Metrics at a Glance
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {statsData.map((dp: any, i: number) => (
                      <div
                        key={i}
                        className={`rounded-lg border px-3 py-2.5 text-center ${dp.sentiment === "positive"
                          ? "bg-emerald-50/60 border-emerald-200/60"
                          : dp.sentiment === "negative"
                            ? "bg-red-50/60 border-red-200/60"
                            : "bg-slate-50 border-slate-200/60"
                          }`}
                      >
                        <p className={`text-lg font-bold tracking-tight ${dp.sentiment === "positive" ? "text-emerald-700"
                          : dp.sentiment === "negative" ? "text-red-700"
                            : "text-slate-700"
                          }`}>
                          {repairMojibakeText(String(dp.value))}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                          {repairMojibakeText(String(dp.label))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Section 2: What the Data Reveals ──────────────────────── */}
            {(() => {
              const insights = s.three_insights || s.core_story || [];
              if (!Array.isArray(insights) || insights.length === 0) return null;
              return (
                <div className="animate-fade-in-up stagger-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> What the Data Reveals
                  </h3>
                  <div className="space-y-2.5">
                    {insights.map((paragraph: string, i: number) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-slate-300 flex-shrink-0" />
                        <p className="text-sm text-slate-600 leading-relaxed">{repairMojibakeText(paragraph)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="border-t border-slate-100" />

            {/* ── Section 3: Strengths & Weaknesses ─────────────────────── */}
            {(() => {
              const strength = s.top_strength;
              const gap = s.critical_gap || s.critical_weakness;
              if (!strength && !gap) return null;
              return (
                <div className="animate-fade-in-up stagger-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5" /> Strengths & Weaknesses
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {strength && (
                      <div className="flex gap-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-emerald-100 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Top Strength</div>
                          <h4 className="font-semibold text-slate-900 mt-0.5">
                            {humanizeModuleKey(strength.module)}
                            {((strength as any).headline || (strength as any).metric) && (
                              <span className="ml-2 text-sm font-normal text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                {repairMojibakeText((strength as any).headline || (strength as any).metric)}
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-slate-600 mt-1">{repairMojibakeText((strength as any).detail || (strength as any).description)}</p>
                        </div>
                      </div>
                    )}

                    {gap && (
                      <div className="flex gap-4 p-4 rounded-xl bg-rose-50/70 border border-rose-200/60">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-rose-100 flex items-center justify-center">
                          <AlertOctagon className="h-5 w-5 text-rose-600" />
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Critical Gap</div>
                          <h4 className="font-semibold text-slate-900 mt-0.5">
                            {humanizeModuleKey((gap as any).module)}
                            {((gap as any).headline || (gap as any).metric) && (
                              <span className="ml-2 text-sm font-normal text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                                {repairMojibakeText((gap as any).headline || (gap as any).metric)}
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-slate-600 mt-1">{repairMojibakeText((gap as any).detail || (gap as any).description)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Section 4: Hidden Opportunity & Path Forward ──────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in-up stagger-4">
              {s.hidden_opportunity && (
                <div className="lg:col-span-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Hidden Opportunity
                  </h3>
                  <div className="text-sm text-slate-600 leading-relaxed bg-amber-50/60 border border-amber-200/50 p-4 rounded-xl">
                    <div className="flex gap-3 items-start">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <p>{repairMojibakeText(s.hidden_opportunity)}</p>
                    </div>
                  </div>
                </div>
              )}
              {Array.isArray(s.path_forward) && s.path_forward.length > 0 && (
                <div className={s.hidden_opportunity ? "lg:col-span-3" : "lg:col-span-5"}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-blue-500" /> Recommended Next Steps
                  </h3>
                  <div className="space-y-2.5">
                    {s.path_forward.map((step, i) => (
                      <div key={i} className="flex gap-3 items-start bg-slate-50/80 border border-slate-100 rounded-lg px-4 py-3">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {step.priority}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{repairMojibakeText(step.action)}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{repairMojibakeText(step.outcome)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Closing statement / Bottom line ────────────────────────── */}
            {(s.bottom_line || s.closing_statement) && (
              <div className="pt-4 border-t border-slate-100 animate-fade-in-up stagger-5">
                <p className="text-sm italic text-slate-400 text-center">
                  &ldquo;{repairMojibakeText(String(s.bottom_line || s.closing_statement || ""))}&rdquo;
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Legacy path: plain text summary ──────────────────────── */
          <LegacySummaryText text={typeof summaryData === "string" ? summaryData : ""} />
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Legacy text summary (backward compat for old reports)                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function LegacySummaryText({ text }: { text: string }) {
  if (!text) return null;

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join(" ").trim());
  }

  return (
    <div className="text-sm text-slate-700 max-w-3xl space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="leading-relaxed">{p}</p>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main page component                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

type EvidenceModuleRow = NonNullable<AuditResult["evidence"]>["modules"][number];

const evidenceStatusMeta: Record<
  EvidenceModuleRow["status"],
  {
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }
> = {
  collected: {
    label: "Collected",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  unavailable: {
    label: "Needs setup",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: AlertCircle,
  },
  skipped: {
    label: "Skipped",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Activity,
  },
  failed: {
    label: "Failed",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: XCircle,
  },
  not_implemented: {
    label: "Local gap",
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
    icon: AlertOctagon,
  },
};

function formatEvidenceReason(reason: string): string {
  const clean = repairMojibakeText(reason);

  if (/collected real data for this module/i.test(clean)) {
    return "Collected real data for this area.";
  }
  if (/citation consistency is not implemented/i.test(clean)) {
    return "Directory scan is not available in the local app yet.";
  }

  return clean
    .replace(/\bthis module\b/gi, "this area")
    .replace(/\bmodule\b/gi, "area")
    .replace(/\bnot implemented\b/gi, "not available yet");
}

function formatEvidenceModuleReason(module: EvidenceModuleRow): string {
  if (module.status === "not_implemented" && module.key === "citation_consistency") {
    return "Directory scan is not available in the local app yet.";
  }

  if (module.status === "collected") {
    const collectedCopy: Partial<Record<EvidenceModuleRow["key"], string>> = {
      gbp_health: "Checked current Google profile fields through Google Places.",
      review_sentiment: "Checked review metrics and sampled visible review themes.",
      website_performance: "Checked one mobile PageSpeed snapshot for the available URL.",
      tech_stack: "Checked homepage HTML and visible technology signals.",
      social_presence: "Checked website-linked social profiles and visible activity signals.",
      competitive_comparison: "Checked a nearby competitor sample; peer relevance may vary.",
      revenue_impact: "Checked qualitative business-impact signals from collected digital gaps.",
      business_intelligence: "Checked local business signals from configured local probes.",
      business_enrichment: "Checked public facts and cited research for business context.",
    };
    const copy = collectedCopy[module.key];
    if (copy) return copy;
  }

  return formatEvidenceReason(module.reason ?? "");
}

function getEvidenceSummary(result: AuditResult, key: keyof AuditResult, showRevenueDollars = true): string {
  switch (key) {
    case "gbp_health": {
      const data = result.gbp_health;
      if (!data) return "";
      return `${data.rating ? `${data.rating}/5 rating` : "Rating unavailable"}, ${data.review_count ?? 0} reviews, ${data.completeness_pct}% profile completeness.`;
    }
    case "review_sentiment": {
      const data = result.review_sentiment;
      if (!data) return "";
      return `${data.google_rating ?? "N/A"}/5 rating, ${data.owner_response_rate ?? 0}% owner response rate, ${data.review_velocity ?? 0} reviews per month.`;
    }
    case "website_performance": {
      const data = result.website_performance;
      if (!data) return "";
      const lcp = data.core_web_vitals.lcp ? `${(data.core_web_vitals.lcp / 1000).toFixed(1)}s LCP` : "LCP unavailable";
      return `${data.performance_score}/100 mobile performance, ${lcp}, ${data.ssl_valid ? "SSL valid" : "SSL missing"}.`;
    }
    case "tech_stack": {
      const data = result.tech_stack;
      if (!data) return "";
      const analytics = data.analytics.length > 0 ? data.analytics.join(", ") : "no analytics detected";
      return `${data.digital_maturity_score}/100 digital maturity; ${analytics}.`;
    }
    case "social_presence": {
      const data = result.social_presence;
      if (!data) return "";
      return `${data.platforms_found} profiles found, ${data.platforms_active} active, ${data.total_following.toLocaleString()} total followers detected.`;
    }
    case "citation_consistency": {
      const data = result.citation_consistency;
      if (!data) return "";
      return `${data.total_found} directories found, ${data.total_correct} correct, ${data.total_inconsistent} inconsistent, ${data.total_missing} missing.`;
    }
    case "competitive_comparison": {
      const data = result.competitive_comparison;
      if (!data) return "";
      return `${data.competitors.length} nearby peers compared; current position is ${data.target_position}.`;
    }
    case "revenue_impact": {
      const data = result.revenue_impact;
      if (!data) return "";
      if (showRevenueDollars) {
        return `${formatCurrency(data.total_monthly_leakage.mid)} modeled monthly leakage across ${data.leaks.length} issue areas.`;
      }
      const assessment = data.opportunity_assessment;
      return `Digital signals only; ${assessment?.impact_level?.replace(/_/g, " ") ?? "qualitative"} impact, ${assessment?.confidence ?? "directional"} confidence.`;
    }
    default:
      return "";
  }
}

const coverageKindMeta = {
  checked: {
    label: "Checked",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  sampled: {
    label: "Sampled",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  not_checked: {
    label: "Not checked",
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
  },
} as const;

const coverageConfidenceMeta = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
} as const;

function AuditCoverageSummaryCard({ result }: { result: AuditResult }) {
  const coverage = buildAuditCoverageSummary(result);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-blue-600" />
              Audit Coverage
            </CardTitle>
            <CardDescription>{coverage.confidence.detail}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {coverage.counts.checked} Checked
            </Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              {coverage.counts.sampled} Sampled
            </Badge>
            <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-700">
              {coverage.counts.notChecked} Not checked
            </Badge>
            <Badge variant="outline">{coverage.confidence.label}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-3">
          {coverage.notes.map((note) => (
            <div key={note} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {note}
            </div>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {coverage.items.map((item) => {
            const meta = coverageKindMeta[item.coverage];
            return (
              <div key={item.key} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                    <Badge variant="outline" className="text-slate-600">
                      {coverageConfidenceMeta[item.confidence]}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceSourcesPanel({ result }: { result: AuditResult }) {
  const evidence = result.evidence;
  if (!evidence || evidence.modules.length === 0) return null;

  const sourceCounts = [
    { label: "Collected", value: evidence.summary.collected, className: "text-emerald-700" },
    { label: "Needs setup", value: evidence.summary.unavailable, className: "text-amber-700" },
    { label: "Skipped", value: evidence.summary.skipped, className: "text-slate-600" },
    { label: "Failed", value: evidence.summary.failed, className: "text-red-700" },
    { label: "Local gaps", value: evidence.summary.not_implemented, className: "text-zinc-700" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Data Sources
            </CardTitle>
            <CardDescription>
              What this audit used, skipped, or could not collect.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {sourceCounts.map((item) => (
              <Badge key={item.label} variant="outline" className={`gap-1 ${item.className}`}>
                <span className="font-semibold">{item.value}</span>
                <span>{item.label}</span>
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {evidence.modules.map((module) => {
            const meta = evidenceStatusMeta[module.status];
            const StatusIcon = meta.icon;
            return (
              <div
                key={module.key}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{module.label}</p>
                    <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Source: {module.source}
                  </p>
                  {module.reason && (
                    <p className="mt-1 text-sm text-slate-600">{formatEvidenceModuleReason(module)}</p>
                  )}
                </div>
                {module.status === "unavailable" && module.settings_key && (
                  <Link href="/settings" className="shrink-0">
                    <Button variant="outline" size="sm">
                      <Settings className="mr-2 h-4 w-4" />
                      Open Settings
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuditReportPage() {
  const params = useParams();
  const reportId = String(params.id ?? "");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueScenario, setRevenueScenario] = useState<"low" | "mid" | "high">("mid");

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/report/${reportId}`);
        if (!res.ok) throw new Error(res.status === 404 ? "Report not found" : "Failed to load report");
        const data = await res.json();
        const repaired = repairMojibakeValue(data) as Report;
        setReport(
          repaired.result && repaired.type === "audit"
            ? { ...repaired, result: sanitizeAuditResultContent(repaired.result as AuditResult) }
            : repaired
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    if (reportId) {
      fetchReport();
    } else {
      setError("Report not found");
      setLoading(false);
    }
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="mt-4 text-muted-foreground">{error || "Report not found"}</p>
        <Link href="/audits" className="mt-4">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Audits</Button>
        </Link>
      </div>
    );
  }

  if (report.status === "processing" || report.status === "queued") {
    const input = report.input as AuditInput;
    return (
        <AuditLoading
          reportId={report.id}
          businessName={input.businessName}
          city={input.city}
          onComplete={(updated) => setReport(repairMojibakeValue(updated))}
        />
      );
  }

  if (report.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="mt-4 text-lg font-medium">Audit failed</p>
        <Link href="/audits/new" className="mt-4"><Button>Try Again</Button></Link>
      </div>
    );
  }

  const auditInput = report.input as AuditInput;
  const result = report.result as AuditResult | undefined;
  const scores = report.scores;

  // Revenue scenario toggle — Conservative / Moderate / Aggressive
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">No result data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/audits" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to Audits
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-1">{auditInput.businessName}</h1>
          <p className="text-muted-foreground">
            {auditInput.city && `${auditInput.city}, `}{auditInput.state || ""}
            {" · "}Audited {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`/api/report/${params.id}/pdf`, "_blank")}>
            <Download className="mr-2 h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/api/report/${params.id}/docx`, "_blank")}>
            <FileText className="mr-2 h-4 w-4" />DOCX
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/api/report/${params.id}/pptx`, "_blank")}>
            <Presentation className="mr-2 h-4 w-4" />PPTX
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/api/report/${params.id}/xlsx`, "_blank")}>
            <Sheet className="mr-2 h-4 w-4" />XLSX
          </Button>
        </div>
      </div>

      {/* ═══════════════ Overall Executive Summary & Score ═══════════════ */}
      {scores && <ExecutiveSummarySection scores={scores} result={result} />}

      <AuditCoverageSummaryCard result={result} />

      <BusinessContextCard enrichment={result.business_enrichment} />

      {/* Business Intelligence — "Important Facts Uncovered" */}
      {result.business_intelligence && result.business_intelligence.signal_count > 0 && (
        <IntelligenceCard
          data={result.business_intelligence}
        />
      )}

      {/* Strategic Intelligence */}
      {result.ai_analysis?.strategic_intelligence && (
        <StrategicIntelligenceCard
          data={result.ai_analysis.strategic_intelligence}
          showRevenueDollars={shouldShowRevenueDollars(result.revenue_impact)}
        />
      )}

      {/* AI Deep Analysis */}
      {result.ai_analysis && (
        <AIAnalysisCard
          analysis={result.ai_analysis}
          enhancedRecommendations={result.enhanced_recommendations}
          categorySkill={result.category_skill_used}
          showRevenueDollars={shouldShowRevenueDollars(result.revenue_impact)}
        />
      )}

      {/* Detailed Evidence */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Detailed Evidence</h2>
          <p className="text-sm text-muted-foreground">
            Expand these sections to inspect the source status, raw metrics, findings, and recommendations behind this audit.
          </p>
        </div>

        <EvidenceSourcesPanel result={result} />

        <div className="grid gap-4">
        {result.gbp_health && (() => {
          const m = getModuleContent("gbp_health", result.gbp_health.findings, result.gbp_health.recommendations, result.gbp_health.score, result.ai_analysis);
          return (
            <ModuleCard title="Google Business Profile Health" icon={<MapPin className="h-5 w-5" />} grade={result.gbp_health.grade} score={m.score} findings={m.findings} recommendations={m.recommendations} isEstimated={m.isEstimated} defaultCollapsed summary={getEvidenceSummary(result, "gbp_health")}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Rating</span><p className="font-semibold">{result.gbp_health.rating ? `${result.gbp_health.rating} / 5.0` : "N/A"}</p></div>
                <div><span className="text-muted-foreground">Reviews</span><p className="font-semibold">{result.gbp_health.review_count ?? "N/A"}</p></div>
                <div><span className="text-muted-foreground">Photos</span><p className="font-semibold">{result.gbp_health.photos_count}</p></div>
                <div><span className="text-muted-foreground">Completeness</span><p className="font-semibold">{result.gbp_health.completeness_pct}%</p></div>
              </div>
            </ModuleCard>
          );
        })()}

        {result.review_sentiment && (() => {
          const m = getModuleContent("review_sentiment", result.review_sentiment.findings, result.review_sentiment.recommendations, result.review_sentiment.score, result.ai_analysis);
          return (
            <ModuleCard title="Review Sentiment & Reputation" icon={<Star className="h-5 w-5" />} grade={result.review_sentiment.grade} score={m.score} findings={m.findings} recommendations={m.recommendations} isEstimated={m.isEstimated} defaultCollapsed summary={getEvidenceSummary(result, "review_sentiment")}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Google Rating</span><p className="font-semibold">{result.review_sentiment.google_rating ?? "N/A"}</p></div>
                <div><span className="text-muted-foreground">Response Rate</span><p className="font-semibold">{result.review_sentiment.owner_response_rate ?? 0}%</p></div>
                <div><span className="text-muted-foreground">Trend</span><p className="font-semibold capitalize">{result.review_sentiment.trend_direction}</p></div>
                <div><span className="text-muted-foreground">Velocity</span><p className="font-semibold">{result.review_sentiment.review_velocity ?? 0}/mo</p></div>
              </div>
              <div className="mt-2">
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div className="bg-green-400" style={{ width: `${result.review_sentiment.sentiment_breakdown.positive}%` }} />
                  <div className="bg-yellow-400" style={{ width: `${result.review_sentiment.sentiment_breakdown.neutral}%` }} />
                  <div className="bg-red-400" style={{ width: `${result.review_sentiment.sentiment_breakdown.negative}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{result.review_sentiment.sentiment_breakdown.positive}% Positive</span>
                  <span>{result.review_sentiment.sentiment_breakdown.neutral}% Neutral</span>
                  <span>{result.review_sentiment.sentiment_breakdown.negative}% Negative</span>
                </div>
              </div>
            </ModuleCard>
          );
        })()}

        {result.website_performance && (() => {
          const m = getModuleContent("website_performance", result.website_performance.findings, result.website_performance.recommendations, result.website_performance.score, result.ai_analysis);
          return (
            <ModuleCard title="Website Performance" icon={<Globe className="h-5 w-5" />} grade={result.website_performance.grade} score={m.score} findings={m.findings} recommendations={m.recommendations} isEstimated={m.isEstimated} defaultCollapsed summary={getEvidenceSummary(result, "website_performance")}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Performance</span><p className="font-semibold">{result.website_performance.performance_score}/100</p></div>
                <div><span className="text-muted-foreground">SEO</span><p className="font-semibold">{result.website_performance.seo_score}/100</p></div>
                <div><span className="text-muted-foreground">Accessibility</span><p className="font-semibold">{result.website_performance.accessibility_score}/100</p></div>
                <div><span className="text-muted-foreground">SSL</span><p className="font-semibold">{result.website_performance.ssl_valid ? "Valid" : "Missing"}</p></div>
              </div>
              <div className="flex gap-4 mt-2">
                {result.website_performance.core_web_vitals.lcp !== undefined && (
                  <div className="flex items-center gap-1 text-xs">
                    {result.website_performance.core_web_vitals.lcp_pass ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    LCP: {(result.website_performance.core_web_vitals.lcp / 1000).toFixed(1)}s
                  </div>
                )}
                {result.website_performance.core_web_vitals.cls !== undefined && (
                  <div className="flex items-center gap-1 text-xs">
                    {result.website_performance.core_web_vitals.cls_pass ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    CLS: {result.website_performance.core_web_vitals.cls}
                  </div>
                )}
              </div>
            </ModuleCard>
          );
        })()}

        {result.tech_stack && (() => {
          const m = getModuleContent("tech_stack", result.tech_stack.findings, result.tech_stack.recommendations, result.tech_stack.score, result.ai_analysis);
          return (
            <ModuleCard title="Technology Stack & Digital Maturity" icon={<Cpu className="h-5 w-5" />} grade={result.tech_stack.grade} score={m.score} findings={m.findings} recommendations={m.recommendations} isEstimated={m.isEstimated} defaultCollapsed summary={getEvidenceSummary(result, "tech_stack")}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">CMS</span><p className="font-semibold">{result.tech_stack.cms || "Unknown"}</p></div>
                <div><span className="text-muted-foreground">Analytics</span><p className="font-semibold">{result.tech_stack.analytics.length > 0 ? result.tech_stack.analytics.join(", ") : "None"}</p></div>
                <div><span className="text-muted-foreground">Booking</span><p className="font-semibold">{result.tech_stack.booking_system || "None"}</p></div>
                <div><span className="text-muted-foreground">Chat</span><p className="font-semibold">{result.tech_stack.chat_widget || "None"}</p></div>
                <div><span className="text-muted-foreground">Payment</span><p className="font-semibold">{result.tech_stack.payment_processor || "None"}</p></div>
                <div><span className="text-muted-foreground">Maturity</span><p className="font-semibold">{result.tech_stack.digital_maturity_score}/100</p></div>
              </div>
            </ModuleCard>
          );
        })()}

        {result.social_presence && (() => {
          const m = getModuleContent("social_presence", result.social_presence.findings, result.social_presence.recommendations, result.social_presence.score, result.ai_analysis);
          return (
            <ModuleCard title="Social Media Presence" icon={<Users className="h-5 w-5" />} grade={result.social_presence.grade} score={m.score} findings={m.findings} recommendations={m.recommendations} isEstimated={m.isEstimated} defaultCollapsed summary={getEvidenceSummary(result, "social_presence")}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Platforms Found</span><p className="font-semibold">{result.social_presence.platforms_found}</p></div>
                <div><span className="text-muted-foreground">Active</span><p className="font-semibold">{result.social_presence.platforms_active}</p></div>
                <div><span className="text-muted-foreground">Total Following</span><p className="font-semibold">{result.social_presence.total_following.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">NAP Consistent</span><p className="font-semibold">{result.social_presence.nap_consistent ? "Yes" : "No"}</p></div>
              </div>
              <div className="mt-3 space-y-1">
                {result.social_presence.platforms.map((p, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                    <span className="font-medium">{p.name}</span>
                    <div className="flex items-center gap-2">
                      {p.found ? <Badge variant="secondary" className="text-xs">Found</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">Not Found</Badge>}
                      {p.is_active && <Badge className="text-xs bg-green-100 text-green-800">Active</Badge>}
                      {p.follower_count !== undefined && <span className="text-muted-foreground">{p.follower_count.toLocaleString()} followers</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ModuleCard>
          );
        })()}

        {result.citation_consistency && (() => {
          const m = getModuleContent("citation_consistency", result.citation_consistency.findings, result.citation_consistency.recommendations, result.citation_consistency.score, result.ai_analysis);
          // Always estimated for citations since data is synthetic
          const citationIsEstimated = result.citation_consistency.is_mock ?? m.isEstimated;
          return (
            <ModuleCard
              title="Citation & Directory Consistency"
              icon={<BookOpen className="h-5 w-5" />}
              grade={result.citation_consistency.grade}
              score={m.score}
              findings={m.findings}
              recommendations={m.recommendations}
              isEstimated={citationIsEstimated}
              defaultCollapsed
              summary={getEvidenceSummary(result, "citation_consistency")}
              collapsedNotice="Based on estimated data — requires a live directory scan to verify NAP accuracy."
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Found</span><p className="font-semibold">{result.citation_consistency.total_found}</p></div>
                <div><span className="text-muted-foreground">Correct</span><p className="font-semibold text-green-600">{result.citation_consistency.total_correct}</p></div>
                <div><span className="text-muted-foreground">Inconsistent</span><p className="font-semibold text-yellow-600">{result.citation_consistency.total_inconsistent}</p></div>
                <div><span className="text-muted-foreground">Missing</span><p className="font-semibold text-red-600">{result.citation_consistency.total_missing}</p></div>
              </div>
              <div className="mt-3 space-y-1">
                {result.citation_consistency.directories.map((d, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                    <span className="font-medium">{d.name}</span>
                    <div className="flex items-center gap-2">
                      {d.status === "found_correct" && <Badge className="text-xs bg-green-100 text-green-800">Correct</Badge>}
                      {d.status === "found_inconsistent" && <Badge className="text-xs bg-yellow-100 text-yellow-800">Inconsistent</Badge>}
                      {d.status === "not_found" && <Badge variant="outline" className="text-xs text-red-600">Not Found</Badge>}
                      {d.status === "unchecked" && <Badge variant="outline" className="text-xs">Unchecked</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </ModuleCard>
          );
        })()}

        {result.competitive_comparison && (() => {
          const m = getModuleContent("competitive_comparison", result.competitive_comparison.findings, result.competitive_comparison.recommendations, result.competitive_comparison.score, result.ai_analysis);
          return (
            <ModuleCard title="Competitive Analysis" icon={<Trophy className="h-5 w-5" />} grade={result.competitive_comparison.grade} score={m.score} findings={m.findings} recommendations={m.recommendations} isEstimated={m.isEstimated} defaultCollapsed summary={getEvidenceSummary(result, "competitive_comparison")}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-muted-foreground">Your Position:</span>
                <Badge className={
                  result.competitive_comparison.target_position === "leader" ? "bg-green-100 text-green-800" :
                    result.competitive_comparison.target_position === "challenger" ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-800"
                }>
                  {repairMojibakeText(result.competitive_comparison.target_position.charAt(0).toUpperCase() + result.competitive_comparison.target_position.slice(1))}
                </Badge>
                {result.competitive_comparison.agentic_reconciled && (
                  <span className="text-[10px] text-violet-500 font-medium">✓ AI-verified peers</span>
                )}
              </div>
              <div className="space-y-1 mt-2">
                {result.competitive_comparison.competitors.map((c, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                    <span className="font-medium">{repairMojibakeText(c.name)}</span>
                    <div className="flex items-center gap-3">
                      {c.rating && <span>{c.rating}★</span>}
                      {c.review_count && <span className="text-muted-foreground">{c.review_count} reviews</span>}
                      <Badge variant="outline" className="text-xs capitalize">{c.estimated_position}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ModuleCard>
          );
        })()}

        {result.revenue_impact && (() => {
          const m = getModuleContent("revenue_impact", result.revenue_impact.findings, result.revenue_impact.recommendations, result.revenue_impact.score, result.ai_analysis);
          const showRevenueDollars = shouldShowRevenueDollars(result.revenue_impact);
          const findings = showRevenueDollars ? m.findings : visibleRevenueFindings(m.findings, result.revenue_impact);
          const scenarioLabels = { low: "Conservative", mid: "Moderate", high: "Aggressive" } as const;
          const scenarioColors = { low: "text-emerald-600", mid: "text-amber-600", high: "text-red-600" } as const;
          const activeLeakage = result.revenue_impact.total_monthly_leakage[revenueScenario];
          const activeAnnual = result.revenue_impact.annual_impact[revenueScenario];
          return (
            <ModuleCard title={showRevenueDollars ? "Revenue Impact Analysis" : "Business Impact Signals"} icon={<DollarSign className="h-5 w-5" />} grade={result.revenue_impact.grade} score={m.score} findings={findings} recommendations={m.recommendations} isEstimated={!showRevenueDollars || m.isEstimated} defaultCollapsed summary={getEvidenceSummary(result, "revenue_impact", showRevenueDollars)}>
              {showRevenueDollars ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">Revenue Scenario</span>
                    <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                      {(["low", "mid", "high"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setRevenueScenario(s)}
                          className={`px-3 py-1.5 font-medium transition-colors ${revenueScenario === s
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground hover:bg-muted"
                            }`}
                        >
                          {scenarioLabels[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Monthly Leakage</span>
                      <p className={`font-semibold ${scenarioColors[revenueScenario]}`}>{formatCurrency(activeLeakage)}</p>
                      <p className="text-[10px] text-muted-foreground">{scenarioLabels[revenueScenario]} estimate</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Annual Impact</span>
                      <p className={`font-semibold ${scenarioColors[revenueScenario]}`}>{formatCurrency(activeAnnual)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ROI if Fixed</span>
                      <p className="font-semibold text-green-600">{result.revenue_impact.roi_if_fixed}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 mb-3">
                  <p className="font-semibold">No verified revenue source found</p>
                  <p className="mt-1 text-amber-800">
                    Public data found business-impact signals, but revenue is private or unverified. This report does not present dollar leakage as an opportunity.
                  </p>
                  {result.revenue_impact.opportunity_assessment && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-amber-700/80">Impact level</span>
                        <p className="font-semibold capitalize">{result.revenue_impact.opportunity_assessment.impact_level.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <span className="text-amber-700/80">Confidence</span>
                        <p className="font-semibold capitalize">{result.revenue_impact.opportunity_assessment.confidence}</p>
                      </div>
                      <div>
                        <span className="text-amber-700/80">Basis</span>
                        <p className="font-semibold">Digital signals only</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2 mt-2">
                {result.revenue_impact.leaks.map((leak, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-secondary/30 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{leak.category}</span>
                        {leak.severity && (
                          <Badge variant={leak.severity === "critical" ? "destructive" : "secondary"} className="text-[10px] capitalize">
                            {leak.severity}
                          </Badge>
                        )}
                      </div>
                      {showRevenueDollars ? (
                        <span className={`font-semibold ${scenarioColors[revenueScenario]}`}>
                          {formatCurrency(leak[`${revenueScenario}_estimate` as "low_estimate" | "mid_estimate" | "high_estimate"])}/mo
                        </span>
                      ) : (
                        <span className="font-semibold text-muted-foreground">
                          {leak.confidence ? `${leak.confidence}/10 confidence` : "Signal"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {leak.contributing_factors.map((f: string, fi: number) => (
                        <Badge key={fi} variant="outline" className="text-xs">
                          {humanizeModuleReferences(showRevenueDollars ? f : stripDollarClaims(f))}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ModuleCard>
          );
        })()}
        </div>
      </section>

      {/* Basic Recommendations (only shown when AI analysis is NOT available) */}
      {!result.ai_analysis && result.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prioritized Recommendations</CardTitle>
            <CardDescription>Sorted by impact and effort — start at the top.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.recommendations.slice(0, 10).map((rec: Recommendation, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{rec.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] font-medium text-slate-500">
                      <span className={`flex items-center gap-1 ${rec.impact === "high" ? "text-amber-600" : "text-emerald-600"}`}>
                        <Zap className="h-3 w-3" /> {rec.impact} impact
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {rec.effort} effort
                      </span>
                      <span className="ml-auto text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm">{rec.module}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
