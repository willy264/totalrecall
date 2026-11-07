import {
	type BeliefEvent,
	type Claim,
	claimSchema,
	eventId,
	fold,
} from "@errata/core";
import { expect, it } from "vitest";
import {
	AgentService,
	initialModel,
	type Store,
	type StoredBelief,
} from "./index.js";

// All state and adapters below are sample test doubles, never exported into runtime.
function fixture() {
	const proposals = new Map<string, { actor: string; claims: Claim[] }>();
	let appended: BeliefEvent[] = [];
	let current: StoredBelief | null = null;
	const store: Store = {
		get: async () => current,
		list: async () => (current ? [current] : []),
		history: async () => appended,
		lock: async (_, work) => work(),
		append: async (events) => {
			appended.push(...events);
			return { durable: true };
		},
		saveModel: async () => {},
		checked: async () => {},
		propose: async (id, actor, claims) => {
			proposals.set(id, { actor, claims });
		},
		consume: async (id, actor) => {
			const proposal = proposals.get(id);
			if (!proposal || proposal.actor !== actor) return null;
			proposals.delete(id);
			return proposal.claims;
		},
		status: async () => ({ mode: "sample" }),
	};
	return {
		store,
		get appended() {
			return appended;
		},
		setCurrent: (value: StoredBelief) => {
			current = value;
			appended = value.folded.events;
		},
	};
}
it("requires actor-bound confirmation before writing", async () => {
	const f = fixture();
	const api = new AgentService(
		"telegram",
		f.store,
		{ read: async () => ({ ok: false, error: "network" }) },
		{},
	);
	const result = (await api.remember(
		"/remember name landlord.sui 0x1",
		"alice",
	)) as { confirmationId: string };
	expect(f.appended).toHaveLength(0);
	await expect(api.confirm(result.confirmationId, "bob")).rejects.toThrow();
	await api.confirm(result.confirmationId, "alice");
	expect(f.appended).toHaveLength(1);
	await expect(api.confirm(result.confirmationId, "alice")).rejects.toThrow();
});
it("holds high-stakes reliance when the chain is unavailable", async () => {
	const f = fixture();
	const claim = claimSchema.parse({
		kind: "name_resolves",
		name: "landlord.sui",
		address: "0x1",
	});
	const event: BeliefEvent = {
		v: 1,
		eventId: eventId("ab", 0),
		beliefKey: "ab",
		seq: 0,
		prev: null,
		event: "asserted",
		agent: "bench",
		provenance: "sample",
		occurredAt: "2026-11-07T00:00:00.000Z",
		claim,
	};
	f.setCurrent({
		folded: fold([event]),
		model: initialModel(claim),
		lastConfirmedAt: event.occurredAt,
		lastCheckedAt: event.occurredAt,
	});
	const api = new AgentService(
		"mcp",
		f.store,
		{ read: async () => ({ ok: false, error: "network" }) },
		{},
	);
	expect(
		(await api.guard({ intent: "pay", query: "landlord", stakes: "high" }))
			.decision,
	).toBe("hold");
});
it("writes a contradiction before returning hold and shares its head", async () => {
	const f = fixture();
	const claim = claimSchema.parse({
		kind: "name_resolves",
		name: "landlord.sui",
		address: "0x1",
	});
	const event: BeliefEvent = {
		v: 1,
		eventId: eventId("ab", 0),
		beliefKey: "ab",
		seq: 0,
		prev: null,
		event: "asserted",
		agent: "bench",
		provenance: "sample",
		occurredAt: "2026-11-07T00:00:00.000Z",
		claim,
	};
	f.setCurrent({
		folded: fold([event]),
		model: initialModel(claim),
		lastConfirmedAt: event.occurredAt,
		lastCheckedAt: event.occurredAt,
	});
	let now = Date.parse(event.occurredAt);
	const api = new AgentService(
		"mcp",
		f.store,
		{
			read: async () => ({
				ok: true,
				evidence: {
					source: "tatum-grpc",
					method: "NameService.LookupName",
					observed: "0x2",
					expected: claim,
					readAt: new Date(now).toISOString(),
				},
			}),
		},
		{},
		{
			now: () => new Date(now),
			sleep: async (ms) => {
				now += ms;
			},
		},
	);
	expect(
		(await api.guard({ intent: "pay", query: "landlord", stakes: "high" }))
			.decision,
	).toBe("hold");
	expect(f.appended.map((e) => e.event)).toEqual([
		"asserted",
		"contradicted",
		"superseded",
	]);
	expect(fold(f.appended).head.claim).toMatchObject({
		address: `0x${"2".padStart(64, "0")}`,
	});
});
