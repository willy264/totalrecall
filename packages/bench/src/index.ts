import {
	type Claim,
	claimSchema,
	guardDecision,
	type Model,
	probability,
	type Read,
	shouldRecheck,
	type Verdict,
	verdict,
} from "@errata/core";
export type Arm = "A" | "C" | "D";
export interface DecisionPoint {
	at: string;
	reads: Read[];
	reference: Read[];
}
export interface Case {
	address: string;
	claim: Claim;
	confirmedAt: string;
	intakeReads: number;
	points: DecisionPoint[];
}
export interface Corpus {
	provenance: "sample" | "replay";
	purpose: "scorer-test-only" | "preregistered-replay";
	trainAddresses: string[];
	cases: Case[];
}
export interface Metrics {
	arm: Arm;
	provenance: Corpus["provenance"];
	purpose: Corpus["purpose"];
	decisions: number;
	staleUsed: number;
	falseContradictions: number;
	policyReads: number;
	holds: number;
	inconclusive: number;
	checkable: number;
	attempted: number;
}
export function score(
	corpus: Corpus,
	arm: Arm,
	trainedModel: Readonly<Model>,
): Metrics {
	if (corpus.provenance === "sample" && corpus.purpose !== "scorer-test-only")
		throw new Error("Synthetic corpus cannot be published as replay");
	if (new Set(corpus.cases.map((c) => c.address)).size !== corpus.cases.length)
		throw new Error("Duplicate test address");
	if (corpus.cases.some((c) => corpus.trainAddresses.includes(c.address)))
		throw new Error("Train/test address leakage");
	const metrics: Metrics = {
		arm,
		provenance: corpus.provenance,
		purpose: corpus.purpose,
		decisions: 0,
		staleUsed: 0,
		falseContradictions: 0,
		policyReads: 0,
		holds: 0,
		inconclusive: 0,
		checkable: 0,
		attempted: corpus.cases.length,
	};
	for (const item of corpus.cases) {
		const claim = claimSchema.parse(item.claim);
		if (claim.kind !== "balance_floor")
			throw new Error(
				"Primary scorer supports the preregistered balance-floor corpus only",
			);
		let lastConfirmed = Date.parse(item.confirmedAt);
		let previous = lastConfirmed;
		let status: Verdict = "confirmed";
		let complete = true;
		metrics.policyReads += item.intakeReads;
		for (const point of item.points) {
			const now = Date.parse(point.at);
			if (!Number.isFinite(now) || now < previous)
				throw new Error("Decision order invalid");
			previous = now;
			const age = (now - lastConfirmed) / 86400000;
			let checked = false;
			if (
				arm === "C" ||
				(arm === "D" && shouldRecheck("low", probability(trainedModel, age)))
			) {
				checked = true;
				const used: Read[] = point.reads.slice(0, 1);
				metrics.policyReads += used.length;
				const first = verdict(claim, used);
				if (first === "inconclusive" && used[0]?.ok && point.reads[1]) {
					used.push(point.reads[1]);
					metrics.policyReads++;
				}
				status = verdict(claim, used);
				if (status === "confirmed") lastConfirmed = now;
			}
			// Reference is only consulted after the policy chooses whether to read; it never drives scheduling.
			const truth = verdict(claim, point.reference);
			if (truth === "inconclusive" || truth === "unverifiable")
				complete = false;
			const decision =
				arm === "A"
					? "proceed"
					: guardDecision("low", [
							{
								key: item.address,
								text: "balance floor",
								verdict: status,
								pTrue: probability(
									trainedModel,
									(now - lastConfirmed) / 86400000,
								),
								checkedThisCall: checked,
								correctionPersisted: status === "contradicted",
							},
						]).decision;
			metrics.decisions++;
			if (decision === "hold") metrics.holds++;
			if (status === "inconclusive") metrics.inconclusive++;
			if (decision === "proceed" && truth === "contradicted")
				metrics.staleUsed++;
			if (status === "contradicted" && truth === "confirmed")
				metrics.falseContradictions++;
		}
		if (complete && item.points.length) metrics.checkable++;
	}
	return metrics;
}
export function compareArms(corpus: Corpus, trainedModel: Readonly<Model>) {
	return (["A", "C", "D"] as const).map((arm) =>
		score(corpus, arm, trainedModel),
	);
}
