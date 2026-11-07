import { notFound } from "next/navigation";

const pages: Record<
	string,
	{ title: string; intro: string; empty: string; detail: string }
> = {
	beliefs: {
		title: "What the agents remember.",
		intro: "Current beliefs, their status and the evidence behind them.",
		empty: "No approved beliefs to display.",
		detail:
			"Only beliefs approved by the owner will appear publicly. A blank record does not imply that the account has no private memories.",
	},
	learning: {
		title: "Memory has a half-life.",
		intro: "A record of how observations change the recheck schedule.",
		empty: "No learned model snapshots yet.",
		detail:
			"Planning priors: name resolution 60 days; balance floors 3 days; object ownership 30 days. These are assumptions, not measured results.",
	},
	bench: {
		title: "Test the doubt.",
		intro:
			"Plain memory. Always check. Errata. The comparison must include the cost.",
		empty: "No scored benchmark has run.",
		detail:
			"The committed experiment plan fixes a seed, address split, metrics and failure thresholds. Results will be labelled replay, with losses and missing data disclosed. Public wallets are a proxy for real users.",
	},
	proof: {
		title: "A claim needs a source.",
		intro: "Account, blobs, expiry and chain evidence in one place.",
		empty: "Mainnet proof is pending.",
		detail:
			"No account object, memory count, blob, expiry or checkpoint has been verified for display. Delegate keys reach all namespaces; this is a single-owner design. The hosted relayer sees plaintext.",
	},
	agents: {
		title: "One correction. Shared memory.",
		intro: "A record of which agent wrote and read each belief.",
		empty: "No agent activity verified yet.",
		detail:
			"Telegram and MCP will use separate delegate keys. No cross-agent portability result has been recorded.",
	},
	status: {
		title: "The state of the build.",
		intro: "What is connected, what is known, and what is still pending.",
		empty: "Setup mode. Live adapters are disabled.",
		detail:
			"M0 must pass before live adapters are enabled. No secrets are needed to view these pages. Missing service configuration is never presented as a healthy connection.",
	},
};
export function generateStaticParams() {
	return Object.keys(pages).map((section) => ({ section }));
}
export default async function Section({
	params,
}: {
	params: Promise<{ section: string }>;
}) {
	const { section } = await params;
	const page = pages[section];
	if (!page) notFound();
	return (
		<>
			<p className="eyebrow">Errata / {section}</p>
			<h1>{page.title}</h1>
			<p className="lede">{page.intro}</p>
			<section className="empty" aria-labelledby="empty-title">
				<p className="folio">Awaiting evidence</p>
				<h2 id="empty-title">{page.empty}</h2>
				<p>{page.detail}</p>
			</section>
		</>
	);
}
