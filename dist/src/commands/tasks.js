"use strict";
// src/commands/tasks.ts (tasks_commands.ts)
// Stage 4: Interactive Tasks Commands (/todo, /review, /weekly, /monthly, /plan) & Unified Task Callbacks
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDynamicRoutineMessage = buildDynamicRoutineMessage;
exports.handleTaskCallbackQuery = handleTaskCallbackQuery;
exports.setupTasksCommands = setupTasksCommands;
const planner_1 = require("../services/planner");
const timezone_1 = require("../core/timezone");
const config_1 = require("../core/config");
const tasks_1 = require("../db/tasks");
const schedule_1 = require("../db/schedule");
const expenses_1 = require("../db/expenses");
const gemini_1 = require("../gemini");
function escapeHtml(raw) {
    return String(raw || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
async function buildDynamicRoutineMessage(telegramId) {
    const tasks = await (0, planner_1.ensureTodaysTasks)(telegramId);
    let completedCount = 0;
    const buttons = [];
    let text = "";
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const isDone = task.status === "completed";
        if (isDone)
            completedCount++;
        const safeTitle = escapeHtml(task.title);
        const timeBadge = task.time ? ` 🕒 <i>${(0, timezone_1.formatTimeToArabic12h)(task.time)}</i>` : "";
        if (isDone) {
            text += `✅ ${i + 1}. <s>${safeTitle}</s>${timeBadge}\n`;
        }
        else {
            text += `⏳ ${i + 1}. ${safeTitle}${timeBadge}\n`;
        }
        if (!isDone) {
            const shortTitle = task.title.length > 14 ? `${task.title.substring(0, 14)}..` : task.title;
            buttons.push([
                { text: `✅ ${shortTitle}`, callback_data: `tdo_${task.id}` },
                { text: `⏰ +1س`, callback_data: `snz1h_${task.id}` },
                { text: `📅 لبكره`, callback_data: `snz1d_${task.id}` }
            ]);
        }
    }
    const percentage = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
    const filledBlocks = Math.max(0, Math.min(10, Math.round(percentage / 10)));
    const progressBar = "▓".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);
    const dateStr = (0, timezone_1.getCurrentDateStr)();
    let header = `📋 <b>مهامك النهارده يا دكتور | ${dateStr}</b>\n`;
    header += `📊 الإنجاز: [${progressBar}] ${percentage}% (${completedCount}/${tasks.length})\n`;
    header += `─────────────────────────────\n`;
    header += text || "جدولك فاضي النهارده ✨\n";
    header += `─────────────────────────────\n`;
    if (tasks.length === 0) {
        header += `✨ مفيش مهام مسجلة النهارده، استمتع بيومك!`;
    }
    else if (completedCount < tasks.length) {
        header += `👇 تقدر تنهي أو تأجل أي مهمة بضغطة واحدة:`;
    }
    else {
        header += `🌟 عاش يا دكتور! خلصت كل مهام النهارده بالكامل!`;
    }
    return { text: header, buttons };
}
/**
 * Unified handler for task inline buttons (`tdo_`, `snz1h_`, `snz1d_`, `cancel_`).
 * Can also be imported by `src/handlers/callbacks.ts` so there is zero duplication or conflict.
 */
async function handleTaskCallbackQuery(ctx) {
    const data = String(ctx.callbackQuery?.data || "");
    const userId = String(ctx.from?.id || "");
    if (!(0, config_1.isAuthorizedAdmin)(userId)) {
        await ctx.answerCallbackQuery({ text: "غير مصرح لك.", show_alert: true }).catch(() => { });
        return true;
    }
    const match = data.match(/^(tdo|snz1h|snz1d|cancel)_(.+)$/);
    if (!match)
        return false;
    const [, action, taskId] = match;
    const msgText = String(ctx.callbackQuery?.message?.text || "");
    const isRoutineListMessage = msgText.includes("مهامك النهارده") || msgText.includes("مهام اليوم التفاعلية");
    try {
        if (action === "tdo") {
            const result = await (0, tasks_1.completeTaskWithXp)(taskId, userId);
            if (result.alreadyCompleted) {
                await ctx
                    .answerCallbackQuery({ text: "✅ المهمة دي متسجلة مكتملة بالفعل!" })
                    .catch(() => { });
            }
            else if (result.task) {
                await ctx
                    .answerCallbackQuery({
                    text: `🎉 عاش يا دكتور! +${result.xpAwarded} XP`
                })
                    .catch(() => { });
            }
            else {
                await ctx
                    .answerCallbackQuery({ text: "⚠️ المهمة غير موجودة." })
                    .catch(() => { });
            }
            if (isRoutineListMessage) {
                const updated = await buildDynamicRoutineMessage(userId);
                await ctx
                    .editMessageText(updated.text, {
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: updated.buttons }
                })
                    .catch(() => { });
            }
            else if (result.task) {
                // Single reminder notification message: lock buttons to prevent spam
                await ctx
                    .editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
                    .catch(() => { });
                await ctx
                    .editMessageText(`✅ **تم إنجاز المهمة!** (+${result.xpAwarded || 10} XP)\n📌 ~~${result.task.title}~~`, { parse_mode: "Markdown" })
                    .catch(() => { });
            }
            return true;
        }
        if (action === "snz1h" || action === "snz1d") {
            const mode = action === "snz1h" ? "1h" : "tomorrow";
            const snoozed = await (0, tasks_1.snoozeTaskById)(taskId, userId, mode);
            if (!snoozed.task) {
                await ctx
                    .answerCallbackQuery({ text: "⚠️ المهمة غير موجودة." })
                    .catch(() => { });
                return true;
            }
            await ctx
                .answerCallbackQuery({
                text: `⏰ تم التأجيل إلى: ${snoozed.formattedSchedule}`
            })
                .catch(() => { });
            if (isRoutineListMessage) {
                const updated = await buildDynamicRoutineMessage(userId);
                await ctx
                    .editMessageText(updated.text, {
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: updated.buttons }
                })
                    .catch(() => { });
            }
            else {
                await ctx
                    .editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
                    .catch(() => { });
                await ctx
                    .editMessageText(`⏰ **تم تأجيل التذكير!**\n📌 المهمة: ${snoozed.task.title}\n📅 الميعاد الجديد: ${snoozed.formattedSchedule}`, { parse_mode: "Markdown" })
                    .catch(() => { });
            }
            return true;
        }
        if (action === "cancel") {
            const cancelled = await (0, tasks_1.cancelTaskById)(taskId, userId);
            await ctx
                .answerCallbackQuery({ text: "🗑️ تم إلغاء المهمة." })
                .catch(() => { });
            if (isRoutineListMessage) {
                const updated = await buildDynamicRoutineMessage(userId);
                await ctx
                    .editMessageText(updated.text, {
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: updated.buttons }
                })
                    .catch(() => { });
            }
            else {
                await ctx
                    .editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
                    .catch(() => { });
                await ctx
                    .editMessageText(`🗑️ **تم إلغاء المهمة:** ${cancelled?.title || ""}`, { parse_mode: "Markdown" })
                    .catch(() => { });
            }
            return true;
        }
    }
    catch (err) {
        console.error("[tasks_commands] Callback error:", err);
        await ctx
            .answerCallbackQuery({ text: "⚠️ حصل خطأ بسيط، جرب تاني." })
            .catch(() => { });
    }
    return true;
}
function setupTasksCommands(bot) {
    // Register unified callback query listener for task buttons
    bot.callbackQuery(/^(tdo|snz1h|snz1d|cancel)_/, async (ctx) => {
        await handleTaskCallbackQuery(ctx);
    });
    bot.command("todo", async (ctx) => {
        await ctx.replyWithChatAction("typing").catch(() => { });
        const userId = String(ctx.from?.id);
        if (!(0, config_1.isAuthorizedAdmin)(userId)) {
            return ctx.reply("عذراً، هذا البوت مخصص لدكتور ماركو فقط.");
        }
        const { text, buttons } = await buildDynamicRoutineMessage(userId);
        return ctx.reply(text, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: buttons }
        });
    });
    bot.command("review", async (ctx) => {
        const userId = String(ctx.from?.id);
        if (!(0, config_1.isAuthorizedAdmin)(userId))
            return;
        await ctx.replyWithChatAction("typing").catch(() => { });
        const today = (0, timezone_1.getCurrentDateStr)();
        const tasks = await (0, tasks_1.getTodaysTasks)(userId, today);
        if (tasks.length === 0) {
            return ctx.reply("جدولك فاضي النهارده ✨ مفيش مهام مسجلة لليوم.");
        }
        const completedTasks = tasks.filter((t) => t.status === "completed");
        const completionRate = Math.round((completedTasks.length / tasks.length) * 100);
        const xpEarnedToday = completedTasks.reduce((sum, t) => sum + (t.xp_reward || 10), 0);
        let text = `🌙 **ملخص آخر اليوم (Daily Review)**\n\n`;
        text += `📊 نسبة الإنجاز: ${completionRate}% (${completedTasks.length}/${tasks.length})\n`;
        text += `✨ نقاط الـ XP المكتسبة اليوم: +${xpEarnedToday} XP\n`;
        if (completedTasks.length > 0) {
            text += `\n✅ **أنجزت النهارده:**\n`;
            completedTasks.forEach((t) => {
                text += `• ${t.title}\n`;
            });
        }
        const pendingTasks = tasks.filter((t) => t.status !== "completed");
        if (pendingTasks.length > 0) {
            text += `\n⏳ **مهام متبقية (${pendingTasks.length}):**\n`;
            pendingTasks.forEach((t) => {
                text += `• ${t.title}\n`;
            });
        }
        text += `\nعاش يا دكتور! يوم موفق 💪`;
        return ctx.reply(text, { parse_mode: "Markdown" });
    });
    bot.command("weekly", async (ctx) => {
        const userId = String(ctx.from?.id);
        if (!(0, config_1.isAuthorizedAdmin)(userId))
            return;
        await ctx.replyWithChatAction("typing").catch(() => { });
        const todayStr = (0, timezone_1.getCurrentDateStr)();
        const weekAgoStr = (0, timezone_1.addDaysToCairoDate)(-7, todayStr);
        const [tasks, expenses] = await Promise.all([
            (0, tasks_1.getTasksInRange)(userId, weekAgoStr, todayStr),
            (0, expenses_1.getExpensesInRange)(userId, weekAgoStr, todayStr)
        ]);
        const completedTasks = tasks.filter((t) => t.status === "completed");
        const completionRate = tasks.length
            ? Math.round((completedTasks.length / tasks.length) * 100)
            : 0;
        const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const xpEarned = completedTasks.reduce((sum, t) => sum + (t.xp_reward || 10), 0);
        const prompt = `اعمل ملخص أسبوعي سريع ومشجع لدكتور ماركو في 4 سطور باللهجة المصرية بناءً على أرقامه الحقيقية فقط:
- المهام المنجزة هذا الأسبوع: ${completedTasks.length} من أصل ${tasks.length} (${completionRate}%)
- نقاط XP المكتسبة: +${xpEarned} XP
- إجمالي مصاريف الأسبوع: ${totalSpent} ج.م`;
        const reply = await (0, gemini_1.chatGemini)(prompt);
        return ctx.reply(`📅 **ملخص الأسبوع**\n\n${reply}`);
    });
    bot.command("monthly", async (ctx) => {
        const userId = String(ctx.from?.id);
        if (!(0, config_1.isAuthorizedAdmin)(userId))
            return;
        await ctx.replyWithChatAction("typing").catch(() => { });
        const todayStr = (0, timezone_1.getCurrentDateStr)();
        const monthAgoStr = (0, timezone_1.addDaysToCairoDate)(-30, todayStr);
        const [tasks, expenses] = await Promise.all([
            (0, tasks_1.getTasksInRange)(userId, monthAgoStr, todayStr),
            (0, expenses_1.getExpensesInRange)(userId, monthAgoStr, todayStr)
        ]);
        const completedTasks = tasks.filter((t) => t.status === "completed");
        const completionRate = tasks.length
            ? Math.round((completedTasks.length / tasks.length) * 100)
            : 0;
        const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const xpEarned = completedTasks.reduce((sum, t) => sum + (t.xp_reward || 10), 0);
        const prompt = `اعمل مراجعة شهرية مركزة وعملية لدكتور ماركو باللهجة المصرية في 5 سطور بناءً على أرقامه الحقيقية فقط:
- المهام المنجزة آخر 30 يوم: ${completedTasks.length} من أصل ${tasks.length} (${completionRate}%)
- نقاط XP المكتسبة: +${xpEarned} XP
- إجمالي المصروفات: ${totalSpent} ج.م`;
        const reply = await (0, gemini_1.chatGemini)(prompt);
        return ctx.reply(`📊 **المراجعة الشهرية**\n\n${reply}`);
    });
    bot.command("plan", async (ctx) => {
        const userId = String(ctx.from?.id);
        if (!(0, config_1.isAuthorizedAdmin)(userId))
            return;
        await ctx.replyWithChatAction("typing").catch(() => { });
        const tasks = await (0, planner_1.ensureTodaysTasks)(userId);
        const tomorrowDayOfWeek = ((0, timezone_1.getCairoDayOfWeek)() + 1) % 7;
        const tomorrowSchedule = await (0, schedule_1.getScheduleForDay)(userId, tomorrowDayOfWeek);
        const tasksList = tasks.length > 0
            ? tasks.map((t) => `- ${t.title}`).join("\n")
            : "لا توجد مهام مسجلة لليوم حتى الآن.";
        const scheduleList = tomorrowSchedule.length > 0
            ? tomorrowSchedule
                .map((s) => `- ${s.course_name} (${s.session_type})`)
                .join("\n")
            : "لا توجد محاضرات أو سكاشن مسجلة لغد.";
        const prompt = `رتب مع دكتور ماركو خطة سريعة لليوم في 3-4 سطور باللهجة المصرية بناءً على البيانات دي فقط:
مهام اليوم:
${tasksList}

جدول الكلية غداً:
${scheduleList}`;
        const reply = await (0, gemini_1.chatGemini)(prompt);
        return ctx.reply(reply);
    });
}
