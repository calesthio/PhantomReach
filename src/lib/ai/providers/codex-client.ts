/**
 * Codex Backend Client
 *
 * Communicates with ChatGPT's Codex endpoint at
 * chatgpt.com/backend-api/codex/responses using the Responses API format.
 *
 * This allows using a ChatGPT Plus/Pro subscription's Codex OAuth token
 * for AI requests, billing against the subscription instead of API credits.
 *
 * Credentials are auto-detected from:
 *   1. CODEX_ACCESS_TOKEN + CODEX_ACCOUNT_ID env vars
 *   2. OPENAI_OAUTH_TOKEN + CODEX_ACCOUNT_ID env vars
 *   3. ~/.codex/auth.json (written by `npx @openai/codex login`)
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CODEX_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodexCredentials {
  accessToken: string;
  accountId: string;
  refreshToken?: string;
}

export class CodexError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "CodexError";
  }
}

/** Parsed response from a single Codex endpoint call. */
export interface CodexCallResult {
  /** Text output (concatenated from output_text items). */
  text: string | null;
  /** Function calls the model wants to make. */
  functionCalls: Array<{
    id: string;
    callId: string;
    name: string;
    arguments: string;
  }>;
  /** Token usage stats. */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Response ID for reference. */
  responseId?: string;
}

// ---------------------------------------------------------------------------
// Credential loading
// ---------------------------------------------------------------------------

let _cachedCredentials: CodexCredentials | null | undefined;

/**
 * Load Codex credentials from environment variables or ~/.codex/auth.json.
 * Caches the result — call resetCodexCredentials() to force reload.
 */
export function getCodexCredentials(): CodexCredentials | null {
  if (_cachedCredentials !== undefined) return _cachedCredentials;

  // Method 1: Explicit env vars
  const envToken = process.env.CODEX_ACCESS_TOKEN;
  const envAccountId = process.env.CODEX_ACCOUNT_ID;
  if (envToken && envAccountId) {
    console.log("[codex] Using credentials from CODEX_ACCESS_TOKEN + CODEX_ACCOUNT_ID env vars");
    _cachedCredentials = { accessToken: envToken, accountId: envAccountId };
    return _cachedCredentials;
  }

  // Method 2: OPENAI_OAUTH_TOKEN + CODEX_ACCOUNT_ID
  const oauthToken = process.env.OPENAI_OAUTH_TOKEN;
  if (oauthToken && envAccountId) {
    console.log("[codex] Using credentials from OPENAI_OAUTH_TOKEN + CODEX_ACCOUNT_ID env vars");
    _cachedCredentials = { accessToken: oauthToken, accountId: envAccountId };
    return _cachedCredentials;
  }

  // Method 3: Read from ~/.codex/auth.json (written by `npx @openai/codex login`)
  try {
    const authPath = path.join(os.homedir(), ".codex", "auth.json");
    const raw = fs.readFileSync(authPath, "utf-8");
    const authData = JSON.parse(raw);
    if (authData?.tokens?.access_token && authData?.tokens?.account_id) {
      console.log("[codex] Using credentials from ~/.codex/auth.json");
      _cachedCredentials = {
        accessToken: authData.tokens.access_token,
        accountId: authData.tokens.account_id,
        refreshToken: authData.tokens.refresh_token,
      };
      return _cachedCredentials;
    }
  } catch {
    // File doesn't exist or isn't parseable — not an error
  }

  _cachedCredentials = null;
  return null;
}

/** Reset cached credentials (e.g., after token refresh). */
export function resetCodexCredentials(): void {
  _cachedCredentials = undefined;
}

// ---------------------------------------------------------------------------
// SSE Stream Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Server-Sent Events stream into accumulated response data.
 * Handles the OpenAI Responses API streaming event format.
 */
async function parseSSEStream(response: Response): Promise<CodexCallResult> {
  let text = "";
  const functionCalls: CodexCallResult["functionCalls"] = [];
  let usage: CodexCallResult["usage"];
  let responseId: string | undefined;

  // Accumulate function call arguments by item ID
  const fcArgBuffers = new Map<string, { id: string; callId: string; name: string; args: string }>();

  const reader = response.body?.getReader();
  if (!reader) {
    throw new CodexError("Response body is not readable");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        let event: any;
        try {
          event = JSON.parse(data);
        } catch {
          continue; // Skip unparseable lines
        }

        switch (event.type) {
          case "response.created":
            responseId = event.response?.id;
            break;

          case "response.output_text.delta":
            text += event.delta || "";
            break;

          case "response.output_item.added": {
            const item = event.item;
            if (item?.type === "function_call") {
              const key = item.id || `idx_${event.output_index}`;
              fcArgBuffers.set(key, {
                id: item.id || "",
                callId: item.call_id || item.id || "",
                name: item.name || "",
                args: "",
              });
            }
            break;
          }

          case "response.function_call_arguments.delta": {
            const key = event.item_id || `idx_${event.output_index}`;
            const existing = fcArgBuffers.get(key);
            if (existing) {
              existing.args += event.delta || "";
            }
            break;
          }

          case "response.output_item.done": {
            const item = event.item;
            if (item?.type === "function_call") {
              const key = item.id || `idx_${event.output_index}`;
              const buffered = fcArgBuffers.get(key);
              functionCalls.push({
                id: item.id || "",
                callId: item.call_id || item.id || "",
                name: item.name || "",
                arguments: buffered?.args || item.arguments || "{}",
              });
              fcArgBuffers.delete(key);
            }
            break;
          }

          case "response.completed": {
            const resp = event.response;
            if (resp?.usage) {
              usage = {
                inputTokens: resp.usage.input_tokens || 0,
                outputTokens: resp.usage.output_tokens || 0,
              };
            }
            // Extract text from completed response if we didn't get it via deltas
            if (!text && resp?.output) {
              for (const item of resp.output) {
                if (item.type === "message" && item.content) {
                  for (const part of item.content) {
                    if (part.type === "output_text" && part.text) {
                      text = part.text;
                    }
                  }
                }
              }
            }
            responseId = resp?.id || responseId;
            break;
          }

          case "response.failed": {
            const error = event.response?.error || event.error;
            throw new CodexError(
              `Codex response failed: ${error?.message || JSON.stringify(error)}`,
            );
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { text: text || null, functionCalls, usage, responseId };
}

// ---------------------------------------------------------------------------
// Non-streaming JSON response parsing
// ---------------------------------------------------------------------------

function parseJSONResponse(data: any): CodexCallResult {
  let text = "";
  const functionCalls: CodexCallResult["functionCalls"] = [];

  if (data.output) {
    for (const item of data.output) {
      if (item.type === "message" && item.content) {
        for (const part of item.content) {
          if (part.type === "output_text") {
            text += part.text || "";
          }
        }
      } else if (item.type === "function_call") {
        functionCalls.push({
          id: item.id || "",
          callId: item.call_id || item.id || "",
          name: item.name || "",
          arguments: item.arguments || "{}",
        });
      }
    }
  }

  return {
    text: text || null,
    functionCalls,
    usage: data.usage ? {
      inputTokens: data.usage.input_tokens || 0,
      outputTokens: data.usage.output_tokens || 0,
    } : undefined,
    responseId: data.id,
  };
}

// ---------------------------------------------------------------------------
// Core API call
// ---------------------------------------------------------------------------

/**
 * Make a single call to the Codex endpoint.
 * Automatically handles both JSON and SSE response formats.
 */
export async function callCodexEndpoint(
  credentials: CodexCredentials,
  body: Record<string, any>,
): Promise<CodexCallResult> {
  const response = await fetch(CODEX_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${credentials.accessToken}`,
      "ChatGPT-Account-Id": credentials.accountId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorBody: string;
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "(could not read error body)";
    }
    throw new CodexError(
      `Codex endpoint returned ${response.status}: ${errorBody.slice(0, 500)}`,
      response.status,
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    return parseSSEStream(response);
  }

  // The Codex endpoint often returns NO Content-Type header for SSE responses.
  // Read the body as text first and sniff whether it's SSE or JSON.
  const bodyText = await response.text();
  const trimmedBody = bodyText.trimStart();
  if (trimmedBody.startsWith("event:") || trimmedBody.startsWith("data:")) {
    // It's an SSE stream — parse it by re-wrapping as a Response
    const sseResponse = new Response(bodyText, { headers: response.headers });
    return parseSSEStream(sseResponse);
  }

  // Non-streaming JSON response
  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new CodexError(`Codex endpoint returned non-JSON, non-SSE response: ${bodyText.slice(0, 300)}`);
  }
  return parseJSONResponse(data);
}

// ---------------------------------------------------------------------------
// High-level completion methods
// ---------------------------------------------------------------------------

/**
 * Single-turn completion via Codex endpoint.
 *
 * Codex endpoint constraints (discovered via testing):
 *   - `instructions` field is REQUIRED (empty string is fine)
 *   - `input` MUST be an array (string input returns 400)
 *   - `stream` MUST be true (non-streaming returns 400)
 *   - Only codex-specific models work (e.g. gpt-5.2-codex, gpt-5.3-codex)
 */
export async function codexComplete(
  credentials: CodexCredentials,
  opts: {
    model: string;
    system?: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<{ text: string | null; usage?: { inputTokens: number; outputTokens: number } }> {
  console.log(`[codex] complete: model=${opts.model}, maxTokens=${opts.maxTokens}, promptLen=${opts.prompt.length}`);

  const result = await callCodexEndpoint(credentials, {
    model: opts.model,
    instructions: opts.system || "You are a helpful assistant.",
    input: [
      { role: "user", content: [{ type: "input_text", text: opts.prompt }] },
    ],
    store: false,
    stream: true,
    // Note: max_output_tokens and temperature are NOT supported by the Codex endpoint (returns 400).
    // The endpoint controls these internally.
  });

  console.log(`[codex] complete: got response (${result.text?.length || 0} chars), usage: ${JSON.stringify(result.usage)}`);
  return { text: result.text, usage: result.usage };
}

/**
 * Agentic tool-use loop via Codex endpoint.
 * Uses the Responses API format with function_call / function_call_output items.
 */
export async function codexCompleteWithTools(
  credentials: CodexCredentials,
  opts: {
    model: string;
    system?: string;
    prompt: string;
    tools: Array<{ name: string; description: string; input_schema: any }>;
    executeTools: (name: string, input: Record<string, unknown>) => Promise<string>;
    maxTokens?: number;
    temperature?: number;
    maxTurns?: number;
  },
): Promise<{
  text: string | null;
  toolCalls: Array<{ name: string; input: any; result: any }>;
  usage?: { inputTokens: number; outputTokens: number };
}> {
  const maxTurns = opts.maxTurns || 15;
  const allToolCalls: Array<{ name: string; input: any; result: any }> = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Convert tools to Responses API format
  const tools = opts.tools.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }));

  // Build input accumulator — starts with just the user message
  const inputItems: any[] = [
    {
      role: "user",
      content: [{ type: "input_text", text: opts.prompt }],
    },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    console.log(`[codex] completeWithTools: turn ${turn + 1}/${maxTurns}`);

    const result = await callCodexEndpoint(credentials, {
      model: opts.model,
      instructions: opts.system || "You are a helpful assistant.",
      input: inputItems,
      tools,
      store: false,
      stream: true,
      // Note: max_output_tokens and temperature are NOT supported by the Codex endpoint (returns 400).
    });

    if (result.usage) {
      totalInputTokens += result.usage.inputTokens;
      totalOutputTokens += result.usage.outputTokens;
    }

    // If no function calls, model is done — return text
    if (result.functionCalls.length === 0) {
      return {
        text: result.text,
        toolCalls: allToolCalls,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      };
    }

    // Execute function calls and add results to input
    for (const fc of result.functionCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(fc.arguments);
      } catch {
        console.error(`[codex] Failed to parse tool args for ${fc.name}:`, fc.arguments);
        args = {};
      }

      console.log(`[codex] Tool call: ${fc.name}`, JSON.stringify(args).slice(0, 200));

      let toolResult: string;
      try {
        toolResult = await opts.executeTools(fc.name, args);
      } catch (err) {
        toolResult = `Error executing tool ${fc.name}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[codex] Tool error:`, toolResult);
      }

      allToolCalls.push({ name: fc.name, input: args, result: toolResult });

      // Append function call + result to conversation for next turn
      inputItems.push({
        type: "function_call",
        id: fc.id,
        call_id: fc.callId,
        name: fc.name,
        arguments: fc.arguments,
      });
      inputItems.push({
        type: "function_call_output",
        call_id: fc.callId,
        output: toolResult,
      });
    }
  }

  console.warn(`[codex] Hit max turns (${maxTurns}) in agentic loop`);
  return {
    text: "Analysis incomplete — reached maximum tool call limit. Results may be partial.",
    toolCalls: allToolCalls,
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  };
}

/**
 * Check if an error is a Codex auth error (401/403).
 * Signals that the token may be expired and fallback should be used.
 */
export function isCodexAuthError(error: unknown): boolean {
  if (error instanceof CodexError) {
    return error.status === 401 || error.status === 403;
  }
  return false;
}
