import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { assert, memory, run, save, state, statePath } from "./m0-common.js";

await run("m0-memwal", async () => {
	const client = memory();
	const configResponse = await fetch(
		`${process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz"}/config`,
		{ signal: AbortSignal.timeout(10000) },
	);
	assert(configResponse.ok, "Probe: relayer config unavailable");
	const config = (await configResponse.json()) as { network?: string };
	assert(
		config.network === "mainnet",
		"Probe: relayer is not configured for mainnet",
	);
	const id = randomBytes(16).toString("hex");
	const probe = existsSync(statePath)
		? state()
		: {
				namespace: `errata-b-${id}`,
				text: `Errata M0 connectivity probe ${id}. provenance: sample. This is a synthetic integration record, not a user fact.`,
				idempotencyKey: `m0:${id}`,
			};
	save(probe); // Persist the same key before the first attempt, including ambiguous timeouts.
	if (!probe.jobId) {
		const accepted = await client.remember(probe.text, probe.namespace, {
			idempotencyKey: probe.idempotencyKey,
			dedupe: true,
		});
		probe.jobId = accepted.job_id;
		save(probe);
	}
	const result = await client.waitForRememberJob(probe.jobId, {
		pollIntervalMs: 5000,
		timeoutMs: 55000,
	});
	assert(result.blob_id, "Probe: no blob ID");
	probe.blobId = result.blob_id;
	save(probe);
	const recalled = await client.recall({
		query: probe.text,
		namespace: probe.namespace,
		limit: 100,
	});
	assert(
		recalled.results.some(
			(hit) => hit.blob_id === probe.blobId && hit.text.includes(probe.text),
		),
		"Probe: write has blob but recall not visible yet; rerun without rewriting",
	);
	return `live transport; sample memory; blob ${probe.blobId}; namespace ${probe.namespace}; remember/wait/recall succeeded`;
});
