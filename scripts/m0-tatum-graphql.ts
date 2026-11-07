import { assert, env, run } from "./m0-common.js";

await run("m0-tatum-graphql", async () => {
	const url = new URL(env("TATUM_SUI_GRAPHQL"));
	assert(
		url.protocol === "https:" &&
			url.hostname.endsWith(".tatum.io") &&
			!url.username &&
			!url.password,
		"Probe: provide a Tatum HTTPS GraphQL endpoint; no silent fallback",
	);
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-api-key": env("TATUM_API_KEY"),
		},
		body: JSON.stringify({
			query: "query Probe { checkpoint { sequenceNumber } }",
		}),
		signal: AbortSignal.timeout(20000),
	});
	assert(response.ok, `Probe: GraphQL HTTP ${response.status}`);
	const body = (await response.json()) as {
		data?: { checkpoint?: { sequenceNumber?: number | string } };
		errors?: unknown[];
	};
	assert(
		!body.errors?.length && body.data?.checkpoint?.sequenceNumber !== undefined,
		"Probe: GraphQL checkpoint query failed",
	);
	return `live: GraphQL checkpoint ${body.data.checkpoint.sequenceNumber}; historical retention and affectedAddress filters still require corpus spike`;
});
