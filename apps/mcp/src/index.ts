import { type AgentApi, guardInput, unavailableApi } from "@errata/agents";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
export function createServer(api: AgentApi) {
	const server = new McpServer({ name: "errata", version: "0.0.0" });
	const wrap = async (work: () => Promise<unknown>) => {
		try {
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(await work()) },
				],
			};
		} catch {
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: "Request unavailable or invalid. Check errata_status; no action was authorized.",
					},
				],
			};
		}
	};
	server.registerTool(
		"errata_remember",
		{
			description:
				"Propose a belief; confirm with its returned confirmationId.",
			inputSchema: {
				text: z.string().max(8000).optional(),
				confirmationId: z.string().uuid().optional(),
			},
		},
		async (input) =>
			wrap(() =>
				input.confirmationId
					? api.confirm(input.confirmationId, "local-owner")
					: input.text
						? api.remember(input.text, "local-owner")
						: Promise.reject(new Error("Missing input")),
			),
	);
	server.registerTool(
		"errata_recall",
		{
			description: "Current beliefs only, including status.",
			inputSchema: { query: z.string().max(2000) },
		},
		async ({ query }) => wrap(() => api.recall(query)),
	);
	server.registerTool(
		"errata_guard",
		{
			description:
				"Check remembered claims before reliance. A hold forbids relying on them.",
			inputSchema: guardInput.shape,
		},
		async (input) => wrap(() => api.guard(input)),
	);
	server.registerTool(
		"errata_history",
		{
			description: "Correction history.",
			inputSchema: { key: z.string().regex(/^[a-f0-9]+$/) },
		},
		async ({ key }) => wrap(() => api.history(key)),
	);
	server.registerTool(
		"errata_status",
		{ description: "Health and account proof status.", inputSchema: {} },
		async () => wrap(() => api.status()),
	);
	return server;
}
export async function start() {
	await createServer(unavailableApi).connect(new StdioServerTransport());
}
