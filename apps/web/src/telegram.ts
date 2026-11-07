import { timingSafeEqual } from "node:crypto";
import type { AgentApi } from "@errata/agents";
import { Bot } from "grammy";
export function validSecret(actual: string | null, expected: string): boolean {
	if (!actual || !expected) return false;
	const a = Buffer.from(actual),
		b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
export function createTelegram(
	token: string,
	allowedIds: ReadonlySet<string>,
	api: AgentApi,
) {
	if (!allowedIds.size) throw new Error("Telegram allowlist required");
	const bot = new Bot(token);
	bot.use(async (ctx, next) => {
		if (ctx.from && allowedIds.has(String(ctx.from.id))) await next();
	});
	const reply = async (
		ctx: { reply(text: string): Promise<unknown> },
		work: () => Promise<unknown>,
	) => {
		try {
			await ctx.reply(JSON.stringify(await work(), null, 2).slice(0, 3900));
		} catch {
			await ctx.reply(
				"Request unavailable or invalid. No action authorized. Use /status.",
			);
		}
	};
	bot.command("status", (ctx) => reply(ctx, () => api.status()));
	bot.command("beliefs", (ctx) =>
		reply(ctx, () => api.recall("all current beliefs")),
	);
	bot.command("why", (ctx) => reply(ctx, () => api.history(ctx.match.trim())));
	bot.command("check", (ctx) =>
		reply(ctx, () =>
			api.guard({
				intent: "Check belief",
				query: ctx.match.trim(),
				stakes: "high",
			}),
		),
	);
	bot.command("guard", (ctx) =>
		reply(ctx, () =>
			api.guard({
				intent: ctx.match.trim(),
				query: ctx.match.trim(),
				stakes: "high",
			}),
		),
	);
	bot.command("confirm", (ctx) =>
		reply(ctx, () => api.confirm(ctx.match.trim(), String(ctx.from?.id))),
	);
	bot.on("message:text", (ctx) =>
		reply(ctx, () => api.remember(ctx.message.text, String(ctx.from?.id))),
	);
	return bot;
}
