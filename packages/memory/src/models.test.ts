import { expect, it } from "vitest";
import type { MemoryClient } from "./index.js";
import { type ModelSnapshot, modelItem, restoreModels } from "./models.js";

it("restores labelled sample model snapshots without changing their cause", async () => {
	const snapshot: ModelSnapshot = {
		v: 1,
		id: "a".repeat(64),
		kind: "balance_floor",
		model: { priorDays: 3, contradictions: 2, exposureDays: 1 },
		causeEventId: "sample-event",
		occurredAt: "2026-11-07T00:00:00.000Z",
		provenance: "sample",
	};
	const item = modelItem(snapshot);
	const client = {
		recall: async () => ({ results: [{ text: item.text }] }),
	} as unknown as MemoryClient;
	const restored = await restoreModels(client, async () => {});
	expect(restored.warnings).toEqual([]);
	expect(restored.snapshots).toEqual([snapshot]);
});
