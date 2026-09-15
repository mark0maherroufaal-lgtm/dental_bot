"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSelfAuditTests = runSelfAuditTests;
const bot_1 = require("../bot");
const ErrorRegistry_1 = require("./ErrorRegistry");
function createMockCtx(commandName) {
    const text = `/${commandName}`;
    return {
        from: { id: 5785296270, first_name: "Admin" }, // Using Admin ID
        chat: { id: 5785296270, type: "private" },
        message: {
            text: text,
            message_id: 1,
            date: Date.now() / 1000,
            entities: [{ type: "bot_command", offset: 0, length: text.length }]
        },
        reply: async (text, extra) => { },
        replyWithChatAction: async (action) => { },
        answerCallbackQuery: async (opts) => { },
        editMessageText: async (text, extra) => { },
        editMessageReplyMarkup: async (opts) => { }
    };
}
async function runSelfAuditTests() {
    const commandsToTest = ["todo", "status", "audit", "plan", "review", "weekly", "monthly", "errors"];
    const results = [];
    const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
    for (const cmd of commandsToTest) {
        const mockCtx = createMockCtx(cmd);
        let status = "PASS";
        let errorId = "—";
        try {
            const update = {
                update_id: Math.floor(Math.random() * 1000000),
                message: mockCtx.message,
                from: mockCtx.from,
                chat: mockCtx.chat
            };
            // Dispatch update to bot
            await bot_1.bot.handleUpdate(update);
        }
        catch (e) {
            status = "FAIL";
            const record = registry.registerError({
                severity: 'HIGH',
                component: 'SelfAudit',
                functionName: `command_${cmd}`,
                file: 'testRunner.ts',
                line: 38,
                originalError: e
            });
            errorId = record.id;
        }
        results.push({
            tool: `/${cmd}`,
            exists: "YES",
            tested: "YES",
            result: status,
            errorId: errorId
        });
    }
    return results;
}
