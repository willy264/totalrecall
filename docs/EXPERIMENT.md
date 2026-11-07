# Errata benchmark preregistration

Status: draft protocol, committed before any scored run. No scored arms have run. Results will be labelled `replay`; synthetic unit fixtures are `sample` and never enter the scored corpus.

## Question and arms

How close does learned rechecking get to always checking, for fewer chain reads?

- A: plain memory, no checks after intake.
- C: check at every decision point, including the second read required for a contradiction.
- D: frozen model trained on the training addresses; check when pTrue < 0.9. The primary replay uses low stakes for all arms. A separately labelled high-stakes sensitivity run checks every time, so D should match C.

Arm B is cut by the revised scope. All arms share intake, observations, contradiction rules and correction semantics. They must not access future observations during a decision.

## Corpus and split

Seed string: `errata-total-recall-2026-11-07-v1`. Fix T0 at 2026-11-07T00:00:00Z, using the last checkpoint at or before that timestamp. Sample from successful transactions in the preceding 24 hours. Collect unique sender addresses, exclude system addresses and entries with incomplete histories, rank by SHA-256(seed + ':' + normalized address), take the first 100 eligible addresses. If fewer exist within the request budget, report the actual count and exclusions without replacing the window after looking at results.

Split the ranked addresses 70% train / 30% test (floor the training count). No address appears in both. Fit only on pre-T0 histories from the training addresses during the preceding seven days. Test on the fixed interval [T0, 2026-11-08T00:00:00Z). Decision points are every two hours. The reference observation for a required second read is at least two seconds later, with the corresponding checkpoint explicitly recorded.

## Claims and reconstruction

Primary historical claim: SUI balance_floor, floor = floor(0.8 × smallest-unit balance at T0), omitting zero-floor cases and disclosing them. All calculations use BigInt. Reconstruct earlier balances backward from a checkpoint-anchored balance and all intervening balance changes; verify transaction pagination completeness. A current balance cannot serve as a T0 anchor without replaying every intervening change. Incomplete histories are uncheckable, never synthetic fills.

name_resolves and object_owner enter separate descriptive results only when complete checkpoint-specific history is available under M0. Main holdings and top counterparty from the original spec are excluded because they do not map to the retained typed claims; do not invent new claim kinds for a better score. Report this reduced coverage prominently.

## Metrics and thresholds

Report numerator and denominator for stale beliefs used at decision points; false contradictions (contradicted when reference supports the claim); all reads spent including confirmation reads, failed reads, and intake; share of attempted beliefs with adequate reference data. Separate actual retrieval requests from simulated policy reads. Report holds and inconclusives so abstention cannot hide poor coverage.

Primary success threshold: D prevents at least 90% of the stale uses prevented by C relative to A, while spending at most 60% of C's policy reads. If A and C have equal stale-use counts, detection gain is undefined and no success claim is made. Any false contradiction is a correctness failure. Show raw counts per arm and per address, plus aggregate rates; do not rely on a single headline percentage.

Evidence against Errata: missing either threshold; D using more reads without fewer stale uses; any false contradiction; learned scheduling performing worse than its initial prior in an explicitly labelled diagnostic; insufficient stale examples to distinguish the arms. Publish all losses and uncheckable cases. Public wallets are a proxy, not recruited users. More checks should detect more staleness; fewer reads alone do not demonstrate better memory.

## Access, budgets and fallback

First test Tatum GraphQL transactions with affectedAddress and checkpoint filters, plus retention and balance changes. Public Sui GraphQL is permitted only as a disclosed benchmark fallback after that probe fails; live product checks remain Tatum-only. No scored run until the endpoint/schema, complete-history rule and exact corpus manifest are recorded and committed. If history is unavailable, collect a prospective fixed 24-hour trace with the same split and decision grid, preregistering its actual interval before collection; never backfill live learning. If time prevents this, report benchmark unavailable rather than invent replay data.

Cap initial corpus retrieval at 5,000 requests, pace below 3 requests/second, stop sooner at the account credit reserve. No automatic paid upgrades. Before scoring, commit the corpus manifest/hash, acquisition failures and final protocol amendments. Commit full result JSON plus script revision and timestamps. Store only a labelled sample in Walrus; benchmark writes do not count as live user memories.
