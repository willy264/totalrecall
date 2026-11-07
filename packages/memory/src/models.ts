import { canonical, hash, provenanceSchema } from "@errata/core";
import { z } from "zod";
import type { MemoryClient, OutboxItem } from "./index.js";
export const modelSnapshotSchema = z
	.object({
		v: z.literal(1),
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
		provenance: provenanceSchema,
	})
	.strict();
export type ModelSnapshot = z.infer<typeof modelSnapshotSchema>;
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
