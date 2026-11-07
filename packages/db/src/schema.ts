import type { BeliefEvent, Model } from "@errata/core";
import {
	bigint,
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

const time = (name: string) =>
	timestamp(name, { withTimezone: true, mode: "date" });
export const beliefs = pgTable("beliefs", {
	key: text("key").primaryKey(),
	head: jsonb("head").$type<BeliefEvent>().notNull(),
	status: text("status").notNull(),
	publicApproved: boolean("public_approved").notNull().default(false),
	lastChecked: time("last_checked"),
	nextCheck: time("next_check"),
	updatedAt: time("updated_at").defaultNow().notNull(),
});
export const events = pgTable(
	"events",
	{
		id: text("id").primaryKey(),
		beliefKey: text("belief_key").notNull(),
		seq: integer("seq").notNull(),
		payload: jsonb("payload").$type<BeliefEvent>().notNull(),
		blobId: text("blob_id"),
	},
	(t) => [uniqueIndex("events_belief_seq").on(t.beliefKey, t.seq)],
);
export const outbox = pgTable("outbox", {
	id: text("id").primaryKey(),
	namespace: text("namespace").notNull(),
	text: text("text").notNull(),
	batchKey: text("batch_key"),
	state: text("state").notNull().default("pending"),
	availableAt: time("available_at").defaultNow().notNull(),
	createdAt: time("created_at").defaultNow().notNull(),
});
export const batches = pgTable("batches", {
	key: text("key").primaryKey(),
	items: jsonb("items").notNull(),
	jobIds: jsonb("job_ids").$type<string[]>(),
	state: text("state").notNull().default("pending"),
	leaseUntil: time("lease_until"),
	availableAt: time("available_at").defaultNow().notNull(),
});
export const jobs = pgTable("jobs", {
	id: text("id").primaryKey(),
	batchKey: text("batch_key").notNull(),
	itemId: text("item_id").notNull(),
	state: text("state").notNull(),
	blobId: text("blob_id"),
	updatedAt: time("updated_at").defaultNow().notNull(),
});
export const snapshots = pgTable("model_snapshots", {
	id: text("id").primaryKey(),
	kind: text("kind").notNull(),
	model: jsonb("model").$type<Model>().notNull(),
	causeEventId: text("cause_event_id").notNull(),
	provenance: text("provenance").notNull(),
	occurredAt: time("occurred_at").notNull(),
	blobId: text("blob_id"),
});
export const creditUsage = pgTable("credit_usage", {
	id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
	method: text("method").notNull(),
	status: text("status").notNull(),
	provenance: text("provenance").notNull(),
	credits: integer("credits"),
	occurredAt: time("occurred_at").defaultNow().notNull(),
});
export const budget = pgTable("budget", {
	id: text("id").primaryKey(),
	reservedCredits: integer("reserved_credits").default(0).notNull(),
	limitCredits: integer("limit_credits").default(100000).notNull(),
	estimatedCost: integer("estimated_cost").notNull(),
});
export const pacing = pgTable("pacing", {
	id: text("id").primaryKey(),
	nextAt: time("next_at").defaultNow().notNull(),
});
