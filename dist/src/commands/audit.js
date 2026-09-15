"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performHealthCheck = performHealthCheck;
exports.setupAuditCommands = setupAuditCommands;
const ErrorRegistry_1 = require("../core/ErrorRegistry");
const supabase_1 = require("../supabase");
const tasks_1 = require("../db/tasks");
const timezone_1 = require("../core/timezone");
async function performHealthCheck(bot) {
    const status = {
        telegram: "OK",
        database: "OK",
        gemini: "OK",
        tasks: "OK",
        runtime: "OK",
        health: 100,
        issues: []
    };
    // Telegram Check
    try {
        await bot.api.getMe();
    }
    catch (e) {
        status.telegram = "FAIL";
        status.issues.push("Telegram: " + e.message);
        status.health -= 15;
    }
    // DB Check
    try {
        const { error } = await supabase_1.supabase.from('todos').select('id').limit(1);
        if (error) {
            throw new Error(error.message);
        }
    }
    catch (e) {
        status.database = "FAIL";
        status.issues.push("Database: " + e.message);
        status.health -= 20;
    }
    // Tasks & Notifications check
    try {
        const { count, error } = await supabase_1.supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending');
        if (!error)
            status.pendingTasks = count || 0;
        const { count: notifCount, error: notifErr } = await supabase_1.supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'PENDING');
        if (!notifErr)
            status.pendingNotifs = notifCount || 0;
        const { count: failCount, error: failErr } = await supabase_1.supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'FAILED');
        if (!failErr)
            status.failedNotifs = failCount || 0;
        await (0, tasks_1.getTodaysTasks)("5785296270", (0, timezone_1.getCurrentDateStr)()); // test with admin ID
    }
    catch (e) {
        status.tasks = "FAIL";
        status.issues.push("Tasks DB: " + e.message);
        status.health -= 20;
    }
    // API (Gemini) Check 
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("Missing GEMINI_API_KEY");
        }
    }
    catch (e) {
        status.gemini = "FAIL";
        status.issues.push("Gemini: " + e.message);
        status.health -= 20;
    }
    // Runtime Check
    try {
        const mem = process.memoryUsage();
        if (mem.rss > 500 * 1024 * 1024) { // over 500MB is suspicious for a simple bot
            throw new Error("High Memory Usage");
        }
    }
    catch (e) {
        status.runtime = "FAIL";
        status.issues.push("Runtime: " + e.message);
        status.health -= 20;
    }
    return status;
}
function setupAuditCommands(bot) {
    bot.command("status", async (ctx) => {
        const userId = String(ctx.from?.id);
        const adminId = process.env.ADMIN_ID || process.env.ADMIN_TELEGRAM_ID;
        if (userId !== adminId)
            return;
        await ctx.replyWithChatAction("typing");
        const health = await performHealthCheck(bot);
        const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
        const activeErrors = registry.getActiveErrors();
        const allErrors = registry.getAllErrors();
        const openCount = activeErrors.length;
        const totalCount = allErrors.length;
        let reply = `📊 BOT STATUS\n\n`;
        reply += `${health.telegram === 'OK' ? '🟢' : '🔴'} Telegram: ${health.telegram}\n`;
        reply += `${health.database === 'OK' ? '🟢' : '🔴'} Database: ${health.database}\n`;
        reply += `${health.gemini === 'OK' ? '🟢' : '🔴'} Gemini: ${health.gemini}\n`;
        reply += `${health.tasks === 'OK' ? '🟢' : '🔴'} Tasks: ${health.tasks}\n`;
        reply += `${health.runtime === 'OK' ? '🟢' : '🔴'} Runtime: ${health.runtime}\n\n`;
        reply += `⚙️ WORKLOAD\n`;
        reply += `⏳ Pending Tasks: ${health.pendingTasks || 0}\n`;
        reply += `🔔 Pending Notifs: ${health.pendingNotifs || 0}\n`;
        reply += `❌ Failed Notifs: ${health.failedNotifs || 0}\n\n`;
        if (activeErrors.length > 0) {
            reply += `🚨 ACTIVE ERRORS (${openCount})\n\n`;
            for (const err of activeErrors.slice(0, 3)) { // Show top 3
                const icon = err.severity === 'CRITICAL' ? '🔴' : err.severity === 'HIGH' ? '🟠' : '🟡';
                reply += `${icon} ${err.id}\n`;
                reply += `📦 ${err.component}\n`;
                const msg = err.originalError.split('\n')[0];
                reply += `❌ ${msg.substring(0, 100)}\n\n`;
            }
        }
        else {
            reply += `✅ No active errors\n\n`;
        }
        reply += `📚 HISTORY (Total: ${totalCount})\n`;
        const fixedCount = allErrors.filter(e => e.status === 'FIXED' || e.status === 'VERIFIED').length;
        reply += `Open: ${openCount}\n`;
        reply += `Fixed: ${fixedCount}\n\n`;
        reply += `📊 HEALTH: ${health.health}%`;
        return ctx.reply(reply);
    });
    bot.command("errors", async (ctx) => {
        const userId = String(ctx.from?.id);
        const adminId = process.env.ADMIN_ID || process.env.ADMIN_TELEGRAM_ID;
        if (userId !== adminId)
            return;
        const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
        const allErrors = registry.getAllErrors().slice(0, 20); // last 20
        if (allErrors.length === 0) {
            return ctx.reply("لا توجد مشاكل مسجلة.");
        }
        let reply = `📋 LAST 20 ERRORS\n\n`;
        for (const err of allErrors) {
            let icon = '🟢'; // Fixed/Verified
            if (err.status === 'OPEN' || err.status === 'INVESTIGATING') {
                icon = err.severity === 'CRITICAL' ? '🔴' : err.severity === 'HIGH' ? '🟠' : '🟡';
            }
            reply += `${icon} ${err.id} — ${err.component} (${err.status})\n`;
        }
        reply += `\nللتفاصيل: /error ERR-ID`;
        return ctx.reply(reply);
    });
    bot.command("error", async (ctx) => {
        const userId = String(ctx.from?.id);
        const adminId = process.env.ADMIN_ID || process.env.ADMIN_TELEGRAM_ID;
        if (userId !== adminId)
            return;
        const id = ctx.message?.text?.split(' ')[1];
        if (!id)
            return ctx.reply("الرجاء إدخال ID: /error ERR-YYYY-XXXXXX");
        const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
        const err = registry.getError(id.trim());
        if (!err)
            return ctx.reply("❌ Error ID غير موجود.");
        let reply = `🔎 ERROR DETAILS\n\n`;
        reply += `ID: ${err.id}\n`;
        reply += `Status: ${err.status}\n`;
        reply += `Severity: ${err.severity}\n`;
        reply += `Occurrences: ${err.occurrences}\n`;
        reply += `Last Seen: ${err.lastSeen}\n\n`;
        reply += `Component: ${err.component}\n`;
        reply += `Function: ${err.functionName}\n`;
        reply += `Location: ${err.file.split(/[\\/]/).pop()}:${err.line}\n\n`;
        reply += `Source: ${err.source || 'Unknown'}\n\n`;
        reply += `Root Cause:\n${err.rootCause}\n\n`;
        if (err.fix) {
            reply += `Fix:\n${err.fix}\n\n`;
        }
        if (err.verification) {
            reply += `Verification:\n${err.verification}\n\n`;
        }
        return ctx.reply(reply);
    });
    bot.command("audit", async (ctx) => {
        const userId = String(ctx.from?.id);
        const adminId = process.env.ADMIN_ID || process.env.ADMIN_TELEGRAM_ID;
        if (userId !== adminId)
            return;
        await ctx.replyWithChatAction("typing");
        const health = await performHealthCheck(bot);
        const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
        const activeErrors = registry.getActiveErrors();
        let reply = `🔎 BOT SELF-AUDIT\n\n`;
        reply += `🟢 HEALTHY\n`;
        if (health.health === 100)
            reply += `- All systems operational.\n`;
        if (health.issues.length > 0) {
            reply += `\n🔴 ERRORS\n`;
            for (const issue of health.issues) {
                reply += `- ${issue}\n`;
            }
        }
        reply += `\n📦 TASKS\n- Status: ${health.tasks}\n`;
        reply += `\n🤖 TELEGRAM\n- Status: ${health.telegram}\n`;
        reply += `\n🔗 APIs\n- Status: ${health.gemini}\n`;
        reply += `\n🗄 DATABASE\n- Status: ${health.database}\n`;
        reply += `\n📊 HEALTH SCORE\n- ${health.health}%\n`;
        if (activeErrors.length > 0) {
            reply += `\n⚠️ Active Errors in Registry: ${activeErrors.length}. Use /status to view.\n`;
        }
        return ctx.reply(reply);
    });
}
