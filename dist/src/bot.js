"use strict";
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
exports.bot.catch(async (err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
    let appErr;
    if (err.error instanceof errors_1.AppError) {
        appErr = err.error;
    }
    else {
        appErr = new errors_1.AppError(err.error instanceof Error ? err.error.message : String(err.error), 'UnhandledError', false, 'CRITICAL', 'Runtime');
    }
    const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
    const record = registry.getError(appErr.errorId);
    if (record) {
        let reply = `🚨 ERROR\n\n`;
        reply += `ID: ${record.id}\n`;
        reply += `📦 ${record.component}\n`;
        reply += `📍 ${record.file.split(/[\\/]/).pop()}:${record.line}\n`;
        if (record.source)
            reply += `🔗 ${record.source}\n`;
        // Don't send full stack trace to user, just the message
        const msg = record.originalError.split('\n')[0];
        reply += `❌ ${msg.substring(0, 200)}\n`;
        try {
            await err.ctx.reply(reply);
        }
        catch (e) {
            console.error("Failed to send error reply to user:", e);
        }
    }
});
(0, general_1.setupGeneralCommands)(exports.bot);
(0, science_1.setupScienceCommands)(exports.bot);
(0, gamification_1.setupGamificationCommands)(exports.bot);
(0, tasks_1.setupTasksCommands)(exports.bot);
(0, audit_1.setupAuditCommands)(exports.bot);
(0, callbacks_1.setupCallbackHandlers)(exports.bot);
(0, messages_1.setupMessageHandlers)(exports.bot);
// Global Error Handlers
process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled Rejection:', reason);
    const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
    registry.registerError({
        severity: 'CRITICAL',
        component: 'Runtime',
        functionName: 'unhandledRejection',
        file: 'unknown',
        line: 0,
        originalError: reason instanceof Error ? reason : new Error(String(reason))
    });
});
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
    registry.registerError({
        severity: 'CRITICAL',
        component: 'Runtime',
        functionName: 'uncaughtException',
        file: 'unknown',
        line: 0,
        originalError: error
    });
});
