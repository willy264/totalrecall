export function GET() {
	return Response.json(
		{
			mode: "setup",
			network: "mainnet",
			verified: false,
			counts: null,
			lastRead: null,
			m0: "pending",
			liveAdapters: false,
		},
		{ headers: { "Cache-Control": "no-store" } },
	);
}
