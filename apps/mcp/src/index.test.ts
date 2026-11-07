import { unavailableApi } from "@errata/agents";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, it } from "vitest";
import { createServer } from "./index.js";

it("advertises five tools and returns hold while M0 is pending", async () => {
	const server = createServer(unavailableApi);
	const client = new Client({ name: "sample-test-client", version: "0" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await server.connect(a);
	await client.connect(b);
	try {
		expect((await client.listTools()).tools.map((t) => t.name)).toEqual([
			"errata_remember",
			"errata_recall",
			"errata_guard",
			"errata_history",
			"errata_status",
		]);
		const result = await client.callTool({
			name: "errata_guard",
			arguments: { intent: "pay", query: "landlord", stakes: "high" },
		});
		expect(JSON.stringify(result)).toContain("hold");
		expect(JSON.stringify(result)).toContain("M0 pending");
	} finally {
		await client.close();
		await server.close();
	}
});
