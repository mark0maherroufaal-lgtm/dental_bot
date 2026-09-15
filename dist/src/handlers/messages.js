"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMessageHandlers = setupMessageHandlers;
const gemini_1 = require("../gemini");
const parser_1 = require("../ai/parser");
const schedule_1 = require("../db/schedule");
const expenses_1 = require("../db/expenses");
const supabase_1 = require("../supabase");
const scientific_1 = require("../services/scientific");
const reminders_1 = require("../services/reminders");
const timezone_1 = require("../core/timezone");
const tasks_1 = require("../db/tasks");
const gamification_1 = require("../db/gamification");
const context_1 = require("../db/context");
async function processTextIntent(ctx, text, userId) {
    // الفصل بين الدكتور ماركو والمرضى (Security & Persona Separation)
    const ADMIN_ID = process.env.ADMIN_ID || "5785296270";
    if (userId !== ADMIN_ID) {
        await ctx.replyWithChatAction("typing");
        const history = await (0, context_1.getChatContext)(userId, 8);
        const reply = await (0, gemini_1.chatPatientGemini)(text, history);
        await (0, context_1.addChatContext)(userId, 'user', text);
        await (0, context_1.addChatContext)(userId, 'model', reply);
        return ctx.reply(reply);
    }
    let intent = "GENERAL_CHAT";
    // --- Phase 10: Deterministic Pre-Router ---
    const lowerText = text.toLowerCase();
    if (/^(فكرني|ذكرني|remind|schedule task)/.test(lowerText)) {
        intent = "CREATE_REMINDER";
    }
    else if (/^(خليها|بدل|تأجيل|reschedule|postpone)/.test(lowerText)) {
        intent = "RESCHEDULE_TASK";
    }
    else if (/^(امسح|الغي|cancel|delete task)/.test(lowerText)) {
        intent = "CANCEL_TASK";
    }
    else if (/(جدول|schedule|timetable)/.test(lowerText) && lowerText.includes("day_of_week")) {
        intent = "COLLEGE_SCHEDULE";
    }
    else if (/^(احصائيات|stats|statistics|تقدمي)/.test(lowerText)) {
        intent = "STATISTICS";
    }
    else if (/^(طوارئ|emergency|نزيف)/.test(lowerText)) {
        intent = "MEDICAL_EMERGENCY";
    }
    else {
        // Fallback to LLM if it's ambiguous
        const aiIntent = await (0, gemini_1.analyzeIntent)(text);
        intent = aiIntent.intent;
    }
    if (intent === "MEDICAL_EMERGENCY") {
        return ctx.reply("🚨 هذه حالة طوارئ! يرجى التوجه لأقرب مستشفى أو الاتصال بالطبيب فوراً.");
    }
    else if (intent === "EXPENSE") {
        await ctx.replyWithChatAction("typing");
        const expenseDetails = await (0, parser_1.parseExpense)(text);
        if (expenseDetails && expenseDetails.amount) {
            try {
                await (0, expenses_1.addExpense)({
                    telegram_id: userId,
                    amount: expenseDetails.amount,
                    currency: expenseDetails.currency,
                    category: expenseDetails.category,
                    description: expenseDetails.description
                });
                return ctx.reply(`✅ تم تسجيل المصروف بنجاح:\n💰 ${expenseDetails.amount} ${expenseDetails.currency}\n📂 ${expenseDetails.category}\n📝 ${expenseDetails.description || "بدون وصف"}`);
            }
            catch (e) {
                throw e;
            }
        }
        else {
            return ctx.reply("🤔 فهمت أنك تريد تسجيل مصروف، لكنني لم أتمكن من تحديد المبلغ بدقة. كم دفعت بالظبط وفي ماذا؟");
        }
    }
    else if (intent === "ARTICLE_SUMMARY") {
        await ctx.replyWithChatAction("typing");
        try {
            const { text: formattedSummary, articleId } = await (0, scientific_1.processAndFormatArticle)(userId, text);
            return ctx.reply(formattedSummary, {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "✅ قرأته (+30 XP)", callback_data: `read_${articleId}` },
                            { text: "❌ مش هقرأه", callback_data: `skip_${articleId}` }
                        ]
                    ]
                }
            });
        }
        catch (e) {
            throw e;
        }
    }
    else if (intent === "COLLEGE_SCHEDULE") {
        await ctx.replyWithChatAction("typing");
        const schedule = await (0, parser_1.parseCollegeSchedule)(text);
        if (schedule && schedule.sessions.length > 0) {
            try {
                // @ts-ignore (Assuming schedule output maps to DB requirements)
                const result = await (0, schedule_1.diffAndApplySchedule)(userId, schedule.sessions);
                return ctx.reply(`✅ تم حفظ جدول الكلية بنجاح!\nتمت إضافة ${result.added} مادة جديدة، وحذف ${result.removed} مادة ملغية.`);
            }
            catch (e) {
                throw e;
            }
        }
        else {
            return ctx.reply("❌ لم أتمكن من استخراج المواعيد من النص. هل يمكنك توضيح الجدول أكثر؟");
        }
    }
    else if (intent === "CREATE_REMINDER" || intent === "RESCHEDULE_TASK" || intent === "CANCEL_TASK") {
        await ctx.replyWithChatAction("typing");
        const parsed = await (0, gemini_1.parseReminder)(text);
        if (parsed) {
            const reply = await (0, reminders_1.handleReminderAction)(userId, parsed);
            return ctx.reply(reply);
        }
        else {
            return ctx.reply("❌ لم أتمكن من استخراج تفاصيل التذكير بوضوح. الرجاء المحاولة بصيغة أوضح.");
        }
    }
    else if (intent === "STATISTICS") {
        await ctx.replyWithChatAction("typing");
        const todayStr = (0, timezone_1.getCurrentDateStr)();
        const tasks = await (0, tasks_1.getTodaysTasks)(userId, todayStr);
        const xp = await (0, gamification_1.getTotalXp)(userId);
        const statsData = {
            today_tasks: tasks.map(t => ({ title: t.title, status: t.status })),
            total_xp: xp,
        };
        const reply = await (0, gemini_1.generateStatsReply)(text, statsData);
        return ctx.reply(reply);
    }
    else if (intent === "COMPLEX_ANALYSIS") {
        try {
            const usageCount = await (0, supabase_1.incrementProUsage)();
            const history = await (0, context_1.getChatContext)(userId, 8);
            if (usageCount > 50) {
                await ctx.reply("⚠️ (تنبيه: باقة الموديل الخارق انتهت اليوم. سأقوم بالرد باستخدام الموديل السريع).");
                const fallbackReply = await (0, gemini_1.chatGemini)(text, history);
                await (0, context_1.addChatContext)(userId, 'user', text);
                await (0, context_1.addChatContext)(userId, 'model', fallbackReply);
                return ctx.reply(fallbackReply);
            }
            await ctx.replyWithChatAction("typing");
            const proReply = await (0, gemini_1.chatProGemini)(text, history);
            await (0, context_1.addChatContext)(userId, 'user', text);
            await (0, context_1.addChatContext)(userId, 'model', proReply);
            if (usageCount >= 45 && usageCount <= 50) {
                const remaining = 50 - usageCount;
                return ctx.reply(`${proReply}\n\n*(⚠️ حارس الباقة: باقي لك ${remaining} رسائل معقدة فقط اليوم)*`, { parse_mode: "Markdown" });
            }
            return ctx.reply(proReply);
        }
        catch (error) {
            console.error("Pro Fallback triggered:", error);
            const history = await (0, context_1.getChatContext)(userId, 8);
            const fallbackReply = await (0, gemini_1.chatGemini)(text, history);
            await (0, context_1.addChatContext)(userId, 'user', text);
            await (0, context_1.addChatContext)(userId, 'model', fallbackReply);
            return ctx.reply(fallbackReply);
        }
    }
    else {
        const history = await (0, context_1.getChatContext)(userId, 8);
        const reply = await (0, gemini_1.chatGemini)(text, history);
        await (0, context_1.addChatContext)(userId, 'user', text);
        await (0, context_1.addChatContext)(userId, 'model', reply);
        return ctx.reply(reply);
    }
}
function setupMessageHandlers(bot) {
    bot.on("message:text", async (ctx) => {
        await ctx.replyWithChatAction("typing");
        await processTextIntent(ctx, ctx.message.text, String(ctx.from?.id));
    });
    bot.on("message:voice", async (ctx) => {
        try {
            await ctx.replyWithChatAction("record_voice");
            const voice = ctx.msg.voice;
            if (voice.duration > 35) {
                return await ctx.reply("عذراً يا دكتور، الرسالة الصوتية طويلة جداً. الحد الأقصى 35 ثانية لضمان السرعة.");
            }
            const file = await ctx.getFile();
            if (!file.file_path)
                throw new Error("File path missing");
            const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
            const response = await fetch(fileUrl);
            if (!response.ok)
                throw new Error("Failed to download audio");
            const arrayBuffer = await response.arrayBuffer();
            const audioBase64String = Buffer.from(arrayBuffer).toString("base64");
            const transcribedText = await (0, gemini_1.transcribeAudio)(audioBase64String);
            await processTextIntent(ctx, transcribedText, String(ctx.from?.id));
        }
        catch (error) {
            throw error;
        }
    });
    bot.on("message:photo", async (ctx) => {
        try {
            await ctx.replyWithChatAction("typing");
            const userId = String(ctx.from?.id);
            // Get the highest resolution photo
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const fileId = photo.file_id;
            const file = await ctx.api.getFile(fileId);
            if (!file.file_path)
                throw new Error("File path missing");
            const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
            const response = await fetch(fileUrl);
            if (!response.ok)
                throw new Error("Failed to download image");
            const arrayBuffer = await response.arrayBuffer();
            const imageBase64String = Buffer.from(arrayBuffer).toString("base64");
            const extractedText = await (0, gemini_1.processReceiptImage)(imageBase64String);
            // Use parseExpense on the extracted text
            const expenseDetails = await (0, parser_1.parseExpense)(extractedText);
            if (expenseDetails && expenseDetails.amount) {
                await (0, expenses_1.addExpense)({
                    telegram_id: userId,
                    amount: expenseDetails.amount,
                    currency: expenseDetails.currency,
                    category: expenseDetails.category,
                    description: expenseDetails.description
                });
                return ctx.reply(`✅ تم تسجيل إيصال المصروف بنجاح:\n💰 ${expenseDetails.amount} ${expenseDetails.currency}\n📂 ${expenseDetails.category}\n📝 ${expenseDetails.description || "بدون وصف"}`);
            }
            else {
                return ctx.reply(`🤔 قرأت الإيصال ولكن لم أتمكن من استخراج المبلغ بدقة. التفاصيل المستخرجة:\n${extractedText}`);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
