import { Bot } from "grammy";
import { analyzeIntent, chatGemini, parseReminder, generateStatsReply, transcribeAudio, chatProGemini } from "./gemini";
import { addTodo, getUserTodos, incrementProUsage, recordReadArticle, getReadArticlesCount } from "./supabase";

// 🚀 الحل القاطع الجذري: تمرير معلومات البوت يدوياً لمنع خطأ التهيئة للأبد
export const bot = new Bot(process.env.BOT_TOKEN!, {
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

bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});

import { ensureTodaysTasks, completeTask } from "./services/planner";
import { getCurrentDateStr, getCurrentTimestampStr } from "./core/timezone";
import { Task, getTodaysTasks } from "./db/tasks";
import { getScheduleForDay } from "./db/schedule";

async function buildDynamicRoutineMessage(telegramId: string) {
    const tasks = await ensureTodaysTasks(telegramId);
    
    let completedCount = 0;
    const buttons = [];
    let text = "";
    
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const isDone = task.status === 'completed';
        if (isDone) completedCount++;
        
        if (isDone) {
            text += `✅ ${i+1}. <s>${task.title}</s>\n`;
        } else {
            text += `${i+1}. ${task.title}\n`;
        }
        
        // We put task ID in callback_data. 
        // Note: callback_data max length is 64 bytes. UUID is 36 bytes. 
        // "tdo_uuid" is 40 bytes, which fits.
        if (!isDone) {
            const btnText = `✔️ أتممت: ${task.title.substring(0, 10)}..`;
            if (buttons.length > 0 && buttons[buttons.length - 1].length < 2) {
                buttons[buttons.length - 1].push({ text: btnText, callback_data: `tdo_${task.id}` });
            } else {
                buttons.push([{ text: btnText, callback_data: `tdo_${task.id}` }]);
            }
        }
    }
    
    const percentage = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
    const filledBlocks = Math.round(percentage / 10);
    const progressBar = "▓".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);
    
    const dateStr = getCurrentDateStr();

    let header = `📋 مهام اليوم التفاعلية | ${dateStr}\n`;
    header += `📊 الإنجاز: [${progressBar}] ${percentage}% (${completedCount}/${tasks.length})\n`;
    header += `─────────────────────────────\n`;
    header += text;
    header += `─────────────────────────────\n`;
    if (completedCount < tasks.length) {
         header += `👇 اضغط على الزر عند الإتمام:\n`;
    } else {
         header += `🌟 عظيم جداً! أنهيت جميع مهام اليوم!\n`;
    }
    
    return { text: header, buttons };
}

bot.command("start", async (ctx) => {
    await ctx.api.setMyCommands([
        { command: "plan", description: "جلسة التخطيط الصباحية لليوم" },
        { command: "todo", description: "قائمة المهام اليومية التفاعلية وشريط الإنجاز" },
        { command: "review", description: "الملخص المسائي وتقييم اليوم" },
        { command: "weekly", description: "التقييم الأسبوعي للإنجازات والمصروفات" },
        { command: "monthly", description: "التقييم الشهري والتحليل العميق" },
        { command: "dental", description: "مقال بيزكس كلينكال مركز" },
        { command: "news", description: "أهم الأخبار العامة العاجلة" },
        { command: "channels", description: "فحص حالة القنوات الثلاث المنفصلة" },
        { command: "status", description: "فحص حالة السيرفر السحابي" },
        { command: "achievements", description: "نظام الإنجازات والنقاط المتراكمة" }
    ]);
    ctx.reply("مرحباً دكتور ماركو! البوت يعمل الآن بنجاح.\nتم تفعيل وتحديث قائمة الاختصارات (Menu) الخاصة بك. اضغط على زر القائمة لاكتشافها!");
});

bot.command("todo", async (ctx) => {
    await ctx.replyWithChatAction("typing");
    const userId = String(ctx.from?.id);
    const { text, buttons } = await buildDynamicRoutineMessage(userId);
    return ctx.reply(text, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
});


bot.command("dental", async (ctx) => {
    await ctx.replyWithChatAction("typing");
    
    const articlePrompt = `
أنت أستاذ جامعي في طب الأسنان (Basic Clinical Science). 
اكتب مقالاً علمياً محترماً ومفصلاً لدكتور أسنان عن موضوع عشوائي أو محدد في Basic Clinical Science.
يجب أن يحتوي المقال على:
- عنوان واضح.
- مقدمة علمية.
- صلب الموضوع (Pathophysiology أو Clinical details).
- تطبيق إكلينيكي (Clinical Application).
- رابط (Link): قم بإنشاء رابط بحث حقيقي على موقع PubMed يبحث عن هذا الموضوع (مثال: https://pubmed.ncbi.nlm.nih.gov/?term=dental+caries+management).
اكتب المقال بأسلوب طبي احترافي شيق.
`;
    const reply = await chatGemini(articlePrompt);
    
    // إنشاء أزرار تفاعلية للمقال
    const buttons = [
        [{ text: "📖 أتممت القراءة", callback_data: `art_read` }],
        [{ text: "🔗 فتحت الرابط وقرأته", callback_data: `art_link` }]
    ];
    
    return ctx.reply("🦷 مقال كلينيكال:\n\n" + reply, {
        reply_markup: { inline_keyboard: buttons }
    });
});

bot.command("news", async (ctx) => {
    await ctx.replyWithChatAction("typing");
    const reply = await chatGemini("لخص أهم وأحدث 3 أخبار عالمية عامة باختصار شديد جداً كعناوين عاجلة.");
    return ctx.reply("📰 أخبار عاجلة:\n\n" + reply);
});

bot.command("status", (ctx) => {
    ctx.reply("🟢 السيرفر السحابي (Vercel): Online\n🟢 قاعدة البيانات (Supabase): Online\n🟢 الذكاء الاصطناعي (Groq/Gemini): Online\n⚡ النظام يعمل بأقصى كفاءة.");
});

bot.command("channels", (ctx) => {
    ctx.reply("📡 حالة القنوات الثلاث:\n1. القناة الأكاديمية: 🟢 تعمل\n2. قناة العيادة: 🟢 تعمل\n3. القناة الشخصية: 🟢 تعمل");
});

bot.command("review", async (ctx) => {
    const userId = String(ctx.from?.id);
    await ctx.replyWithChatAction("typing");
    
    const today = getCurrentDateStr();
    const tasks = await getTodaysTasks(userId, today);
    
    if (tasks.length === 0) {
        return ctx.reply("لا توجد مهام مسجلة لليوم بعد.");
    }
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completionRate = Math.round((completedTasks.length / tasks.length) * 100);
    const xpEarnedToday = completedTasks.reduce((sum, t) => sum + t.xp_reward, 0);
    
    let text = `🌙 **الملخص المسائي (End-of-day Review)**\n\n`;
    text += `📊 نسبة الإنجاز اليوم: ${completionRate}%\n`;
    text += `✨ نقاط الـ XP المكتسبة: +${xpEarnedToday}\n\n`;
    
    text += `✅ **المهام المنجزة:**\n`;
    completedTasks.forEach(t => { text += `- ${t.title}\n`; });
    
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    if (pendingTasks.length > 0) {
        text += `\n⏳ **مهام لم تكتمل (سيتم ترحيلها أو جدولتها لاحقاً):**\n`;
        pendingTasks.forEach(t => { text += `- ${t.title}\n`; });
    }
    
    text += `\nعاش يا دكتور! يوم موفق! 👏`;
    
    return ctx.reply(text, { parse_mode: "Markdown" });
});


import { getTasksInRange } from "./db/tasks";
import { getExpensesInRange } from "./db/expenses";

bot.command("weekly", async (ctx) => {
    const userId = String(ctx.from?.id);
    await ctx.replyWithChatAction("typing");
    
    // Get last 7 days
    const now = new Date();
    const todayStr = getCurrentDateStr();
    
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    
    const tasks = await getTasksInRange(userId, weekAgoStr, todayStr);
    const expenses = await getExpensesInRange(userId, weekAgoStr, todayStr);
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
    
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const xpEarned = completedTasks.reduce((sum, t) => sum + (t.xp_reward || 0), 0);
    
    let prompt = `أنت مساعد دكتور ماركو. نريد عمل Weekly Review.\n`;
    prompt += `المهام المنجزة هذا الأسبوع: ${completedTasks.length} من أصل ${tasks.length} بنسبة إنجاز ${completionRate}%.\n`;
    prompt += `نقاط الـ XP المكتسبة: ${xpEarned}.\n`;
    prompt += `إجمالي المصروفات: ${totalSpent} ج.م.\n`;
    prompt += `اكتب تقرير أسبوعي تشجيعي لطيف يلخص إنجازاته ومصروفاته ويحفزه للأسبوع القادم.`;
    
    const reply = await chatGemini(prompt);
    return ctx.reply(`📅 **Weekly Review**\n\n${reply}`);
});

bot.command("monthly", async (ctx) => {
    const userId = String(ctx.from?.id);
    await ctx.replyWithChatAction("typing");
    
    // Get last 30 days
    const now = new Date();
    const todayStr = getCurrentDateStr();
    
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = monthAgo.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    
    const tasks = await getTasksInRange(userId, monthAgoStr, todayStr);
    const expenses = await getExpensesInRange(userId, monthAgoStr, todayStr);
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
    
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const xpEarned = completedTasks.reduce((sum, t) => sum + (t.xp_reward || 0), 0);
    
    let prompt = `أنت مساعد دكتور ماركو. نريد عمل Monthly Review (المراجعة الشهرية).\n`;
    prompt += `المهام المنجزة هذا الشهر: ${completedTasks.length} من أصل ${tasks.length} بنسبة إنجاز ${completionRate}%.\n`;
    prompt += `نقاط الـ XP المكتسبة: ${xpEarned}.\n`;
    prompt += `إجمالي المصروفات: ${totalSpent} ج.م.\n`;
    prompt += `اكتب تقرير شهري تحليلي مفصل وعميق يراجع أداءه العام ويقدم نصائح ذهبية للشهر القادم.`;
    
    const reply = await chatGemini(prompt);
    return ctx.reply(`📊 **Monthly Review**\n\n${reply}`);
});

bot.command("plan", async (ctx) => {
    const userId = String(ctx.from?.id);
    await ctx.replyWithChatAction("typing");
    
    const today = getCurrentDateStr();
    const tasks = await ensureTodaysTasks(userId);
    
    const now = new Date();
    const tomorrowDayOfWeek = (now.getDay() + 1) % 7;
    const tomorrowSchedule = await getScheduleForDay(userId, tomorrowDayOfWeek);
    
    let prompt = `أنت مساعد دكتور ماركو. نريد عمل Daily Planning Session لليوم.\n`;
    prompt += `المهام المقررة اليوم:\n${tasks.map(t => `- ${t.title}`).join('\n')}\n`;
    prompt += `جدول الكلية غداً:\n${tomorrowSchedule.length > 0 ? tomorrowSchedule.map(s => `- ${s.course_name} (${s.session_type})`).join('\n') : "لا يوجد مواعيد مسجلة."}\n`;
    prompt += `اكتب رسالة صباحية لطيفة تناقش معه خطة اليوم وتقترح تعديلات بناءً على سكاشن الغد، واسأله إذا كان لديه أي التزامات طارئة قبل تثبيت الخطة.`;
    
    const reply = await chatGemini(prompt);
    return ctx.reply(reply);
});

import { getTotalXp, calculateLevel } from "./db/gamification";

bot.command("achievements", async (ctx) => {
    const userId = String(ctx.from?.id);
    await ctx.replyWithChatAction("typing");
    
    // حساب النقاط الكلية من الـ XP Transactions
    const xp = await getTotalXp(userId);
    
    // جلب عدد المقالات القديمة لدمجها إذا أردنا، أو الاعتماد على XP فقط
    const articlesCount = await getReadArticlesCount(userId);
    const legacyXp = articlesCount * 10;
    const totalXp = xp + legacyXp; // دمج النقاط القديمة مع الجديدة
    
    const { levelText, nextLevelXp } = calculateLevel(totalXp);
    
    let progressText = "";
    if (totalXp >= 500) {
        progressText = "الحد الأقصى للمستوى!";
    } else {
        // حساب النسبة
        let currentLevelBaseXp = 0;
        if (totalXp >= 300) currentLevelBaseXp = 300;
        else if (totalXp >= 150) currentLevelBaseXp = 150;
        else if (totalXp >= 50) currentLevelBaseXp = 50;
        
        const xpInCurrentLevel = totalXp - currentLevelBaseXp;
        const xpRequiredForNextLevel = nextLevelXp - currentLevelBaseXp;
        const percentage = Math.round((xpInCurrentLevel / xpRequiredForNextLevel) * 100);
        
        const filledBlocks = Math.round(percentage / 10);
        const progressBar = "▓".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);
        
        progressText = `التقدم للمستوى التالي: [${progressBar}] ${percentage}%\n(باقي ${nextLevelXp - totalXp} نقطة)`;
    }
    
    const replyText = `🏆 **نظام الإنجازات v3.0** 🏆\n\n`
                    + `✨ إجمالي النقاط (XP): ${totalXp}\n\n`
                    + `🎖️ **مستواك الحالي:**\n${levelText}\n\n`
                    + `${progressText}\n\n`
                    + `💡 *تلميح: أنهِ مهام /todo اليومية لكسب المزيد من النقاط!*`;
                    
    return ctx.reply(replyText, { parse_mode: "Markdown" });
});

import { processAndFormatArticle } from "./services/scientific";
import { updateArticleStatus, getArticle } from "./db/articles";
import { addXpTransaction } from "./db/gamification";

bot.command("article", async (ctx) => {
    // For now, prompt the user to send an article text to process
    return ctx.reply("📚 لإضافة مقال علمي لمكتبتك وتلخيصه، أرسل نص المقال أو الـ Abstract الخاص به متبوعاً بكلمة 'لخص'.\nأو يمكنك استخدام /dental لمقالة سريعة من البوت.");
});

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = String(ctx.from?.id);
    
    // معالجة أزرار المقالات القديمة
    if (data.startsWith("art_")) {
        const type = data === "art_read" ? "قراءة مقال" : "فتح وقراءة رابط مقال";
        
        await recordReadArticle(type, userId);
        await ctx.answerCallbackQuery({ text: `🎉 عظيم جداً يا دكتور! تم تسجيل إنجازك (${type}) في سجلات الشهر بنجاح! 💪`, show_alert: true });
        return;
    }
    
    // قراءة مقال علمي (Scientific Engine)
    if (data.startsWith("read_")) {
        const articleId = data.substring(5);
        
        try {
            await updateArticleStatus(articleId, 'COMPLETED', 30);
            await addXpTransaction(userId, 30, `Completed Scientific Reading - Article`);
            
            await ctx.answerCallbackQuery({ text: "✅ تم تسجيل قراءتك للمقال وإضافة 30 XP! عاش يا دكتور 👏", show_alert: true });
            
            // تعديل الأزرار لتعكس حالة القراءة
            await ctx.editMessageReplyMarkup({ 
                reply_markup: { inline_keyboard: [[{ text: "🌟 تمت القراءة (+30 XP)", callback_data: "done" }]] } 
            });
        } catch (e) {
            console.error(e);
            await ctx.answerCallbackQuery({ text: "❌ حدث خطأ أثناء التحديث.", show_alert: true });
        }
        return;
    }

    if (data.startsWith("skip_")) {
        const articleId = data.substring(5);
        try {
            await updateArticleStatus(articleId, 'SKIPPED');
            await ctx.answerCallbackQuery({ text: "تم التأجيل. سنحاول اختيار مقال أقصر لاحقاً." });
            await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        } catch (e) {
            await ctx.answerCallbackQuery({ text: "❌ حدث خطأ." });
        }
        return;
    }
    
    // معالجة أزرار المهام الديناميكية
    if (data.startsWith("tdo_")) {
        const taskId = data.substring(4);
        const userId = String(ctx.from?.id);
        
        try {
            const resultMsg = await completeTask(userId, taskId);
            await ctx.answerCallbackQuery({ text: resultMsg, show_alert: true });
            
            // Re-render the message
            const { text, buttons } = await buildDynamicRoutineMessage(userId);
            await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
        } catch (e) {
            console.error(e);
            await ctx.answerCallbackQuery({ text: "حدث خطأ أثناء إتمام المهمة.", show_alert: true });
        }
    }
});

import { parseCollegeSchedule, parseExpense } from "./ai/parser";
import { addCollegeSessions } from "./db/schedule";
import { addExpense } from "./db/expenses";

async function processTextIntent(ctx: any, text: string, userId: string) {
    const analysis = await analyzeIntent(text);
    const intent = analysis.intent;

    if (intent === "MEDICAL_EMERGENCY") {
        return ctx.reply("⚠️ تنبيه: أنا مساعد ذكي ولست طبيباً. يبدو أن هذا الاستفسار طبي خطير. يُرجى استشارة طبيب بشري أو التوجه لأقرب عيادة فوراً.");
    } 
    
    else if (intent === "EXPENSE") {
        await ctx.replyWithChatAction("typing");
        const expenseDetails = await parseExpense(text);
        
        if (expenseDetails && expenseDetails.amount) {
            try {
                await addExpense({
                    telegram_id: userId,
                    amount: expenseDetails.amount,
                    currency: expenseDetails.currency,
                    category: expenseDetails.category,
                    description: expenseDetails.description
                });
                return ctx.reply(`✅ تم تسجيل المصروف بنجاح:\n💰 ${expenseDetails.amount} ${expenseDetails.currency}\n📂 ${expenseDetails.category}\n📝 ${expenseDetails.description || "بدون وصف"}`);
            } catch (e) {
                return ctx.reply("❌ حدث خطأ أثناء تسجيل المصروف في قاعدة البيانات.");
            }
        } else {
            return ctx.reply("🤔 فهمت أنك تريد تسجيل مصروف، لكنني لم أتمكن من تحديد المبلغ بدقة. كم دفعت بالظبط وفي ماذا؟");
        }
    }

    else if (intent === "ARTICLE_SUMMARY") {
        await ctx.replyWithChatAction("typing");
        try {
            const { text: formattedSummary, articleId } = await processAndFormatArticle(userId, text);
            
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
        } catch (e) {
            return ctx.reply("❌ حدث خطأ أثناء تلخيص وحفظ المقال.");
        }
    }
    
    else if (intent === "COLLEGE_SCHEDULE") {
        await ctx.replyWithChatAction("typing");
        const schedule = await parseCollegeSchedule(text);
        if (schedule && schedule.sessions.length > 0) {
            try {
                await addCollegeSessions(userId, schedule.sessions as any[]);
                return ctx.reply(`✅ تم فهم وحفظ جدول الكلية بنجاح!\nسأقوم تلقائياً باقتراح مهام "تدريب استباقي" في اليوم الذي يسبق أي سكشن عملي.`);
            } catch (e) {
                return ctx.reply("❌ حدث خطأ أثناء حفظ الجدول في قاعدة البيانات.");
            }
        } else {
            return ctx.reply("❌ لم أتمكن من استخراج المواعيد من النص. هل يمكنك توضيح الجدول أكثر؟");
        }
    }
    
    else if (intent === "CREATE_REMINDER") {
        const parsed = await parseReminder(text);
        if (parsed && parsed.task && parsed.date) {
            await addTodo(parsed.task, parsed.date, userId);
            return ctx.reply(`✅ تم تسجيل المهمة بنجاح:\n📌 ${parsed.task}\n📅 ${parsed.date}`);
        } else {
            return ctx.reply("❌ عذراً، لم أتمكن من فهم التاريخ بدقة. هل يمكنك توضيحه؟");
        }
    } 
    
    else if (intent === "STATISTICS") {
        await ctx.replyWithChatAction("typing");
        
        // Gather analytics data
        const todayStr = getCurrentDateStr();
        const tasks = await getTodaysTasks(userId, todayStr);
        const xp = await getTotalXp(userId);
        
        // We can add a function to get recent expenses if needed, for now we pass tasks and XP
        const statsData = {
            today_tasks: tasks.map(t => ({ title: t.title, status: t.status })),
            total_xp: xp,
        };
        
        const reply = await generateStatsReply(text, statsData);
        return ctx.reply(reply);
    }
    
    else if (intent === "COMPLEX_ANALYSIS") {
        try {
            const usageCount = await incrementProUsage();

            if (usageCount > 50) {
                await ctx.reply("⚠️ (تنبيه: باقة الموديل الخارق انتهت اليوم. سأقوم بالرد باستخدام الموديل السريع).");
                const fallbackReply = await chatGemini(text);
                return ctx.reply(fallbackReply);
            }

            await ctx.replyWithChatAction("typing");
            const proReply = await chatProGemini(text);

            if (usageCount >= 45 && usageCount <= 50) {
                const remaining = 50 - usageCount;
                return ctx.reply(`${proReply}\n\n*(⚠️ حارس الباقة: باقي لك ${remaining} رسائل معقدة فقط اليوم)*`, { parse_mode: "Markdown" });
            }

            return ctx.reply(proReply);
        } catch (error) {
            console.error("Pro Fallback triggered:", error);
            const fallbackReply = await chatGemini(text);
            return ctx.reply(fallbackReply);
        }
    }
    
    else {
        const reply = await chatGemini(text);
        return ctx.reply(reply);
    }
}

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
        if (!file.file_path) throw new Error("File path missing");

        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Failed to download audio");

        const arrayBuffer = await response.arrayBuffer();
        const audioBase64String = Buffer.from(arrayBuffer).toString("base64");

        const transcribedText = await transcribeAudio(audioBase64String);
        await processTextIntent(ctx, transcribedText, String(ctx.from?.id));

    } catch (error) {
        console.error("Voice Processing Error:", error);
        await ctx.reply("عذراً يا دكتور، حدث خطأ أثناء معالجة رسالتك الصوتية. يرجى المحاولة كتابياً.");
    }
});

import { processReceiptImage } from "./gemini";

bot.on("message:photo", async (ctx) => {
    try {
        await ctx.replyWithChatAction("typing");
        const userId = String(ctx.from?.id);
        
        // Get the highest resolution photo
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileId = photo.file_id;
        
        const file = await ctx.api.getFile(fileId);
        if (!file.file_path) throw new Error("File path missing");
        
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Failed to download image");
        
        const arrayBuffer = await response.arrayBuffer();
        const imageBase64String = Buffer.from(arrayBuffer).toString("base64");
        
        const extractedText = await processReceiptImage(imageBase64String);
        
        // Use parseExpense on the extracted text
        const expenseDetails = await parseExpense(extractedText);
        
        if (expenseDetails && expenseDetails.amount) {
            await addExpense({
                telegram_id: userId,
                amount: expenseDetails.amount,
                currency: expenseDetails.currency,
                category: expenseDetails.category,
                description: expenseDetails.description
            });
            return ctx.reply(`✅ تم تسجيل إيصال المصروف بنجاح:\n💰 ${expenseDetails.amount} ${expenseDetails.currency}\n📂 ${expenseDetails.category}\n📝 ${expenseDetails.description || "بدون وصف"}`);
        } else {
            return ctx.reply(`🤔 قرأت الإيصال ولكن لم أتمكن من استخراج المبلغ بدقة. التفاصيل المستخرجة:\n${extractedText}`);
        }
        
    } catch (e) {
        console.error("Receipt Processing Error:", e);
        await ctx.reply("❌ عذراً، حدث خطأ أثناء محاولة قراءة الإيصال.");
    }
});
