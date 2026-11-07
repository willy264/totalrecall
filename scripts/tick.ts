import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { root } from "./m0-common.js";

const dryRun = !process.argv.includes("--live");
// No runtime fake store: without live composition, a dry run reports unknown queue sizes.
const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	provenance: "sample",
	purpose: "tick preflight only; not a live check",
	dryRun,
	mode: "setup",
	dueBeliefs: null,
	checked: 0,
	writes: 0,
	status: dryRun ? "dry-run" : "blocked",
	reason: dryRun
		? "No credentials accessed and no adapters instantiated"
		: "M0 and real scheduler/outbox composition must be completed before enabling live ticks",
};
mkdirSync(resolve(root, "evidence"), { recursive: true });
writeFileSync(
	resolve(root, "evidence/tick.json"),
	`${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report));
if (!dryRun) process.exitCode = 1;
