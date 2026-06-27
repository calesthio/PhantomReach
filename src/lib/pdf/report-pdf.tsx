import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type {
  Report,
  AuditResult,
  AIAnalysisResult,
  EnhancedRecommendation,
  PriorityAction,
  CrossModuleSynthesis,
  ExecutiveSummaryData,
} from "@/lib/db/types";
import { shouldShowRevenueDollars, stripDollarClaims } from "@/lib/reports/revenue-display";
import { priorityPlanSubtitle } from "@/lib/reports/display-labels";

const PURPLE = "#7c3aed";
const DARK = "#1e293b";
const GRAY = "#6b7280";
const LIGHT_GRAY = "#f3f4f6";
const WHITE = "#ffffff";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    backgroundColor: WHITE,
    color: "#1f2937",
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  pageFooter: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 9, color: GRAY },
  footerPageNumber: { fontSize: 9, color: GRAY },

  // Cover
  coverPage: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  coverAccent: {
    width: 60,
    height: 4,
    backgroundColor: PURPLE,
    marginBottom: 30,
    borderRadius: 2,
  },
  coverHeader: {
    color: PURPLE,
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 2,
  },
  coverSubheader: {
    fontSize: 14,
    color: GRAY,
    marginBottom: 40,
    textAlign: "center",
    letterSpacing: 1,
  },
  coverBusinessName: {
    fontSize: 26,
    fontWeight: "bold",
    color: DARK,
    marginBottom: 30,
    textAlign: "center",
  },
  gradeBox: {
    width: 110,
    height: 110,
    borderRadius: 55,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  gradeText: {
    fontSize: 52,
    fontWeight: "bold",
    color: WHITE,
  },
  gradeLabel: {
    fontSize: 11,
    color: GRAY,
    marginBottom: 30,
  },
  coverDate: { fontSize: 11, color: GRAY, marginTop: 6 },

  // Sections
  sectionHeading: {
    fontSize: 20,
    fontWeight: "bold",
    color: DARK,
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: PURPLE,
    paddingBottom: 8,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: "bold",
    color: DARK,
    marginBottom: 10,
    marginTop: 18,
  },
  summaryText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#374151",
    marginBottom: 12,
    textAlign: "justify",
  },

  // Scorecard
  scorecardGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  scorecardItem: {
    width: "30%",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  scorecardLabel: {
    fontSize: 10,
    color: WHITE,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  scorecardGrade: { fontSize: 24, fontWeight: "bold", color: WHITE },

  // Module detail
  moduleGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  moduleGridItem: {
    width: "48%",
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: PURPLE,
  },
  moduleLabel: { fontSize: 9, color: GRAY, marginBottom: 2 },
  moduleScore: { fontSize: 15, fontWeight: "bold", color: DARK },
  moduleTitle: { fontSize: 18, fontWeight: "bold", color: DARK, marginBottom: 4 },
  moduleGradeSubtitle: { fontSize: 12, color: GRAY, marginBottom: 16 },

  // Findings
  findingsHeading: {
    fontSize: 13,
    fontWeight: "bold",
    color: DARK,
    marginTop: 15,
    marginBottom: 8,
  },
  findingItem: {
    marginBottom: 5,
    paddingLeft: 12,
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.4,
  },

  // Recommendations
  recommendationRow: {
    display: "flex",
    flexDirection: "row",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  recommendationNumber: {
    width: 24,
    height: 24,
    backgroundColor: PURPLE,
    borderRadius: 12,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  recommendationNumberText: { fontSize: 11, fontWeight: "bold", color: WHITE },
  recommendationContent: { flex: 1 },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: DARK,
    marginBottom: 2,
  },
  recommendationDesc: {
    fontSize: 10,
    color: GRAY,
    marginBottom: 4,
    lineHeight: 1.3,
  },
  badgeRow: { display: "flex", flexDirection: "row", gap: 6 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 8,
    fontWeight: "bold",
  },

  // AI Analysis specific
  aiCard: {
    backgroundColor: "#faf5ff",
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  causalCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  strengthCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  gapCard: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  narrativeCard: {
    backgroundColor: "#faf5ff",
    borderWidth: 1,
    borderColor: "#d8b4fe",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    display: "flex",
    flexDirection: "row",
    gap: 10,
  },
  cardTitle: { fontSize: 11, fontWeight: "bold", color: DARK, marginBottom: 4 },
  cardText: { fontSize: 10, color: "#374151", lineHeight: 1.4 },
  cardMeta: { fontSize: 9, color: GRAY, marginTop: 4 },
  cardAccent: { fontSize: 9, color: "#059669", marginTop: 4, fontWeight: "bold" },
  inlineBadge: {
    fontSize: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: LIGHT_GRAY,
    color: DARK,
    fontWeight: "bold",
  },
  qualityNote: {
    backgroundColor: "#f9fafb",
    borderRadius: 6,
    padding: 12,
    marginTop: 12,
  },
  qualityTitle: { fontSize: 10, fontWeight: "bold", color: GRAY, marginBottom: 6 },
  qualityItem: { fontSize: 9, color: GRAY, marginBottom: 3, paddingLeft: 8 },

  // Intel signals
  signalRow: {
    display: "flex",
    flexDirection: "row",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    marginTop: 4,
    flexShrink: 0,
  },
  signalContent: { flex: 1 },
  signalHeadline: { fontSize: 11, fontWeight: "bold", color: DARK, marginBottom: 2 },
  signalDetail: { fontSize: 10, color: "#374151", lineHeight: 1.3 },
  signalSource: { fontSize: 8, color: GRAY, marginTop: 2 },
});

const getGradeColor = (grade: string): string => {
  switch (grade) {
    // New context-aware labels
    case "Strong": return "#059669";
    case "Solid": return "#2563eb";
    case "Developing": return "#d97706";
    case "Needs Attention": return "#ea580c";
    // Legacy A-F
    case "A": return "#059669";
    case "B": return "#2563eb";
    case "C": return "#f59e0b";
    case "D": return "#ef4444";
    case "F": return "#7c2d12";
    default: return GRAY;
  }
};

const getBadgeColor = (level: string) => {
  switch (level) {
    case "high": return { bg: "#fee2e2", text: "#991b1b" };
    case "medium": return { bg: "#fef3c7", text: "#92400e" };
    case "low": return { bg: "#dbeafe", text: "#1e40af" };
    default: return { bg: LIGHT_GRAY, text: "#374151" };
  }
};

const confidenceColor = (c: string) => {
  switch (c) {
    case "high": return "#059669";
    case "medium": return "#f59e0b";
    case "low": return "#ef4444";
    default: return GRAY;
  }
};

function Footer({ page }: { page: number }) {
  return (
    <View style={styles.pageFooter}>
      <Text style={styles.footerText}>Generated by Phantom Reach | phantomreach.io</Text>
      <Text style={styles.footerPageNumber}>Page {page}</Text>
    </View>
  );
}

interface ReportPDFProps {
  report: Report;
}

export const ReportPDF: React.FC<ReportPDFProps> = ({ report }) => {
  const auditResult = report.result as AuditResult | undefined;
  const input = report.input as any;
  const businessName = input?.businessName || "Business";
  const auditDate = new Date(report.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const overallGrade = report.scores?.overall_grade || "N/A";
  const overallScore = report.scores?.overall_score || 0;

  const modules = [
    { key: "gbp_health", label: "GBP Health", result: auditResult?.gbp_health },
    { key: "review_sentiment", label: "Reviews", result: auditResult?.review_sentiment },
    { key: "website_performance", label: "Website", result: auditResult?.website_performance },
    { key: "tech_stack", label: "Tech Stack", result: auditResult?.tech_stack },
    { key: "social_presence", label: "Social", result: auditResult?.social_presence },
    { key: "citation_consistency", label: "Citations", result: auditResult?.citation_consistency },
    { key: "competitive_comparison", label: "Competitive", result: auditResult?.competitive_comparison },
    { key: "revenue_impact", label: auditResult?.revenue_impact && !shouldShowRevenueDollars(auditResult.revenue_impact) ? "Business Impact" : "Revenue Impact", result: auditResult?.revenue_impact },
  ].filter((m) => m.result !== undefined);

  const aiAnalysis = auditResult?.ai_analysis;
  const enhancedRecs = auditResult?.enhanced_recommendations;
  const intel = auditResult?.business_intelligence;
  const showRevenueDollars = shouldShowRevenueDollars(auditResult?.revenue_impact);
  const displayRevenueText = (text: string | undefined) => (
    showRevenueDollars ? (text || "") : stripDollarClaims(text || "")
  );

  const topRecommendations = (enhancedRecs && enhancedRecs.length > 0)
    ? enhancedRecs.slice(0, 5)
    : (auditResult?.recommendations || [])
        .sort((a, b) => {
          const impactScore = { high: 3, medium: 2, low: 1 };
          const effortScore = { high: 1, medium: 2, low: 3 };
          const scoreA = (impactScore[a.impact as keyof typeof impactScore] || 0) * (effortScore[a.effort as keyof typeof effortScore] || 0);
          const scoreB = (impactScore[b.impact as keyof typeof impactScore] || 0) * (effortScore[b.effort as keyof typeof effortScore] || 0);
          return scoreB - scoreA;
        })
        .slice(0, 5);

  let pageNum = 1;

  return (
    <Document>
      {/* ── Cover Page ──────────────────────────────────────── */}
      <Page size="A4" style={[styles.page, styles.coverPage]}>
        <View style={styles.coverAccent} />
        <Text style={styles.coverHeader}>PHANTOM REACH</Text>
        <Text style={styles.coverSubheader}>Business Intelligence Report</Text>
        <Text style={styles.coverBusinessName}>{businessName}</Text>
        <View style={[styles.gradeBox, { backgroundColor: getGradeColor(overallGrade) }]}>
          <Text style={styles.gradeText}>{overallScore}</Text>
        </View>
        <Text style={styles.gradeLabel}>{overallGrade} — {overallScore}/100</Text>
        {auditResult?.category_skill_used && (
          <Text style={{ fontSize: 10, color: PURPLE, marginTop: 4 }}>
            Industry Analysis: {auditResult.category_skill_used}
          </Text>
        )}
        <Text style={styles.coverDate}>Audit Date: {auditDate}</Text>
      </Page>

      {/* ── Executive Summary ───────────────────────────────── */}
      {auditResult?.executive_summary && (() => {
        const es = auditResult.executive_summary;
        const isV2 = typeof es === "object" && es !== null && "verdict_headline" in es;
        const s = isV2 ? (es as ExecutiveSummaryData) : null;

        return (
          <Page size="A4" style={styles.page}>
            <Text style={styles.sectionHeading}>Executive Summary</Text>

            {s ? (
              <View>
                {/* Headline + subline */}
                <Text style={{ fontSize: 18, fontWeight: "bold", color: DARK, marginBottom: 4 }}>
                  {s.verdict_headline}
                </Text>
                {s.verdict_subline && (
                  <Text style={{ fontSize: 12, color: GRAY, marginBottom: 16 }}>
                    {s.verdict_subline}
                  </Text>
                )}

                {/* Key stats strip */}
                {Array.isArray(s.key_stats) && s.key_stats.length > 0 && (
                  <View style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {s.key_stats.map((stat: any, i: number) => (
                      <View key={i} style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
                        backgroundColor: stat.sentiment === "positive" ? "#f0fdf4" : stat.sentiment === "negative" ? "#fef2f2" : LIGHT_GRAY,
                        borderWidth: 1,
                        borderColor: stat.sentiment === "positive" ? "#bbf7d0" : stat.sentiment === "negative" ? "#fecaca" : "#e5e7eb",
                      }}>
                        <Text style={{ fontSize: 8, color: GRAY, marginBottom: 2 }}>{stat.label}</Text>
                        <Text style={{ fontSize: 14, fontWeight: "bold", color: DARK }}>{stat.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Three insights */}
                {Array.isArray(s.three_insights) && s.three_insights.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 10, fontWeight: "bold", color: PURPLE, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                      Key Insights
                    </Text>
                    {s.three_insights.map((insight: string, i: number) => (
                      <View key={i} style={{ display: "flex", flexDirection: "row", marginBottom: 6 }}>
                        <Text style={{ fontSize: 10, color: PURPLE, marginRight: 6, fontWeight: "bold" }}>{i + 1}.</Text>
                        <Text style={{ fontSize: 10, color: "#374151", lineHeight: 1.4, flex: 1 }}>{insight}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Top strength + Critical gap side by side */}
                <View style={{ display: "flex", flexDirection: "row", gap: 10, marginBottom: 16 }}>
                  {s.top_strength && (
                    <View style={{ flex: 1, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", borderRadius: 8, padding: 12 }}>
                      <Text style={{ fontSize: 8, color: "#059669", fontWeight: "bold", marginBottom: 4, textTransform: "uppercase" }}>Top Strength</Text>
                      <Text style={{ fontSize: 11, fontWeight: "bold", color: DARK, marginBottom: 2 }}>{s.top_strength.headline}</Text>
                      <Text style={{ fontSize: 9, color: "#374151", lineHeight: 1.3 }}>{s.top_strength.detail}</Text>
                    </View>
                  )}
                  {s.critical_gap && (
                    <View style={{ flex: 1, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 8, padding: 12 }}>
                      <Text style={{ fontSize: 8, color: "#d97706", fontWeight: "bold", marginBottom: 4, textTransform: "uppercase" }}>Critical Gap</Text>
                      <Text style={{ fontSize: 11, fontWeight: "bold", color: DARK, marginBottom: 2 }}>{s.critical_gap.headline}</Text>
                      <Text style={{ fontSize: 9, color: "#374151", lineHeight: 1.3 }}>{s.critical_gap.detail}</Text>
                    </View>
                  )}
                </View>

                {/* Path forward */}
                {Array.isArray(s.path_forward) && s.path_forward.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 10, fontWeight: "bold", color: PURPLE, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                      Path Forward
                    </Text>
                    {s.path_forward.map((step: any, i: number) => (
                      <View key={i} style={{ display: "flex", flexDirection: "row", marginBottom: 5 }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: PURPLE, display: "flex", justifyContent: "center", alignItems: "center", marginRight: 8, flexShrink: 0 }}>
                          <Text style={{ fontSize: 9, color: WHITE, fontWeight: "bold" }}>{step.priority || i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: "bold", color: DARK }}>{step.action}</Text>
                          <Text style={{ fontSize: 9, color: GRAY }}>{step.outcome}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bottom line */}
                {s.bottom_line && (
                  <View style={{ backgroundColor: "#faf5ff", borderWidth: 1, borderColor: "#e9d5ff", borderRadius: 8, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: DARK, lineHeight: 1.5, fontWeight: "bold" }}>
                      {s.bottom_line}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* Legacy string or v1 summary */
              <Text style={styles.summaryText}>
                {typeof es === "string"
                  ? es
                  : [(es as any).verdict_context, ...((es as any).core_story || []), (es as any).closing_statement].filter(Boolean).join("\n\n")}
              </Text>
            )}

            {aiAnalysis?.cross_module_synthesis?.competitive_narrative && (
              <View style={[styles.narrativeCard, { marginTop: 14 }]}>
                <Text style={{ fontSize: 9, color: PURPLE, fontWeight: "bold", marginBottom: 6 }}>
                  AI COMPETITIVE ASSESSMENT
                </Text>
                <Text style={{ fontSize: 11, color: DARK, lineHeight: 1.5, fontStyle: "italic" }}>
                  {aiAnalysis.cross_module_synthesis.competitive_narrative}
                </Text>
              </View>
            )}

            {aiAnalysis?.data_quality_assessment && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 10, color: GRAY }}>
                  Analysis Confidence: {Math.round(aiAnalysis.data_quality_assessment.overall_confidence * 100)}%
                </Text>
              </View>
            )}

            <Footer page={++pageNum} />
          </Page>
        );
      })()}

      {/* ── Digital Health Scorecard ─────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionHeading}>Digital Health Scorecard</Text>
        <View style={styles.scorecardGrid}>
          {modules.map((module, idx) => (
            <View key={idx} style={[styles.scorecardItem, { backgroundColor: getGradeColor(module.result?.grade || "") }]}>
              <Text style={styles.scorecardLabel}>{module.label}</Text>
              <Text style={styles.scorecardGrade}>{module.result?.score ?? "—"}</Text>
              <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{module.result?.grade}</Text>
            </View>
          ))}
        </View>
        <Footer page={++pageNum} />
      </Page>

      {/* ── AI Deep Analysis Pages ──────────────────────────── */}
      {aiAnalysis && (
        <>
          {/* Causal Chains + Hidden Strengths */}
          <Page size="A4" style={styles.page}>
            <Text style={styles.sectionHeading}>AI Deep Analysis</Text>

            {aiAnalysis.cross_module_synthesis.causal_chains.length > 0 && (
              <View>
                <Text style={styles.subHeading}>Causal Chains</Text>
                <Text style={{ fontSize: 9, color: GRAY, marginBottom: 10 }}>
                  Problems that compound across modules — fixing the root unlocks cascading improvements.
                </Text>
                {aiAnalysis.cross_module_synthesis.causal_chains.map((chain, i) => (
                  <View key={i} style={styles.causalCard}>
                    <Text style={styles.cardTitle}>{chain.chain}</Text>
                    <Text style={styles.cardText}>{chain.business_impact}</Text>
                    <Text style={styles.cardMeta}>Modules: {chain.modules_involved.join(", ")}</Text>
                    <Text style={styles.cardAccent}>Fix sequence: {chain.fix_sequence}</Text>
                  </View>
                ))}
              </View>
            )}

            {aiAnalysis.cross_module_synthesis.hidden_strengths.length > 0 && (
              <View>
                <Text style={styles.subHeading}>Hidden Strengths</Text>
                {aiAnalysis.cross_module_synthesis.hidden_strengths.map((s, i) => (
                  <View key={i} style={styles.strengthCard}>
                    <Text style={styles.cardTitle}>{s.strength}</Text>
                    <Text style={{ fontSize: 10, color: "#166534", marginTop: 2 }}>
                      Opportunity: {s.leverage_opportunity}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Footer page={++pageNum} />
          </Page>

          {/* Compounding Gaps + Priority Action Plan */}
          <Page size="A4" style={styles.page}>
            {aiAnalysis.cross_module_synthesis.compounding_gaps.length > 0 && (
              <View>
                <Text style={styles.subHeading}>Compounding Gaps</Text>
                <Text style={{ fontSize: 9, color: GRAY, marginBottom: 10 }}>
                  Multiple weaknesses that amplify each other.
                </Text>
                {aiAnalysis.cross_module_synthesis.compounding_gaps.map((gap, i) => (
                  <View key={i} style={styles.gapCard}>
                    <Text style={styles.cardTitle}>{gap.description}</Text>
                    <Text style={styles.cardText}>Combined impact: {gap.combined_impact}</Text>
                    <Text style={styles.cardMeta}>Modules: {gap.involved_modules.join(", ")}</Text>
                  </View>
                ))}
              </View>
            )}

            {aiAnalysis.priority_action_plan.length > 0 && (
              <View>
                <Text style={styles.subHeading}>Priority Action Plan</Text>
                <Text style={{ fontSize: 9, color: GRAY, marginBottom: 10 }}>
                  {priorityPlanSubtitle(showRevenueDollars)}
                </Text>
                {aiAnalysis.priority_action_plan.map((action, i) => (
                  <View key={i} style={styles.actionCard}>
                    <View style={[styles.recommendationNumber, { marginTop: 0 }]}>
                      <Text style={styles.recommendationNumberText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{action.action}</Text>
                      <Text style={styles.cardText}>{action.rationale}</Text>
                      <View style={[styles.badgeRow, { marginTop: 4 }]}>
                        <Text style={[styles.inlineBadge, { backgroundColor: "#dbeafe", color: "#1e40af" }]}>
                          {showRevenueDollars ? "ROI" : "Impact"}: {displayRevenueText(action.expected_roi)}
                        </Text>
                        <Text style={[styles.inlineBadge, { backgroundColor: "#f3e8ff", color: "#7c3aed" }]}>
                          {action.timeframe}
                        </Text>
                      </View>
                      {action.unlocks && (
                        <Text style={styles.cardAccent}>Unlocks: {displayRevenueText(action.unlocks)}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Footer page={++pageNum} />
          </Page>
        </>
      )}

      {/* ── Business Intelligence ───────────────────────────── */}
      {intel && intel.signals.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionHeading}>Business Intelligence</Text>
          <Text style={{ fontSize: 10, color: GRAY, marginBottom: 16 }}>
            External signals about this business from public records and data sources.
          </Text>
          {intel.signals.map((signal, i) => (
            <View key={i} style={styles.signalRow}>
              <View style={[styles.signalDot, { backgroundColor: confidenceColor(signal.confidence) }]} />
              <View style={styles.signalContent}>
                <Text style={styles.signalHeadline}>{signal.headline}</Text>
                <Text style={styles.signalDetail}>{signal.detail}</Text>
                <Text style={styles.signalSource}>Source: {signal.source} | Confidence: {signal.confidence}</Text>
              </View>
            </View>
          ))}
          <Footer page={++pageNum} />
        </Page>
      )}

      {/* ── Module Detail Pages ─────────────────────────────── */}
      {modules.map((module, pageIdx) =>
        module.result ? (
          <Page key={pageIdx} size="A4" style={styles.page}>
            <View>
              <Text style={styles.moduleTitle}>{module.label}</Text>
              <Text style={styles.moduleGradeSubtitle}>
                Grade: {module.result.grade} | Score: {module.result.score}/100
              </Text>

              {module.key === "gbp_health" && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Business Name</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).business_name}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Rating</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).rating || "N/A"} stars</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Review Count</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).review_count || 0}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Completeness</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).completeness_pct || 0}%</Text>
                  </View>
                </View>
              )}

              {module.key === "review_sentiment" && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Google Rating</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).google_rating || "N/A"} stars</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Sentiment Trend</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).trend_direction}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Response Rate</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).owner_response_rate || 0}%</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Velocity</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).review_velocity || 0}/mo</Text>
                  </View>
                </View>
              )}

              {module.key === "website_performance" && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Performance</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).performance_score}/100</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>SEO</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).seo_score}/100</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Mobile Friendly</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).mobile_friendly ? "Yes" : "No"}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>SSL Valid</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).ssl_valid ? "Yes" : "No"}</Text>
                  </View>
                </View>
              )}

              {module.key === "tech_stack" && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Digital Maturity</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).digital_maturity_score}/100</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>CMS</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).cms || "None"}</Text>
                  </View>
                </View>
              )}

              {module.key === "social_presence" && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Platforms Active</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).platforms_active}/{(module.result as any).platforms_found}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>NAP Consistent</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).nap_consistent ? "Yes" : "No"}</Text>
                  </View>
                </View>
              )}

              {module.key === "citation_consistency" && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Found Correct</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).total_correct}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Inconsistent</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).total_inconsistent}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Missing</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).total_missing}</Text>
                  </View>
                </View>
              )}

              {module.key === "competitive_comparison" && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Position</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).target_position}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Competitors</Text>
                    <Text style={styles.moduleScore}>{(module.result as any).competitors?.length || 0}</Text>
                  </View>
                </View>
              )}

              {module.key === "revenue_impact" && shouldShowRevenueDollars(module.result as any) && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Monthly Leakage (Mid)</Text>
                    <Text style={styles.moduleScore}>${(module.result as any).total_monthly_leakage?.mid || 0}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Annual Impact</Text>
                    <Text style={styles.moduleScore}>${(module.result as any).annual_impact?.mid || 0}</Text>
                  </View>
                </View>
              )}
              {module.key === "revenue_impact" && !shouldShowRevenueDollars(module.result as any) && (
                <View style={styles.moduleGrid}>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Impact Level</Text>
                    <Text style={styles.moduleScore}>{((module.result as any).opportunity_assessment?.impact_level || "signals").replace(/_/g, " ")}</Text>
                  </View>
                  <View style={styles.moduleGridItem}>
                    <Text style={styles.moduleLabel}>Revenue Basis</Text>
                    <Text style={styles.moduleScore}>Unverified</Text>
                  </View>
                </View>
              )}

              {/* AI deep dive for this module */}
              {aiAnalysis?.module_analyses?.[module.key] && (
                <View style={[styles.aiCard, { marginTop: 14 }]}>
                  <Text style={{ fontSize: 9, color: PURPLE, fontWeight: "bold", marginBottom: 6 }}>AI EXPERT ANALYSIS</Text>
                  {aiAnalysis.module_analyses[module.key].expert_findings.slice(0, 2).map((f, i) => (
                    <Text key={i} style={styles.findingItem}>{displayRevenueText(f)}</Text>
                  ))}
                  {aiAnalysis.module_analyses[module.key].hidden_insights.slice(0, 1).map((h, i) => (
                    <Text key={i} style={[styles.findingItem, { color: "#059669" }]}>Insight: {displayRevenueText(h)}</Text>
                  ))}
                </View>
              )}

              {module.result?.findings && module.result.findings.length > 0 && (
                <View>
                  <Text style={styles.findingsHeading}>Key Findings</Text>
                  {module.result.findings.slice(0, 3).map((finding, idx) => (
                    <Text key={idx} style={styles.findingItem}>{displayRevenueText(finding)}</Text>
                  ))}
                </View>
              )}

              {module.result?.recommendations && module.result.recommendations.length > 0 && (
                <View>
                  <Text style={styles.findingsHeading}>Top Recommendations</Text>
                  {module.result.recommendations.slice(0, 3).map((rec, idx) => (
                    <Text key={idx} style={styles.findingItem}>{displayRevenueText(rec)}</Text>
                  ))}
                </View>
              )}
            </View>
            <Footer page={++pageNum} />
          </Page>
        ) : null
      )}

      {/* ── Prioritized Recommendations Page ────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionHeading}>
          {enhancedRecs ? "AI-Enhanced Recommendations" : "Prioritized Recommendations"}
        </Text>

        {topRecommendations.length > 0 ? (
          topRecommendations.map((rec, idx) => {
            const impactColors = getBadgeColor(rec.impact);
            const effortColors = getBadgeColor(rec.effort);
            const enhanced = rec as EnhancedRecommendation;
            return (
              <View key={idx} style={styles.recommendationRow}>
                <View style={styles.recommendationNumber}>
                  <Text style={styles.recommendationNumberText}>{idx + 1}</Text>
                </View>
                <View style={styles.recommendationContent}>
                  <Text style={styles.recommendationTitle}>{rec.title}</Text>
                  <Text style={styles.recommendationDesc}>{rec.description}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: impactColors.bg }]}>
                      <Text style={{ color: impactColors.text, fontSize: 8, fontWeight: "bold" }}>
                        {rec.impact.toUpperCase()} IMPACT
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: effortColors.bg }]}>
                      <Text style={{ color: effortColors.text, fontSize: 8, fontWeight: "bold" }}>
                        {rec.effort.toUpperCase()} EFFORT
                      </Text>
                    </View>
                    {enhanced.timeframe && (
                      <View style={[styles.badge, { backgroundColor: "#f3e8ff" }]}>
                        <Text style={{ color: PURPLE, fontSize: 8, fontWeight: "bold" }}>
                          {enhanced.timeframe}
                        </Text>
                      </View>
                    )}
                  </View>
                  {enhanced.expected_outcome && (
                    <Text style={styles.cardAccent}>Expected: {enhanced.expected_outcome}</Text>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.summaryText}>No recommendations available.</Text>
        )}

        {/* Data quality notes */}
        {aiAnalysis?.data_quality_assessment?.caveats && aiAnalysis.data_quality_assessment.caveats.length > 0 && (
          <View style={styles.qualityNote}>
            <Text style={styles.qualityTitle}>Data Quality Notes</Text>
            {aiAnalysis.data_quality_assessment.caveats.map((c, i) => (
              <Text key={i} style={styles.qualityItem}>{c}</Text>
            ))}
          </View>
        )}

        <Footer page={++pageNum} />
      </Page>
    </Document>
  );
};

export default ReportPDF;
