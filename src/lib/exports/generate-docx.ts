import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  ShadingType,
  BorderStyle,
  PageBreak,
  LevelFormat,
} from "docx";
import type { Report, AuditResult, EnhancedRecommendation } from "@/lib/db/types";
import { shouldShowRevenueDollars, stripDollarClaims } from "@/lib/reports/revenue-display";

const PURPLE = "7C3AED";
const DARK = "1E293B";
const GRAY = "6B7280";
const LIGHT_BG = "F9FAFB";
const WHITE = "FFFFFF";

const gradeColorMap: Record<string, string> = {
  Strong: "059669", Solid: "2563EB", Developing: "D97706", "Needs Attention": "EA580C",
  A: "059669", B: "2563EB", C: "F59E0B", D: "EF4444", F: "7C2D12",
};

const border = { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" };
const allBorders = { top: border, bottom: border, left: border, right: border };

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 200 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: level === HeadingLevel.HEADING_1 ? 32 : 26, color: DARK })],
  });
}

function bodyText(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: "374151" })],
  });
}

function metricCell(label: string, value: string, fill = LIGHT_BG): TableCell {
  return new TableCell({
    borders: allBorders,
    width: { size: 4680, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({ children: [new TextRun({ text: label, font: "Arial", size: 18, color: GRAY })] }),
      new Paragraph({ children: [new TextRun({ text: value, font: "Arial", size: 26, bold: true, color: DARK })] }),
    ],
  });
}

export async function generateReportDOCX(report: Report): Promise<Buffer> {
  const auditResult = report.result as AuditResult | undefined;
  const input = report.input as any;
  const businessName = input?.businessName || "Business";
  const auditDate = new Date(report.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const overallGrade = report.scores?.overall_grade || "N/A";
  const overallScore = report.scores?.overall_score || 0;
  const aiAnalysis = auditResult?.ai_analysis;
  const enhancedRecs = auditResult?.enhanced_recommendations;
  const intel = auditResult?.business_intelligence;
  const showRevenueDollars = shouldShowRevenueDollars(auditResult?.revenue_impact);
  const displayRevenueText = (text: string | undefined) => (
    showRevenueDollars ? (text || "") : stripDollarClaims(text || "")
  );

  const modules = [
    { key: "gbp_health", label: "GBP Health", result: auditResult?.gbp_health },
    { key: "review_sentiment", label: "Reviews", result: auditResult?.review_sentiment },
    { key: "website_performance", label: "Website Performance", result: auditResult?.website_performance },
    { key: "tech_stack", label: "Tech Stack", result: auditResult?.tech_stack },
    { key: "social_presence", label: "Social Presence", result: auditResult?.social_presence },
    { key: "citation_consistency", label: "Citations", result: auditResult?.citation_consistency },
    { key: "competitive_comparison", label: "Competitive Position", result: auditResult?.competitive_comparison },
    { key: "revenue_impact", label: "Revenue Impact", result: auditResult?.revenue_impact },
  ].filter((m) => m.result !== undefined);

  const children: (Paragraph | Table)[] = [];

  // ── Cover Section ────────────────────────────────────────
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "PHANTOM REACH", font: "Arial", size: 44, bold: true, color: PURPLE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: "Business Intelligence Report", font: "Arial", size: 24, color: GRAY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: businessName, font: "Arial", size: 36, bold: true, color: DARK })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `Overall Grade: ${overallGrade}`, font: "Arial", size: 28, bold: true, color: gradeColorMap[overallGrade] || GRAY }),
        new TextRun({ text: `  |  Score: ${overallScore}/100`, font: "Arial", size: 24, color: GRAY }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Audit Date: ${auditDate}`, font: "Arial", size: 20, color: GRAY })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── Executive Summary ────────────────────────────────────
  if (auditResult?.executive_summary) {
    children.push(heading("Executive Summary"));
    const summaryText = typeof auditResult.executive_summary === "string"
      ? auditResult.executive_summary
      : [auditResult.executive_summary.verdict_context, ...(auditResult.executive_summary.core_story || []), auditResult.executive_summary.closing_statement].filter(Boolean).join("\n\n");
    children.push(bodyText(summaryText));

    if (aiAnalysis?.cross_module_synthesis?.competitive_narrative) {
      children.push(
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "AI Competitive Assessment:", font: "Arial", size: 20, bold: true, color: PURPLE })] }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: aiAnalysis.cross_module_synthesis.competitive_narrative, font: "Arial", size: 22, italics: true, color: DARK })],
        }),
      );
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── Digital Health Scorecard ──────────────────────────────
  children.push(heading("Digital Health Scorecard"));
  const scorecardRows: TableRow[] = [];
  for (let i = 0; i < modules.length; i += 3) {
    const cells = modules.slice(i, i + 3).map((m) => {
      const gc = gradeColorMap[m.result?.grade || ""] || GRAY;
      return new TableCell({
        borders: allBorders,
        width: { size: 3120, type: WidthType.DXA },
        shading: { fill: gc, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 120, right: 120 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.label, font: "Arial", size: 18, bold: true, color: WHITE })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.result?.grade || "-", font: "Arial", size: 36, bold: true, color: WHITE })] }),
        ],
      });
    });
    while (cells.length < 3) {
      cells.push(new TableCell({ borders: allBorders, width: { size: 3120, type: WidthType.DXA }, children: [new Paragraph("")] }));
    }
    scorecardRows.push(new TableRow({ children: cells }));
  }
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120], rows: scorecardRows }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── AI Deep Analysis ─────────────────────────────────────
  if (aiAnalysis) {
    children.push(heading("AI Deep Analysis"));

    if (aiAnalysis.cross_module_synthesis.causal_chains.length > 0) {
      children.push(heading("Causal Chains", HeadingLevel.HEADING_2));
      for (const chain of aiAnalysis.cross_module_synthesis.causal_chains) {
        children.push(
          new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: chain.chain, font: "Arial", size: 22, bold: true, color: DARK })] }),
          bodyText(chain.business_impact),
          new Paragraph({ children: [new TextRun({ text: `Modules: ${chain.modules_involved.join(", ")}`, font: "Arial", size: 18, color: GRAY })] }),
          new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: `Fix sequence: ${chain.fix_sequence}`, font: "Arial", size: 18, bold: true, color: "059669" })] }),
        );
      }
    }

    if (aiAnalysis.cross_module_synthesis.hidden_strengths.length > 0) {
      children.push(heading("Hidden Strengths", HeadingLevel.HEADING_2));
      for (const s of aiAnalysis.cross_module_synthesis.hidden_strengths) {
        children.push(
          new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: s.strength, font: "Arial", size: 22, bold: true, color: "166534" })] }),
          new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Opportunity: ${s.leverage_opportunity}`, font: "Arial", size: 20, color: "059669" })] }),
        );
      }
    }

    if (aiAnalysis.priority_action_plan.length > 0) {
      children.push(heading("Priority Action Plan", HeadingLevel.HEADING_2));
      aiAnalysis.priority_action_plan.forEach((action, i) => {
        children.push(
          new Paragraph({
            spacing: { before: 120 },
            children: [
              new TextRun({ text: `${i + 1}. `, font: "Arial", size: 22, bold: true, color: PURPLE }),
              new TextRun({ text: action.action, font: "Arial", size: 22, bold: true, color: DARK }),
            ],
          }),
          bodyText(action.rationale),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: `ROI: ${displayRevenueText(action.expected_roi)}`, font: "Arial", size: 18, color: "2563EB" }),
              new TextRun({ text: `  |  ${action.timeframe}`, font: "Arial", size: 18, color: GRAY }),
              ...(action.unlocks ? [new TextRun({ text: `  |  Unlocks: ${displayRevenueText(action.unlocks)}`, font: "Arial", size: 18, color: "059669" })] : []),
            ],
          }),
        );
      });
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── Business Intelligence ────────────────────────────────
  if (intel && intel.signals.length > 0) {
    children.push(heading("Business Intelligence"));
    for (const signal of intel.signals) {
      children.push(
        new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: signal.headline, font: "Arial", size: 22, bold: true, color: DARK })] }),
        bodyText(signal.detail),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: `Source: ${signal.source} | Confidence: ${signal.confidence}`, font: "Arial", size: 18, color: GRAY })],
        }),
      );
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── Module Details ───────────────────────────────────────
  for (const module of modules) {
    if (!module.result) continue;
    children.push(heading(module.label));
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: `Grade: ${module.result.grade} | Score: ${module.result.score}/100`, font: "Arial", size: 22, color: GRAY })],
      }),
    );

    // Module metrics table
    const r = module.result as any;
    const metrics: [string, string][] = [];
    if (module.key === "gbp_health") {
      metrics.push(["Business Name", r.business_name || "-"], ["Rating", `${r.rating || "N/A"} stars`], ["Reviews", String(r.review_count || 0)], ["Completeness", `${r.completeness_pct || 0}%`]);
    } else if (module.key === "review_sentiment") {
      metrics.push(["Google Rating", `${r.google_rating || "N/A"} stars`], ["Trend", r.trend_direction || "-"], ["Response Rate", `${r.owner_response_rate || 0}%`], ["Velocity", `${r.review_velocity || 0}/mo`]);
    } else if (module.key === "website_performance") {
      metrics.push(["Performance", `${r.performance_score}/100`], ["SEO", `${r.seo_score}/100`], ["Mobile Friendly", r.mobile_friendly ? "Yes" : "No"], ["SSL Valid", r.ssl_valid ? "Yes" : "No"]);
    } else if (module.key === "tech_stack") {
      metrics.push(["Digital Maturity", `${r.digital_maturity_score}/100`], ["CMS", r.cms || "None"]);
    } else if (module.key === "social_presence") {
      metrics.push(["Platforms Active", `${r.platforms_active}/${r.platforms_found}`], ["NAP Consistent", r.nap_consistent ? "Yes" : "No"]);
    } else if (module.key === "citation_consistency") {
      metrics.push(["Correct", String(r.total_correct)], ["Inconsistent", String(r.total_inconsistent)], ["Missing", String(r.total_missing)]);
    } else if (module.key === "competitive_comparison") {
      metrics.push(["Position", r.target_position || "-"], ["Competitors", String(r.competitors?.length || 0)]);
    } else if (module.key === "revenue_impact") {
      if (shouldShowRevenueDollars(r)) {
        metrics.push(["Monthly Leakage", `$${r.total_monthly_leakage?.mid || 0}`], ["Annual Impact", `$${r.annual_impact?.mid || 0}`]);
      } else {
        metrics.push(["Impact Level", r.opportunity_assessment?.impact_level?.replace(/_/g, " ") || "Signals only"], ["Revenue Basis", "Unverified"]);
      }
    }

    if (metrics.length > 0) {
      const metricRows: TableRow[] = [];
      for (let i = 0; i < metrics.length; i += 2) {
        const cells = [metricCell(metrics[i][0], metrics[i][1])];
        if (metrics[i + 1]) cells.push(metricCell(metrics[i + 1][0], metrics[i + 1][1]));
        else cells.push(new TableCell({ borders: allBorders, width: { size: 4680, type: WidthType.DXA }, children: [new Paragraph("")] }));
        metricRows.push(new TableRow({ children: cells }));
      }
      children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: metricRows }));
    }

    if (module.result.findings?.length) {
      children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: "Key Findings", font: "Arial", size: 22, bold: true, color: DARK })] }));
      for (const f of module.result.findings.slice(0, 4)) {
        children.push(bodyText(`- ${displayRevenueText(f)}`));
      }
    }

    if (module.result.recommendations?.length) {
      children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: "Recommendations", font: "Arial", size: 22, bold: true, color: DARK })] }));
      for (const rec of module.result.recommendations.slice(0, 3)) {
        children.push(bodyText(`- ${displayRevenueText(rec)}`));
      }
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── Prioritized Recommendations ──────────────────────────
  const recs = enhancedRecs?.length ? enhancedRecs.slice(0, 5) : (auditResult?.recommendations || []).slice(0, 5);
  children.push(heading(enhancedRecs?.length ? "AI-Enhanced Recommendations" : "Prioritized Recommendations"));
  recs.forEach((rec, i) => {
    const enhanced = rec as EnhancedRecommendation;
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [
          new TextRun({ text: `${i + 1}. `, font: "Arial", size: 24, bold: true, color: PURPLE }),
          new TextRun({ text: rec.title, font: "Arial", size: 24, bold: true, color: DARK }),
        ],
      }),
      bodyText(displayRevenueText(rec.description)),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({ text: `${rec.impact.toUpperCase()} IMPACT`, font: "Arial", size: 18, bold: true, color: rec.impact === "high" ? "991B1B" : "92400E" }),
          new TextRun({ text: `  |  ${rec.effort.toUpperCase()} EFFORT`, font: "Arial", size: 18, color: GRAY }),
          ...(enhanced.timeframe ? [new TextRun({ text: `  |  ${enhanced.timeframe}`, font: "Arial", size: 18, color: PURPLE })] : []),
          ...(enhanced.expected_outcome ? [new TextRun({ text: `  |  Expected: ${displayRevenueText(enhanced.expected_outcome)}`, font: "Arial", size: 18, color: "059669" })] : []),
        ],
      }),
    );
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
