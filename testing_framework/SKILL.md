# Phantom Reach — Agentic Testing Framework

> **Purpose**: An AI agent loads this skill, performs deep functional testing of the Phantom Reach codebase, finds and fixes bugs, then saves a dated session summary so future sessions know what was tested.

---

## How This Skill Works

1. **Agent reads this file** to understand the testing methodology, tools, and priorities.
2. **Agent reads past session summaries** from `testing_framework/sessions/` to understand what has already been tested, what bugs were found/fixed, and what areas remain untested.
3. **Agent deploys deep exploration** across the codebase, guided by the Testing Map below.
4. **Agent writes and runs tests** using the test utilities in `testing_framework/test-utils/`.
5. **Agent hunts for up to 10 bugs**. If 10 don't exist, that's fine — never fabricate bugs.
6. **Agent fixes each confirmed bug** directly in the source code.
7. **Agent saves a dated session summary** to `testing_framework/sessions/YYYY-MM-DD-session-N.md`.

---

## First Steps (Every Session)

```bash
# 1. Read this skill
# 2. Read the project context
cat CLAUDE.md                    # Project overview
cat IMPLEMENTATION_JOURNEY.md    # What's built, what's mock

# 3. Read past test sessions (learn what's been tested)
ls testing_framework/sessions/
# Read each session file to build context

# 4. Read the Testing Map below to pick focus areas
# 5. Install test dependencies if not already present
cd /path/to/phantom-reach-api
npm ls vitest 2>/dev/null || npm install --save-dev vitest @vitest/coverage-v8

# 6. Run existing tests first
npx vitest run --reporter=verbose 2>&1 | head -100
```

---

## Testing Map — What Needs Testing

### Tier 1: Critical Path (Test First)

These are the core pipeline modules. Bugs here break every audit/scout.

| Module | File | Key Functions | Risk Level |
|--------|------|--------------|------------|
| **Audit Orchestrator** | `src/lib/agents/orchestrator.ts` | `runAuditPipeline()`, scoring, Phase 0-4 | CRITICAL |
| **Scout Orchestrator** | `src/lib/agents/scout-orchestrator.ts` | `runScoutPipeline()`, discovery, enrichment | CRITICAL |
| **Scoring Engine** | `src/lib/agents/scoring.ts` | `calculateWeightedScore()`, `scoreToGrade()` | CRITICAL |
| **API: /api/audit** | `src/app/api/audit/route.ts` | POST validation, credit check, pipeline dispatch | CRITICAL |
| **API: /api/scout** | `src/app/api/scout/route.ts` | POST validation, blocking pipeline, timeout | CRITICAL |

#### Known Bug Hotspots in Tier 1:
- **Promise.all without error isolation** in orchestrator.ts lines 394-408 (6 parallel modules — one failure crashes all)
- **Phase 0 undefined propagation** to competitor module (lines 382-384)
- **Division by zero** in scout average rating calculation (line 268)
- **Income parsing fails on decimals** like "$65.5k" (scout-orchestrator.ts line 358)
- **No auth on any API route** — all use demo user fallback

### Tier 2: Data Gathering Tools

Each tool has a real API path and a mock fallback. Both paths need testing.

| Tool | File | Mock? | Key Edge Cases |
|------|------|-------|---------------|
| **Google Maps** | `src/lib/agents/tools/google-maps.ts` | Yes | Special chars in business name, missing hours |
| **Reviews** | `src/lib/agents/tools/reviews.ts` | Yes | `owner_response` always undefined (BUG), score ceiling varies |
| **PageSpeed** | `src/lib/agents/tools/pagespeed.ts` | Yes | INP/TBT confusion, rate limit fallback missing `is_mock` |
| **Tech Detect** | `src/lib/agents/tools/tech-detect.ts` | Yes | Large HTML timeout, regex efficiency |
| **Social Scan** | `src/lib/agents/tools/social-scan.ts` | Yes | Undefined website input |
| **Citations** | `src/lib/agents/tools/citations.ts` | Yes | Mock data frozen |
| **Competitors** | `src/lib/agents/tools/competitors.ts` | Yes | Undefined rating propagation |
| **Revenue Calc** | `src/lib/agents/tools/revenue-calc.ts` | Yes | Revenue leak rounding to $0k |
| **Intent Signals** | `src/lib/agents/tools/intent-signals.ts` | Yes | Signal severity unbounded |

#### Known Bug Hotspots in Tier 2:
- **reviews.ts line 77**: `owner_response: r.author_url ? undefined : undefined` — ALWAYS undefined regardless of condition
- **pagespeed.ts**: Treats INP and TBT as interchangeable (they measure different things)
- **tech-detect.ts**: No HTML size limit before regex matching — potential timeout on large pages
- **revenue-calc.ts**: Revenue leak < $500 rounds to "$0k" display

### Tier 3: AI Provider Layer

Multi-provider abstraction with complex fallback chains.

| Module | File | Key Functions | Risk Level |
|--------|------|--------------|------------|
| **Provider Router** | `src/lib/ai/claude.ts` | `getProvider()`, `complete()`, `extractJSON()`, `completeWithTools()` | HIGH |
| **Anthropic** | `src/lib/ai/providers/anthropic.ts` | JSON repair, OAuth fallback, agentic loop | HIGH |
| **OpenAI** | `src/lib/ai/providers/openai.ts` | Codex fallback, tool args parsing | HIGH |
| **Google** | `src/lib/ai/providers/google.ts` | Schema conversion, function call parsing | MEDIUM |
| **Codex** | `src/lib/ai/providers/codex-client.ts` | SSE parsing, credential caching | MEDIUM |

#### Known Bug Hotspots in Tier 3:
- **anthropic.ts `repairTruncatedJSON()`**: Doesn't handle escaped quotes in keys
- **openai.ts**: `_codexFailed = true` is a one-way door — never resets
- **google.ts**: `functionName!` non-null assertion could crash
- **codex-client.ts**: Credential cached as null forever — no refresh path

### Tier 4: Export Generators

Mechanical renderers that convert audit results to documents.

| Export | File | Key Risk |
|--------|------|---------|
| **PDF** | `src/lib/pdf/generate-pdf.ts` | No timeout on `renderToBuffer()`, OOM on large reports |
| **DOCX** | `src/lib/exports/generate-docx.ts` | Type casting without null check on `report.result` |
| **PPTX** | `src/lib/exports/generate-pptx.ts` | Text truncation mid-sentence (`.slice(0, 800)`) |
| **XLSX** | `src/lib/exports/generate-xlsx.ts` | Sheet name collision (31-char truncation) |

### Tier 5: Infrastructure

| Module | File | Key Risk |
|--------|------|---------|
| **Billing/Stripe** | `src/lib/billing/stripe.ts` | Webhook handlers are ALL TODO stubs, hardcoded email |
| **Tier Gating** | `src/lib/billing/tier-gate.ts` | Substring match on action names |
| **Auth** | `src/lib/auth/index.ts` | New user gets 0 credits (no initialization) |
| **Mock DB** | `src/lib/db/mock-db.ts` | Invalid plan → silent default |
| **Cache** | `src/lib/cache/memory.ts` | No LRU eviction, unbounded growth |
| **Redis** | `src/lib/cache/redis.ts` | Possible double URL-encoding |
| **Inngest** | `src/lib/inngest/functions.ts` | No granular error logging |
| **Email** | `src/lib/email/resend.ts` | No general rate limiting |
| **MCP Server** | `src/mcp/server.ts` | Error messages could leak internals |

---

## Tools Available to the Testing Agent

### 1. Vitest Test Runner
```bash
# Run all tests
npx vitest run

# Run specific test suite
npx vitest run testing_framework/test-suites/orchestrator.test.ts

# Run with coverage
npx vitest run --coverage

# Watch mode (for iterative development)
npx vitest --watch
```

### 2. TypeScript Compiler (Static Analysis)
```bash
# Type check entire project
npx tsc --noEmit

# Check specific patterns
npx tsc --noEmit 2>&1 | grep "error TS"
```

### 3. Code Grep (Pattern Detection)
```bash
# Find unsafe type assertions
grep -rn "as any" src/lib/ --include="*.ts"

# Find missing null checks
grep -rn "\!\." src/lib/ --include="*.ts"

# Find Promise.all without error handling
grep -rn "Promise\.all" src/lib/ --include="*.ts"

# Find silent catch blocks
grep -rn "catch.*{" src/lib/ --include="*.ts" -A 2

# Find TODO/FIXME/HACK
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts"
```

### 4. Test Utilities (testing_framework/test-utils/)
- `mock-factories.ts` — Create mock AuditInput, ScoutInput, Reports, Users
- `test-helpers.ts` — Common assertions, async helpers, error matchers

### 5. Direct Code Execution
```bash
# Run a specific function in isolation
npx tsx -e "
  const { calculateWeightedScore } = require('./src/lib/agents/scoring');
  console.log(calculateWeightedScore({}));
"
```

---

## Bug Hunting Strategy

### Phase A: Static Analysis (No Execution)
1. Run `npx tsc --noEmit` — fix any type errors first
2. Grep for known anti-patterns (see Tools section)
3. Read each Tier 1 file, trace data flow, find null-safety gaps

### Phase B: Unit Tests (Isolated Functions)
1. Write tests for pure functions first (scoring, parsing, formatting)
2. Test mock fallback paths (every tool should return valid data when API key missing)
3. Test edge cases: empty inputs, null fields, huge inputs, malformed data

### Phase C: Integration Tests (Module Interactions)
1. Test the full audit pipeline with mock data
2. Test the full scout pipeline with mock data
3. Test export generators with various report shapes (empty, partial, full)
4. Test API route handlers with mock requests

### Phase D: Adversarial Testing
1. Malformed inputs (SQL injection in business names, XSS in URLs)
2. Extremely large inputs (1MB business name, 10000 character URL)
3. Race conditions (concurrent audits, credit deduction races)
4. Type confusion (string where number expected, array where object expected)

---

## Bug Report Format

When a bug is found, document it as:

```markdown
### BUG-XXX: [Short Title]

**Severity**: CRITICAL | HIGH | MEDIUM | LOW
**File**: src/path/to/file.ts
**Line(s)**: 42-48
**Category**: null-safety | logic-error | type-mismatch | missing-validation | race-condition | performance

**Description**: What the bug is and why it matters.

**Reproduction**: How to trigger it (test case or manual steps).

**Root Cause**: Why the bug exists (code analysis).

**Fix Applied**: What was changed and why.

**Test Added**: Reference to the test that now catches this.
```

---

## Session Summary Format

After each testing session, save a file to `testing_framework/sessions/YYYY-MM-DD-session-N.md`:

```markdown
# Testing Session: YYYY-MM-DD (Session N)

## Focus Areas
- [Which tiers/modules were tested]

## Tests Written
- [List of test files created/modified]

## Bugs Found & Fixed
| ID | Title | Severity | File | Status |
|----|-------|----------|------|--------|
| BUG-001 | ... | HIGH | ... | FIXED |

## Bugs Found & Not Fixed (Needs Discussion)
| ID | Title | Severity | File | Reason |
|----|-------|----------|------|--------|

## Coverage Gaps Remaining
- [What still needs testing]

## Recommendations for Next Session
- [What the next testing agent should focus on]

## Test Results Summary
- Tests written: X
- Tests passing: Y
- Tests failing: Z
- Bugs found: N
- Bugs fixed: M
```

---

## Configuration

### vitest.config.ts
The testing framework expects a vitest config at the project root. If missing, create one:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['testing_framework/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/app/**', 'src/components/**', '**/*.d.ts'],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Test File Naming
- Unit tests: `testing_framework/test-suites/{module}.test.ts`
- Integration tests: `testing_framework/test-suites/{module}.integration.test.ts`

---

## Important Reminders

1. **Never fabricate bugs**. If you can't find 10 real bugs, report what you found honestly.
2. **Never break mock fallbacks**. Every external API call must still return valid mock data when env vars are missing.
3. **Read past sessions first**. Don't re-test what was already tested unless verifying a fix.
4. **Fix bugs in-place**. Don't create separate fix files — modify the actual source.
5. **Run `npx tsc --noEmit` after every fix** to ensure you haven't introduced type errors.
6. **Save your session summary** before finishing. Future agents depend on it.
