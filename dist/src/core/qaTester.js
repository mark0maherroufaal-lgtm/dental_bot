"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const bot_1 = require("../bot");
const ErrorRegistry_1 = require("./ErrorRegistry");
const planner_1 = require("../services/planner");
const ADMIN_ID = 5785296270;
const capturedReplies = [];
const tasksDb = __importStar(require("../db/tasks"));
// Mock Database calls for Test Mode
tasksDb.getTodaysTasks = async () => [{ id: "tdo_123", title: "Test Task", xp_reward: 10, status: 'pending', telegram_id: String(ADMIN_ID) }];
tasksDb.createDailyTasks = async () => [{ id: "tdo_123", title: "Test Task", xp_reward: 10, status: 'pending', telegram_id: String(ADMIN_ID) }];
tasksDb.updateTaskStatus = async () => { };
tasksDb.getTasksInRange = async () => [];
// Override telegram API calls to capture them
bot_1.bot.api.config.use(async (prev, method, payload, signal) => {
    if (method === "sendMessage" || method === "editMessageText" || method === "answerCallbackQuery") {
        capturedReplies.push({ method, payload });
        return { ok: true, result: { message_id: Math.floor(Math.random() * 100000) } };
    }
    // For other methods like sendChatAction
    return { ok: true, result: true };
});
function createUpdate(text, userId = ADMIN_ID) {
    return {
        update_id: Math.floor(Math.random() * 1000000),
        message: {
            message_id: Math.floor(Math.random() * 1000000),
            from: { id: userId, is_bot: false, first_name: "TestUser" },
            chat: { id: userId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: text,
            entities: text.startsWith('/') ? [{ type: "bot_command", offset: 0, length: text.split(' ')[0].length }] : []
        }
    };
}
function createCallbackQuery(data, userId = ADMIN_ID) {
    return {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
            id: String(Math.floor(Math.random() * 1000000)),
            from: { id: userId, is_bot: false, first_name: "TestUser" },
            message: {
                message_id: Math.floor(Math.random() * 1000000),
                chat: { id: userId, type: "private" },
                date: Math.floor(Date.now() / 1000),
            },
            chat_instance: "test_instance",
            data: data
        }
    };
}
async function sendUpdate(update) {
    capturedReplies.length = 0; // clear
    await bot_1.bot.handleUpdate(update);
    // Let event loop process microtasks
    await new Promise(r => setTimeout(r, 100));
    return [...capturedReplies];
}
async function runTests() {
    console.log("Starting QA E2E Tests...");
    const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
    let passed = 0;
    let failed = 0;
    async function assertCommand(name, update, validate) {
        console.log(`Testing: ${name}`);
        try {
            const replies = await sendUpdate(update);
            if (validate(replies)) {
                console.log(`✅ PASS: ${name}`);
                passed++;
            }
            else {
                console.log(`❌ FAIL: ${name}`);
                console.log(JSON.stringify(replies, null, 2));
                failed++;
                registry.registerError({
                    severity: 'HIGH',
                    component: 'QATest',
                    functionName: name,
                    file: 'qaTester.ts',
                    line: 0,
                    originalError: new Error(`Validation failed for ${name}`)
                });
            }
        }
        catch (e) {
            console.log(`❌ FAIL (Exception): ${name} - ${e.message}`);
            failed++;
        }
    }
    // 1. Test /status
    await assertCommand("/status", createUpdate("/status"), replies => replies.some(r => r.method === "sendMessage" && r.payload.text && r.payload.text.includes("BOT STATUS")));
    // 2. Test /todo (Admin)
    await assertCommand("/todo (Admin)", createUpdate("/todo"), replies => replies.some(r => r.method === "sendMessage" && r.payload.text && r.payload.text.includes("مهام اليوم")));
    // 3. Test Task Callback (Complete Task)
    const tasks = await (0, planner_1.ensureTodaysTasks)(String(ADMIN_ID));
    if (tasks.length > 0) {
        const taskId = tasks[0].id;
        await assertCommand("Complete Task (Callback)", createCallbackQuery(`tdo_${taskId}`), replies => replies.some(r => r.method === "answerCallbackQuery") &&
            replies.some(r => r.method === "editMessageText" && r.payload.text.includes("مهام اليوم")));
    }
    else {
        console.log("⚠️ No tasks found to test callback.");
    }
    // 4. Test Error Registration directly
    console.log("Testing Error ID Registration...");
    const errorCountBefore = registry.getActiveErrors().length;
    const testErr = registry.registerError({
        severity: 'MEDIUM',
        component: 'QATest',
        functionName: 'dummy',
        file: 'dummy.ts',
        line: 1,
        originalError: new Error("Test QA Error")
    });
    if (registry.getActiveErrors().length > errorCountBefore && testErr.id.startsWith("ERR-")) {
        console.log(`✅ PASS: Error Registration (ID: ${testErr.id})`);
        passed++;
    }
    else {
        console.log(`❌ FAIL: Error Registration`);
        failed++;
    }
    // Print summary
    console.log(`\nQA Tests Completed. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) {
        process.exit(1);
    }
}
runTests().then(() => {
    console.log("Done.");
    process.exit(0);
}).catch(console.error);
