# Phantom Reach Agent Playbook

This file is the canonical instruction file for coding assistants working in this repository. Keep tool-specific files such as `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, Cursor rules, Continue rules, and Aider conventions as short pointers back here.

## What This Project Is

Phantom Reach is a local-first business audit app for nontechnical marketers, agencies, consultants, and sales teams. A user enters a local business, the app gathers public digital-presence signals, and it renders a consultant-style audit report.

Current product focus:

- Audit Reports are the primary workflow.
- City Scout is intentionally hidden for now. Do not revive Scout UI or scout workflows unless the user explicitly asks.
- The app runs locally with SQLite. It must not require Supabase, Stripe, Resend, Inngest, or SaaS infrastructure for normal local use.
- Missing external keys should make a module unavailable. Never fabricate mock data or fake findings.

## Agent Mission

When the user asks for help, act like a local research and implementation agent:

- Run the app locally.
- Generate audit reports through the UI or API.
- Read stored report JSON.
- Inspect report quality and source coverage.
- Gather extra public intelligence when the user asks for deeper insight.
- Produce supplemental artifacts in `output/` when useful.
- Improve the app while preserving the local-first, no-fake-data direction.

If in-app AI keys are missing, a coding assistant can still help by reading the raw audit data, doing cited public research, and writing supplemental analysis for the user.

## Local Runbook

Use Node.js 20 or newer.

```bash
npm run local
```

That prepares the local workspace and starts the app at:

```text
http://127.0.0.1:3000
```

For development-only startup:

```bash
npm run dev
```

Common local pages:

- `/audits` - audit history
- `/audits/new` - run a new audit
- `/audits/{reportId}` - rendered audit report
- `/settings` - API keys and local workspace settings

## API Workflow

Generate an audit:

```bash
curl -X POST http://127.0.0.1:3000/api/audit \
  -H "Content-Type: application/json" \
  -d "{\"businessName\":\"Bellevue Dental Arts\",\"city\":\"Bellevue\",\"state\":\"WA\"}"
```

The response includes a `reportId`.

Poll or fetch the report:

```bash
curl http://127.0.0.1:3000/api/report/{reportId}
```

List reports:

```bash
curl "http://127.0.0.1:3000/api/reports?type=audit"
```

Export routes may exist for a completed report:

```text
/api/report/{reportId}/pdf
/api/report/{reportId}/docx
/api/report/{reportId}/pptx
/api/report/{reportId}/xlsx
```

Prefer the browser UI for visual checks and the API/SQLite for exact data inspection.

## Where Data Lives

Local runtime files:

- `data/phantom-reach.db` - SQLite report database and local workspace user.
- `data/phantom-reach.local.sqlite` - saved local data-source secrets in some workflows.
- `.phantom-reach/instance.key` - local encryption key for saved secrets.
- `output/` - generated analysis artifacts, report extracts, screenshots, and debugging outputs.
- `output/playwright/` - Playwright screenshots and UI verification artifacts.

Do not share or commit local secrets, `.phantom-reach/instance.key`, `.env.local`, or local database contents.

To inspect a report directly from SQLite:

```bash
node -e "const Database=require('better-sqlite3'); const db=new Database('data/phantom-reach.db'); const row=db.prepare('select id,status,input,result,scores,created_at from reports where id=?').get(process.argv[1]); console.log(JSON.stringify({...row,input:JSON.parse(row.input),result:JSON.parse(row.result),scores:JSON.parse(row.scores)},null,2));" REPORT_ID
```

## Data Sources

Keys are managed at `/settings` and can also be supplied via env vars.

Important keys:

- `GOOGLE_PLACES_API_KEY` - business lookup, Google profile, reviews, competitors.
- `GOOGLE_PAGESPEED_API_KEY` - PageSpeed and Lighthouse data.
- `GOOGLE_CRUX_API_KEY` - Chrome UX Report field data. Optional; PageSpeed or Places key may work only if CrUX API is enabled for that key.
- `CENSUS_API_KEY` - optional ZIP-level Census enrichment.
- `OPENCORPORATES_API_TOKEN` - optional public business filing enrichment.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_AI_API_KEY` - optional AI synthesis.

Rules:

- If a key is missing, report the source as unavailable.
- If a source fails, preserve the diagnostic internally but show marketer-readable notes in the UI.
- Never use synthetic fallback data in reports.

## Report Analysis Workflow

When asked to evaluate or deepen an audit report:

1. Identify the report ID from the URL, page, API response, or SQLite.
2. Fetch `/api/report/{reportId}` or read the row from `data/phantom-reach.db`.
3. Inspect `result.evidence`, module outputs, `business_enrichment`, `ai_analysis`, recommendations, and rendered report text.
4. Separate verified facts from inferred analysis.
5. Look for content issues:
   - unsupported claims,
   - stale or missing citations,
   - unverified revenue numbers,
   - recommendations that do not follow from the evidence,
   - fourth-wall AI self-critique,
   - raw technical errors shown to marketers.
6. If the user wants more intelligence, run focused public research and cite sources.
7. Save useful extracts or supplemental writeups under `output/`.

For additional research, prefer official business pages, Google profile data already collected by the audit, government data, reputable local sources, and clearly attributable public pages. Avoid generic directory spam unless it is directly relevant to the question.

## Supplemental Agentic Analysis

If the app lacks an AI provider key or the user wants a second opinion, an external coding assistant can generate additional analysis from:

- the stored report JSON,
- public web research,
- screenshots of the rendered report,
- source-specific raw outputs from collector tools.

Supplemental analysis should:

- state what was checked,
- cite source URLs,
- explain confidence,
- identify what remains unknown,
- avoid revenue/opportunity dollar claims unless the source or user provides a verified basis.

Good supplemental artifact locations:

- `output/report-{reportId}-extract.json`
- `output/report-{reportId}-research.md`
- `output/report-{reportId}-qa.md`
- `output/playwright/report-{reportId}.png`

## Implementation Guardrails

- Preserve local-first behavior.
- Do not add SaaS dependencies to normal local workflows.
- Do not reintroduce mock data.
- Do not hard-code fake report content to satisfy UI states.
- Keep changes scoped to the user request.
- Prefer existing patterns and types in `src/lib/db/types.ts`.
- For manual file edits, use focused patches.
- When changing report or settings UI, verify with Playwright.
- When changing audit behavior, add or update tests in `testing_framework/test-suites/`.

## Useful Commands

```bash
npm run local
npm run dev
npm run verify:local
npm test
npm test -- testing_framework/test-suites/enrichment-collectors.test.ts
npx tsc --noEmit
npx next build
```

Live enrichment probes are gated because they hit public services:

```powershell
Get-Content .env.local | ForEach-Object { if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$') { Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2] } }
$env:RUN_LIVE_ENRICHMENT='1'
npm test -- testing_framework/test-suites/enrichment-live.test.ts
```

## Key Files

- `src/app/api/audit/route.ts` - starts audit jobs.
- `src/app/api/report/[id]/route.ts` - fetches report JSON.
- `src/app/api/reports/route.ts` - lists reports.
- `src/app/(dashboard)/audits/[id]/page.tsx` - rendered audit report.
- `src/app/(dashboard)/settings/page.tsx` - local settings and data-source keys.
- `src/lib/agents/orchestrator.ts` - main audit pipeline.
- `src/lib/agents/tools/` - data collectors.
- `src/lib/agents/prompts/` - AI prompts.
- `src/lib/reports/content-contract.ts` - report content sanitization.
- `src/lib/reports/coverage.ts` - audit coverage and evidence display.
- `src/lib/db/local-sqlite.ts` - local SQLite implementation.
- `src/lib/db/types.ts` - shared data types.
- `testing_framework/test-suites/` - regression tests.

## Current Product Boundaries

Do not assume old docs are fully current. Some older files still describe SaaS billing, Supabase, mock-first development, and City Scout. The current local open-source direction is:

- one-command local use,
- SQLite storage,
- settings-page key management,
- audit reports first,
- truthful source coverage,
- no fake data,
- agent-friendly report inspection and supplemental research.
