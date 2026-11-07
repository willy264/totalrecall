import { expect, it } from "vitest";
import {
	isDue,
	nextCheckAt,
	type ScheduleState,
	updateSchedule,
} from "./scheduler.js";

const at = "2026-11-07T00:00:00.000Z";
const state: ScheduleState = {
	model: { priorDays: 3, contradictions: 0, exposureDays: 0 },
	lastObservationAt: at,
	lastConfirmedAt: at,
	lastCauseEventId: null,
	snapshot: null,
};
it("moves the check earlier after a contradiction and records its cause", () => {
	const before = nextCheckAt(state.model, at);
	const after = updateSchedule(state, {
		kind: "balance_floor",
		verdict: "contradicted",
		causeEventId: "sample-1",
		at: "2026-11-07T00:01:00.000Z",
		provenance: "sample",
	});
	expect(Date.parse(after.nextCheckAt)).toBeLessThan(Date.parse(before));
	expect(after.snapshot?.causeEventId).toBe("sample-1");
	expect(after.snapshot?.provenance).toBe("sample");
	expect(isDue(after.state.model, at, before)).toBe(true);
});
it("deduplicates the cause and does not learn from failures", () => {
	const input = {
		kind: "balance_floor" as const,
		verdict: "contradicted" as const,
		causeEventId: "sample-1",
		at,
		provenance: "sample" as const,
	};
	const first = updateSchedule(state, input);
	expect(updateSchedule(first.state, input).state).toEqual(first.state);
	expect(
		updateSchedule(state, { ...input, verdict: "inconclusive" }).state,
	).toEqual(state);
});
it("snapshots daily even if the model moves by less than 20 percent", () => {
	const first = updateSchedule(
		{
			...state,
			model: { priorDays: 60, contradictions: 0, exposureDays: 100 },
		},
		{
			kind: "name_resolves",
			verdict: "confirmed",
			causeEventId: "one",
			at,
			provenance: "sample",
		},
	);
	const second = updateSchedule(first.state, {
		kind: "name_resolves",
		verdict: "confirmed",
		causeEventId: "two",
		at: "2026-11-08T00:00:00.000Z",
		provenance: "sample",
	});
	expect(second.snapshot).not.toBeNull();
});
it("rejects backwards time", () =>
	expect(() =>
		updateSchedule(state, {
			kind: "balance_floor",
			verdict: "confirmed",
			causeEventId: "x",
			at: "2026-11-06T00:00:00.000Z",
			provenance: "sample",
		}),
	).toThrow());
