import { Bot } from "grammy";
import { analyzeIntent, chatGemini, parseReminder, generateStatsReply, transcribeAudio, chatProGemini } from "./gemini";
import { addTodo, getUserTodos, incrementProUsage } from "./supabase";

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

const ROUTINE_TASKS = [
    "[أكاديمي] مذاكرة 7 صفحات أوكسفورد (Restoration)",
    "[عملي] تحضير سنة أوبريتف (Cavity Prep)",
    "[عملي] تحضير سنة فكسد ريدكشن",
    "[روحي] فيديو د. أبونا لوقا (رومية 2)",
    "[شطرنج] ساعة راحة وتطوير المدرب",
    "[إنجليزي] تدريب مهارات الإنجليزي اليومية"
];

function buildRoutineMessage(state: string) {
    let completedCount = 0;
    const buttons = [];
    let text = "";
    
    for (let i=0; i<ROUTINE_TASKS.length; i++) {
        const isDone = state[i] === '1';
        if (isDone) completedCount++;
        
        const prefix = isDone ? "✅" : "⏳";
        text += `${i+1}. ${prefix} ${ROUTINE_TASKS[i]}\n`;
        
        const newState = state.substring(0, i) + (isDone ? '0' : '1') + state.substring(i+1);
        
        // Two buttons per row
        if (i % 2 === 0) {
            buttons.push([{
                text: `${isDone ? "❌" : "✔️"} ${i+1}`,
                callback_data: `rtn_${newState}`
            }]);
        } else {
            buttons[buttons.length - 1].push({
                text: `${isDone ? "❌" : "✔️"} ${i+1}`,
                callback_data: `rtn_${newState}`
            });
        }
    }
    
    const percentage = Math.round((completedCount / ROUTINE_TASKS.length) * 100);
    const filledBlocks = Math.round(percentage / 10);
    const progressBar = "▓".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);
    
    let header = `📋 مهام اليوم التفاعلية\n`;
    header += `📊 الإنجاز: [${progressBar}] ${percentage}% (${completedCount}/${ROUTINE_TASKS.length})\n`;
    header += `─────────────────────────────\n`;
    header += text;
    header += `─────────────────────────────\n👇 اضغط على الأرقام أدناه لشطب أو استرجاع المهمة:\n`;
    
    return { text: header, buttons };
}

bot.command("start", (ctx) => {
    ctx.reply("مرحباً دكتور ماركو! البوت يعمل الآن بنجاح.\nجرب إرسال /today لعرض روتينك اليومي، أو تحدث معي مباشرة.");
});

bot.command("today", (ctx) => {
    const { text, buttons } = buildRoutineMessage("000000");
    return ctx.reply(text, { reply_markup: { inline_keyboard: buttons } });
});

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith("rtn_")) {
        const state = data.split("_")[1];
        const { text, buttons } = buildRoutineMessage(state);
        try {
            await ctx.editMessageText(text, { reply_markup: { inline_keyboard: buttons } });
        } catch (e) {
            // Ignore if message is identical
        }
        await ctx.answerCallbackQuery();
    }
});

async function processTextIntent(ctx: any, text: string, userId: string) {
    const analysis = await analyzeIntent(text);
    const intent = analysis.intent;

    if (intent === "MEDICAL_EMERGENCY") {
        return ctx.reply("⚠️ تنبيه: أنا مساعد ذكي ولست طبيباً. يبدو أن هذا الاستفسار طبي خطير. يُرجى استشارة طبيب بشري أو التوجه لأقرب عيادة فوراً.");
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
        const todos = await getUserTodos(userId);
        const reply = await generateStatsReply(text, todos);
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
