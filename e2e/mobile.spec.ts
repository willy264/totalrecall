import { expect, test } from "@playwright/test";

for (const path of [
	"/",
	"/beliefs",
	"/learning",
	"/bench",
	"/proof",
	"/agents",
	"/status",
	"/beliefs/ab",
])
	test(`${path} has a usable mobile shell without overflow`, async ({
		page,
	}) => {
		await page.goto(path);
		await expect(
			page.getByRole("navigation", { name: "Main navigation" }),
		).toBeVisible();
		await expect(
			page.getByRole("main").getByRole("heading", { level: 1 }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Proof", exact: true }),
		).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
		await expect(
			page.getByText("Setup mode · Mainnet verification pending"),
		).toBeVisible();
		if (path === "/proof")
			await expect(
				page.getByRole("heading", { name: "Mainnet proof is pending." }),
			).toBeVisible();
	});
