import { nextCheckAt, type ScheduleState } from "@errata/core";
import { expect, it } from "vitest";
import { type DueBelief, type SchedulerStore, tick } from "./scheduler.js";

it("checks due beliefs and persists a changed schedule plus snapshot in one store operation", async () => {
	let state: ScheduleState = {
		model: { priorDays: 3, contradictions: 0, exposureDays: 0 },
		lastObservationAt: "2026-11-07T00:00:00.000Z",
		lastConfirmedAt: "2026-11-07T00:00:00.000Z",
		lastCauseEventId: null,
		snapshot: null,
	};
	const before = nextCheckAt(state.model, state.lastConfirmedAt);
	const belief = (): DueBelief => ({
		key: "sample",
		kind: "balance_floor",
		schedule: state,
	});
	const store: SchedulerStore = {
		candidates: async () => [belief()],
		observe: async (_, work) => {
			const result = await work(belief());
			if (result) state = result.state;
		},
	};
	const report = await tick(
		store,
		async () => ({
			verdict: "contradicted",
			causeEventId: "sample-cause",
			at: "2026-11-07T12:00:00.000Z",
			provenance: "sample",
		}),
		"2026-11-07T12:00:00.000Z",
	);
	expect(report.checked).toBe(1);
	expect(report.snapshots).toBe(1);
	expect(nextCheckAt(state.model, state.lastConfirmedAt) < before).toBe(true);
	expect(state.snapshot?.causeEventId).toBe("sample-cause");
});
it("dry run never invokes checks or mutations", async () => {
	let writes = 0,
		reads = 0;
	const store: SchedulerStore = {
		candidates: async () => [],
		observe: async () => {
			writes++;
		},
	};
	const result = await tick(
		store,
		async () => {
			reads++;
			throw new Error("must not run");
		},
		"2026-11-07T00:00:00.000Z",
		true,
	);
	expect(result.dryRun).toBe(true);
	expect(reads + writes).toBe(0);
});
