/**
 * Provider-agnostic LLM interfaces for Phantom Reach.
 *
 * One frontier model per provider. No tiering. No cost optimization compromises.
 * The provider selection is a business/preference decision, not a cost decision.
 */

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface CompletionRequest {
  /** System prompt (optional). */
  system?: string;
  /** User message content. */
  prompt: string;
  /** Max tokens to generate. Defaults to 1024. */
  maxTokens?: number;
  /** Temperature 0-1. Defaults to 0.3. */
  temperature?: number;
}

export interface CompletionResponse {
  /** Generated text or null if provider unavailable. */
  text: string | null;
  /** Token usage stats (if available from provider). */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Tool-use / Agentic types
// ---------------------------------------------------------------------------

/** A tool definition the model can call. */
export interface ToolDefinition {
  /** Unique tool name (e.g., "web_search", "search_google_places"). */
  name: string;
  /** What this tool does — the model reads this to decide when to use it. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

/** Function that executes a tool call and returns a string result. */
export type ToolExecutor = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<string>;

/** Request for an agentic completion with tool-use loop. */
export interface AgenticRequest {
  /** System prompt. */
  system?: string;
  /** Initial user message. */
  prompt: string;
  /** Available tools the model can call. */
  tools: ToolDefinition[];
  /** Function to execute tool calls. Called by the provider during the loop. */
  executeTools: ToolExecutor;
  /** Max tokens per turn. Defaults to 8192. */
  maxTokens?: number;
  /** Temperature 0-1. Defaults to 0.4. */
  temperature?: number;
  /** Maximum number of tool-call rounds. Defaults to 15. */
  maxTurns?: number;
}

/** Response from an agentic completion. */
export interface AgenticResponse {
  /** Final text output from the model. */
  text: string | null;
  /** All tool calls made during the loop. */
  toolCalls: { name: string; input: any; result: any }[];
  /** Aggregate token usage across all turns. */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Provider capabilities
// ---------------------------------------------------------------------------

export interface LLMCapabilities {
  /** Whether the provider supports extended thinking / chain-of-thought. */
  supportsExtendedThinking: boolean;
  /** Whether the provider can return multiple tool_use blocks in parallel. */
  supportsParallelToolCalls: boolean;
  /** Whether the provider supports structured JSON output mode. */
  supportsStructuredOutput: boolean;
  /** Maximum context window in tokens. */
  maxContextTokens: number;
}

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

export type AuthMode = "api_key" | "oauth_token" | "codex";

export interface ProviderAuthConfig {
  /** How to authenticate with the provider. */
  mode: AuthMode;
  /** The API key or OAuth Bearer token. */
  credential: string;
  /** Optional: base URL override (e.g., for proxies or enterprise endpoints). */
  baseURL?: string;
  /** Optional: organization ID (OpenAI-specific). */
  organizationId?: string;
  /** Optional: Vertex AI project ID (Google-specific). */
  vertexProject?: string;
  /** Optional: Vertex AI location (Google-specific, defaults to us-central1). */
  vertexLocation?: string;
}

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

export interface LLMProviderConfig {
  /** Which provider to use. */
  provider: "anthropic" | "openai" | "google";
  /** API key for the provider. */
  apiKey: string;
  /** The single frontier model to use. */
  model: string;
  /** Optional: auth mode and credentials (overrides apiKey if set). */
  auth?: ProviderAuthConfig;
}

// ---------------------------------------------------------------------------
// Provider interface — the core abstraction
// ---------------------------------------------------------------------------

export interface LLMProvider {
  /** Send a single-turn message and return the text response. */
  complete(req: CompletionRequest): Promise<CompletionResponse>;

  /** Send a prompt and parse the response as JSON. */
  extractJSON<T = unknown>(req: CompletionRequest): Promise<T | null>;

  /** Run an agentic tool-use completion loop. Optional — not all providers may support it. */
  completeWithTools?(req: AgenticRequest): Promise<AgenticResponse>;

  /** Check whether the provider API is configured and usable. */
  isConfigured(): boolean;

  /** Return the capabilities of this provider's model. */
  getCapabilities(): LLMCapabilities;

  /** Human-readable provider name. */
  getProviderName(): string;
}
