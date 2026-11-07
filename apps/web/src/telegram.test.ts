import { unavailableApi } from "@errata/agents";
import { expect, it } from "vitest";
import { createTelegram, validSecret } from "./telegram.js";

it("rejects absent or mismatched webhook secrets", () => {
	expect(validSecret(null, "test")).toBe(false);
	expect(validSecret("wrong", "test")).toBe(false);
	expect(validSecret("test", "test")).toBe(true);
});
it("requires an explicit allowlist", () =>
	expect(() =>
		createTelegram("sample-token", new Set(), unavailableApi),
	).toThrow("allowlist"));
