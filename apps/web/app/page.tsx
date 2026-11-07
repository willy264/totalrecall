import Link from "next/link";
export default function Home() {
	return (
		<>
			<p className="eyebrow">Memory that checks itself</p>
			<h1>
				Your agent remembers.
				<br />
				<em>Is it still true?</em>
			</h1>
			<p className="lede">
				An address changes. A balance falls. Errata checks remembered chain
				facts before your agents rely on them, and shares the correction.
			</p>
			<div className="rule" />
			<section aria-labelledby="first">
				<p className="folio">01 / The record</p>
				<h2 id="first">The first correction belongs here.</h2>
				<p>
					No live correction has been verified yet. When one is, this page will
					show the old belief beside the correction, with its source, blob and
					chain evidence.
				</p>
				<Link className="action" href="/proof">
					Inspect the proof record <span aria-hidden="true">↗</span>
				</Link>
			</section>
			<section className="columns">
				<div>
					<p className="folio">Check</p>
					<h2>Before reliance.</h2>
					<p>
						A guard holds when a belief is contradicted, or when a high-stakes
						check cannot be completed.
					</p>
				</div>
				<div>
					<p className="folio">Correct</p>
					<h2>Keep the history.</h2>
					<p>
						New versions supersede old ones. Each correction must carry
						evidence; a model cannot decide the verdict.
					</p>
				</div>
				<div>
					<p className="folio">Learn</p>
					<h2>Check at the right time.</h2>
					<p>
						The recheck schedule is designed to change as observations
						accumulate. No learned result is claimed yet.
					</p>
				</div>
			</section>
		</>
	);
}
