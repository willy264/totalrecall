import type { Bot } from "grammy";
import { z } from "zod";
import { validSecret } from "./telegram.js";

const updateSchema = z
	.object({ update_id: z.number().int().nonnegative() })
	.passthrough();
export function telegramWebhook(bot: Bot, secret: string) {
	return async (request: Request) => {
		if (
			!validSecret(
				request.headers.get("x-telegram-bot-api-secret-token"),
				secret,
			)
		)
			return new Response("Unauthorized", { status: 401 });
		if (Number(request.headers.get("content-length") ?? 0) > 65536)
			return new Response("Too large", { status: 413 });
		let body: unknown;
		try {
			const text = await request.text();
			if (text.length > 65536)
				return new Response("Too large", { status: 413 });
			body = JSON.parse(text);
		} catch {
			return new Response("Invalid JSON", { status: 400 });
		}
		const parsed = updateSchema.safeParse(body);
		if (!parsed.success) return new Response("Invalid update", { status: 400 });
		try {
			await bot.handleUpdate(parsed.data as Parameters<Bot["handleUpdate"]>[0]);
			return new Response("OK");
		} catch {
			return new Response("Unavailable", { status: 503 });
		}
	};
}
