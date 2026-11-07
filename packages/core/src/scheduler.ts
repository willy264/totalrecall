import { z } from "zod";
import {
	canonical,
	hash,
	learn,
	type Model,
	nextCheckDays,
	type Provenance,
	snapshotDue,
	type Verdict,
} from "./index.js";
export const modelSnapshotSchema = z
	.object({
		v: z.literal(1),
		event: z.literal("model_update").optional(),
		agent: z.literal("checker").optional(),
		id: z.string().regex(/^[a-f0-9]{64}$/),
		kind: z.enum(["name_resolves", "balance_floor", "object_owner"]),
		model: z
			.object({
				priorDays: z.number().positive(),
				contradictions: z.number().int().nonnegative(),
				exposureDays: z.number().nonnegative(),
			})
			.strict(),
		causeEventId: z.string().min(1),
		occurredAt: z.iso.datetime(),
		provenance: z.enum(["live", "replay", "sample"]),
	})
	.strict();
export type ModelSnapshot = z.infer<typeof modelSnapshotSchema>;
export interface ScheduleState {
	model: Model;
	lastObservationAt: string;
	lastConfirmedAt: string;
	lastCauseEventId: string | null;
	snapshot: ModelSnapshot | null;
}
const day = 86400000;
function timestamp(value: string): number {
	const result = Date.parse(value);
	if (!Number.isFinite(result)) throw new Error("Invalid schedule timestamp");
	return result;
}
export function nextCheckAt(model: Model, lastConfirmedAt: string): string {
	return new Date(
		timestamp(lastConfirmedAt) + nextCheckDays(model) * day,
	).toISOString();
}
export function isDue(
	model: Model,
	lastConfirmedAt: string,
	now: string,
): boolean {
	return timestamp(now) >= timestamp(nextCheckAt(model, lastConfirmedAt));
}
export function updateSchedule(
	state: ScheduleState,
	input: {
		kind: ModelSnapshot["kind"];
		verdict: Verdict;
		causeEventId: string;
		at: string;
		provenance: Provenance;
	},
): {
	state: ScheduleState;
	nextCheckAt: string;
	snapshot: ModelSnapshot | null;
} {
	const at = timestamp(input.at),
		previous = timestamp(state.lastObservationAt);
	if (at < previous) throw new Error("Observation precedes model state");
	if (
		input.causeEventId === state.lastCauseEventId ||
		input.verdict === "inconclusive" ||
		input.verdict === "unverifiable"
	)
		return {
			state,
			nextCheckAt: nextCheckAt(state.model, state.lastConfirmedAt),
			snapshot: null,
		};
	const model = learn(state.model, (at - previous) / day, input.verdict);
	const lastConfirmedAt =
		input.verdict === "confirmed" ? input.at : state.lastConfirmedAt;
	const publish =
		!state.snapshot ||
		snapshotDue(
			state.snapshot.model,
			model,
			(at - timestamp(state.snapshot.occurredAt)) / day,
		);
	let snapshot: ModelSnapshot | null = null;
	if (publish) {
		const data = {
			v: 1 as const,
			event: "model_update" as const,
			agent: "checker" as const,
			kind: input.kind,
			model,
			causeEventId: input.causeEventId,
			occurredAt: input.at,
			provenance: input.provenance,
		};
		snapshot = modelSnapshotSchema.parse({
			...data,
			id: hash(canonical(data)),
		});
	}
	return {
		state: {
			model,
			lastObservationAt: input.at,
			lastConfirmedAt,
			lastCauseEventId: input.causeEventId,
			snapshot: snapshot ?? state.snapshot,
		},
		nextCheckAt: nextCheckAt(model, lastConfirmedAt),
		snapshot,
	};
}
