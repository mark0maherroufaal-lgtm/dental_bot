// src/handlers/messages.ts (router.ts)
// Stage 3 + Stage 5 + Stage 6 Integrated Router (Includes [🗑️ مسح المصروف] Undo Button & Dental Budget Summary)

import { Bot } from "grammy";
import {
    analyzeIntent,
    chatGemini,
    parseReminder,
    generateStatsReply,
    transcribeAudio,
    chatProGemini,
    processReceiptImage
} from "../gemini";
import {
    parseCollegeSchedule,
    parseExpense,
    parseAcademicUpdate
} from "../ai/parser";
import {
    diffAndApplySchedule,
    addAcademicEvent
} from "../db/schedule";
import {
    addExpense,
    deleteExpenseById,
    getExpensesSummary,
    Expense
} from "../db/expenses";
import { isAuthorizedAdmin } from "../core/config";
import { processAndFormatArticle } from "../services/scientific";
import { handleReminderAction } from "../services/reminders";
import {
    getCurrentDateStr,
    getTomorrowDateStr,
    formatDateToArabicFriendly
} from "../core/timezone";
import { getTodaysTasks } from "../db/tasks";
import { getTotalXp } from "../db/gamification";
import { getChatContext, addChatContext } from "../db/context";

// ==========================================
// Layer 1: 0ms Deterministic Pattern Helpers
// ==========================================

const SCHEDULE_KEYWORDS_REGEX =
    /(جدول|محاضرة|محاضرات|سكشن|سكاشن|عيادة|مدرج|عملي|نظري|schedule|timetable|lecture|section|clinic|lab)/i;

const DAY_NAMES_REGEX =
    /(الأحد|الاحد|الإثنين|الاثنين|الثلاثاء|التلات|الأربعاء|الاربع|الخميس|الجمعة|السبت|sunday|monday|tuesday|wednesday|thursday|friday|saturday|\bsun\b|\bmon\b|\btue\b|\bwed\b|\bthu\b|\bfri\b|\bsat\b)/i;

const TIME_PATTERN_REGEX =
    /(\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:ص|م|صباحا|مساء|am|pm)\b|\bمن\s*\d{1,2}\s*(?:لـ|إلى|لحد)\s*\d{1,2}\b)/i;

const EXPENSE_SIGNAL_REGEX =
    /(?:^(?:صرفت|دفعت|اشتريت|جبت|حاسبت|كلفتني)\b|\b(?:صرفت|دفعت)\s+[\d٠-٩]+|\b[\d٠-٩]+(?:\.[\d٠-٩]+)?\s*(?:جنيه|جنية|ج\.م|جم|egp|le)\b)/i;

const EXPENSE_SUMMARY_QUERY_REGEX =
    /(?:صرفت\s*كام|مصاريف\s*(?:النهارده|اليوم|الاسبوع|الأسبوع|الشهر)|ميزانية|ميزانيتي|حساب\s*الأدوات|مصاريف\s*الأسنان)/i;

const REMINDER_START_REGEX = /^(?:فكرني|ذكرني|فكرنى|ذكرنى|remind|schedule task)\b/i;
const CANCEL_START_REGEX = /^(?:امسح|الغي|إلغاء|الغى|كنسل|cancel|delete task)\b/i;
const RESCHEDULE_START_REGEX = /^(?:خليها|بدل|أجل|اجل|تأجيل|رحل|reschedule|postpone)\b/i;

const REMINDER_ANYWHERE_REGEX =
    /(?:فكرني|ذكرني|فكرنى|ذكرنى|أجل|اجل|امسح تذكير|الغي تذكير|الغي مهمة)/i;

const ACADEMIC_EVENT_REGEX =
    /\b(?:امتحان|إمتحان|كويز|اختبار|ميدتيرم|فاينل|تسليم\s+شيت|تسليم\s+اسايمنت|exam|quiz|midterm|final)\b/i;

const STATS_REGEX =
    /(?:^(?:احصائيات|إحصائيات|احصائياتي|تقدمي|مستوايا|نقاطي|مهامي|المهام|مهام|ورايا\s*ايه|ورايا\s*إيه|عندي\s*ايه|عندي\s*إيه|جدولي\s*النهارده|جدولي\s*اليوم|يومى|يومي)\b|مهامي|مهام\s+النهارده|مهام\s+اليوم|ورايا\s+ايه\s+النهارده|ورايا\s+إيه\s+النهارده)/i;

function isCollegeScheduleMessage(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length <= 80) return false;

    const hasScheduleKeyword = SCHEDULE_KEYWORDS_REGEX.test(trimmed);
    const hasDaysAndTimes = DAY_NAMES_REGEX.test(trimmed) && TIME_PATTERN_REGEX.test(trimmed);
    const hasLegacyColumn = trimmed.toLowerCase().includes("day_of_week");

    return hasScheduleKeyword || hasDaysAndTimes || hasLegacyColumn;
}

function detectDeterministicIntent(text: string): string | null {
    const trimmed = text.trim();
    const lowerText = trimmed.toLowerCase();

    if (isCollegeScheduleMessage(trimmed)) {
        return "COLLEGE_SCHEDULE";
    }

    if (EXPENSE_SUMMARY_QUERY_REGEX.test(trimmed)) {
        return "EXPENSE_SUMMARY";
    }

    if (
        EXPENSE_SIGNAL_REGEX.test(trimmed) &&
        (REMINDER_ANYWHERE_REGEX.test(trimmed) || ACADEMIC_EVENT_REGEX.test(trimmed))
    ) {
        return "COMPOUND_EXPENSE_AND_REMINDER";
    }

    if (REMINDER_START_REGEX.test(lowerText)) {
        return "CREATE_REMINDER";
    }
    if (RESCHEDULE_START_REGEX.test(lowerText)) {
        return "RESCHEDULE_TASK";
    }
    if (CANCEL_START_REGEX.test(lowerText)) {
        return "CANCEL_TASK";
    }

    if (STATS_REGEX.test(lowerText)) {
        return "STATISTICS";
    }

    if (EXPENSE_SIGNAL_REGEX.test(trimmed)) {
        return "EXPENSE";
    }

    if (
        ACADEMIC_EVENT_REGEX.test(trimmed) &&
        /(?:بكره|بكرة|غدا|غداً|بعد بكره|يوم|الأسبوع|الاسبوع|الجاي|القادم|\d{1,2})/.test(trimmed)
    ) {
        return "ACADEMIC_EVENT";
    }

    if (/^(?:طوارئ|emergency|نزيف)/i.test(lowerText)) {
        return "MEDICAL_EMERGENCY";
    }

    return null;
}

// ==========================================
// Helper Flows (Expense, Reminder, Academic)
// ==========================================

function formatBriefExpenseReply(saved: Expense): string {
    const currency = saved.currency || "EGP";
    const category = saved.category || "عام";

    const extraParts: string[] = [];
    if (saved.description && saved.description.trim() && saved.description.trim() !== category) {
        extraParts.push(saved.description.trim());
    }
    if (
        saved.merchant &&
        saved.merchant.trim() &&
        !extraParts.join(" ").toLowerCase().includes(saved.merchant.trim().toLowerCase())
    ) {
        extraParts.push(saved.merchant.trim());
    }

    const extraInfo = extraParts.length > 0 ? ` (${extraParts.join(" - ")})` : "";
    return `✅ تم تسجيل: ${saved.amount} ${currency} - ${category}${extraInfo}`;
}

export function buildExpenseUndoKeyboard(expenseId?: string) {
    if (!expenseId) return undefined;
    return {
        inline_keyboard: [
            [
                {
                    text: "🗑️ مسح المصروف",
                    callback_data: `delexp_${expenseId}`
                }
            ]
        ]
    };
}

async function executeExpenseFlow(
    text: string,
    userId: string
): Promise<{ replyText: string; savedExpense: Expense } | null> {
    const expenseDetails = await parseExpense(text);
    if (expenseDetails && expenseDetails.amount) {
        const savedExpense = await addExpense({
            telegram_id: userId,
            amount: expenseDetails.amount,
            currency: expenseDetails.currency || "EGP",
            category: expenseDetails.category || "عام",
            description: expenseDetails.description?.trim() || null,
            merchant: (expenseDetails as any).merchant || null,
            payment_method: (expenseDetails as any).payment_method || null,
            expense_date: (expenseDetails as any).expense_date || getCurrentDateStr()
        });

        return {
            replyText: formatBriefExpenseReply(savedExpense),
            savedExpense
        };
    }
    return null;
}

async function executeReminderFlow(
    text: string,
    userId: string,
    forcedAction?: "CREATE" | "RESCHEDULE" | "CANCEL"
): Promise<string | null> {
    const parsed = await parseReminder(text);
    if (!parsed) return null;

    if (forcedAction) {
        parsed.action = forcedAction;
    }

    return await handleReminderAction(userId, parsed);
}

async function executeAcademicEventFlow(text: string, userId: string): Promise<string> {
    try {
        const parsedUpdates = await parseAcademicUpdate(text);
        const eventsList = Array.isArray((parsedUpdates as any)?.events)
            ? (parsedUpdates as any).events
            : Array.isArray(parsedUpdates)
            ? parsedUpdates
            : [];

        if (eventsList.length > 0) {
            const confirmations: string[] = [];

            for (const ev of eventsList) {
                const eventDateOnly = String(ev.event_date || getTomorrowDateStr()).slice(0, 10);
                await addAcademicEvent({
                    event_type: ev.event_type || "EXAM",
                    title: ev.title,
                    event_date: ev.event_date || eventDateOnly,
                    original_message: text
                });

                const reminderReply = await handleReminderAction(userId, {
                    task: `مراجعة واستعداد لـ: ${ev.title}`,
                    date: eventDateOnly,
                    time: "09:00",
                    action: "CREATE",
                    category: "COLLEGE_STUDY",
                    priority: "Critical",
                    course_keyword: null
                });

                confirmations.push(
                    `🎓 تم تسجيل **${ev.title}** (${formatDateToArabicFriendly(eventDateOnly)}) في الأحداث الأكاديمية وعملتلك تذكير تلقائي:\n${reminderReply}`
                );
            }

            return confirmations.join("\n\n");
        }
    } catch (e) {
        console.warn("[Router] parseAcademicUpdate fallback to parseReminder:", e);
    }

    const parsed = await parseReminder(text);
    const isQuiz = /(?:كويز|quiz|اختبار قصير)/i.test(text);
    const isAssignment = /(?:تسليم|شيت|اسايمنت|assignment|sheet)/i.test(text);
    const eventType: "EXAM" | "QUIZ" | "ASSIGNMENT" = isQuiz
        ? "QUIZ"
        : isAssignment
        ? "ASSIGNMENT"
        : "EXAM";

    const eventDate = parsed?.date || getTomorrowDateStr();
    const cleanTitle =
        parsed?.task?.replace(/^(?:مراجعة|مذاكرة)\s+/i, "").trim() || text.trim().slice(0, 80);

    await addAcademicEvent({
        event_type: eventType,
        title: cleanTitle,
        event_date: eventDate,
        original_message: text
    }).catch((err) => console.error("[Router] addAcademicEvent error:", err));

    const reminderReply = await handleReminderAction(userId, {
        task: parsed?.task?.startsWith("مراجعة")
            ? parsed.task
            : `مراجعة واستعداد لـ: ${cleanTitle}`,
        date: eventDate,
        time: parsed?.time || "09:00",
        action: "CREATE",
        category: "COLLEGE_STUDY",
        priority: "Critical",
        course_keyword: parsed?.course_keyword || null
    });

    return `🎓 تم تسجيل **${cleanTitle}** في الأحداث الأكاديمية (${formatDateToArabicFriendly(eventDate)}) وعملتلك تذكير تلقائي:\n\n${reminderReply}`;
}

// ==========================================
// Core Text Intent Processor
// ==========================================

export async function processTextIntent(ctx: any, text: string, userId: string) {
    if (!isAuthorizedAdmin(userId)) {
        return ctx.reply(
            "عذراً، هذا البوت مبرمج ليكون المساعد الشخصي لدكتور ماركو فقط ولا يمكن للآخرين استخدامه."
        );
    }

    const cleanText = text?.trim();
    if (!cleanText) return;

    let intent = detectDeterministicIntent(cleanText);

    if (!intent) {
        const aiIntent = await analyzeIntent(cleanText);
        intent = aiIntent.intent;

        if (
            EXPENSE_SIGNAL_REGEX.test(cleanText) &&
            (intent === "CREATE_REMINDER" || intent === "ACADEMIC_EVENT")
        ) {
            intent = "COMPOUND_EXPENSE_AND_REMINDER";
        }
    }

    // 1. Medical Emergency
    if (intent === "MEDICAL_EMERGENCY") {
        return ctx.reply("🚨 هذه حالة طوارئ! يرجى التوجه لأقرب مستشفى أو الاتصال بالطبيب فوراً.");
    }

    // 2. Expense Summary Query ("صرفت كام النهارده / الشهر ده؟")
    if (intent === "EXPENSE_SUMMARY") {
        await ctx.replyWithChatAction("typing").catch(() => {});
        const isToday = /(?:النهارده|اليوم)/i.test(cleanText);
        const isWeek = /(?:الاسبوع|الأسبوع)/i.test(cleanText);
        const period = isToday ? "today" : isWeek ? "week" : "month";

        const summary = await getExpensesSummary(period, userId);
        return ctx.reply(summary.formattedSummary, { parse_mode: "Markdown" });
    }

    // 3. Compound Message (Expense + Reminder / Academic Event in one message)
    if (intent === "COMPOUND_EXPENSE_AND_REMINDER") {
        await ctx.replyWithChatAction("typing").catch(() => {});

        const [expenseRes, reminderReply] = await Promise.all([
            executeExpenseFlow(cleanText, userId).catch(() => null),
            ACADEMIC_EVENT_REGEX.test(cleanText)
                ? executeAcademicEventFlow(cleanText, userId).catch(() => null)
                : executeReminderFlow(cleanText, userId, "CREATE").catch(() => null)
        ]);

        const combinedParts = [expenseRes?.replyText, reminderReply].filter(Boolean);
        if (combinedParts.length > 0) {
            return ctx.reply(combinedParts.join("\n\n"), {
                reply_markup: buildExpenseUndoKeyboard(expenseRes?.savedExpense?.id)
            });
        }
        intent = "EXPENSE";
    }

    // 4. Expense Flow (With [🗑️ مسح المصروف] interactive button)
    if (intent === "EXPENSE") {
        await ctx.replyWithChatAction("typing").catch(() => {});
        const expenseRes = await executeExpenseFlow(cleanText, userId);

        if (expenseRes) {
            return ctx.reply(expenseRes.replyText, {
                reply_markup: buildExpenseUndoKeyboard(expenseRes.savedExpense.id)
            });
        }
        return ctx.reply(
            "🤔 فهمت إنك صرفت مبلغ، بس مقدرتش ألقط الرقم بالظبط. دفعت كام وفي إيه؟"
        );
    }

    // 5. Article Summary
    if (intent === "ARTICLE_SUMMARY") {
        await ctx.replyWithChatAction("typing").catch(() => {});
        const { text: formattedSummary, articleId } = await processAndFormatArticle(
            userId,
            cleanText
        );

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

    // 6. College Schedule Flow
    if (intent === "COLLEGE_SCHEDULE") {
        await ctx.replyWithChatAction("typing").catch(() => {});
        const schedule = await parseCollegeSchedule(cleanText);
        if (schedule && schedule.sessions && schedule.sessions.length > 0) {
            const result = await diffAndApplySchedule(userId, schedule.sessions as any[]);
            return ctx.reply(
                `✅ تم تحديث جدول الكلية!\n➕ أُضيف: ${result.added} مواعيد\n➖ حُذف: ${result.removed} مواعيد ملغاة`
            );
        }
        return ctx.reply(
            "❌ مقدرتش أطلع المواعيد من النص ده. اتأكد إن الجدول فيه اسم المادة واليوم والوقت."
        );
    }

    // 7. Proactive Academic Event (Exam / Quiz / Assignment)
    if (intent === "ACADEMIC_EVENT") {
        await ctx.replyWithChatAction("typing").catch(() => {});
        const academicReply = await executeAcademicEventFlow(cleanText, userId);
        return ctx.reply(academicReply);
    }

    // 8. Tasks & Reminders (CREATE / RESCHEDULE / CANCEL)
    if (
        intent === "CREATE_REMINDER" ||
        intent === "RESCHEDULE_TASK" ||
        intent === "CANCEL_TASK"
    ) {
        await ctx.replyWithChatAction("typing").catch(() => {});

        const forcedAction =
            intent === "CANCEL_TASK"
                ? "CANCEL"
                : intent === "RESCHEDULE_TASK"
                ? "RESCHEDULE"
                : undefined;

        const reply = await executeReminderFlow(cleanText, userId, forcedAction);
        if (reply) {
            return ctx.reply(reply);
        }
        return ctx.reply(
            "❌ مقدرتش أحدد تفاصيل التذكير بالظبط. قولي مثلاً: «فكرني بمراجعة الـ anatomy بكره الساعة 9 الصبح»."
        );
    }

    // 9. Statistics & Today's Tasks ("مهامي إيه النهارده")
    if (intent === "STATISTICS") {
        await ctx.replyWithChatAction("typing").catch(() => {});

        const todayStr = getCurrentDateStr();
        const [tasks, xp] = await Promise.all([
            getTodaysTasks(userId, todayStr),
            getTotalXp(userId)
        ]);

        const statsData = {
            today_tasks: tasks.map((t: any) => ({
                id: t.id,
                title: t.title,
                status: t.status,
                time: t.time || null
            })),
            total_xp: xp
        };

        const reply = await generateStatsReply(cleanText, statsData);
        return ctx.reply(reply);
    }

    // 10. Complex Analysis
    if (intent === "COMPLEX_ANALYSIS") {
        await ctx.replyWithChatAction("typing").catch(() => {});
        try {
            const history = await getChatContext(userId, 8);
            const proReply = await chatProGemini(cleanText, history);

            await Promise.all([
                addChatContext(userId, "user", cleanText),
                addChatContext(userId, "model", proReply)
            ]);

            return ctx.reply(proReply);
        } catch (error) {
            console.error("[Router] Complex Analysis fallback triggered:", error);
            const history = await getChatContext(userId, 8);
            const fallbackReply = await chatGemini(cleanText, history);

            await Promise.all([
                addChatContext(userId, "user", cleanText),
                addChatContext(userId, "model", fallbackReply)
            ]);

            return ctx.reply(fallbackReply);
        }
    }

    // 11. General Egyptian Chat
    await ctx.replyWithChatAction("typing").catch(() => {});
    const history = await getChatContext(userId, 8);
    const reply = await chatGemini(cleanText, history);

    await Promise.all([
        addChatContext(userId, "user", cleanText),
        addChatContext(userId, "model", reply)
    ]);

    return ctx.reply(reply);
}

// ==========================================
// Bot Middleware & Message Handlers Setup
// ==========================================

export function setupMessageHandlers(bot: Bot) {
    // 1. Unified Central Security Middleware
    bot.use(async (ctx, next) => {
        const userId = ctx.from?.id ? String(ctx.from.id) : null;
        if (!userId || !isAuthorizedAdmin(userId)) {
            if (ctx.message || ctx.callbackQuery) {
                await ctx
                    .reply(
                        "عذراً، هذا البوت مبرمج ليكون المساعد الشخصي لدكتور ماركو فقط ولا يمكن للآخرين استخدامه."
                    )
                    .catch(() => {});
            }
            return;
        }
        await next();
    });

    // 2. Callback Handler for Expense Undo Button ([🗑️ مسح المصروف])
    bot.callbackQuery(/^delexp_(.+)$/, async (ctx) => {
        const userId = String(ctx.from?.id || "");
        const expenseId = ctx.match[1];

        try {
            const deleted = await deleteExpenseById(expenseId, userId);
            await ctx
                .editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
                .catch(() => {});

            if (deleted) {
                await ctx
                    .answerCallbackQuery({ text: "🗑️ تم مسح المصروف بنجاح." })
                    .catch(() => {});
                await ctx
                    .editMessageText(
                        `🗑️ ~~تم مسح المصروف: ${deleted.amount} ${deleted.currency || "EGP"} - ${deleted.category}~~`,
                        { parse_mode: "Markdown" }
                    )
                    .catch(() => {});
            } else {
                await ctx
                    .answerCallbackQuery({ text: "المصروف ده ممسوح بالفعل." })
                    .catch(() => {});
            }
        } catch (err) {
            console.error("[Router] delexp callback error:", err);
            await ctx
                .answerCallbackQuery({ text: "⚠️ تعذر مسح المصروف، جرب تاني." })
                .catch(() => {});
        }
    });

    // 3. Text Messages Handler
    bot.on("message:text", async (ctx) => {
        await ctx.replyWithChatAction("typing").catch(() => {});
        await processTextIntent(ctx, ctx.message.text, String(ctx.from?.id));
    });

    // 4. Voice Messages Handler
    bot.on("message:voice", async (ctx) => {
        try {
            await ctx.replyWithChatAction("typing").catch(() => {});

            const voice = ctx.msg.voice;
            if (voice.duration > 120) {
                return await ctx.reply(
                    "معلش يا دكتور، الفويس طويل شوية (أقصى حاجة دقيقتين عشان أرد عليك بسرعة)."
                );
            }

            const file = await ctx.getFile();
            if (!file.file_path) throw new Error("Voice file_path missing");

            const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error("Failed to download voice from Telegram");

            const arrayBuffer = await response.arrayBuffer();
            const audioBase64String = Buffer.from(arrayBuffer).toString("base64");

            const transcribedText = await transcribeAudio(audioBase64String, "audio/ogg");
            if (!transcribedText || !transcribedText.trim()) {
                return await ctx.reply("❌ مش قادر أفهم الصوت، ممكن تكتب؟");
            }

            await processTextIntent(ctx, transcribedText, String(ctx.from?.id));
        } catch (error) {
            console.error("[Router] Voice handler error:", error);
            return await ctx.reply("❌ مش قادر أفهم الصوت، ممكن تكتب؟");
        }
    });

    // 5. Photo / Receipt Image Handler (Includes caption context & [🗑️ مسح المصروف] button)
    bot.on("message:photo", async (ctx) => {
        try {
            await ctx.replyWithChatAction("typing").catch(() => {});
            const userId = String(ctx.from?.id);
            const caption = ctx.message.caption?.trim() || "";

            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const file = await ctx.api.getFile(photo.file_id);
            if (!file.file_path) throw new Error("Photo file_path missing");

            const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error("Failed to download photo from Telegram");

            const arrayBuffer = await response.arrayBuffer();
            const imageBase64String = Buffer.from(arrayBuffer).toString("base64");

            const extractedText = await processReceiptImage(imageBase64String, "image/jpeg");

            const combinedExpenseInput = caption
                ? `وصف المستخدم للصورة: "${caption}"\nتفاصيل الفاتورة المستخرجة: ${extractedText}`
                : extractedText;

            const expenseDetails = await parseExpense(combinedExpenseInput);

            if (expenseDetails && expenseDetails.amount) {
                const savedExpense = await addExpense({
                    telegram_id: userId,
                    amount: expenseDetails.amount,
                    currency: expenseDetails.currency || "EGP",
                    category: expenseDetails.category || "عام",
                    description: expenseDetails.description?.trim() || caption || null,
                    merchant: (expenseDetails as any).merchant || null,
                    payment_method: (expenseDetails as any).payment_method || null,
                    expense_date: (expenseDetails as any).expense_date || getCurrentDateStr()
                });

                return ctx.reply(formatBriefExpenseReply(savedExpense), {
                    reply_markup: buildExpenseUndoKeyboard(savedExpense.id)
                });
            } else {
                return ctx.reply(
                    `🤔 قريت الصورة بس مقدرتش أحدد المبلغ بالظبط:\n${extractedText}\n\nقولي دفعت كام وفي إيه عشان أسجلها؟`
                );
            }
        } catch (error) {
            console.error("[Router] Photo handler error:", error);
            return ctx.reply(
                "❌ مقدرتش أقرأ صورة الفاتورة، ممكن تصورها أوضح أو تكتبلي دفعت كام؟"
            );
        }
    });
}