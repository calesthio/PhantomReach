import ExcelJS from "exceljs";
import type { Report, AuditResult, EnhancedRecommendation } from "@/lib/db/types";
import { shouldShowRevenueDollars, stripDollarClaims } from "@/lib/reports/revenue-display";

const PURPLE = "7C3AED";
const DARK = "1E293B";
const GRAY = "6B7280";
const WHITE = "FFFFFF";

const gradeColorMap: Record<string, string> = {
  Strong: "059669", Solid: "2563EB", Developing: "D97706", "Needs Attention": "EA580C",
  A: "059669", B: "2563EB", C: "F59E0B", D: "EF4444", F: "7C2D12",
};

function headerStyle(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.font = { bold: true, color: { argb: WHITE }, size: 11, name: "Arial" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PURPLE } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "E5E7EB" } },
      bottom: { style: "thin", color: { argb: "E5E7EB" } },
      left: { style: "thin", color: { argb: "E5E7EB" } },
      right: { style: "thin", color: { argb: "E5E7EB" } },
    };
  }
  r.height = 28;
}

function dataCell(cell: ExcelJS.Cell, bold = false) {
  cell.font = { size: 10, name: "Arial", color: { argb: DARK }, bold };
  cell.alignment = { vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: "E5E7EB" } },
    bottom: { style: "thin", color: { argb: "E5E7EB" } },
    left: { style: "thin", color: { argb: "E5E7EB" } },
    right: { style: "thin", color: { argb: "E5E7EB" } },
  };
}

export async function generateReportXLSX(report: Report): Promise<Buffer> {
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
  const showRevenueDollars = shouldShowRevenueDollars(auditResult?.revenue_impact);
  const displayRevenueText = (text: string | undefined) => (
    showRevenueDollars ? (text || "") : stripDollarClaims(text || "")
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Phantom Reach";
  wb.created = new Date();

  const modules = [
    { key: "gbp_health", label: "GBP Health", result: auditResult?.gbp_health },
    { key: "review_sentiment", label: "Reviews", result: auditResult?.review_sentiment },
    { key: "website_performance", label: "Website", result: auditResult?.website_performance },
    { key: "tech_stack", label: "Tech Stack", result: auditResult?.tech_stack },
    { key: "social_presence", label: "Social", result: auditResult?.social_presence },
    { key: "citation_consistency", label: "Citations", result: auditResult?.citation_consistency },
    { key: "competitive_comparison", label: "Competitive", result: auditResult?.competitive_comparison },
    { key: "revenue_impact", label: showRevenueDollars ? "Revenue Impact" : "Business Impact", result: auditResult?.revenue_impact },
  ].filter((m) => m.result !== undefined);

  // ── Sheet 1: Overview ────────────────────────────────────
  const overview = wb.addWorksheet("Overview", { properties: { tabColor: { argb: PURPLE } } });
  overview.columns = [
    { header: "", width: 25 },
    { header: "", width: 40 },
  ];

  overview.mergeCells("A1:B1");
  const titleCell = overview.getCell("A1");
  titleCell.value = `Phantom Reach — ${businessName}`;
  titleCell.font = { size: 16, bold: true, color: { argb: PURPLE }, name: "Arial" };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  overview.getRow(1).height = 36;

  const infoRows: [string, string | number][] = [
    ["Business Name", businessName],
    ["Audit Date", auditDate],
    ["Overall Grade", overallGrade],
    ["Overall Score", `${overallScore}/100`],
  ];
  let row = 3;
  for (const [label, value] of infoRows) {
    const r = overview.getRow(row);
    r.getCell(1).value = label;
    r.getCell(2).value = value;
    dataCell(r.getCell(1), true);
    dataCell(r.getCell(2));
    if (label === "Overall Grade") {
      r.getCell(2).font = { size: 14, bold: true, color: { argb: gradeColorMap[String(value)] || GRAY }, name: "Arial" };
    }
    row++;
  }

  // ── Sheet 2: Scorecard ───────────────────────────────────
  const scorecard = wb.addWorksheet("Scorecard", { properties: { tabColor: { argb: "059669" } } });
  scorecard.columns = [
    { header: "Module", width: 25 },
    { header: "Grade", width: 10 },
    { header: "Score", width: 10 },
    { header: "Key Finding", width: 50 },
    { header: "Top Recommendation", width: 50 },
  ];
  headerStyle(scorecard, 1, 5);

  modules.forEach((m, i) => {
    const r = scorecard.getRow(i + 2);
    r.getCell(1).value = m.label;
    r.getCell(2).value = m.result?.grade || "-";
    r.getCell(3).value = m.result?.score || 0;
    r.getCell(4).value = m.result?.findings?.[0] || "-";
    r.getCell(5).value = m.result?.recommendations?.[0] || "-";
    for (let c = 1; c <= 5; c++) dataCell(r.getCell(c));
    // Color the grade cell
    const gc = gradeColorMap[m.result?.grade || ""] || GRAY;
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: gc } };
    r.getCell(2).font = { bold: true, color: { argb: WHITE }, size: 12, name: "Arial" };
    r.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    r.height = 30;
  });

  // ── Sheet 3: Recommendations ─────────────────────────────
  const recsSheet = wb.addWorksheet("Recommendations", { properties: { tabColor: { argb: PURPLE } } });
  recsSheet.columns = [
    { header: "#", width: 5 },
    { header: "Title", width: 30 },
    { header: "Description", width: 50 },
    { header: "Impact", width: 10 },
    { header: "Effort", width: 10 },
    { header: "Timeframe", width: 15 },
    { header: "Expected Outcome", width: 40 },
  ];
  headerStyle(recsSheet, 1, 7);

  const recs = enhancedRecs?.length ? enhancedRecs : (auditResult?.recommendations || []);
  recs.forEach((rec, i) => {
    const enhanced = rec as EnhancedRecommendation;
    const r = recsSheet.getRow(i + 2);
    r.getCell(1).value = i + 1;
    r.getCell(2).value = rec.title;
    r.getCell(3).value = displayRevenueText(rec.description);
    r.getCell(4).value = rec.impact.toUpperCase();
    r.getCell(5).value = rec.effort.toUpperCase();
    r.getCell(6).value = enhanced.timeframe || "-";
    r.getCell(7).value = enhanced.expected_outcome ? displayRevenueText(enhanced.expected_outcome) : "-";
    for (let c = 1; c <= 7; c++) dataCell(r.getCell(c));
    // Color impact
    const impactColors: Record<string, string> = { HIGH: "FEE2E2", MEDIUM: "FEF3C7", LOW: "DBEAFE" };
    r.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: impactColors[rec.impact.toUpperCase()] || "F3F4F6" } };
    r.height = 24;
  });

  // ── Sheet 4: AI Analysis (if available) ──────────────────
  if (aiAnalysis) {
    const aiSheet = wb.addWorksheet("AI Analysis", { properties: { tabColor: { argb: "F59E0B" } } });
    aiSheet.columns = [
      { header: "Type", width: 20 },
      { header: "Detail", width: 50 },
      { header: "Impact / Opportunity", width: 40 },
      { header: "Modules", width: 30 },
    ];
    headerStyle(aiSheet, 1, 4);

    let aiRow = 2;

    for (const chain of aiAnalysis.cross_module_synthesis.causal_chains) {
      const r = aiSheet.getRow(aiRow++);
      r.getCell(1).value = "Causal Chain";
      r.getCell(2).value = displayRevenueText(chain.chain);
      r.getCell(3).value = displayRevenueText(chain.business_impact);
      r.getCell(4).value = chain.modules_involved.join(", ");
      for (let c = 1; c <= 4; c++) dataCell(r.getCell(c));
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
    }

    for (const s of aiAnalysis.cross_module_synthesis.hidden_strengths) {
      const r = aiSheet.getRow(aiRow++);
      r.getCell(1).value = "Hidden Strength";
      r.getCell(2).value = displayRevenueText(s.strength);
      r.getCell(3).value = displayRevenueText(s.leverage_opportunity);
      r.getCell(4).value = "-";
      for (let c = 1; c <= 4; c++) dataCell(r.getCell(c));
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
    }

    for (const g of aiAnalysis.cross_module_synthesis.compounding_gaps) {
      const r = aiSheet.getRow(aiRow++);
      r.getCell(1).value = "Compounding Gap";
      r.getCell(2).value = displayRevenueText(g.description);
      r.getCell(3).value = displayRevenueText(g.combined_impact);
      r.getCell(4).value = g.involved_modules.join(", ");
      for (let c = 1; c <= 4; c++) dataCell(r.getCell(c));
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
    }

    // Priority actions sub-section
    const actionsSheet = wb.addWorksheet("Action Plan", { properties: { tabColor: { argb: "2563EB" } } });
    actionsSheet.columns = [
      { header: "#", width: 5 },
      { header: "Action", width: 40 },
      { header: "Rationale", width: 50 },
      { header: "Expected ROI", width: 20 },
      { header: "Timeframe", width: 15 },
      { header: "Unlocks", width: 30 },
    ];
    headerStyle(actionsSheet, 1, 6);

    aiAnalysis.priority_action_plan.forEach((action, i) => {
      const r = actionsSheet.getRow(i + 2);
      r.getCell(1).value = i + 1;
      r.getCell(2).value = action.action;
      r.getCell(3).value = displayRevenueText(action.rationale);
      r.getCell(4).value = displayRevenueText(action.expected_roi);
      r.getCell(5).value = action.timeframe;
      r.getCell(6).value = action.unlocks ? displayRevenueText(action.unlocks) : "-";
      for (let c = 1; c <= 6; c++) dataCell(r.getCell(c));
      r.height = 24;
    });
  }

  // ── Sheet 5: Module Details ──────────────────────────────
  for (const module of modules) {
    if (!module.result) continue;
    const sheetName = module.label.slice(0, 31); // Excel sheet name limit
    const ws = wb.addWorksheet(sheetName);
    ws.columns = [
      { header: "Metric", width: 25 },
      { header: "Value", width: 40 },
    ];
    headerStyle(ws, 1, 2);

    const r = module.result as any;
    const metrics: [string, string | number][] = [
      ["Grade", module.result.grade],
      ["Score", `${module.result.score}/100`],
    ];

    if (module.key === "gbp_health") {
      metrics.push(["Business Name", r.business_name || "-"], ["Rating", `${r.rating || "N/A"}`], ["Review Count", r.review_count || 0], ["Completeness", `${r.completeness_pct || 0}%`], ["Hours Complete", r.hours_complete ? "Yes" : "No"], ["Photos", r.photos_count || 0]);
    } else if (module.key === "review_sentiment") {
      metrics.push(["Google Rating", `${r.google_rating || "N/A"}`], ["Google Reviews", r.google_review_count || 0], ["Trend", r.trend_direction || "-"], ["Response Rate", `${r.owner_response_rate || 0}%`], ["Velocity", `${r.review_velocity || 0}/mo`]);
    } else if (module.key === "website_performance") {
      metrics.push(["Performance", `${r.performance_score}/100`], ["SEO", `${r.seo_score}/100`], ["Accessibility", `${r.accessibility_score}/100`], ["Mobile Friendly", r.mobile_friendly ? "Yes" : "No"], ["SSL Valid", r.ssl_valid ? "Yes" : "No"], ["Schema Markup", r.has_schema_markup ? "Yes" : "No"]);
    } else if (module.key === "tech_stack") {
      metrics.push(["Digital Maturity", `${r.digital_maturity_score}/100`], ["CMS", r.cms || "None"], ["Analytics", (r.analytics || []).join(", ") || "None"], ["Domain Age", `${r.domain_age_years || "?"} years`]);
    } else if (module.key === "social_presence") {
      metrics.push(["Platforms Found", r.platforms_found], ["Platforms Active", r.platforms_active], ["Total Following", r.total_following || 0], ["NAP Consistent", r.nap_consistent ? "Yes" : "No"]);
    } else if (module.key === "citation_consistency") {
      metrics.push(["Total Found", r.total_found], ["Correct", r.total_correct], ["Inconsistent", r.total_inconsistent], ["Missing", r.total_missing]);
    } else if (module.key === "competitive_comparison") {
      metrics.push(["Position", r.target_position || "-"], ["Competitors Analyzed", r.competitors?.length || 0]);
    } else if (module.key === "revenue_impact") {
      if (shouldShowRevenueDollars(r)) {
        metrics.push(["Monthly Leakage (Low)", `$${r.total_monthly_leakage?.low || 0}`], ["Monthly Leakage (Mid)", `$${r.total_monthly_leakage?.mid || 0}`], ["Monthly Leakage (High)", `$${r.total_monthly_leakage?.high || 0}`], ["Annual Impact (Mid)", `$${r.annual_impact?.mid || 0}`], ["ROI if Fixed", r.roi_if_fixed || "-"]);
      } else {
        metrics.push(["Impact Level", r.opportunity_assessment?.impact_level?.replace(/_/g, " ") || "Signals only"], ["Revenue Basis", "Unverified"], ["Confidence", r.opportunity_assessment?.confidence || "low"]);
      }
    }

    let mRow = 2;
    for (const [label, value] of metrics) {
      const mr = ws.getRow(mRow++);
      mr.getCell(1).value = label;
      mr.getCell(2).value = value;
      dataCell(mr.getCell(1), true);
      dataCell(mr.getCell(2));
    }

    // Add findings
    if (module.result.findings?.length) {
      mRow++;
      const fh = ws.getRow(mRow++);
      fh.getCell(1).value = "Key Findings";
      fh.getCell(1).font = { bold: true, size: 11, color: { argb: DARK }, name: "Arial" };
      for (const f of module.result.findings) {
        const fr = ws.getRow(mRow++);
        fr.getCell(1).value = displayRevenueText(f);
        fr.getCell(1).font = { size: 10, name: "Arial", color: { argb: "374151" } };
        fr.getCell(1).alignment = { wrapText: true };
      }
    }

    // Add recommendations
    if (module.result.recommendations?.length) {
      mRow++;
      const rh = ws.getRow(mRow++);
      rh.getCell(1).value = "Recommendations";
      rh.getCell(1).font = { bold: true, size: 11, color: { argb: DARK }, name: "Arial" };
      for (const rec of module.result.recommendations) {
        const rr = ws.getRow(mRow++);
        rr.getCell(1).value = displayRevenueText(rec);
        rr.getCell(1).font = { size: 10, name: "Arial", color: { argb: "374151" } };
        rr.getCell(1).alignment = { wrapText: true };
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
