import { Bot } from "grammy";
import { 
    analyzeIntent, 
    chatGemini, 
    parseReminder, 
    generateStatsReply, 
    transcribeAudio, 
    chatProGemini,
    processReceiptImage,
    chatPatientGemini
} from "../gemini";
import { parseCollegeSchedule, parseExpense } from "../ai/parser";
import { addCollegeSessions } from "../db/schedule";
import { addExpense } from "../db/expenses";
import { addTodo, incrementProUsage } from "../supabase";
import { processAndFormatArticle } from "../services/scientific";
import { getCurrentDateStr } from "../core/timezone";
import { getTodaysTasks } from "../db/tasks";
import { getTotalXp } from "../db/gamification";
import { getChatContext, addChatContext } from "../db/context";

async function processTextIntent(ctx: any, text: string, userId: string) {
    // الفصل بين الدكتور ماركو والمرضى (Security & Persona Separation)
    const ADMIN_ID = process.env.ADMIN_ID || "5785296270";
    if (userId !== ADMIN_ID) {
        await ctx.replyWithChatAction("typing");
        const history = await getChatContext(userId, 8);
        const reply = await chatPatientGemini(text, history);
        
        await addChatContext(userId, 'user', text);
        await addChatContext(userId, 'model', reply);
        
        return ctx.reply(reply);
    }

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
                // @ts-ignore (Assuming schedule output maps to DB requirements)
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
        
        const todayStr = getCurrentDateStr();
        const tasks = await getTodaysTasks(userId, todayStr);
        const xp = await getTotalXp(userId);
        
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
            const history = await getChatContext(userId, 8);

            if (usageCount > 50) {
                await ctx.reply("⚠️ (تنبيه: باقة الموديل الخارق انتهت اليوم. سأقوم بالرد باستخدام الموديل السريع).");
                const fallbackReply = await chatGemini(text, history);
                await addChatContext(userId, 'user', text);
                await addChatContext(userId, 'model', fallbackReply);
                return ctx.reply(fallbackReply);
            }

            await ctx.replyWithChatAction("typing");
            const proReply = await chatProGemini(text, history);
            
            await addChatContext(userId, 'user', text);
            await addChatContext(userId, 'model', proReply);

            if (usageCount >= 45 && usageCount <= 50) {
                const remaining = 50 - usageCount;
                return ctx.reply(`${proReply}\n\n*(⚠️ حارس الباقة: باقي لك ${remaining} رسائل معقدة فقط اليوم)*`, { parse_mode: "Markdown" });
            }

            return ctx.reply(proReply);
        } catch (error) {
            console.error("Pro Fallback triggered:", error);
            const history = await getChatContext(userId, 8);
            const fallbackReply = await chatGemini(text, history);
            await addChatContext(userId, 'user', text);
            await addChatContext(userId, 'model', fallbackReply);
            return ctx.reply(fallbackReply);
        }
    }
    
    else {
        const history = await getChatContext(userId, 8);
        
        const reply = await chatGemini(text, history);
        
        await addChatContext(userId, 'user', text);
        await addChatContext(userId, 'model', reply);
        
        return ctx.reply(reply);
    }
}

export function setupMessageHandlers(bot: Bot) {
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
}
