import { Bot } from "grammy";
import { ensureTodaysTasks } from "../services/planner";
import { getCurrentDateStr } from "../core/timezone";
import { getTodaysTasks, getTasksInRange } from "../db/tasks";
import { getScheduleForDay } from "../db/schedule";
import { getExpensesInRange } from "../db/expenses";
import { chatGemini } from "../gemini";

export async function buildDynamicRoutineMessage(telegramId: string) {
    const tasks = await ensureTodaysTasks(telegramId);
    
    let completedCount = 0;
    const buttons = [];
    let text = "";
    
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const isDone = task.status === 'completed';
        if (isDone) completedCount++;
        
        const safeTitle = task.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        if (isDone) {
            text += `✅ ${i+1}. <s>${safeTitle}</s>\n`;
        } else {
            text += `${i+1}. ${safeTitle}\n`;
        }
        
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

export function setupTasksCommands(bot: Bot) {
    bot.command("todo", async (ctx) => {
        try {
            await ctx.replyWithChatAction("typing");
            const userId = String(ctx.from?.id);
            const ADMIN_ID = process.env.ADMIN_ID || "5785296270";
            if (userId !== ADMIN_ID) {
                return ctx.reply("عذراً، هذه الأوامر مخصصة لإدارة العيادة فقط.");
            }
            
            const { text, buttons } = await buildDynamicRoutineMessage(userId);
            return ctx.reply(text, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
        } catch (e: any) {
            console.error("Todo error:", e);
            return ctx.reply("❌ حدث خطأ داخلي أثناء معالجة المهام:\n" + e.message);
        }
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

    bot.command("weekly", async (ctx) => {
        const userId = String(ctx.from?.id);
        await ctx.replyWithChatAction("typing");
        
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
}
