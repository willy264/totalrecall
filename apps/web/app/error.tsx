"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
	return (
		<section role="alert">
			<p className="eyebrow">The record could not be loaded</p>
			<h1>We cannot verify this page.</h1>
			<p>Nothing here should be treated as a confirmed belief.</p>
			<button type="button" onClick={reset}>
				Try again
			</button>
		</section>
	);
}
