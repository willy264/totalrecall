import { assert, memory, pause, run, state } from "./m0-common.js";

await run("m0-namespaces", async () => {
	const client = memory(),
		probe = state();
	let cursor: string | undefined;
	let found = false;
	const seen = new Set<string>();
	do {
		const page = await client.listNamespaces({ cursor, limit: 100 });
		found ||= page.namespaces.some((n) => n.name === probe.namespace);
		if (!page.has_more) break;
		assert(
			page.next_cursor && !seen.has(page.next_cursor),
			"Probe: invalid namespace pagination",
		);
		cursor = page.next_cursor;
		seen.add(cursor);
		await pause(1000);
	} while (cursor !== undefined);
	assert(found, "Probe: namespace not enumerated");
	cursor = undefined;
	seen.clear();
	let expiry: string | null | undefined;
	do {
		const page = await client.listMemories({
			cursor,
			namespace: probe.namespace,
			limit: 100,
		});
		assert(!page.must_resync, "Probe: memory enumeration requires resync");
		const hit = page.memories.find((m) => m.blob_id === probe.blobId);
		if (hit) {
			assert("expires_at" in hit, "Probe: expiry field absent");
			expiry = hit.expires_at;
		}
		if (!page.has_more) break;
		assert(
			page.next_cursor && !seen.has(page.next_cursor),
			"Probe: invalid memory pagination",
		);
		cursor = page.next_cursor;
		seen.add(cursor);
		await pause(1000);
	} while (cursor !== undefined);
	assert(expiry !== undefined, "Probe: sample blob not enumerated");
	return `live: errata-b-<hex> accepted; both paginated listings work; expires_at=${expiry ?? "null (renewal unverified)"}`;
});
