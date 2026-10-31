// src/bot.ts (bot.ts)
// Stage 8: Main Bot Instance, First-Line Admin Security Shield, Safe Error Handler & Handler Registration

import { Bot } from "grammy";
import { setupGeneralCommands } from "./commands/general";
import { setupScienceCommands } from "./commands/science";
import { setupGamificationCommands } from "./commands/gamification";
import { setupTasksCommands } from "./commands/tasks";
import { setupAuditCommands } from "./commands/audit";
import { setupCallbackHandlers } from "./handlers/callbacks";
import { setupMessageHandlers } from "./handlers/messages";
import { AppError, getUserFriendlyErrorMessage } from "./core/errors";
import { config, isAuthorizedAdmin } from "./core/config";
import { ErrorRegistry } from "./core/ErrorRegistry";

export const bot = new Bot(config.BOT_TOKEN, {
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
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!userId || !isAuthorizedAdmin(userId)) {
        if (ctx.callbackQuery) {
            await ctx
                .answerCallbackQuery({
                    text: "عذراً، هذا البوت خاص بدكتور ماركو فقط.",
                    show_alert: true
                })
                .catch(() => {});
        } else if (ctx.message) {
            await ctx
                .reply(
                    "عذراً، هذا البوت مبرمج ليكون المساعد الشخصي لدكتور ماركو فقط ولا يمكن للآخرين استخدامه."
                )
                .catch(() => {});
        }
        return;
    }
    await next();
});

// ==========================================
// 2. Global Bot Catch (Crash-Proof String Formatting)
// ==========================================
bot.catch(async (err) => {
    console.error(`[Bot Catch] Error while handling update ${err.ctx.update.update_id}:`, err.error);

    let appErr: AppError;
    if (err.error instanceof AppError) {
        appErr = err.error;
    } else {
        appErr = new AppError(
            err.error instanceof Error ? err.error.message : String(err.error),
            "UnhandledError",
            false,
            "CRITICAL",
            "Runtime",
            err.error
        );
    }

    try {
        const registry = ErrorRegistry.getInstance();
        const record = registry.getError(appErr.errorId);

        if (record) {
            const errObj = record.originalError as any;
            const rawOriginal =
                typeof record.originalError === "string"
                    ? record.originalError
                    : errObj?.message || String(record.originalError || "");
            const firstLine = rawOriginal.split("\n")[0].substring(0, 200);
            const fileName = String(record.file || "unknown").split(/[\\/]/).pop();

            const reply = [
                `⚠️ ${getUserFriendlyErrorMessage(err.error)}`,
                ``,
                `🔍 [Debug ID: ${record.id} | ${record.component} | ${fileName}:${record.line}]`,
                `❌ ${firstLine}`
            ].join("\n");

            await err.ctx.reply(reply).catch(() => {});
        } else {
            await err.ctx.reply(getUserFriendlyErrorMessage(err.error)).catch(() => {});
        }
    } catch (replyErr) {
        console.error("[Bot Catch] Failed to send error reply:", replyErr);
    }
});

// ==========================================
// 3. Register Commands, Callbacks & Message Handlers
// ==========================================
setupGeneralCommands(bot);
setupScienceCommands(bot);
setupGamificationCommands(bot);
setupTasksCommands(bot);
setupAuditCommands(bot);

// Register message & specialized callback handlers (tdo_, snz1h_, snz1d_, cancel_, delexp_)
// before generic callback handlers so nothing gets swallowed.
setupMessageHandlers(bot);
setupCallbackHandlers(bot);

// ==========================================
// 4. Process-Level Unhandled Error Guards
// ==========================================
process.on("unhandledRejection", async (reason: any) => {
    console.error("Unhandled Rejection:", reason);
    try {
        const registry = ErrorRegistry.getInstance();
        registry.registerError({
            severity: "CRITICAL",
            component: "Runtime",
            functionName: "unhandledRejection",
            file: "unknown",
            line: 0,
            originalError: reason instanceof Error ? reason : new Error(String(reason))
        });
    } catch {}
});

process.on("uncaughtException", async (error: Error) => {
    console.error("Uncaught Exception:", error);
    try {
        const registry = ErrorRegistry.getInstance();
        registry.registerError({
            severity: "CRITICAL",
            component: "Runtime",
            functionName: "uncaughtException",
            file: "unknown",
            line: 0,
            originalError: error
        });
    } catch {}
});
