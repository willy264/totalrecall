import type { Read } from "@errata/core";
import { expect, it } from "vitest";
import { type Corpus, compareArms, score } from "./index.js";

// Tiny authored sample solely for scorer assertions. Not a benchmark result or real wallet history.
const reads = (amount: string): Read[] =>
	[0, 2].map((second) => ({
		ok: true,
		evidence: {
			source: "tatum-grpc",
			method: "StateService.GetBalance",
			observed: amount,
			expected: "20",
			readAt: `2026-11-07T12:00:0${second}.000Z`,
		},
	}));
const sample: Corpus = {
	provenance: "sample",
	purpose: "scorer-test-only",
	trainAddresses: ["sample-training"],
	cases: [
		{
			address: "sample-test",
			claim: {
				kind: "balance_floor",
				address: "0x1",
				coinType: "0x2::sui::SUI",
				floor: "20",
			},
			confirmedAt: "2026-11-07T00:00:00.000Z",
			intakeReads: 1,
			points: [
				{
					at: "2026-11-07T12:00:00.000Z",
					reads: reads("10"),
					reference: reads("10"),
				},
			],
		},
	],
};
const model = { priorDays: 3, contradictions: 0, exposureDays: 0 };
it("sample scorer: A uses a stale belief, C and due D hold and count two reads", () => {
	const [a, c, d] = compareArms(sample, model);
	expect(a.staleUsed).toBe(1);
	expect(a.policyReads).toBe(1);
	expect(c.staleUsed).toBe(0);
	expect(c.policyReads).toBe(3);
	expect(d.staleUsed).toBe(0);
	expect(d.policyReads).toBe(3);
	expect(d.provenance).toBe("sample");
});
it("does not let reference truth cause D to check early", () => {
	const early = {
		...sample,
		cases: sample.cases.map((c) => ({
			...c,
			points: c.points.map((p) => ({ ...p, at: "2026-11-07T00:01:00.000Z" })),
		})),
	};
	expect(score(early, "D", model).staleUsed).toBe(1);
	expect(score(early, "D", model).policyReads).toBe(1);
});
it("counts false contradictions against independent reference", () => {
	const conflicting = {
		...sample,
		cases: sample.cases.map((c) => ({
			...c,
			points: c.points.map((p) => ({ ...p, reference: reads("30") })),
		})),
	};
	expect(score(conflicting, "C", model).falseContradictions).toBe(1);
});
it("rejects train/test leakage", () =>
	expect(() =>
		score({ ...sample, trainAddresses: ["sample-test"] }, "D", model),
	).toThrow("leakage"));
it("leaves trained parameters unchanged and reports missing reference coverage", () => {
	const frozen = Object.freeze({ ...model });
	const missing = {
		...sample,
		cases: sample.cases.map((c) => ({
			...c,
			points: c.points.map((p) => ({ ...p, reference: [] })),
		})),
	};
	expect(score(missing, "D", frozen).checkable).toBe(0);
	expect(frozen).toEqual(model);
});
