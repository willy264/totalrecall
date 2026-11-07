import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { decode } from "../packages/core/src/index.js";
import { memory, pause, root } from "./m0-common.js";
export interface MemoryProof {
	schemaVersion: number;
	generatedAt: string;
	provenance: "live";
	status: "verified" | "incomplete" | "unavailable";
	network: "mainnet" | null;
	counts: { live: number; replay: number; sample: number } | null;
	blobs: {
		blobId: string;
		provenance: "live" | "replay" | "sample";
		expiresAt: string | null;
	}[];
	warnings: string[];
}
export async function verifyMemories(): Promise<MemoryProof> {
	const report: MemoryProof = {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		provenance: "live",
		status: "unavailable",
		network: null,
		counts: null,
		blobs: [],
		warnings: [],
	};
	if (!process.env.MEMWAL_ACCOUNT_ID || !process.env.MEMWAL_KEY_CHECKER) {
		report.warnings.push(
			"Missing memory credentials; no live verification ran",
		);
		return report;
	}
	try {
		const base =
			process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz";
		const config = await fetch(`${base}/config`, {
			signal: AbortSignal.timeout(10000),
		});
		if (
			!config.ok ||
			((await config.json()) as { network?: string }).network !== "mainnet"
		)
			throw new Error("network");
		report.network = "mainnet";
		const client = memory();
		const counts = { live: 0, replay: 0, sample: 0 };
		const metadata = new Map<string, string | null>();
		let cursor: string | undefined;
		const seen = new Set<string>();
		do {
			await pause(1100);
			const page = await client.listMemories({ cursor, limit: 100 });
			if (page.must_resync) throw new Error("resync");
			for (const item of page.memories)
				if (item.namespace_id.startsWith("errata-b-"))
					metadata.set(item.blob_id, item.expires_at);
			if (!page.has_more) break;
			if (!page.next_cursor || seen.has(page.next_cursor))
				throw new Error("cursor");
			cursor = page.next_cursor;
			seen.add(cursor);
		} while (cursor !== undefined);
		cursor = undefined;
		seen.clear();
		const counted = new Set<string>();
		do {
			await pause(1100);
			const page = await client.listNamespaces({ cursor, limit: 100 });
			for (const ns of page.namespaces) {
				if (!/^errata-b-[a-f0-9]+$/.test(ns.name)) continue;
				await pause(1100);
				const recalled = await client.recall({
					query: "Errata belief event history",
					namespace: ns.name,
					limit: 100,
				});
				if (
					recalled.results.length === 100 ||
					recalled.results.length < ns.memory_count ||
					recalled.dropped_count
				)
					report.warnings.push("Recall may be incomplete");
				for (const hit of recalled.results) {
					const event = decode(hit.text);
					if (
						!event ||
						`errata-b-${event.beliefKey}` !== ns.name ||
						!metadata.has(hit.blob_id)
					) {
						report.warnings.push("Unvalidated memory omitted");
						continue;
					}
					if (counted.has(hit.blob_id)) continue;
					counted.add(hit.blob_id);
					counts[event.provenance]++;
					report.blobs.push({
						blobId: hit.blob_id,
						provenance: event.provenance,
						expiresAt: metadata.get(hit.blob_id) ?? null,
					});
				}
			}
			if (!page.has_more) break;
			if (!page.next_cursor || seen.has(page.next_cursor))
				throw new Error("cursor");
			cursor = page.next_cursor;
			seen.add(cursor);
		} while (cursor !== undefined);
		if (counted.size !== metadata.size)
			report.warnings.push("Not all listed blobs were validated");
		if (
			report.blobs.some(
				(b) =>
					!b.expiresAt ||
					Date.parse(b.expiresAt) <= Date.parse("2026-11-17T23:59:59Z"),
			)
		)
			report.warnings.push(
				"Expiry after 17 November is not established for every blob",
			);
		report.counts = counts;
		report.status = report.warnings.length ? "incomplete" : "verified";
	} catch {
		report.warnings.push("Live verification failed; remote errors suppressed");
		report.status = "unavailable";
		report.counts = null;
		report.blobs = [];
	}
	return report;
}
export function writeEvidence(name: string, value: unknown) {
	mkdirSync(resolve(root, "evidence"), { recursive: true });
	writeFileSync(
		resolve(root, `evidence/${name}.json`),
		`${JSON.stringify(value, null, 2)}\n`,
	);
}
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	const report = await verifyMemories();
	writeEvidence("memories", report);
	console.log(`${report.status}: evidence/memories.json`);
	if (report.status !== "verified") process.exitCode = 1;
}
