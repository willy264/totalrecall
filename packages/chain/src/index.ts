import { type Claim, claimSchema, type Read } from "@errata/core";
import { credentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";

export interface BudgetReservation {
	allowed: boolean;
	warning: boolean;
}
/** Must atomically reserve across processes before the request, including retries. */
export interface ChainLedger {
	reserve(background: boolean): Promise<BudgetReservation>;
	record(input: {
		method: string;
		status: string;
		provenance: "live";
		credits: number | null;
	}): Promise<void>;
}
export interface Pacer {
	acquire(): Promise<void>;
}
export interface Runtime {
	now(): number;
	sleep(ms: number): Promise<void>;
}
export const runtime: Runtime = {
	now: () => Date.now(),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
/** Use only for a single process. Production multi-process wiring requires the DB pacer. */
export class SerialPacer implements Pacer {
	private tail: Promise<void> = Promise.resolve();
	private next = 0;
	constructor(private clock: Runtime = runtime) {}
	acquire(): Promise<void> {
		const task = this.tail.then(async () => {
			await this.clock.sleep(Math.max(0, this.next - this.clock.now()));
			this.next = this.clock.now() + 500;
		});
		this.tail = task.catch(() => {});
		return task;
	}
}
export interface Wire {
	lookupName(name: string): Promise<unknown>;
	getBalance(owner: string, coinType: string): Promise<unknown>;
	getObject(objectId: string): Promise<unknown>;
	close(): void;
}
export function nativeWire(
	apiKey: string,
	host = "sui-mainnet-grpc.gateway.tatum.io:443",
): Wire {
	if (!apiKey || host !== "sui-mainnet-grpc.gateway.tatum.io:443")
		throw new Error("Tatum mainnet credentials and endpoint required");
	const transport = new GrpcTransport({
		host,
		channelCredentials: credentials.createSsl(),
	});
	const client = new SuiGrpcClient({ network: "mainnet", transport });
	const options = { meta: { "x-api-key": apiKey }, timeout: 20000 };
	return {
		lookupName: async (name) =>
			await client.nameService.lookupName({ name }, options).response,
		getBalance: async (owner, coinType) =>
			await client.stateService.getBalance({ owner, coinType }, options)
				.response,
		getObject: async (objectId) =>
			await client.ledgerService.getObject(
				{ objectId, readMask: { paths: ["object_id", "owner"] } },
				options,
			).response,
		close: () => transport.close(),
	};
}
function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object")
		throw new Error("Malformed response");
	return value as Record<string, unknown>;
}
export function observation(claim: Claim, response: unknown): unknown {
	const body = record(response);
	if (claim.kind === "name_resolves") {
		if (!("record" in body)) return null;
		const entry = record(body.record);
		if (entry.targetAddress === undefined) return null;
		if (typeof entry.targetAddress !== "string")
			throw new Error("Malformed name target");
		return entry.targetAddress;
	}
	if (claim.kind === "balance_floor") {
		const balance = record(body.balance);
		const total = balance.balance;
		if (typeof total !== "bigint" && typeof total !== "string")
			throw new Error("Missing balance");
		if (!/^\d+$/.test(String(total))) throw new Error("Invalid balance");
		return String(total);
	}
	if (claim.kind === "object_owner") {
		const owner = record(record(body.object).owner);
		if (owner.kind === 1 || owner.kind === 5) {
			if (typeof owner.address !== "string") throw new Error("Missing owner");
			return owner.address;
		}
		if (owner.kind === 2 || owner.kind === 3 || owner.kind === 4) return null;
		throw new Error("Unknown ownership kind");
	}
	throw new Error("Uncheckable claim");
}
export function errorCode(error: unknown): string {
	if (!error || typeof error !== "object") return "UNKNOWN";
	return String(
		(error as { code?: unknown; status?: unknown }).code ??
			(error as { status?: unknown }).status ??
			"UNKNOWN",
	);
}
export class TatumChain {
	constructor(
		private wire: Wire,
		private pacer: Pacer,
		private ledger: ChainLedger,
		private clock: Runtime = runtime,
	) {}
	async read(input: Claim, background = false): Promise<Read> {
		const claim = claimSchema.parse(input);
		if (claim.kind === "preference") return { ok: false, error: "other" };
		const method = {
			name_resolves: "NameService.LookupName",
			balance_floor: "StateService.GetBalance",
			object_owner: "LedgerService.GetObject",
		}[claim.kind];
		for (let attempt = 0; attempt < 4; attempt++) {
			try {
				const budget = await this.ledger.reserve(background);
				if (!budget.allowed) return { ok: false, error: "rate" };
				await this.pacer.acquire();
				let response: unknown;
				try {
					response =
						claim.kind === "name_resolves"
							? await this.wire.lookupName(claim.name)
							: claim.kind === "balance_floor"
								? await this.wire.getBalance(claim.address, claim.coinType)
								: await this.wire.getObject(claim.objectId);
				} catch (error) {
					await this.ledger.record({
						method,
						status: errorCode(error),
						provenance: "live",
						credits: null,
					});
					throw error;
				}
				await this.ledger.record({
					method,
					status: "OK",
					provenance: "live",
					credits: null,
				});
				return {
					ok: true,
					evidence: {
						source: "tatum-grpc",
						method,
						observed: observation(claim, response),
						expected: claim,
						readAt: new Date(this.clock.now()).toISOString(),
					},
				};
			} catch (error) {
				const code = errorCode(error);
				const retry = [
					"429",
					"14",
					"UNAVAILABLE",
					"RESOURCE_EXHAUSTED",
					"8",
				].includes(code);
				if (retry && attempt < 3) {
					const retrySeconds = Number(
						(error as { retryAfterSeconds?: unknown }).retryAfterSeconds,
					);
					await this.clock.sleep(
						Math.max(
							1000 * 2 ** attempt,
							Number.isFinite(retrySeconds)
								? Math.min(retrySeconds * 1000, 60000)
								: 0,
						),
					);
					continue;
				}
				return {
					ok: false,
					error: ["16", "7", "UNAUTHENTICATED", "PERMISSION_DENIED"].includes(
						code,
					)
						? "auth"
						: retry
							? "rate"
							: code === "UNKNOWN"
								? "other"
								: "network",
				};
			}
		}
		return { ok: false, error: "other" };
	}
	close(): void {
		this.wire.close();
	}
}
