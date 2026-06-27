#!/usr/bin/env node
/**
 * Phantom Reach MCP Server
 *
 * Exposes Phantom Reach audit & scout data to any MCP-compatible AI client.
 * Users install with: npx phantom-reach-mcp
 *
 * Tools provided:
 *  - phantom_reach_run_audit      — Run a full audit on a business
 *  - phantom_reach_get_report     — Retrieve a completed report by ID
 *  - phantom_reach_list_reports   — List recent reports
 *  - phantom_reach_run_scout      — Scout a city/category for opportunities
 *  - phantom_reach_get_scorecard  — Get a quick scorecard summary
 *  - phantom_reach_export_report  — Get export URL for a report
 *
 * Configuration via env:
 *  PHANTOM_REACH_API_URL  — Base URL (default: https://phantomreach.io)
 *  PHANTOM_REACH_API_KEY  — API key for authentication
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.PHANTOM_REACH_API_URL || "https://phantomreach.io";
const API_KEY = process.env.PHANTOM_REACH_API_KEY || "";
const CHARACTER_LIMIT = 25000;

async function apiRequest(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
): Promise<any> {
  const url = `${API_BASE}/api${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${endpoint} failed (${res.status}): ${text}`);
  }

  return res.json();
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[Truncated — full data available via report export]";
}

// ── Server Setup ─────────────────────────────────────────────

const server = new McpServer({
  name: "phantom-reach-mcp",
  version: "1.0.0",
});

// ── Tool: Run Audit ──────────────────────────────────────────

const RunAuditSchema = z.object({
  businessName: z.string().min(1).describe("Name of the business to audit"),
  city: z.string().optional().describe("City where the business is located"),
  state: z.string().optional().describe("State (US) or region"),
  url: z.string().url().optional().describe("Business website URL"),
  googleMapsUrl: z.string().url().optional().describe("Google Maps URL for the business"),
  customDirection: z.string().optional().describe("Custom analysis direction (e.g., 'focus on SEO gaps')"),
}).strict();

server.registerTool(
  "phantom_reach_run_audit",
  {
    title: "Run Business Audit",
    description:
      "Run a comprehensive 8-module digital health audit on a local business. " +
      "Analyzes GBP profile, reviews, website performance, tech stack, social presence, " +
      "citations, competitors, and revenue impact. Returns a report ID for retrieval.",
    inputSchema: RunAuditSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params: z.infer<typeof RunAuditSchema>) => {
    try {
      const data = await apiRequest("/audit", "POST", params);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            reportId: data.reportId,
            status: data.status,
            message: data.status === "processing"
              ? "Audit is running asynchronously. Use phantom_reach_get_report to check status."
              : "Audit completed.",
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    }
  },
);

// ── Tool: Get Report ─────────────────────────────────────────

const GetReportSchema = z.object({
  reportId: z.string().min(1).describe("The report ID returned from run_audit or run_scout"),
}).strict();

server.registerTool(
  "phantom_reach_get_report",
  {
    title: "Get Audit Report",
    description:
      "Retrieve a completed audit or scout report by ID. Returns the full analysis " +
      "including all module scores, findings, recommendations, AI analysis, " +
      "executive summary, and business intelligence signals.",
    inputSchema: GetReportSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params: z.infer<typeof GetReportSchema>) => {
    try {
      const data = await apiRequest(`/report/${params.reportId}`);
      const text = truncate(JSON.stringify(data, null, 2));
      return { content: [{ type: "text" as const, text }] };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    }
  },
);

// ── Tool: Get Scorecard ──────────────────────────────────────

server.registerTool(
  "phantom_reach_get_scorecard",
  {
    title: "Get Quick Scorecard",
    description:
      "Get a concise scorecard summary for a report — overall grade, module grades, " +
      "top findings, and top recommendation. Faster than fetching the full report.",
    inputSchema: GetReportSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params: z.infer<typeof GetReportSchema>) => {
    try {
      const data = await apiRequest(`/report/${params.reportId}`);
      const result = data.result || {};
      const scores = data.scores || {};

      const scorecard = {
        business: (data.input as any)?.businessName,
        overall_grade: scores.overall_grade,
        overall_score: scores.overall_score,
        module_grades: scores.module_grades || {},
        executive_summary: typeof result.executive_summary === "string"
          ? result.executive_summary.slice(0, 500)
          : result.executive_summary?.verdict_context || "",
        top_recommendation: result.recommendations?.[0]?.title,
        ai_confidence: result.ai_analysis?.data_quality_assessment?.overall_confidence,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(scorecard, null, 2) }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    }
  },
);

// ── Tool: Run Scout ──────────────────────────────────────────

const RunScoutSchema = z.object({
  city: z.string().min(1).describe("City to scout"),
  category: z.string().min(1).describe("Business category (e.g., 'dentists', 'restaurants')"),
  resultCount: z.number().int().min(1).max(100).default(10).describe("Number of businesses to scan"),
  customDirection: z.string().optional().describe("Custom focus for the scout scan"),
}).strict();

server.registerTool(
  "phantom_reach_run_scout",
  {
    title: "Run City Scout",
    description:
      "Scout a city for business opportunities in a given category. " +
      "Scans multiple businesses, ranks them by digital weakness, and " +
      "identifies the best prospects for outreach.",
    inputSchema: RunScoutSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params: z.infer<typeof RunScoutSchema>) => {
    try {
      const data = await apiRequest("/scout", "POST", params);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            reportId: data.reportId,
            status: data.status,
            message: "Scout is running. Use phantom_reach_get_report to retrieve results.",
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    }
  },
);

// ── Tool: Export Report ──────────────────────────────────────

const ExportReportSchema = z.object({
  reportId: z.string().min(1).describe("The report ID to export"),
  format: z.enum(["pdf", "docx", "pptx", "xlsx"]).describe("Export format"),
}).strict();

server.registerTool(
  "phantom_reach_export_report",
  {
    title: "Export Report",
    description:
      "Get a download URL for a report in the specified format. " +
      "Supported formats: PDF, DOCX (Word), PPTX (PowerPoint), XLSX (Excel).",
    inputSchema: ExportReportSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params: z.infer<typeof ExportReportSchema>) => {
    const url = `${API_BASE}/api/report/${params.reportId}/${params.format}`;
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          download_url: url,
          format: params.format,
          message: `Download the ${params.format.toUpperCase()} report from the URL above.`,
        }, null, 2),
      }],
    };
  },
);

// ── Tool: List Reports ───────────────────────────────────────

const ListReportsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10).describe("Max reports to return"),
  type: z.enum(["audit", "scout", "all"]).default("all").describe("Filter by report type"),
}).strict();

server.registerTool(
  "phantom_reach_list_reports",
  {
    title: "List Reports",
    description: "List recent audit and scout reports with their status and scores.",
    inputSchema: ListReportsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params: z.infer<typeof ListReportsSchema>) => {
    try {
      const data = await apiRequest(`/reports?limit=${params.limit}&type=${params.type}`);
      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify(data, null, 2)) }],
      };
    } catch (error: any) {
      return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    }
  },
);

// ── Start Server ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Phantom Reach MCP server running on stdio");
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
