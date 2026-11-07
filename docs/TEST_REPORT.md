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
