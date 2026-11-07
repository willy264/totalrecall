import { credentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { verifyMemories, writeEvidence } from "./verify-memories.js";

const memories = await verifyMemories();
let checkpoint: string | null = null;
let accountVerified = false;
const warnings: string[] = [];
const account = process.env.MEMWAL_ACCOUNT_ID;
if (
	process.env.TATUM_API_KEY &&
	account &&
	/^0x[0-9a-fA-F]{1,64}$/.test(account)
) {
	const transport = new GrpcTransport({
		host: "sui-mainnet-grpc.gateway.tatum.io:443",
		channelCredentials: credentials.createSsl(),
	});
	try {
		const client = new SuiGrpcClient({ network: "mainnet", transport });
		const options = {
			meta: { "x-api-key": process.env.TATUM_API_KEY },
			timeout: 20000,
		};
		const cp = await client.ledgerService.getCheckpoint(
			{ checkpointId: { oneofKind: undefined } },
			options,
		).response;
		checkpoint = cp.checkpoint?.sequenceNumber?.toString() ?? null;
		await new Promise((resolve) => setTimeout(resolve, 1100));
		const result = await client.ledgerService.getObject(
			{ objectId: account, readMask: { paths: ["object_id"] } },
			options,
		).response;
		accountVerified =
			result.object?.objectId?.toLowerCase() ===
			`0x${account.slice(2).toLowerCase().padStart(64, "0")}`;
	} catch {
		warnings.push("Tatum proof read failed; no fallback used");
	} finally {
		transport.close();
	}
} else
	warnings.push("Tatum/account credentials absent; chain proof not attempted");
const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	provenance: "live",
	status:
		memories.status === "verified" && checkpoint && accountVerified
			? "verified"
			: "unavailable",
	network: "mainnet",
	accountId: accountVerified ? account : null,
	accountVerified,
	checkpoint,
	memories,
	warnings,
};
writeEvidence("proof", report);
console.log(`${report.status}: evidence/proof.json`);
if (report.status !== "verified") process.exitCode = 1;
