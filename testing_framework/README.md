# Phantom Reach — Agentic Testing Framework

## Overview

This is an **agentic testing framework** designed to be loaded by an AI agent (Claude) as a skill. The agent reads `SKILL.md`, reviews past session summaries, then performs deep functional testing of the Phantom Reach codebase — finding and fixing real bugs.

## Directory Structure

```
testing_framework/
├── SKILL.md                    ← The skill file (agent reads this first)
├── README.md                   ← This file
├── sessions/                   ← Dated session summaries (agent memory)
│   ├── SESSION_TEMPLATE.md     ← Template for new sessions
│   └── 2026-03-04-session-1.md ← Example session (created by agent)
├── test-utils/                 ← Shared test utilities
│   ├── index.ts                ← Barrel export
│   ├── mock-factories.ts       ← Mock data factories for all types
│   └── test-helpers.ts         ← Assertions, env helpers, async utils
└── test-suites/                ← Test files organized by module
    ├── scoring.test.ts         ← Scoring engine tests
    ├── types.test.ts           ← Type utilities + TIER_LIMITS tests
    └── mock-factories.test.ts  ← Self-test for mock factories
```

## How to Use

### For AI Agents
1. Read `SKILL.md` — it contains the complete testing methodology
2. Read all files in `sessions/` — learn what's been tested before
3. Write and run tests, find bugs, fix them
4. Save a dated session summary

### For Humans
```bash
# Install test dependencies
npm install --save-dev vitest @vitest/coverage-v8

# Run all tests
npx vitest run

# Run with coverage
npx vitest run --coverage

# Watch mode
npx vitest --watch
```

## Test Configuration

Tests are configured in `vitest.config.ts` at the project root. Key settings:

- **Environment**: Node.js
- **Test pattern**: `testing_framework/**/*.test.ts`
- **Path alias**: `@/` → `./src/`
- **Timeout**: 30s per test

## Adding New Tests

1. Create a file in `test-suites/` named `{module}.test.ts`
2. Import mock factories from `../test-utils/mock-factories`
3. Import test helpers from `../test-utils/test-helpers`
4. Use `describe`/`it`/`expect` from vitest (globally available)

## Local Visual Smoke

Use this before claiming the local app is visually healthy:

```bash
npm run verify:local
```

The command starts a temporary dev server, runs Playwright against `/audits` and `/settings`, fails on missing CSS/static assets, and writes screenshots to `output/playwright/`.
