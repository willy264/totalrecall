import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync(
	"git",
	["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
	{ encoding: "utf8" },
)
	.split("\0")
	.filter(Boolean);
const patterns = [
	/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
	/(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{30,}/,
	/\bAIza[A-Za-z0-9_-]{30,}/,
	/\bsk-[A-Za-z0-9_-]{24,}/,
	/(?:API_KEY|BOT_TOKEN|DATABASE_URL|MEMWAL_KEY_\w+)\s*=\s*["']?[A-Za-z0-9:/_-]{16,}/,
];
const bad = files.filter(
	(path) =>
		(/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith(".example")) ||
		patterns.some((pattern) => pattern.test(readFileSync(path, "utf8"))),
);
if (bad.length) {
	console.error("FAIL secret scan (paths only):", bad.join(", "));
	process.exitCode = 1;
} else
	console.log(
		`PASS secret scan: ${files.length} files; heuristic scan, not a guarantee`,
	);
