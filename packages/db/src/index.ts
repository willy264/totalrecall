import type { ChainLedger, Pacer } from "@errata/chain";
import { canonical } from "@errata/core";
import {
	type Batch,
	batchKey,
	type OutboxItem,
	type OutboxStore,
} from "@errata/memory";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

export * from "./schema.js";
export function connect(url: string) {
	if (!url) throw new Error("DATABASE_URL required");
	const pool = new Pool({ connectionString: url });
	return { pool, db: drizzle(pool) };
}
export class PostgresPacer implements Pacer {
	constructor(
		private pool: Pool,
		private id = "tatum",
		private intervalMs = 500,
	) {
		if (intervalMs < 500) throw new Error("Pacing interval too short");
	}
	async acquire(): Promise<void> {
		const result = await this.pool.query(
			`INSERT INTO pacing(id,next_at) VALUES($1,clock_timestamp()+$2*interval '1 millisecond') ON CONFLICT(id) DO UPDATE SET next_at=GREATEST(pacing.next_at,clock_timestamp())+$2*interval '1 millisecond' RETURNING EXTRACT(EPOCH FROM (next_at-clock_timestamp()))*1000-$2 AS wait`,
			[this.id, this.intervalMs],
		);
		const delay = Math.max(0, Number(result.rows[0].wait));
		if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
	}
}
export class PostgresCredits implements ChainLedger {
	constructor(private pool: Pool) {}
	async reserve(background: boolean) {
		const result = await this.pool.query(
			`UPDATE budget SET reserved_credits=reserved_credits+estimated_cost WHERE id='tatum' AND estimated_cost>0 AND reserved_credits+estimated_cost<=limit_credits*CASE WHEN $1 THEN 0.8 ELSE 1 END RETURNING reserved_credits,limit_credits`,
			[background],
		);
		if (!result.rows.length) return { allowed: false, warning: true };
		return {
			allowed: true,
			warning:
				Number(result.rows[0].reserved_credits) >=
				Number(result.rows[0].limit_credits) * 0.5,
		};
	}
	async record(input: {
		method: string;
		status: string;
		provenance: "live";
		credits: number | null;
	}) {
		await this.pool.query(
			"INSERT INTO credit_usage(method,status,provenance,credits) VALUES($1,$2,$3,$4)",
			[input.method, input.status, input.provenance, input.credits],
		);
	}
}
export class PostgresOutbox implements OutboxStore {
	constructor(private pool: Pool) {}
	async enqueue(items: OutboxItem[]) {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			for (const item of items) {
				await client.query(
					"INSERT INTO outbox(id,namespace,text) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
					[item.id, item.namespace, item.text],
				);
				const existing = await client.query(
					"SELECT namespace,text FROM outbox WHERE id=$1",
					[item.id],
				);
				if (
					existing.rows[0].namespace !== item.namespace ||
					existing.rows[0].text !== item.text
				)
					throw new Error("Idempotency collision");
			}
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}
	async leaseBatch(limit: number): Promise<Batch | null> {
		if (limit < 1 || limit > 20) throw new Error("Invalid bulk limit");
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const existing = await client.query(
				`SELECT * FROM batches WHERE state='pending' AND available_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1`,
			);
			let batch: Batch;
			if (existing.rows.length) {
				const row = existing.rows[0];
				batch = { key: row.key, items: row.items, jobIds: row.job_ids };
			} else {
				const rows = await client.query(
					`SELECT id,namespace,text FROM outbox WHERE batch_key IS NULL AND state='pending' AND available_at<=now() ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT $1`,
					[limit],
				);
				if (!rows.rows.length) {
					await client.query("COMMIT");
					return null;
				}
				const items = rows.rows as OutboxItem[];
				batch = { key: batchKey(items), items, jobIds: null };
				await client.query("INSERT INTO batches(key,items) VALUES($1,$2)", [
					batch.key,
					JSON.stringify(items),
				]);
				await client.query(
					"UPDATE outbox SET batch_key=$1 WHERE id=ANY($2::text[])",
					[batch.key, items.map((i) => i.id)],
				);
			}
			await client.query(
				`UPDATE batches SET lease_until=now()+interval '10 minutes' WHERE key=$1`,
				[batch.key],
			);
			await client.query("COMMIT");
			return batch;
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}
	async accepted(key: string, ids: string[]) {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const result = await client.query(
				"SELECT items,job_ids FROM batches WHERE key=$1 FOR UPDATE",
				[key],
			);
			const row = result.rows[0];
			if (!row || row.items.length !== ids.length)
				throw new Error("Job count mismatch");
			if (row.job_ids && canonical(row.job_ids) !== canonical(ids))
				throw new Error("Job identity changed");
			await client.query("UPDATE batches SET job_ids=$2 WHERE key=$1", [
				key,
				JSON.stringify(ids),
			]);
			for (let i = 0; i < ids.length; i++)
				await client.query(
					`INSERT INTO jobs(id,batch_key,item_id,state) VALUES($1,$2,$3,'pending') ON CONFLICT(id) DO NOTHING`,
					[ids[i], key, row.items[i].id],
				);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}
	async completed(key: string, item: string, job: string, blob: string) {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(
				`UPDATE jobs SET state='done',blob_id=$2,updated_at=now() WHERE id=$1 AND batch_key=$3 AND item_id=$4`,
				[job, blob, key, item],
			);
			await client.query(
				`UPDATE outbox SET state='done' WHERE id=$1 AND batch_key=$2`,
				[item, key],
			);
			await client.query(
				`UPDATE batches SET state='done',lease_until=NULL WHERE key=$1 AND NOT EXISTS(SELECT 1 FROM outbox WHERE batch_key=$1 AND state<>'done')`,
				[key],
			);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}
	async defer(key: string, seconds: number, state: "pending" | "failed") {
		await this.pool.query(
			`UPDATE batches SET state=$2,available_at=now()+$3*interval '1 second',lease_until=NULL WHERE key=$1 AND state<>'done'`,
			[key, state, seconds],
		);
	}
}
