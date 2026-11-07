import { assert, env, memory, pause, run, state } from "./m0-common.js";

await run("m0-delegates", async () => {
	const delegates = ["CHECKER", "TELEGRAM", "MCP"];
	assert(
		new Set(delegates.map((d) => env(`MEMWAL_KEY_${d}`))).size === 3,
		"Probe: delegate keys must be distinct",
	);
	const probe = state();
	assert(probe.blobId, "Probe: m0-memwal must finish first");
	for (const delegate of delegates) {
		const result = await memory(delegate).recall({
			query: probe.text,
			namespace: probe.namespace,
			limit: 100,
		});
		assert(
			result.results.some((hit) => hit.blob_id === probe.blobId),
			"Probe: delegate did not recall the shared blob",
		);
		await pause(1000);
	}
	return "live: three distinct delegate keys recalled the same sample memory blob";
});
