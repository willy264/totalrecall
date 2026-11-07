export default async function Timeline({
	params,
}: {
	params: Promise<{ key: string }>;
}) {
	const { key } = await params;
	return (
		<>
			<p className="eyebrow">Belief history</p>
			<h1>A correction leaves a trace.</h1>
			<p className="mono">{key.slice(0, 128)}</p>
			<section className="empty">
				<h2>No public evidence is available for this belief.</h2>
				<p>
					Its timeline will appear only after the owner approves publication and
					the record is verified. No old value, correction, blob or checkpoint
					is fabricated here.
				</p>
			</section>
		</>
	);
}
