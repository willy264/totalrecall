# Errata · Total Recall

Memory that checks itself before your agent acts on it.

Under construction. No live integration has passed yet. Single owner, separate Telegram and MCP delegates, deterministic chain verdicts, Walrus event history, learned recheck intervals.

Repository: https://github.com/willy264/totalrecall

Use Node 22+ and pnpm 12.18.0. Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm secret-scan`. Scripts use TypeScript through tsx on Windows and Linux.

Secrets belong in the process environment, never in Git or chat. Delegate keys can reach every namespace. The hosted relayer sees plaintext: store only non-sensitive facts. Every memory and metric must identify live, replay, or sample provenance.

## Setup and reproduction

```text
git clone https://github.com/willy264/totalrecall.git
cd totalrecall
npm install --global pnpm@12.18.0
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm secret-scan
pnpm --filter @errata/web build
pnpm --filter @errata/web dev
```

If an older Windows pnpm launcher intervenes, substitute `npx --yes pnpm@12.18.0` for `pnpm`. Web defaults to localhost:3000. `pnpm --filter @errata/mcp start` starts the stdio server in setup mode; no live adapters are enabled.

```text
pnpm exec playwright install chromium
pnpm e2e
pnpm exec tsx scripts/tick.ts --dry-run
pnpm exec tsx scripts/verify-memories.ts
pnpm exec tsx scripts/proof.ts
```

Proof scripts exit nonzero and write unavailable reports without credentials. That is not successful live verification. Mobile tests emulate iPhone 13 and Pixel 7 in Chromium, not real-device Safari; screenshots, video and traces are disabled. Check TEST_REPORT.md for actual execution status.

## Live gate

Never supply a seed phrase or owner private key. Follow [M0](docs/M0.md), record results and only then compose real adapters. After M0, replace/supplement authored sample fixtures with redacted recorded responses, preserving labels. The Drizzle migration exists but remains unapplied.

The tick workflow defaults to dry-run. Its live command refuses execution until M0 and real scheduler/outbox composition are finished. Setting `ERRATA_LIVE_TICK=true` alone cannot bypass that gate. GitHub scheduling is approximate. Budget reservations need an explicitly configured cost estimate until measured.

## Structure and disclosures

Core contains pure verdicts, folding, guard and scheduling. Chain/memory/db contain adapters and persistence; LLM/agents contain extraction and orchestration. Apps expose MCP, Telegram handler factories and web shells. The benchmark package has A/C/D scorer tests only: its tiny sample corpus is **not benchmark results**. Real replay follows [EXPERIMENT.md](docs/EXPERIMENT.md).

- One owner, not multi-tenant isolation. Delegate keys reach every namespace.
- Only some memories are chain-checkable; preferences remain unverifiable.
- Public-wallet replay is a proxy for users. Disclose losses, missing coverage and every non-Tatum source.
- No signing, sending or custody of funds. Payments, wallet sign-in, price claims and public sandbox are cut.
- OpenAI Codex assisted implementation, tests and drafts. Reused libraries are pinned in the lockfile; SDK findings are in DECISIONS.md.
- No supported claim yet of live learning improvement, mainnet portability, Walrus recovery or ten mainnet memories.

See [claims](docs/CLAIMS.md), [tests](docs/TEST_REPORT.md) and [status](docs/STATUS.md). Blog/video publication and submission require owner review. Uptime through 17 November remains a deployment obligation.
