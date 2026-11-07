import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:3107",
		screenshot: "off",
		video: "off",
		trace: "off",
	},
	projects: [
		{
			name: "iPhone 13",
			use: { ...devices["iPhone 13"], browserName: "chromium" },
		},
		{ name: "Pixel 7", use: { ...devices["Pixel 7"] } },
	],
	webServer: {
		command:
			"node apps/web/node_modules/next/dist/bin/next dev apps/web --hostname 127.0.0.1 --port 3107",
		url: "http://127.0.0.1:3107",
		reuseExistingServer: false,
		timeout: 120000,
	},
});
