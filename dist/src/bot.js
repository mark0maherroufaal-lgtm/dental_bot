"use strict";
// src/bot.ts (bot.ts)
// Stage 8: Main Bot Instance, First-Line Admin Security Shield, Safe Error Handler & Handler Registration
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const grammy_1 = require("grammy");
const general_1 = require("./commands/general");
const science_1 = require("./commands/science");
const gamification_1 = require("./commands/gamification");
const tasks_1 = require("./commands/tasks");
const audit_1 = require("./commands/audit");
const callbacks_1 = require("./handlers/callbacks");
const messages_1 = require("./handlers/messages");
const errors_1 = require("./core/errors");
const config_1 = require("./core/config");
const ErrorRegistry_1 = require("./core/ErrorRegistry");
exports.bot = new grammy_1.Bot(config_1.config.BOT_TOKEN, {
    botInfo: {
        id: 8696849914,
        is_bot: true,
        first_name: "My Dental Secretary",
        username: "Marko_Dental_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        supports_guest_queries: false,
        can_connect_to_business: false,
        has_main_web_app: false,
        has_topics_enabled: false,
        allows_users_to_create_topics: false,
        can_manage_bots: false,
        supports_join_request_queries: false
    }
});
// ==========================================
// 1. First-Line Central Security Gate (Before ANY command or callback)
// ==========================================
exports.bot.use(async (ctx, next) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!userId || !(0, config_1.isAuthorizedAdmin)(userId)) {
        if (ctx.callbackQuery) {
            await ctx
                .answerCallbackQuery({
                text: "عذراً، هذا البوت خاص بدكتور ماركو فقط.",
                show_alert: true
            })
                .catch(() => { });
        }
        else if (ctx.message) {
            await ctx
                .reply("عذراً، هذا البوت مبرمج ليكون المساعد الشخصي لدكتور ماركو فقط ولا يمكن للآخرين استخدامه.")
                .catch(() => { });
        }
        return;
    }
    await next();
});
// ==========================================
// 2. Global Bot Catch (Crash-Proof String Formatting)
// ==========================================
exports.bot.catch(async (err) => {
    console.error(`[Bot Catch] Error while handling update ${err.ctx.update.update_id}:`, err.error);
    let appErr;
    if (err.error instanceof errors_1.AppError) {
        appErr = err.error;
    }
    else {
        appErr = new errors_1.AppError(err.error instanceof Error ? err.error.message : String(err.error), "UnhandledError", false, "CRITICAL", "Runtime", err.error);
    }
    try {
        const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
        const record = registry.getError(appErr.errorId);
        if (record) {
            const errObj = record.originalError;
            const rawOriginal = typeof record.originalError === "string"
                ? record.originalError
                : errObj?.message || String(record.originalError || "");
            const firstLine = rawOriginal.split("\n")[0].substring(0, 200);
            const fileName = String(record.file || "unknown").split(/[\\/]/).pop();
            const reply = [
                `⚠️ ${(0, errors_1.getUserFriendlyErrorMessage)(err.error)}`,
                ``,
                `🔍 [Debug ID: ${record.id} | ${record.component} | ${fileName}:${record.line}]`,
                `❌ ${firstLine}`
            ].join("\n");
            await err.ctx.reply(reply).catch(() => { });
        }
        else {
            await err.ctx.reply((0, errors_1.getUserFriendlyErrorMessage)(err.error)).catch(() => { });
        }
    }
    catch (replyErr) {
        console.error("[Bot Catch] Failed to send error reply:", replyErr);
    }
});
// ==========================================
// 3. Register Commands, Callbacks & Message Handlers
// ==========================================
(0, general_1.setupGeneralCommands)(exports.bot);
(0, science_1.setupScienceCommands)(exports.bot);
(0, gamification_1.setupGamificationCommands)(exports.bot);
(0, tasks_1.setupTasksCommands)(exports.bot);
(0, audit_1.setupAuditCommands)(exports.bot);
// Register message & specialized callback handlers (tdo_, snz1h_, snz1d_, cancel_, delexp_)
// before generic callback handlers so nothing gets swallowed.
(0, messages_1.setupMessageHandlers)(exports.bot);
(0, callbacks_1.setupCallbackHandlers)(exports.bot);
// ==========================================
// 4. Process-Level Unhandled Error Guards
// ==========================================
process.on("unhandledRejection", async (reason) => {
    console.error("Unhandled Rejection:", reason);
    try {
        const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
        registry.registerError({
            severity: "CRITICAL",
            component: "Runtime",
            functionName: "unhandledRejection",
            file: "unknown",
            line: 0,
            originalError: reason instanceof Error ? reason : new Error(String(reason))
        });
    }
    catch { }
});
process.on("uncaughtException", async (error) => {
    console.error("Uncaught Exception:", error);
    try {
        const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
        registry.registerError({
            severity: "CRITICAL",
            component: "Runtime",
            functionName: "uncaughtException",
            file: "unknown",
            line: 0,
            originalError: error
        });
    }
    catch { }
});
