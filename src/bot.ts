import { Bot } from "grammy";
import { setupGeneralCommands } from "./commands/general";
import { setupScienceCommands } from "./commands/science";
import { setupGamificationCommands } from "./commands/gamification";
import { setupTasksCommands } from "./commands/tasks";
import { setupAuditCommands } from "./commands/audit";
import { setupCallbackHandlers } from "./handlers/callbacks";
import { setupMessageHandlers } from "./handlers/messages";
import { AppError } from "./core/errors";
import { config } from "./core/config";
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

bot.catch(async (err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
    
    let appErr: AppError;
    if (err.error instanceof AppError) {
        appErr = err.error;
    } else {
        appErr = new AppError(
            err.error instanceof Error ? err.error.message : String(err.error),
            'UnhandledError',
            false,
            'CRITICAL',
            'Runtime'
        );
    }
    
    const registry = ErrorRegistry.getInstance();
    const record = registry.getError(appErr.errorId);
    
    if (record) {
        let reply = `🚨 ERROR\n\n`;
        reply += `ID: ${record.id}\n`;
        reply += `📦 ${record.component}\n`;
        reply += `📍 ${record.file.split(/[\\/]/).pop()}:${record.line}\n`;
        if (record.source) reply += `🔗 ${record.source}\n`;
        
        // Don't send full stack trace to user, just the message
        const msg = record.originalError.split('\n')[0];
        reply += `❌ ${msg.substring(0, 200)}\n`;
        
        try {
            await err.ctx.reply(reply);
        } catch (e) {
            console.error("Failed to send error reply to user:", e);
        }
    }
});

setupGeneralCommands(bot);
setupScienceCommands(bot);
setupGamificationCommands(bot);
setupTasksCommands(bot);
setupAuditCommands(bot);

setupCallbackHandlers(bot);
setupMessageHandlers(bot);

// Global Error Handlers
process.on('unhandledRejection', async (reason: any) => {
    console.error('Unhandled Rejection:', reason);
    const registry = ErrorRegistry.getInstance();
    registry.registerError({
        severity: 'CRITICAL',
        component: 'Runtime',
        functionName: 'unhandledRejection',
        file: 'unknown',
        line: 0,
        originalError: reason instanceof Error ? reason : new Error(String(reason))
    });
});

process.on('uncaughtException', async (error: Error) => {
    console.error('Uncaught Exception:', error);
    const registry = ErrorRegistry.getInstance();
    registry.registerError({
        severity: 'CRITICAL',
        component: 'Runtime',
        functionName: 'uncaughtException',
        file: 'unknown',
        line: 0,
        originalError: error
    });
});
