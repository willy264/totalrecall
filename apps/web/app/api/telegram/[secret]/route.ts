export const runtime = "nodejs";
// M0 gate: no bot instantiated and no messages sent before live wiring is approved by passed probes.
export function POST() {
	return Response.json(
		{ error: "Telegram integration not enabled; M0 pending" },
		{ status: 503 },
	);
}
