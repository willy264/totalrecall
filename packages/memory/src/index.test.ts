import { type BeliefEvent, eventId } from "@errata/core";
import { expect, it } from "vitest";
import {
	type Batch,
	batchKey,
	eventItem,
	flush,
	type MemoryClient,
	namespace,
	type OutboxStore,
	restore,
} from "./index.js";

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
	claim: { kind: "preference", text: "sample only", ttlDays: 1 },
};
const item = eventItem("sample fixture", event);
it("namespaces reject injection", () => {
	expect(namespace("ab")).toBe("errata-b-ab");
	expect(() => namespace("../secret")).toThrow();
});
it("persists accepted jobs and does not resubmit on retry", async () => {
	let writes = 0,
		done = false;
	const batch: Batch = { key: batchKey([item]), items: [item], jobIds: null };
	const store: OutboxStore = {
		enqueue: async () => {},
		leaseBatch: async () => batch,
		accepted: async (_, jobs) => {
			batch.jobIds = jobs;
		},
		completed: async () => {
			done = true;
		},
		defer: async () => {},
	};
	const client = {
		rememberBulk: async () => {
			writes++;
			return { job_ids: ["j"], total: 1, status: "pending" };
		},
		getRememberStatus: async () => ({
			job_id: "j",
			status: "done",
			blob_id: "sample-blob",
		}),
	} as unknown as MemoryClient;
	await flush(store, client, async () => {});
	await flush(store, client, async () => {});
	expect(writes).toBe(1);
	expect(done).toBe(true);
});
it("keeps ambiguous timeout batch key unchanged", async () => {
	const keys: string[] = [];
	const batch: Batch = { key: batchKey([item]), items: [item], jobIds: null };
	const store: OutboxStore = {
		enqueue: async () => {},
		leaseBatch: async () => batch,
		accepted: async () => {},
		completed: async () => {},
		defer: async () => {},
	};
	const client = {
		rememberBulk: async (_: unknown, opts: { idempotencyKey: string }) => {
			keys.push(opts.idempotencyKey);
			throw new Error("sample timeout");
		},
	} as unknown as MemoryClient;
	await flush(store, client, async () => {});
	await flush(store, client, async () => {});
	expect(keys).toEqual([batch.key, batch.key]);
});
it("restores namespace events and warns at truncation boundary", async () => {
	const client = {
		listNamespaces: async () => ({
			namespaces: [{ name: "errata-b-ab" }],
			has_more: false,
			next_cursor: null,
		}),
		recall: async () => ({ results: [{ text: item.text }] }),
	} as unknown as MemoryClient;
	expect((await restore(client, async () => {})).complete).toBe(true);
	client.recall = async () => ({
		results: Array.from({ length: 100 }, () => ({
			text: item.text,
			blob_id: "fixture",
			distance: 0,
		})),
		total: 100,
	});
	expect((await restore(client, async () => {})).warnings).toContain(
		"errata-b-ab: recall limit reached; history may be truncated",
	);
});
