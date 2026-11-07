# Test report — 7 November 2026

All core test data is `sample`. No live chain or memory result is claimed.

## Executed

- Vitest 5.1.0: 30 tests passed, one file. Covers tag parsing and malformed tags, canonical hashing, sequence folding, exact retry deduplication, forks/gaps/corruption, unsupported verdicts, user override rejection, prompt injection, BigInt, two-read timing, all error classes, tolerance, names, ownership, preferences, model math, guard holds, serialized rebuild equivalence, correction integrity and provenance.
- TypeScript 7.0.2: root `tsc --noEmit` passed, including all six M0 scripts. Turbo core typecheck also passed.
- `npx --yes pnpm@12.18.0 exec turbo run typecheck test`: two tasks succeeded. Other workspace packages are scaffolds and do not claim implemented checks.
- All six M0 scripts were executed in a child environment with relevant variables removed. Each printed FAIL, logged the missing-variable reason, and exited 1. No remote calls were attempted. This tests prerequisite handling only; it is not a live M0 failure or pass.
- Local heuristic secret scan passed. It checks tracked and untracked non-ignored files, reports only paths, and is not a comprehensive historical leak audit.

## Found and fixed

- MemWal's constructor is private: changed to MemWal.create after installed declaration inspection and a typecheck failure.
- Added Seal, then moved Sui to 2.39.1 to satisfy Seal's peer range.
- pnpm 12 initially rejected unapproved install scripts: explicitly allowed esbuild and disabled protobufjs's optional script.
- Direct Turbo initially selected the pre-existing pnpm 10 Windows launcher and failed before tasks ran. Executing through pnpm 12 succeeded. Use the pinned package manager; `npx --yes pnpm@12.18.0` is a working fallback.
- Biome found constant-loop/style issues and a PowerShell-written non-UTF-8 documentation byte; corrected them and formatted the repository.

## Not executed / not proven

Mainnet writes, delegate interoperability, actual pagination/expiry, live Tatum reads, Vercel gRPC, credit costs, relayer rate limits, Groq extraction, historical GraphQL coverage, live rebuild, E2E, browser accessibility, and remote GitHub CI. No benchmark scoring has run. CI is configured locally, not published or executed on GitHub.

The rebuild unit test demonstrates pure serialization/folding behavior only. It does not prove recovery from Walrus or Neon.

## Credential-free continuation ? 7 November, approximately 16:08 Lagos

Passed: 51 tests total across core (30), chain (6), memory (5), LLM (4), agent service (3), MCP protocol (1), Telegram helpers (2). The MCP protocol test uses the SDK in-memory transport and does not send external messages. Chain/memory response fixtures are sample test doubles, not captured mainnet responses.

The full Turbo run passed 16 tasks with 49 tests before the two additional tests; the affected memory, agent, and MCP suites were subsequently run and passed with the additions. Database's test task explicitly reports no tests; do not count it as database validation. Root typecheck and app/package typechecks passed. Biome formatting/lint passed.

Next 16.4.5 production build passed. Local HTTP smoke tests returned 200 for /, /beliefs, /learning, /bench, /proof, /agents, /status and /beliefs/ab. /api/status reports setup mode, null counts and disabled adapters. POST /api/telegram/test returned 503. No claim is made about browser visual correctness or WCAG compliance; screenshot execution was policy-blocked.

Drizzle generated 0000_daily_saracen.sql for nine tables. Migration was not applied; PostgreSQL concurrency, leases and SQL behavior still require an actual database test. No credentialed M0 script, scored benchmark, public deployment, bot message or publication ran in this continuation.

## 7 November: scheduler, proof scripts and scorer

The full Turbo run passed 18 tasks and 63 tests: core 34, chain 6, memory 6, LLM 4, agents 5, MCP 1, Telegram helpers 2, benchmark scorer 5. Scheduler/memory/agent suites were rerun after adding explicit model_update metadata and passed. The rebuild test wipes the fake cache, follows paginated listNamespaces, recalls at limit 100, folds events and models, and asserts the identical guard result. This remains sample evidence.

Dry tick executed without keys: no checks/writes; due count unknown. verify-memories and proof were executed with credential variables removed: each exited 1 and wrote unavailable JSON with null counts/checkpoint. No successful live verification is claimed. No scored replay run occurred.

Playwright contains 16 cases across iPhone 13 and Pixel 7 Chromium emulation, asserting no horizontal scroll and visible navigation/headings. Browser installation succeeded, but the execution command was rejected by automatic policy (blocked by policy). E2E therefore remains NOT RUN, not passed. No screenshot workaround was attempted.

Review found the earlier Biome migration had set preset:none. That meant earlier checks did not exercise the recommended lint rules, despite the command succeeding. Restored preset:recommended and ran it successfully; fixed environment declarations and type import formatting.

GitHub CI now runs on the authorized public repository. Verified successful runs include https://github.com/willy264/totalrecall/actions/runs/42386607019 and https://github.com/willy264/totalrecall/actions/runs/42386739291 . Intermediate feature commits lacked later workspace/lockfile changes and some failed; do not treat those as passing.

Dependency audit identified a moderate development-only esbuild 0.18.20 advisory through drizzle-kit. Added a targeted override to 0.25.12; drizzle-kit generate succeeded with no schema changes, and a full pnpm audit reported zero known vulnerabilities. This does not establish absence of all security defects.
