import { createHash } from "node:crypto";
import { z } from "zod";

export const provenanceSchema = z.enum(["live", "replay", "sample"]);
export type Provenance = z.infer<typeof provenanceSchema>;
const address = z
	.string()
	.regex(/^0x[0-9a-fA-F]{1,64}$/)
	.transform((s) => `0x${s.slice(2).toLowerCase().padStart(64, "0")}`);
const amount = z.string().regex(/^(0|[1-9][0-9]*)$/);
export const claimSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("name_resolves"),
			name: z.string().regex(/^[a-z0-9.-]+\.sui$/),
			address,
		})
		.strict(),
	z
		.object({
			kind: z.literal("balance_floor"),
			address,
			coinType: z.string().min(1),
			floor: amount,
			tolerancePct: z.number().min(0).max(100).optional(),
		})
		.strict(),
	z
		.object({
			kind: z.literal("object_owner"),
			objectId: address,
			owner: address,
		})
		.strict(),
	z
		.object({
			kind: z.literal("preference"),
			text: z.string().min(1),
			ttlDays: z.number().positive(),
		})
		.strict(),
]);
export type Claim = z.infer<typeof claimSchema>;
export const evidenceSchema = z
	.object({
		source: z.enum(["tatum-grpc", "tatum-data", "tatum-graphql"]),
		method: z.string().min(1),
		checkpoint: z.string().regex(/^\d+$/).optional(),
		observed: z.unknown(),
		expected: z.unknown(),
		readAt: z.iso.datetime(),
	})
	.strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export const eventSchema = z
	.object({
		v: z.literal(1),
		eventId: z.string().regex(/^[a-f0-9]{32}$/),
		beliefKey: z.string().regex(/^[a-f0-9]+$/),
		seq: z.number().int().nonnegative(),
		prev: z
			.string()
			.regex(/^[a-f0-9]{64}$/)
			.nullable(),
		event: z.enum([
			"asserted",
			"verified",
			"contradicted",
			"superseded",
			"confirmed_by_user",
			"retired",
			"model_update",
		]),
		agent: z.enum(["checker", "telegram", "mcp", "web", "bench"]),
		provenance: provenanceSchema,
		occurredAt: z.iso.datetime(),
		claim: claimSchema,
		evidence: z.array(evidenceSchema).optional(),
		supersedes: z.string().optional(),
		dependsOn: z.array(z.string()).optional(),
	})
	.strict();
export type BeliefEvent = z.infer<typeof eventSchema>;
export type Verdict =
	| "confirmed"
	| "contradicted"
	| "inconclusive"
	| "unverifiable";

// Pure deterministic computation; no clock, randomness, filesystem or network.
export function canonical(value: unknown): string {
	if (value === null || typeof value !== "object") {
		const result = JSON.stringify(value);
		if (result === undefined) throw new Error("Not JSON");
		return result;
	}
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	return `{${Object.entries(value)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
		.join(",")}}`;
}
export const hash = (value: string): string =>
	createHash("sha256").update(value).digest("hex");
export const eventId = (key: string, seq: number): string =>
	hash(`${key}:${seq}`).slice(0, 32);
export const hashEvent = (event: BeliefEvent): string =>
	hash(canonical(eventSchema.parse(event)));
export function encode(sentence: string, event: BeliefEvent): string {
	if (sentence.includes("⟦errata:") || sentence.includes("⟧"))
		throw new Error("Reserved delimiter");
	return `${sentence} ⟦errata:${canonical(eventSchema.parse(event))}⟧`;
}
export function decode(text: string): BeliefEvent | null {
	const start = text.indexOf("⟦errata:");
	if (
		start < 0 ||
		start !== text.lastIndexOf("⟦errata:") ||
		!text.endsWith("⟧")
	)
		return null;
	try {
		return eventSchema.parse(JSON.parse(text.slice(start + 8, -1)));
	} catch {
		return null;
	}
}

export interface Folded {
	head: BeliefEvent;
	events: BeliefEvent[];
	status: Verdict | "retired";
}
export function fold(input: readonly BeliefEvent[]): Folded {
	if (!input.length) throw new Error("Empty history");
	const bySeq = new Map<number, BeliefEvent>();
	for (const raw of input) {
		const event = eventSchema.parse(raw);
		const old = bySeq.get(event.seq);
		if (old && hashEvent(old) !== hashEvent(event)) throw new Error("Fork");
		bySeq.set(event.seq, event);
	}
	const events = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
	let status: Folded["status"] = "inconclusive";
	for (let i = 0; i < events.length; i++) {
		const e = events[i];
		const prior = events[i - 1];
		if (
			e.seq !== i ||
			e.beliefKey !== events[0].beliefKey ||
			e.eventId !== eventId(e.beliefKey, e.seq) ||
			e.prev !== (prior ? hashEvent(prior) : null)
		)
			throw new Error("Broken chain");
		if (i === 0 && e.event !== "asserted") throw new Error("Missing assertion");
		if (i > 0 && e.event === "asserted") throw new Error("Repeated assertion");
		if (
			prior &&
			e.event !== "superseded" &&
			canonical(e.claim) !== canonical(prior.claim)
		)
			throw new Error("Claim changed without supersession");
		if (prior && e.provenance !== prior.provenance)
			throw new Error("Provenance changed");
		if (e.event === "verified" || e.event === "contradicted") {
			const result = verdict(
				e.claim,
				(e.evidence ?? []).map((evidence) => ({ ok: true as const, evidence })),
			);
			if (result !== (e.event === "verified" ? "confirmed" : "contradicted"))
				throw new Error("Unsupported verdict event");
			status = result;
		} else if (e.event === "superseded") {
			if (prior?.event !== "contradicted" || e.supersedes !== prior.eventId)
				throw new Error("Invalid supersession");
			if (e.claim.kind !== prior.claim.kind)
				throw new Error("Claim kind changed");
			const observations = prior.evidence ?? [];
			if (
				!observations.length ||
				observations.some(
					(item) => compare(e.claim, item.observed) !== "confirmed",
				)
			)
				throw new Error("Correction unsupported by observations");
			status = "inconclusive";
		} else if (e.event === "retired") status = "retired";
		else if (e.event === "confirmed_by_user") {
			if (e.claim.kind !== "preference")
				throw new Error("User cannot confirm chain facts");
			status = "unverifiable";
		}
	}
	return { head: events[events.length - 1], events, status };
}

export type Read =
	| { ok: true; evidence: Evidence }
	| { ok: false; error: "network" | "auth" | "rate" | "other" };
function compare(claim: Claim, observed: unknown): Verdict {
	if (claim.kind === "preference") return "unverifiable";
	if (claim.kind === "balance_floor") {
		if (typeof observed !== "string" || !/^(0|[1-9][0-9]*)$/.test(observed))
			return "inconclusive";
		const actual = BigInt(observed),
			floor = BigInt(claim.floor);
		if (actual >= floor) return "confirmed";
		// Compare in basis points without converting chain amounts to floating point.
		const tolerance =
			claim.tolerancePct === undefined ? 0 : Math.max(1, claim.tolerancePct);
		if (
			tolerance > 0 &&
			(floor - actual) * 10000n < floor * BigInt(Math.round(tolerance * 100))
		)
			return "inconclusive";
		return "contradicted";
	}
	if (observed === null) return "contradicted";
	const parsed = address.safeParse(observed);
	if (!parsed.success) return "inconclusive";
	return parsed.data ===
		(claim.kind === "name_resolves" ? claim.address : claim.owner)
		? "confirmed"
		: "contradicted";
}
export function verdict(raw: Claim, reads: readonly Read[]): Verdict {
	const claim = claimSchema.parse(raw);
	if (claim.kind === "preference") return "unverifiable";
	if (!reads.length || reads.some((r) => !r.ok)) return "inconclusive";
	const successful = reads.flatMap((r) => (r.ok ? [r.evidence] : []));
	if (successful.some((e) => !evidenceSchema.safeParse(e).success))
		return "inconclusive";
	const results = successful.map((e) => compare(claim, e.observed));
	if (results.every((v) => v === "confirmed")) return "confirmed";
	if (!results.every((v) => v === "contradicted") || successful.length < 2)
		return "inconclusive";
	const times = successful.map((e) => Date.parse(e.readAt));
	if (times.some((t, i) => i > 0 && t < times[i - 1])) return "inconclusive";
	return times[times.length - 1] - times[0] >= 2000
		? "contradicted"
		: "inconclusive";
}

export const priors = {
	name_resolves: 60,
	balance_floor: 3,
	object_owner: 30,
} as const;
export interface Model {
	priorDays: number;
	contradictions: number;
	exposureDays: number;
}
function validateModel(m: Model): void {
	if (
		!Number.isFinite(m.priorDays) ||
		m.priorDays <= 0 ||
		!Number.isInteger(m.contradictions) ||
		m.contradictions < 0 ||
		!Number.isFinite(m.exposureDays) ||
		m.exposureDays < 0
	)
		throw new Error("Invalid model");
}
export function rate(m: Model): number {
	validateModel(m);
	return (1 + m.contradictions) / (m.priorDays / Math.LN2 + m.exposureDays);
}
export const halfLife = (m: Model): number => Math.LN2 / rate(m);
export function probability(m: Model, days: number): number {
	if (!Number.isFinite(days) || days < 0) throw new Error("Invalid age");
	return Math.exp(-rate(m) * days);
}
export const nextCheckDays = (m: Model): number => -Math.log(0.9) / rate(m);
export function learn(m: Model, exposureDays: number, result: Verdict): Model {
	if (!Number.isFinite(exposureDays) || exposureDays < 0)
		throw new Error("Invalid exposure");
	validateModel(m);
	return result === "inconclusive" || result === "unverifiable"
		? { ...m }
		: {
				...m,
				contradictions: m.contradictions + (result === "contradicted" ? 1 : 0),
				exposureDays: m.exposureDays + exposureDays,
			};
}
export function snapshotDue(
	before: Model,
	after: Model,
	daysSinceSnapshot: number,
): boolean {
	return (
		daysSinceSnapshot >= 1 ||
		Math.abs(halfLife(after) / halfLife(before) - 1) > 0.2
	);
}
export function shouldRecheck(stakes: "low" | "high", pTrue: number): boolean {
	if (!Number.isFinite(pTrue) || pTrue < 0 || pTrue > 1)
		throw new Error("Invalid probability");
	return stakes === "high" || pTrue < 0.9;
}
export interface GuardBelief {
	key: string;
	text: string;
	verdict: Verdict;
	pTrue: number;
	checkedThisCall: boolean;
	correctionPersisted?: boolean;
	blobId?: string;
	checkpoint?: string;
}
export function guardDecision(
	stakes: "low" | "high",
	beliefs: readonly GuardBelief[],
): {
	decision: "proceed" | "hold";
	beliefs: readonly GuardBelief[];
	reasons: string[];
} {
	const reasons: string[] = [];
	if (!beliefs.length) reasons.push("No relevant beliefs resolved");
	for (const b of beliefs) {
		if (b.verdict === "contradicted") {
			reasons.push(`${b.key}: contradicted`);
			if (!b.correctionPersisted)
				reasons.push(`${b.key}: correction not persisted`);
		}
		if (shouldRecheck(stakes, b.pTrue) && !b.checkedThisCall)
			reasons.push(`${b.key}: required check missing`);
		if (
			stakes === "high" &&
			(b.verdict === "inconclusive" || b.verdict === "unverifiable")
		)
			reasons.push(`${b.key}: high-stakes fact not verified`);
	}
	return { decision: reasons.length ? "hold" : "proceed", beliefs, reasons };
}
