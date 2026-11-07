import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MemWal } from "@mysten-incubation/memwal";
export const root = fileURLToPath(new URL("../", import.meta.url));
export function env(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing environment: ${name}`);
	return value;
}
export function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
export async function run(
	name: string,
	fn: () => Promise<string>,
): Promise<void> {
	let status = "PASS",
		detail: string;
	try {
		detail = await fn();
	} catch (error) {
		status = "FAIL";
		process.exitCode = 1;
		// Never echo remote error text, headers, URLs or SDK error objects.
		detail =
			error instanceof Error &&
			/^(Missing environment:|Probe:)/.test(error.message)
				? error.message
				: "Probe failed; remote details suppressed to protect credentials. Check credentials, endpoint and SDK status.";
	}
	const line = `${new Date().toISOString()} ${status} ${name}: ${detail}`;
	console.log(line);
	appendFileSync(resolve(root, "docs/DECISIONS.md"), `\n- ${line}\n`);
}
export const pause = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));
export function memory(delegate = "CHECKER"): MemWal {
	return MemWal.create({
		accountId: env("MEMWAL_ACCOUNT_ID"),
		key: env(`MEMWAL_KEY_${delegate}`),
		serverUrl:
			process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz",
		requestTimeoutMs: 20000,
	});
}
export interface ProbeState {
	namespace: string;
	text: string;
	idempotencyKey: string;
	jobId?: string;
	blobId?: string;
}
export const statePath = resolve(root, ".local/m0-memory.json");
export function save(state: ProbeState): void {
	mkdirSync(resolve(root, ".local"), { recursive: true });
	writeFileSync(statePath, JSON.stringify(state, null, 2));
}
export function state(): ProbeState {
	assert(existsSync(statePath), "Probe: run m0-memwal first");
	return JSON.parse(readFileSync(statePath, "utf8")) as ProbeState;
}
