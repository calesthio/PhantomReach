/**
 * Anthropic provider implementation.
 *
 * Single model: Claude Opus 4.6 — the frontier model for ALL reasoning.
 * No Sonnet/Haiku split. One model does everything.
 *
 * Supports two modes:
 * 1. Single-turn completions (complete / extractJSON)
 * 2. Agentic tool-use loops (completeWithTools) — the model calls tools
 *    in a loop until it produces a final text response.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProvider,
  LLMCapabilities,
  CompletionRequest,
  CompletionResponse,
  ToolDefinition,
  AgenticRequest,
  AgenticResponse,
  ToolExecutor,
} from "../types";

// ---------------------------------------------------------------------------
// Model constant — single frontier model
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: Anthropic | null | undefined;
let _usingOAuth = false;
let _oauthFailed = false;

function getClient(): Anthropic | null {
  if (_client !== undefined) return _client;

  const oauthToken = process.env.ANTHROPIC_OAUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Try OAuth first (unless it already failed this session)
  if (oauthToken && !_oauthFailed) {
    console.log("[ai/anthropic] Using OAuth Bearer token for authentication");
    _usingOAuth = true;
    _client = new Anthropic({
      apiKey: oauthToken,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
      defaultHeaders: {
        "Authorization": `Bearer ${oauthToken}`,
      },
    });
    return _client;
  }

  // Fallback to API key
  if (apiKey) {
    if (_oauthFailed) {
      console.log("[ai/anthropic] OAuth failed, using API key fallback");
    } else {
      console.log("[ai/anthropic] Using API key for authentication");
    }
    _usingOAuth = false;
    _client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });
    return _client;
  }

  console.warn(
    "[ai/anthropic] Neither ANTHROPIC_API_KEY nor ANTHROPIC_OAUTH_TOKEN set — Anthropic provider disabled"
  );
  _client = null;
  return null;
}

function isAuthError(error: unknown): boolean {
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  if (status === 401 || status === 403) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes("unauthorized") || msg.includes("invalid api key") ||
    msg.includes("invalid x-api-key") || msg.includes("authentication");
}

function handleOAuthFailure(error: unknown): boolean {
  if (!_usingOAuth) return false;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  const msg = error instanceof Error ? error.message : String(error);

  console.warn(
    `[ai/anthropic] ⚠️ OAuth token authentication failed (status=${status}): ${msg}`
  );

  if (apiKey) {
    console.log("[ai/anthropic] Falling back to API key authentication...");
    _oauthFailed = true;
    _client = undefined;
    return true;
  }

  console.error("[ai/anthropic] No ANTHROPIC_API_KEY available for fallback — request will fail");
  return false;
}

/** Reset the singleton (used when auth config changes at runtime). */
export function resetAnthropicClient(): void {
  _client = undefined;
  _oauthFailed = false;
  _usingOAuth = false;
}

// ---------------------------------------------------------------------------
// Robust JSON extraction — handles markdown fencing, truncation, edge cases
// ---------------------------------------------------------------------------

function robustParseJSON<T>(text: string): T | null {
  const trimmed = text.trim();

  // Strategy 1: Direct parse (model returned clean JSON)
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continue to next strategy
  }

  // Strategy 2: Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fencePattern = /```(?:json)?\s*\n?([\s\S]*?)(?:\n?```\s*$|$)/i;
  const fenceMatch = trimmed.match(fencePattern);
  if (fenceMatch?.[1]) {
    const inner = fenceMatch[1].trim();
    try {
      return JSON.parse(inner) as T;
    } catch {
      // Try balanced extraction from inside fences
      const balanced = extractBalancedJSON(inner);
      if (balanced) {
        try { return JSON.parse(balanced) as T; } catch { /* continue */ }
      }
      // Try repair if truncated
      const repaired = repairTruncatedJSON(inner);
      if (repaired) {
        try { return JSON.parse(repaired) as T; } catch { /* continue */ }
      }
    }
  }

  // Strategy 3: Extract balanced JSON object from text
  // This handles: text before JSON, text after JSON, or both
  const balanced = extractBalancedJSON(trimmed);
  if (balanced) {
    try {
      return JSON.parse(balanced) as T;
    } catch {
      // continue
    }
  }

  // Strategy 4: Find first { and attempt to parse from there (legacy fallback)
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace >= 0) {
    const jsonCandidate = trimmed.slice(firstBrace);
    try {
      return JSON.parse(jsonCandidate) as T;
    } catch {
      const repaired = repairTruncatedJSON(jsonCandidate);
      if (repaired) {
        try { return JSON.parse(repaired) as T; } catch { /* exhausted */ }
      }
    }
  }

  console.error("[ai/anthropic] robustParseJSON: all strategies failed, text starts with:", trimmed.slice(0, 200));
  return null;
}

/**
 * Extract a balanced JSON object from text that may have surrounding content.
 * Finds the first '{' and tracks balanced braces to find the matching '}'.
 * Handles nested objects, arrays, and strings correctly.
 */
function extractBalancedJSON(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        // Found the matching closing brace
        return text.slice(start, i + 1);
      }
    }
  }

  // Didn't find matching close — JSON is truncated
  // Return null so caller can try repair strategy
  return null;
}

/**
 * Attempt to repair truncated JSON by closing unclosed brackets/braces/strings.
 * This handles the common case where max_tokens cuts off the response mid-JSON.
 */
function repairTruncatedJSON(json: string): string | null {
  let s = json.trim();

  // Remove trailing comma if present
  s = s.replace(/,\s*$/, "");

  // Track what needs closing
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"' && !escape) {
      if (inString) {
        inString = false;
      } else {
        inString = true;
      }
      continue;
    }

    if (inString) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  // If we're in a string, close it
  if (inString) {
    s += '"';
  }

  // Close all unclosed brackets/braces
  while (stack.length > 0) {
    s += stack.pop();
  }

  return s;
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

class AnthropicProvider implements LLMProvider {
  private async _doComplete(req: CompletionRequest): Promise<CompletionResponse> {
    const client = getClient();
    if (!client) return { text: null };

    const {
      system,
      prompt,
      maxTokens = 1024,
      temperature = 0.3,
    } = req;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    });

    // Log stop reason — critical for debugging truncation issues
    if (response.stop_reason === "max_tokens") {
      console.warn(
        `[ai/anthropic] ⚠️ Response TRUNCATED (stop_reason=max_tokens). ` +
        `max_tokens=${maxTokens}, output_tokens=${response.usage?.output_tokens}. ` +
        `The model ran out of output space — consider increasing maxTokens or simplifying the prompt.`
      );
    }

    const textBlocks = response.content.filter((b) => b.type === "text");
    const text = textBlocks.map((b) => b.text).join("") || null;

    return {
      text,
      usage: response.usage
        ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        }
        : undefined,
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    try {
      return await this._doComplete(req);
    } catch (error) {
      if (isAuthError(error) && handleOAuthFailure(error)) {
        return await this._doComplete(req);
      }
      throw error;
    }
  }

  async extractJSON<T = unknown>(req: CompletionRequest): Promise<T | null> {
    console.log(`[ai/anthropic] extractJSON called (maxTokens=${req.maxTokens}, promptLen=${req.prompt.length})`);

    let text: string | null;
    try {
      const response = await this.complete(req);
      text = response.text;
    } catch (apiError) {
      console.error("[ai/anthropic] extractJSON: API call failed:", apiError instanceof Error ? apiError.message : String(apiError));
      throw apiError; // Re-throw so caller knows it was an API failure, not a parse failure
    }

    if (!text) {
      console.error("[ai/anthropic] extractJSON: API returned empty/null text");
      return null;
    }

    console.log(`[ai/anthropic] extractJSON: got response (${text.length} chars), starts with: ${JSON.stringify(text.slice(0, 100))}`);
    console.log(`[ai/anthropic] extractJSON: ends with: ${JSON.stringify(text.slice(-100))}`);

    try {
      const parsed = robustParseJSON<T>(text);
      if (parsed !== null) {
        console.log("[ai/anthropic] extractJSON: successfully parsed JSON");
        return parsed;
      }

      console.error(
        "[ai/anthropic] extractJSON: FAILED to parse. Response length:",
        text.length,
        "First 500 chars:", text.slice(0, 500)
      );
      return null;
    } catch (e) {
      console.error(
        "[ai/anthropic] extractJSON: exception during parse:",
        e instanceof Error ? e.message : String(e),
        "Response first 300 chars:", text.slice(0, 300)
      );
      return null;
    }
  }

  /**
   * Agentic tool-use loop.
   *
   * The model is given a set of tools it can call. It calls them in a loop
   * (up to maxTurns) until it produces a final text response with stop_reason="end_turn".
   *
   * This is the core of the agentic architecture — the AI decides what data
   * to gather, calls tools to get it, and synthesizes the results.
   */
  private async _doCompleteWithTools(req: AgenticRequest): Promise<AgenticResponse> {
    const client = getClient();
    if (!client) return { text: null, toolCalls: [] };

    const {
      system,
      prompt,
      tools,
      executeTools,
      maxTokens = 8192,
      temperature = 0.4,
      maxTurns = 15,
    } = req;

    // Convert our tool definitions to Anthropic format
    const anthropicTools: Anthropic.Messages.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema,
    }));

    // Build conversation messages
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: prompt },
    ];

    const allToolCalls: { name: string; input: any; result: any }[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let turn = 0; turn < maxTurns; turn++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        tools: anthropicTools,
        messages,
      });

      // Track usage
      if (response.usage) {
        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;
      }

      // Check if the model is done (no more tool calls)
      if (response.stop_reason === "end_turn") {
        const textBlocks = response.content.filter((b) => b.type === "text");
        const text = textBlocks.map((b) => (b as Anthropic.Messages.TextBlock).text).join("") || null;
        return {
          text,
          toolCalls: allToolCalls,
          usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        };
      }

      // Extract tool use blocks
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use"
      ) as Anthropic.Messages.ToolUseBlock[];

      if (toolUseBlocks.length === 0) {
        // No tool calls and not end_turn — extract text and return
        const textBlocks = response.content.filter((b) => b.type === "text");
        const text = textBlocks.map((b) => (b as Anthropic.Messages.TextBlock).text).join("") || null;
        return {
          text,
          toolCalls: allToolCalls,
          usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        };
      }

      // Add assistant's response to conversation
      messages.push({ role: "assistant", content: response.content });

      // Execute each tool call and build the tool results
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`[ai/anthropic] Tool call: ${toolUse.name}`, JSON.stringify(toolUse.input).slice(0, 200));

        let result: string;
        try {
          result = await executeTools(toolUse.name, toolUse.input as Record<string, unknown>);
        } catch (err) {
          result = `Error executing tool ${toolUse.name}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[ai/anthropic] Tool error:`, result);
        }

        allToolCalls.push({ name: toolUse.name, input: toolUse.input, result });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add tool results to conversation
      messages.push({ role: "user", content: toolResults });
    }

    // Hit max turns — extract whatever text we have
    console.warn(`[ai/anthropic] Hit max turns (${maxTurns}) in agentic loop`);
    return {
      text: "Analysis incomplete — reached maximum tool call limit. Results may be partial.",
      toolCalls: allToolCalls,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    };
  }

  async completeWithTools(req: AgenticRequest): Promise<AgenticResponse> {
    try {
      return await this._doCompleteWithTools(req);
    } catch (error) {
      if (isAuthError(error) && handleOAuthFailure(error)) {
        return await this._doCompleteWithTools(req);
      }
      throw error;
    }
  }

  isConfigured(): boolean {
    return getClient() !== null;
  }

  getCapabilities(): LLMCapabilities {
    return {
      supportsExtendedThinking: true,
      supportsParallelToolCalls: true,
      supportsStructuredOutput: true,
      maxContextTokens: 200_000,
    };
  }

  getProviderName(): string {
    return "anthropic";
  }
}

// ---------------------------------------------------------------------------
// Export singleton instance
// ---------------------------------------------------------------------------

export const anthropicProvider = new AnthropicProvider();
