import {
	type BeliefEvent,
	canonical,
	decode,
	encode,
	type Folded,
	fold,
	hash,
} from "@errata/core";
import { MemWal, type MemWalConfig } from "@mysten-incubation/memwal";
export type MemoryClient = Pick<
	MemWal,
	"rememberBulk" | "getRememberStatus" | "listNamespaces" | "recall"
>;
export const createMemoryClient = (config: MemWalConfig): MemoryClient =>
	MemWal.create(config);
export function namespace(key: string): string {
	if (!/^[a-f0-9]{1,128}$/.test(key)) throw new Error("Invalid belief key");
	return `errata-b-${key}`;
}
export interface OutboxItem {
	id: string;
	namespace: string;
	text: string;
}
export interface Batch {
	key: string;
	items: OutboxItem[];
	jobIds: string[] | null;
}
/** Implementations must transactionally lease and persist batches before any network write. */
export interface OutboxStore {
	enqueue(items: OutboxItem[]): Promise<void>;
	leaseBatch(limit: number): Promise<Batch | null>;
	accepted(batchKey: string, jobIds: string[]): Promise<void>;
	completed(
		batchKey: string,
		itemId: string,
		jobId: string,
		blobId: string,
	): Promise<void>;
	defer(
		batchKey: string,
		seconds: number,
		status: "pending" | "failed",
	): Promise<void>;
}
export function eventItem(sentence: string, event: BeliefEvent): OutboxItem {
	return {
		id: `event:${event.eventId}`,
		namespace: namespace(event.beliefKey),
		text: encode(sentence, event),
	};
}
export function batchKey(items: OutboxItem[]): string {
	return `batch:${hash(canonical(items))}`;
}
export async function flush(
	store: OutboxStore,
	client: MemoryClient,
	pace: () => Promise<void>,
): Promise<{ state: string; count: number }> {
	const batch = await store.leaseBatch(20);
	if (!batch) return { state: "empty", count: 0 };
	if (batch.items.length > 20 || batch.items.length === 0)
		throw new Error("Invalid batch size");
	try {
		let jobs = batch.jobIds;
		if (!jobs) {
			await pace();
			const result = await client.rememberBulk(
				batch.items.map(({ text, namespace }) => ({ text, namespace })),
				{ idempotencyKey: batch.key },
			);
			jobs = result.job_ids;
			if (jobs.length !== batch.items.length)
				throw new Error("Job count mismatch");
			await store.accepted(batch.key, jobs);
		}
		let completed = 0,
			failed = false;
		for (let i = 0; i < jobs.length; i++) {
			await pace();
			const job = await client.getRememberStatus(jobs[i]);
			if (job.status === "done" && job.blob_id) {
				await store.completed(
					batch.key,
					batch.items[i].id,
					jobs[i],
					job.blob_id,
				);
				completed++;
			} else if (job.status === "failed") failed = true;
		}
		if (completed < jobs.length)
			await store.defer(
				batch.key,
				failed ? 300 : 15,
				failed ? "failed" : "pending",
			);
		return {
			state: failed ? "failed" : completed === jobs.length ? "done" : "pending",
			count: completed,
		};
	} catch (error) {
		const seconds = Number(
			(error as { retryAfterSeconds?: unknown })?.retryAfterSeconds,
		);
		await store.defer(
			batch.key,
			Number.isFinite(seconds) ? Math.max(15, seconds) : 30,
			"pending",
		);
		return { state: "pending", count: 0 };
	}
}
export interface RestoreResult {
	beliefs: Map<string, Folded>;
	warnings: string[];
	hash: string;
	complete: boolean;
}
export async function restore(
	client: MemoryClient,
	pace: () => Promise<void>,
): Promise<RestoreResult> {
	const beliefs = new Map<string, Folded>(),
		warnings: string[] = [];
	let cursor: string | undefined;
	const cursors = new Set<string>();
	do {
		await pace();
		const page = await client.listNamespaces({ cursor, limit: 100 });
		for (const entry of page.namespaces) {
			if (!/^errata-b-[a-f0-9]+$/.test(entry.name)) continue;
			await pace();
			const result = await client.recall({
				query: "",
				namespace: entry.name,
				limit: 100,
			});
			if (result.results.length === 100)
				warnings.push(
					`${entry.name}: recall limit reached; history may be truncated`,
				);
			if (result.dropped_count)
				warnings.push(`${entry.name}: dropped memories`);
			const events: BeliefEvent[] = [];
			for (const hit of result.results) {
				const event = decode(hit.text);
				if (!event) {
					warnings.push(`${entry.name}: malformed tag`);
					continue;
				}
				if (namespace(event.beliefKey) !== entry.name) {
					warnings.push(`${entry.name}: mismatched key`);
					continue;
				}
				events.push(event);
			}
			try {
				const folded = fold(events);
				beliefs.set(folded.head.beliefKey, folded);
			} catch {
				warnings.push(`${entry.name}: incomplete or invalid event chain`);
			}
		}
		if (!page.has_more) break;
		if (!page.next_cursor || cursors.has(page.next_cursor))
			throw new Error("Invalid namespace cursor");
		cursor = page.next_cursor;
		cursors.add(cursor);
	} while (cursor !== undefined);
	const digest = hash(
		canonical(
			[...beliefs]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, value]) => ({ key, events: value.events })),
		),
	);
	return { beliefs, warnings, hash: digest, complete: warnings.length === 0 };
}
/** Replace cache only after a complete restore; preserve the previous cache on any warning. */
export async function rebuild(
	client: MemoryClient,
	pace: () => Promise<void>,
	cache: { replace(result: RestoreResult): Promise<void> },
	expectedHash?: string,
): Promise<RestoreResult> {
	const result = await restore(client, pace);
	if (!result.complete) throw new Error("Incomplete restore; cache preserved");
	if (expectedHash && result.hash !== expectedHash)
		throw new Error("Rebuild hash mismatch; cache preserved");
	await cache.replace(result);
	return result;
}
