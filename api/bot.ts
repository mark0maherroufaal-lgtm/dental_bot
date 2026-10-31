// api/bot.ts (webhook_api.ts)
// Stage 8: Hardened Vercel Webhook Endpoint + Auto-Registration of Telegram Bot Commands Menu

import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";
import { config } from "../src/core/config";
import { ErrorRegistry } from "../src/core/ErrorRegistry";

let initialized = false;

const BOT_COMMANDS_MENU = [
    { command: "todo", description: "📋 مهامي النهارده" },
    { command: "menu", description: "⚡ إظهار أزرار القائمة السريعة" },
    { command: "req", description: "🦷 سجل متطلبات السكاشن العملي" },
    { command: "achievements", description: "🏆 مستوايا ونقاط الـ XP والـ Streak" },
    { command: "plan", description: "🗓️ تخطيط اليوم وسكاشن الغد" },
    { command: "review", description: "🌙 ملخص إنجاز آخر اليوم" },
    { command: "weekly", description: "📅 التقرير الأسبوعي" },
    { command: "monthly", description: "📊 المراجعة الشهرية" }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        return res.status(200).send("Dr. Marko Personal AI Assistant Bot is alive and ready!");
    }

    // 1. Validate Telegram Webhook Secret Token if configured
    const secret = config.WEBHOOK_SECRET;
    if (secret) {
        const headerSecret = req.headers["x-telegram-bot-api-secret-token"];
        if (headerSecret !== secret) {
            console.warn("[Webhook] Unauthorized webhook request rejected.");
            return res.status(401).send("Unauthorized");
        }
    }

    try {
        if (!initialized) {
            await bot.init();
            // Register Telegram's native "/" Commands Menu non-blockingly on cold start
            bot.api.setMyCommands(BOT_COMMANDS_MENU).catch(() => {});
            initialized = true;
        }

        const update = req.body;
        if (update && typeof update === "object") {
            await bot.handleUpdate(update);
        }
    } catch (e) {
        console.error("[Webhook] Error handling Telegram update:", e);
    } finally {
        try {
            await ErrorRegistry.getInstance().flush();
        } catch (flushErr) {
            console.error("[Webhook] ErrorRegistry flush failed:", flushErr);
        }

        if (!res.writableEnded) {
            res.status(200).send("OK");
        }
    }
}
