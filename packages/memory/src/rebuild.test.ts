import {
	type BeliefEvent,
	eventId,
	fold,
	guardDecision,
	hashEvent,
	probability,
} from "@errata/core";
import { expect, it } from "vitest";
import {
	eventItem,
	type MemoryClient,
	type RestoreResult,
	rebuild,
	restore,
} from "./index.js";
import { type ModelSnapshot, modelItem } from "./models.js";

it("sample end-to-end: wipe cache, enumerate, recall, fold and return the identical guard decision", async () => {
	const claim = {
		kind: "balance_floor" as const,
		address: `0x${"1".padStart(64, "0")}`,
		coinType: "0x2::sui::SUI",
		floor: "20",
	};
	const asserted: BeliefEvent = {
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
	const verified: BeliefEvent = {
		...asserted,
		seq: 1,
		eventId: eventId("ab", 1),
		prev: hashEvent(asserted),
		event: "verified",
		evidence: [
			{
				source: "tatum-grpc",
				method: "StateService.GetBalance",
				observed: "30",
				expected: claim,
				readAt: asserted.occurredAt,
			},
		],
	};
	const snapshot: ModelSnapshot = {
		v: 1,
		id: "a".repeat(64),
		kind: "balance_floor",
		model: { priorDays: 3, contradictions: 2, exposureDays: 1 },
		causeEventId: verified.eventId,
		occurredAt: asserted.occurredAt,
		provenance: "sample",
	};
	const calls: string[] = [];
	const texts = [
		eventItem("sample verified", verified).text,
		eventItem("sample assertion", asserted).text,
	];
	const client = {
		listNamespaces: async ({ cursor }: { cursor?: string }) => {
			calls.push("listNamespaces");
			return cursor
				? {
						namespaces: [{ name: "errata-model", memory_count: 1 }],
						has_more: false,
						next_cursor: null,
					}
				: {
						namespaces: [{ name: "errata-b-ab", memory_count: 2 }],
						has_more: true,
						next_cursor: "page2",
					};
		},
		recall: async ({
			namespace,
			limit,
		}: {
			namespace: string;
			limit: number;
		}) => {
			expect(limit).toBe(100);
			calls.push(`recall:${namespace}`);
			return {
				results: (namespace === "errata-model"
					? [modelItem(snapshot).text]
					: texts
				).map((text) => ({ text, blob_id: "sample", distance: 0 })),
			};
		},
	} as unknown as MemoryClient;
	let cache: RestoreResult | null = {
		beliefs: new Map([["ab", fold([asserted, verified])]]),
		models: [snapshot],
		warnings: [],
		hash: "",
		complete: true,
	};
	const decision = () => {
		if (!cache) throw new Error("cache empty");
		const belief = cache.beliefs.get("ab");
		if (!belief) throw new Error("belief missing");
		return guardDecision("low", [
			{
				key: "ab",
				text: "sample balance",
				verdict: belief.status === "retired" ? "inconclusive" : belief.status,
				pTrue: probability(cache.models[0].model, 0.01),
				checkedThisCall: false,
			},
		]);
	};
	const before = decision();
	const exported = await restore(client, async () => {});
	cache = null;
	expect(() => decision()).toThrow("cache empty");
	calls.length = 0;
	await rebuild(
		client,
		async () => {},
		{
			replace: async (result) => {
				cache = result;
			},
		},
		exported.hash,
	);
	expect(decision()).toEqual(before);
	expect(calls).toEqual([
		"listNamespaces",
		"recall:errata-b-ab",
		"listNamespaces",
		"recall:errata-model",
	]);
});
