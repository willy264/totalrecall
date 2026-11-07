import {
	canonical,
	hash,
	type ModelSnapshot,
	modelSnapshotSchema,
} from "@errata/core";

export { type ModelSnapshot, modelSnapshotSchema } from "@errata/core";

import type { MemoryClient, OutboxItem } from "./index.js";
export function modelItem(snapshot: ModelSnapshot): OutboxItem {
	const parsed = modelSnapshotSchema.parse(snapshot);
	return {
		id: `model:${parsed.id}`,
		namespace: "errata-model",
		text: `Errata recheck model for ${parsed.kind}. ⟦errata-model:${canonical(parsed)}⟧`,
	};
}
export async function restoreModels(
	client: MemoryClient,
	pace: () => Promise<void>,
): Promise<{ snapshots: ModelSnapshot[]; warnings: string[]; hash: string }> {
	await pace();
	const result = await client.recall({
		query: "Errata recheck model snapshots",
		namespace: "errata-model",
		limit: 100,
	});
	const warnings: string[] = [];
	if (result.results.length === 100)
		warnings.push("errata-model: recall limit reached");
	if (result.dropped_count) warnings.push("errata-model: dropped snapshots");
	const snapshots: ModelSnapshot[] = [];
	for (const hit of result.results) {
		const start = hit.text.indexOf("⟦errata-model:");
		try {
			if (
				start < 0 ||
				start !== hit.text.lastIndexOf("⟦errata-model:") ||
				!hit.text.endsWith("⟧")
			)
				throw new Error("tag");
			snapshots.push(
				modelSnapshotSchema.parse(JSON.parse(hit.text.slice(start + 14, -1))),
			);
		} catch {
			warnings.push("errata-model: malformed snapshot");
		}
	}
	snapshots.sort(
		(a, b) =>
			a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
	);
	return { snapshots, warnings, hash: hash(canonical(snapshots)) };
}
