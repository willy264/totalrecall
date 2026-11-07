import { randomUUID } from "node:crypto";
import {
	type BeliefEvent,
	type Claim,
	canonical,
	eventId,
	type Folded,
	guardDecision,
	hash,
	hashEvent,
	learn,
	type Model,
	priors,
	probability,
	type Read,
	shouldRecheck,
	verdict,
} from "@errata/core";
import { type Extractor, extract, type Intake } from "@errata/llm";
import { z } from "zod";
export type Agent = "telegram" | "mcp";
export interface StoredBelief {
	folded: Folded;
	model: Model;
	lastConfirmedAt: string;
	lastCheckedAt: string;
	blobId?: string;
}
export interface Store {
	get(key: string): Promise<StoredBelief | null>;
	list(query: string): Promise<StoredBelief[]>;
	history(key: string): Promise<BeliefEvent[]>;
	/** Serializes work per belief across processes. */
	lock<T>(key: string, work: () => Promise<T>): Promise<T>;
	append(events: BeliefEvent[]): Promise<{ durable: boolean }>;
	saveModel(key: string, model: Model, cause: string): Promise<void>;
	checked(key: string, at: string, confirmed: boolean): Promise<void>;
	propose(
		id: string,
		owner: string,
		claims: Claim[],
		expiresAt: string,
	): Promise<void>;
	/** Atomically consume only a proposal bound to this actor and not expired. */
	consume(id: string, owner: string, now: string): Promise<Claim[] | null>;
	status(): Promise<Record<string, unknown>>;
}
export const guardInput = z
	.object({
		intent: z.string().min(1).max(2000),
		query: z.string().min(1).max(2000),
		stakes: z.enum(["low", "high"]),
	})
	.strict();
export interface AgentApi {
	remember(text: string, actor: string): Promise<unknown>;
	confirm(id: string, actor: string): Promise<unknown>;
	recall(query: string): Promise<unknown>;
	guard(input: z.infer<typeof guardInput>): Promise<unknown>;
	history(key: string): Promise<unknown>;
	status(): Promise<unknown>;
}
export class AgentService implements AgentApi {
	constructor(
		private agent: Agent,
		private store: Store,
		private chain: { read(claim: Claim): Promise<Read> },
		private providers: { groq?: Extractor; gemini?: Extractor },
		private clock = {
			now: () => new Date(),
			sleep: (ms: number) =>
				new Promise<void>((resolve) => setTimeout(resolve, ms)),
		},
	) {}
	async remember(text: string, actor: string): Promise<Intake | unknown> {
		const result = await extract(text, this.providers);
		if (result.state !== "confirmation_required") return result;
		const id = randomUUID();
		await this.store.propose(
			id,
			`${this.agent}:${actor}`,
			result.claims,
			new Date(this.clock.now().getTime() + 600000).toISOString(),
		);
		return { ...result, confirmationId: id, expiresInSeconds: 600 };
	}
	async confirm(id: string, actor: string) {
		const claims = await this.store.consume(
			id,
			`${this.agent}:${actor}`,
			this.clock.now().toISOString(),
		);
		if (!claims)
			throw new Error("Confirmation absent, expired or already used");
		const results = [];
		for (const claim of claims) {
			const key = hash(canonical(claim));
			results.push(
				await this.store.lock(key, async () => {
					if ((await this.store.history(key)).length)
						return { key, state: "already_remembered" };
					const event: BeliefEvent = {
						v: 1,
						eventId: eventId(key, 0),
						beliefKey: key,
						seq: 0,
						prev: null,
						event: "asserted",
						agent: this.agent,
						provenance: "live",
						occurredAt: this.clock.now().toISOString(),
						claim,
					};
					const first = await this.chain.read(claim);
					const reads = [first];
					if (verdict(claim, reads) === "inconclusive" && first.ok) {
						await this.clock.sleep(2000);
						reads.push(await this.chain.read(claim));
					}
					const outcome = verdict(claim, reads);
					const events = [event];
					if (outcome === "confirmed" || outcome === "contradicted")
						events.push({
							...event,
							seq: 1,
							eventId: eventId(key, 1),
							prev: hashEvent(event),
							event: outcome === "confirmed" ? "verified" : "contradicted",
							evidence: reads.flatMap((r) => (r.ok ? [r.evidence] : [])),
						});
					const stored = await this.store.append(events);
					return { key, verdict: outcome, durable: stored.durable };
				}),
			);
		}
		return results;
	}
	async recall(query: string) {
		return (await this.store.list(query))
			.filter((b) => b.folded.status !== "retired")
			.map((b) => ({
				key: b.folded.head.beliefKey,
				claim: b.folded.head.claim,
				status: b.folded.status,
				provenance: b.folded.head.provenance,
				blobId: b.blobId,
			}));
	}
	async guard(raw: z.infer<typeof guardInput>) {
		const input = guardInput.parse(raw);
		const stored = await this.store.list(input.query);
		const output = [];
		for (const entry of stored) {
			if (entry.folded.status === "retired") continue;
			const key = entry.folded.head.beliefKey;
			const result = await this.store.lock(key, async () => {
				const current = await this.store.get(key);
				if (!current) throw new Error("Belief changed during guard");
				const entry = current;
				const head = entry.folded.head;
				const age = Math.max(
					0,
					(this.clock.now().getTime() - Date.parse(entry.lastConfirmedAt)) /
						86400000,
				);
				const pTrue = probability(entry.model, age);
				let outcome =
					entry.folded.status === "retired"
						? ("inconclusive" as const)
						: entry.folded.status;
				let cause = head.eventId;
				let checked = false,
					durable = false;
				if (shouldRecheck(input.stakes, pTrue)) {
					checked = true;
					const reads = [await this.chain.read(head.claim)];
					if (verdict(head.claim, reads) === "inconclusive" && reads[0].ok) {
						await this.clock.sleep(2000);
						reads.push(await this.chain.read(head.claim));
					}
					outcome = verdict(head.claim, reads);
					if (outcome === "contradicted") {
						const evidence = reads.flatMap((r) => (r.ok ? [r.evidence] : []));
						const event: BeliefEvent = {
							...head,
							eventId: eventId(head.beliefKey, head.seq + 1),
							seq: head.seq + 1,
							prev: hashEvent(head),
							event: "contradicted",
							agent: this.agent,
							occurredAt: this.clock.now().toISOString(),
							evidence,
						};
						const events = [event];
						const value = evidence[evidence.length - 1]?.observed;
						let correction: Claim | undefined;
						if (typeof value === "string") {
							if (head.claim.kind === "name_resolves")
								correction = { ...head.claim, address: value };
							if (head.claim.kind === "object_owner")
								correction = { ...head.claim, owner: value };
						}
						// A balance floor is a user's constraint: never silently lower it to make it pass.
						if (correction)
							events.push({
								...event,
								eventId: eventId(head.beliefKey, event.seq + 1),
								seq: event.seq + 1,
								prev: hashEvent(event),
								event: "superseded",
								claim: correction,
								supersedes: event.eventId,
							});
						durable = (await this.store.append(events)).durable;
						cause = event.eventId;
					}
					if (outcome === "confirmed" || outcome === "contradicted") {
						await this.store.checked(
							head.beliefKey,
							this.clock.now().toISOString(),
							outcome === "confirmed",
						);
						if (
							!(
								outcome === "contradicted" &&
								entry.folded.status === "contradicted"
							)
						)
							await this.store.saveModel(
								head.beliefKey,
								learn(
									entry.model,
									Math.max(
										0,
										(this.clock.now().getTime() -
											Date.parse(entry.lastCheckedAt)) /
											86400000,
									),
									outcome,
								),
								cause,
							);
					}
				}
				return {
					key: head.beliefKey,
					text: canonical(head.claim),
					verdict: outcome,
					pTrue: outcome === "confirmed" && checked ? 1 : pTrue,
					checkedThisCall: checked,
					correctionPersisted: durable,
					blobId: entry.blobId,
				};
			});
			output.push(result);
		}
		return guardDecision(input.stakes, output);
	}
	history(key: string) {
		return this.store.history(key);
	}
	status() {
		return this.store.status();
	}
}
export function initialModel(claim: Claim): Model {
	return {
		priorDays: claim.kind === "preference" ? claim.ttlDays : priors[claim.kind],
		contradictions: 0,
		exposureDays: 0,
	};
}
/** Runtime starts closed until M0 passes and real adapters are explicitly supplied. */
export const unavailableApi: AgentApi = {
	remember: async () => {
		throw new Error("Live adapters not enabled: M0 pending");
	},
	confirm: async () => {
		throw new Error("Live adapters not enabled: M0 pending");
	},
	recall: async () => {
		throw new Error("Live adapters not enabled: M0 pending");
	},
	guard: async () => ({
		decision: "hold",
		beliefs: [],
		reasons: ["Live adapters not enabled: M0 pending"],
	}),
	history: async () => {
		throw new Error("Live adapters not enabled: M0 pending");
	},
	status: async () => ({ mode: "setup", m0: "pending", liveAdapters: false }),
};
