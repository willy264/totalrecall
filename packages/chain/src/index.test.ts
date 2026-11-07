import { claimSchema } from "@errata/core";
import { describe, expect, it } from "vitest";
import {
	type ChainLedger,
	observation,
	SerialPacer,
	TatumChain,
	type Wire,
} from "./index.js";

// SAMPLE SDK-shape fixtures, authored from installed declarations. NOT recorded live RPC responses.
const fixtures = {
	balance: { balance: { balance: "90071992547409931234" } },
	name: { record: { targetAddress: "0x1" } },
	object: { object: { owner: { kind: 1, address: "0x1" } } },
};
const balance = claimSchema.parse({
	kind: "balance_floor",
	address: "0x1",
	coinType: "0x2::sui::SUI",
	floor: "20",
});
describe("sample SDK contract fixtures", () => {
	it("preserves large balances", () =>
		expect(observation(balance, fixtures.balance)).toBe(
			"90071992547409931234",
		));
	it("rejects malformed balances rather than using zero", () =>
		expect(() => observation(balance, {})).toThrow());
	it("maps names and distinguishes object ownership", () => {
		expect(
			observation(
				claimSchema.parse({
					kind: "name_resolves",
					name: "a.sui",
					address: "0x1",
				}),
				fixtures.name,
			),
		).toBe("0x1");
		const c = claimSchema.parse({
			kind: "object_owner",
			objectId: "0x2",
			owner: "0x1",
		});
		expect(observation(c, fixtures.object)).toBe("0x1");
		expect(
			observation(c, { object: { owner: { kind: 2, address: "0x1" } } }),
		).toBeNull();
	});
	it("paces concurrent acquisitions at two per second", async () => {
		let now = 0;
		const times: number[] = [];
		const pacer = new SerialPacer({
			now: () => now,
			sleep: async (ms) => {
				now += ms;
				times.push(now);
			},
		});
		await Promise.all([pacer.acquire(), pacer.acquire(), pacer.acquire()]);
		expect(times).toEqual([0, 500, 1000]);
	});
	it("backs off 14 and meters every attempt", async () => {
		let calls = 0;
		const delays: number[] = [];
		const records: unknown[] = [];
		const wire: Wire = {
			getBalance: async () => {
				if (++calls < 3) throw { code: 14 };
				return fixtures.balance;
			},
			lookupName: async () => fixtures.name,
			getObject: async () => fixtures.object,
			close: () => {},
		};
		const ledger: ChainLedger = {
			reserve: async () => ({ allowed: true, warning: false }),
			record: async (r) => {
				records.push(r);
			},
		};
		const chain = new TatumChain(wire, { acquire: async () => {} }, ledger, {
			now: () => 0,
			sleep: async (ms) => {
				delays.push(ms);
			},
		});
		expect((await chain.read(balance)).ok).toBe(true);
		expect(delays).toEqual([1000, 2000]);
		expect(records).toHaveLength(3);
	});
	it("does not issue reads once budget is exhausted", async () => {
		let calls = 0;
		const wire: Wire = {
			getBalance: async () => {
				calls++;
				return fixtures.balance;
			},
			lookupName: async () => ({}),
			getObject: async () => ({}),
			close: () => {},
		};
		const chain = new TatumChain(
			wire,
			{ acquire: async () => {} },
			{
				reserve: async () => ({ allowed: false, warning: true }),
				record: async () => {},
			},
		);
		expect(await chain.read(balance, true)).toEqual({
			ok: false,
			error: "rate",
		});
		expect(calls).toBe(0);
	});
});
