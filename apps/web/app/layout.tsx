import type { Metadata } from "next";
import Link from "next/link";
import "./style.css";
export const metadata: Metadata = {
	title: "Errata — Memory that checks itself",
	description:
		"Shared agent memory, checked against chain evidence before use.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<a className="skip" href="#main">
					Skip to content
				</a>
				<header>
					<Link className="wordmark" href="/">
						Errata<span aria-hidden="true">*</span>
					</Link>
					<p className="edition">An account of what changed.</p>
					<nav aria-label="Main navigation">
						<Link href="/beliefs">Beliefs</Link>
						<Link href="/learning">Learning</Link>
						<Link href="/bench">Benchmark</Link>
						<Link href="/proof">Proof</Link>
						<Link href="/status">Status</Link>
					</nav>
				</header>
				<main id="main">{children}</main>
				<footer>
					<p>One owner. Several agents. A shared record of corrections.</p>
					<p className="mono">Setup mode · Mainnet verification pending</p>
				</footer>
			</body>
		</html>
	);
}
