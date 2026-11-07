import { credentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { assert, env, pause, run } from "./m0-common.js";

await run("m0-tatum-grpc", async () => {
	const key = env("TATUM_API_KEY"),
		owner = env("WATCH_ADDRESS"),
		name = env("M0_SUI_NAME"),
		objectId = env("M0_OBJECT_ID");
	const host =
		process.env.TATUM_SUI_GRPC ?? "sui-mainnet-grpc.gateway.tatum.io:443";
	assert(
		host === "sui-mainnet-grpc.gateway.tatum.io:443",
		"Probe: only Tatum mainnet host allowed",
	);
	const transport = new GrpcTransport({
		host,
		channelCredentials: credentials.createSsl(),
	});
	const client = new SuiGrpcClient({ network: "mainnet", transport });
	const opts = { meta: { "x-api-key": key }, timeout: 20000 };
	try {
		const checkpoint = await client.ledgerService.getCheckpoint(
			{ checkpointId: { oneofKind: undefined } },
			opts,
		).response;
		assert(
			checkpoint.checkpoint?.sequenceNumber !== undefined,
			"Probe: checkpoint absent",
		);
		await pause(1100);
		const resolved = await client.nameService.lookupName({ name }, opts)
			.response;
		assert(
			resolved.record?.targetAddress,
			"Probe: name has no target; supply a known active name",
		);
		await pause(1100);
		const balance = await client.stateService.getBalance(
			{ owner, coinType: process.env.M0_COIN_TYPE ?? "0x2::sui::SUI" },
			opts,
		).response;
		assert(balance.balance, "Probe: balance absent");
		await pause(1100);
		const object = await client.ledgerService.getObject(
			{ objectId, readMask: { paths: ["object_id", "owner"] } },
			opts,
		).response;
		assert(object.object?.owner, "Probe: object owner absent");
		return `live: checkpoint ${checkpoint.checkpoint.sequenceNumber}; LookupName/GetBalance/GetObject returned fields; 4 reads; credit cost not measured; Vercel deployment not tested`;
	} finally {
		transport.close();
	}
});
