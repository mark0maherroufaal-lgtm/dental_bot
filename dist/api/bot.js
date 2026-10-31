"use strict";
// api/bot.ts (webhook_api.ts)
// Stage 8: Hardened Vercel Webhook Endpoint + Auto-Registration of Telegram Bot Commands Menu
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const bot_1 = require("../src/bot");
const config_1 = require("../src/core/config");
const ErrorRegistry_1 = require("../src/core/ErrorRegistry");
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
async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(200).send("Dr. Marko Personal AI Assistant Bot is alive and ready!");
    }
    // 1. Validate Telegram Webhook Secret Token if configured
    const secret = config_1.config.WEBHOOK_SECRET;
    if (secret) {
        const headerSecret = req.headers["x-telegram-bot-api-secret-token"];
        if (headerSecret !== secret) {
            console.warn("[Webhook] Unauthorized webhook request rejected.");
            return res.status(401).send("Unauthorized");
        }
    }
    try {
        if (!initialized) {
            await bot_1.bot.init();
            // Register Telegram's native "/" Commands Menu non-blockingly on cold start
            bot_1.bot.api.setMyCommands(BOT_COMMANDS_MENU).catch(() => { });
            initialized = true;
        }
        const update = req.body;
        if (update && typeof update === "object") {
            await bot_1.bot.handleUpdate(update);
        }
    }
    catch (e) {
        console.error("[Webhook] Error handling Telegram update:", e);
    }
    finally {
        try {
            await ErrorRegistry_1.ErrorRegistry.getInstance().flush();
        }
        catch (flushErr) {
            console.error("[Webhook] ErrorRegistry flush failed:", flushErr);
        }
        if (!res.writableEnded) {
            res.status(200).send("OK");
        }
    }
}
