# Decisions and milestone status

## 2026-11-07 — M0 pending prerequisites

The full build specification has been read. No product code has been written and no live tests have run.

The project directory was empty at initial inspection; the referenced research dossier was not present there.

M0 requires section 15 setup before live probes. Mainnet memory and Tatum reads must both pass before product implementation starts. Unrun tests are pending, not passing.

Section 12's explicit cut order (top first) takes precedence over the earlier instruction to cut from its bottom. The core loop remains mandatory.

Use the earlier submission target: 10 November at 12:00 UTC (13:00 Lagos). The hard deadline is 17:00 UTC (18:00 Lagos). Past milestone dates do not justify backdating commits or fabricating daily learning history.

Public repository publication, other public posting, spending, adding a card, and form submission require explicit user approval. Secrets must be supplied through the environment, never chat or version control.

## 2026-11-07 ? Revised schedule and verified SDK surface

The user's 15:30 Lagos schedule reset supersedes the original M0-before-code restriction for credential-free foundation/core work. Cut x402/MPP, wallet sign-in, /try, stake_validator, recurring_payment, price_band and benchmark Arm B. Keep the three chain claim kinds, Telegram/MCP, learned scheduling, rebuild, proof and arms A/C/D.

Revised Lagos gates: Sat 23:59 M0 and live CLI; Sun 14:00 agents/outbox/tick; Sun 23:59 learning/rebuild and benchmark underway; Mon 14:00 web/results/verified memories; Mon 23:59 freeze and hardening; Tue 13:00 submission package. Gate status must distinguish done/failed/changed with evidence. No autonomous scheduling service has been configured by this repository.

Registry checks executed: pnpm 12.18.0, TypeScript 7.0.2, Vitest 5.1.0, turbo 2.11.10, Zod 4.6.7, MemWal 0.1.13 and Sui 2.39.0 exist. Sui latest was 2.39.1; requested 2.39.0 retained. Local Node is 25.8.1; CI targets Node 22. Exact resolved dependencies are captured in pnpm-lock.yaml. esbuild's install script is explicitly allowed; protobufjs's optional build script is disabled.

Installed declarations inspected: node_modules/@mysten-incubation/memwal/dist/{index,memwal,types}.d.ts. MemWal.create(config) is required; constructor is private. remember returns job_id; waitForRememberJob returns blob_id. listNamespaces and listMemories use has_more (not page length) and next_cursor; listMemories exposes expires_at, which may be null. Filtered memory pages may be empty while has_more is true.

Default MemWal entry does not import the account/manual/AI helpers. However memwal.js dynamically imports @mysten/seal and @mysten/sui for SEAL sessions, so Seal 1.5.4 is installed. ai, zod and @mysten/walrus are optional peers; ai and walrus are not needed for this default-client probe. SDK-managed session RPC is separate from product claim verification and may use the relayer-configured Sui endpoint; no claim verdict may use it as a Tatum fallback.

Sui declarations inspected under dist/grpc/client.d.mts and proto/sui/rpc/v2/*.d.mts: client.nameService.lookupName({name}); client.stateService.getBalance({owner,coinType}); client.ledgerService.getObject({objectId,readMask}); client.ledgerService.getCheckpoint({checkpointId:{oneofKind:undefined}}). Unary calls expose .response. getObject's default mask excludes owner, so the probe requests it explicitly. Native GrpcTransport accepts TLS channelCredentials and per-call meta with x-api-key.

Tatum documentation checked: https://docs.tatum.io/reference/sui-grpc and https://docs.tatum.io/docs/sui-migration-guide-from-json-rpc-to-grpc . Native mainnet host and x-api-key metadata match the implementation; installed SDK method names take precedence over inconsistent prose mentioning GetLatestCheckpoint. This is static verification, not a live Tatum pass.

Core representation decisions: evidence is an array rather than the original single object, preserving both contradiction reads. Event IDs hash key + ':' + seq to avoid ambiguous concatenation; chains start at seq 0. Monetary values are canonical decimal strings on the wire and BigInt during comparisons. The exact next-check expression is -ln(0.9)/lambda rather than rounded 0.105/lambda. Empty guard resolution holds. Preferences remain unverifiable; high-stakes use holds. Core uses deterministic node:crypto SHA-256, with no IO, clocks or randomness.

Follow-up: Seal 1.5.4 requires Sui ^2.39.1, so Sui is now pinned at 2.39.1. The remaining peer warning is the transitive GraphQL editor plugin @0no-co/graphqlsp declaring TypeScript 5/6 support; TypeScript 7 typechecking succeeds and this plugin is not configured. No fallback needed so far.

- 2026-11-07T14:41:01.373Z FAIL m0-memwal: Missing environment: MEMWAL_ACCOUNT_ID

- 2026-11-07T14:41:02.560Z FAIL m0-delegates: Missing environment: MEMWAL_KEY_CHECKER

- 2026-11-07T14:41:04.066Z FAIL m0-namespaces: Missing environment: MEMWAL_ACCOUNT_ID

- 2026-11-07T14:41:07.978Z FAIL m0-tatum-grpc: Missing environment: TATUM_API_KEY

- 2026-11-07T14:41:09.730Z FAIL m0-tatum-graphql: Missing environment: TATUM_SUI_GRAPHQL

- 2026-11-07T14:41:11.649Z FAIL m0-groq: Missing environment: GROQ_API_KEY
