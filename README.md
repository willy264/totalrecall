# Errata

Memory that checks itself before your agent acts on it.

Under construction. No live integration has passed yet. Single owner, separate Telegram and MCP delegates, deterministic chain verdicts, Walrus event history, learned recheck intervals.

Use Node 22+ and pnpm 12.18.0. Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm secret-scan`. Scripts use TypeScript through tsx on Windows and Linux.

Secrets belong in the process environment, never in Git or chat. Delegate keys can reach every namespace. The hosted relayer sees plaintext: store only non-sensitive facts. Every memory and metric must identify live, replay, or sample provenance.
