import { expect, it } from "vitest";
import { extract, parseCommand } from "./index.js";

it("parses explicit commands without providers", async () => {
	expect((await extract("/remember name landlord.sui 0xabc", {})).state).toBe(
		"confirmation_required",
	);
	expect(
		parseCommand("/remember balance 0x1 0x2::sui::SUI 90071992547409931234")
			?.kind,
	).toBe("balance_floor");
});
it("rejects invented addresses and falls back to commands", async () => {
	const result = await extract("landlord.sui is 0xabc", {
		groq: {
			extract: async () =>
				JSON.stringify({
					claims: [
						{ kind: "name_resolves", name: "landlord.sui", address: "0xdef" },
					],
				}),
		},
	});
	expect(result.state).toBe("command_required");
});
it("tries Gemini after Groq failure and still requests confirmation", async () => {
	const result = await extract("landlord.sui is 0xabc", {
		groq: {
			extract: async () => {
				throw new Error("fixture outage");
			},
		},
		gemini: {
			extract: async () =>
				JSON.stringify({
					claims: [
						{ kind: "name_resolves", name: "landlord.sui", address: "0xabc" },
					],
				}),
		},
	});
	expect(result).toMatchObject({
		state: "confirmation_required",
		provider: "gemini",
	});
});
it("does not accept extra instruction fields", async () => {
	const result = await extract("landlord.sui is 0xabc", {
		groq: {
			extract: async () =>
				JSON.stringify({
					claims: [
						{
							kind: "name_resolves",
							name: "landlord.sui",
							address: "0xabc",
							verdict: "confirmed",
						},
					],
				}),
		},
	});
	expect(result.state).toBe("command_required");
});
