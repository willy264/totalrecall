import {
	isDue,
	type ModelSnapshot,
	type Provenance,
	type ScheduleState,
	updateSchedule,
	type Verdict,
} from "@errata/core";
export interface DueBelief {
	key: string;
	kind: ModelSnapshot["kind"];
	schedule: ScheduleState;
}
export interface SchedulerStore {
	candidates(): Promise<DueBelief[]>;
	/** Reload and serialize state under a durable per-belief lock; apply model + snapshot outbox atomically. */
	observe(
		key: string,
		work: (
			current: DueBelief,
		) => Promise<ReturnType<typeof updateSchedule> | null>,
	): Promise<void>;
}
export interface CheckObservation {
	verdict: Verdict;
	causeEventId: string;
	at: string;
	provenance: Provenance;
}
export async function tick(
	store: SchedulerStore,
	check: (belief: DueBelief) => Promise<CheckObservation>,
	now: string,
	dryRun = false,
) {
	const candidates = await store.candidates();
	const due = candidates.filter((b) =>
		isDue(b.schedule.model, b.schedule.lastConfirmedAt, now),
	);
	let checked = 0,
		snapshots = 0;
	const errors: string[] = [];
	if (!dryRun)
		for (const belief of due) {
			try {
				await store.observe(belief.key, async (current) => {
					if (
						!isDue(
							current.schedule.model,
							current.schedule.lastConfirmedAt,
							now,
						)
					)
						return null;
					const observation = await check(current);
					checked++;
					const result = updateSchedule(current.schedule, {
						...observation,
						kind: current.kind,
					});
					if (result.snapshot) snapshots++;
					return result;
				});
			} catch {
				errors.push(belief.key);
			}
		}
	return {
		dryRun,
		candidates: candidates.length,
		due: due.length,
		checked,
		snapshots,
		errors,
	};
}
