"use strict";
// api/cron.ts (cron_api.ts)
// Stage 8: Tri-Mode Cron Endpoint:
// 1. Every-Minute Real-Time Notifications (via cron-job.org)
// 2. Once-Daily 6:00 AM Cairo Morning Briefing + Interactive Academic Event Buttons
// 3. Once-Daily 10:00 PM Cairo Evening Wrap-Up (Pending Tasks Rollover Button + Tomorrow's Lab Coat/Practical Alert)
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const bot_1 = require("../src/bot");
const notifications_1 = require("../src/services/notifications");
const supabase_1 = require("../src/supabase");
const config_1 = require("../src/core/config");
const timezone_1 = require("../src/core/timezone");
function isCronAuthorized(req) {
    const secret = config_1.config.CRON_SECRET;
    if (!secret)
        return true;
    const authHeader = req.headers["authorization"] || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const customHeader = String(req.headers["x-cron-secret"] || "").trim();
    const querySecret = String(req.query?.secret || "").trim();
    if (req.headers["x-vercel-cron"] === "1")
        return true;
    return bearerToken === secret || customHeader === secret || querySecret === secret;
}
async function tryClaimMorningBriefingLock(todayStr) {
    try {
        const { data: existing, error: selectErr } = await supabase_1.supabase
            .from("api_usage")
            .select("usage_date, morning_briefing_sent")
            .eq("usage_date", todayStr)
            .maybeSingle();
        if (selectErr) {
            const { hour, minute } = (0, timezone_1.getCairoParts)();
            return Number(hour) === 6 && Number(minute) === 0;
        }
        if (existing?.morning_briefing_sent) {
            return false;
        }
        if (!existing) {
            const { error: insertErr } = await supabase_1.supabase.from("api_usage").insert([
                {
                    usage_date: todayStr,
                    pro_count: 0,
                    morning_briefing_sent: true
                }
            ]);
            return !insertErr;
        }
        else {
            const { error: updateErr } = await supabase_1.supabase
                .from("api_usage")
                .update({
                morning_briefing_sent: true,
                updated_at: new Date().toISOString()
            })
                .eq("usage_date", todayStr)
                .eq("morning_briefing_sent", false);
            return !updateErr;
        }
    }
    catch (e) {
        console.warn("[Cron] tryClaimMorningBriefingLock fallback:", e);
        return false;
    }
}
/**
 * Claims an atomic once-per-day lock for the 10:00 PM Cairo Evening Wrap-Up
 * using the `memories` table (or minute===0 fallback) so no schema migration is strictly required.
 */
async function tryClaimEveningWrapUpLock(adminId, todayStr) {
    try {
        const lockKey = `EVENING_WRAPUP_${todayStr}`;
        const { data: existing, error: selectErr } = await supabase_1.supabase
            .from("memories")
            .select("id")
            .eq("telegram_id", adminId)
            .eq("memory_type", lockKey)
            .maybeSingle();
        if (selectErr) {
            const { hour, minute } = (0, timezone_1.getCairoParts)();
            return Number(hour) === 22 && Number(minute) === 0;
        }
        if (existing)
            return false;
        const { error: insertErr } = await supabase_1.supabase.from("memories").insert([
            {
                telegram_id: adminId,
                memory_type: lockKey,
                memory_value: "SENT",
                source: "cron"
            }
        ]);
        return !insertErr;
    }
    catch {
        const { hour, minute } = (0, timezone_1.getCairoParts)();
        return Number(hour) === 22 && Number(minute) === 0;
    }
}
/**
 * Sends the 6:00 AM Cairo Morning Briefing + Interactive Buttons for Academic Events
 */
async function sendMorningBriefing(adminId, todayStr) {
    const threeDaysLaterStr = (0, timezone_1.addDaysToCairoDate)(3, todayStr);
    const dayOfWeek = (0, timezone_1.getCairoDayOfWeek)();
    const dayNameAr = (0, timezone_1.getCairoDayNameAr)();
    const [scheduleRes, tasksRes, eventsRes] = await Promise.all([
        supabase_1.supabase
            .from("college_schedule")
            .select("*")
            .eq("telegram_id", adminId)
            .eq("day_of_week", dayOfWeek)
            .eq("status", "active")
            .order("start_time", { ascending: true }),
        supabase_1.supabase
            .from("tasks")
            .select("*")
            .eq("telegram_id", adminId)
            .eq("due_date", todayStr)
            .in("status", ["pending", "rescheduled"])
            .order("time", { ascending: true, nullsFirst: false }),
        supabase_1.supabase
            .from("academic_events")
            .select("*")
            .eq("is_completed", false)
            .gte("event_date", todayStr)
            .lte("event_date", threeDaysLaterStr)
            .order("event_date", { ascending: true })
    ]);
    const schedule = scheduleRes.data || [];
    const tasks = tasksRes.data || [];
    const upcomingEvents = eventsRes.data || [];
    if (schedule.length === 0 && tasks.length === 0 && upcomingEvents.length === 0) {
        return false;
    }
    const lines = [
        `☀️ **صباح الخير يا دكتور ماركو! ملخص يومك (${dayNameAr} ${todayStr}):**`
    ];
    if (schedule.length > 0) {
        lines.push(`\n🏛️ **جدول الكلية النهارده:**`);
        for (const s of schedule) {
            const start = (0, timezone_1.formatTimeToArabic12h)(s.start_time);
            const end = (0, timezone_1.formatTimeToArabic12h)(s.end_time);
            const loc = s.location ? ` (${s.location})` : "";
            lines.push(`• ${s.course_name} — ${s.session_type} من ${start} لـ ${end}${loc}`);
        }
    }
    if (tasks.length > 0) {
        lines.push(`\n📌 **مهامك النهارده (${tasks.length}):**`);
        for (const t of tasks) {
            const timePart = t.time ? ` (${(0, timezone_1.formatTimeToArabic12h)(t.time)})` : "";
            lines.push(`• ${t.title}${timePart}`);
        }
    }
    const inlineKeyboard = [];
    if (upcomingEvents.length > 0) {
        lines.push(`\n🚨 **تنبيهات أكاديمية خلال الـ 3 أيام الجايين:**`);
        for (const ev of upcomingEvents) {
            const emoji = ev.event_type === "EXAM" ? "⚠️" : ev.event_type === "QUIZ" ? "📝" : "📅";
            const dateStr = String(ev.event_date).slice(0, 10);
            lines.push(`${emoji} **${ev.title}** — الميعاد: ${(0, timezone_1.formatDateToArabicFriendly)(dateStr)}`);
            const shortTitle = ev.title.length > 12 ? `${ev.title.substring(0, 12)}..` : ev.title;
            inlineKeyboard.push([
                {
                    text: `✅ خلصت: ${shortTitle}`,
                    callback_data: `done_ev_${ev.id}`
                },
                {
                    text: `⏰ مراجعة 8 م`,
                    callback_data: `rev_ev_${ev.id}`
                }
            ]);
        }
    }
    lines.push(`\nشد حيلك، يومك جميل وموفق إن شاء الله! 💪✨`);
    await bot_1.bot.api.sendMessage(adminId, lines.join("\n"), {
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined
    });
    return true;
}
/**
 * Sends the 10:00 PM Cairo Evening Wrap-Up:
 * - Alerts Dr. Marko if he has Practical/Clinical sections tomorrow morning (to pack lab coat & instruments)
 * - Offers a 1-click button (`[🔄 رحّل المهام المتبقية لبكره]`) if he has unfinished tasks today
 */
async function sendEveningWrapUp(adminId, todayStr) {
    const tomorrowDow = ((0, timezone_1.getCairoDayOfWeek)() + 1) % 7;
    const [pendingTasksRes, tomorrowScheduleRes] = await Promise.all([
        supabase_1.supabase
            .from("tasks")
            .select("id, title")
            .eq("telegram_id", adminId)
            .eq("due_date", todayStr)
            .in("status", ["pending", "rescheduled"]),
        supabase_1.supabase
            .from("college_schedule")
            .select("*")
            .eq("telegram_id", adminId)
            .eq("day_of_week", tomorrowDow)
            .eq("status", "active")
            .order("start_time", { ascending: true })
    ]);
    const pendingTasks = pendingTasksRes.data || [];
    const tomorrowSessions = tomorrowScheduleRes.data || [];
    const practicalSessions = tomorrowSessions.filter((s) => /(?:practical|section|clinic|lab|عملي|سكشن|عيادة)/i.test(`${s.session_type} ${s.course_name}`));
    if (pendingTasks.length === 0 && practicalSessions.length === 0) {
        return false;
    }
    const lines = [`🌙 **مساء الخير يا دكتور! تنبيه سريع قبل ما تنام:**`];
    if (practicalSessions.length > 0) {
        const courseNames = practicalSessions.map((s) => s.course_name).join(" ، ");
        lines.push(`\n🥼 **تنبيه سكاشن بكره:** عندك عملي (${courseNames}) — متنساش تحضّر البالطو والأدوات في الشنطة من دلوقتي!`);
    }
    const inlineKeyboard = [];
    if (pendingTasks.length > 0) {
        lines.push(`\n⏳ **فاضلك ${pendingTasks.length} مهام من النهارده لسه متعملتش:**`);
        for (const t of pendingTasks.slice(0, 5)) {
            lines.push(`• ${t.title}`);
        }
        inlineKeyboard.push([
            {
                text: "🔄 رحّل المهام المتبقية لبكره الصبح",
                callback_data: "rollover_all"
            }
        ]);
    }
    await bot_1.bot.api.sendMessage(adminId, lines.join("\n"), {
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined
    });
    return true;
}
async function handler(req, res) {
    if (!isCronAuthorized(req)) {
        return res.status(401).json({ status: "unauthorized" });
    }
    try {
        // 1. Always process real-time due notifications (every minute via cron-job.org)
        const notifStats = await (0, notifications_1.processDueNotifications)();
        const adminId = config_1.config.ADMIN_ID;
        const todayStr = (0, timezone_1.getCurrentDateStr)();
        const { hour } = (0, timezone_1.getCairoParts)();
        const cairoHour = parseInt(hour, 10);
        const forceMorning = req.query?.morning === "true";
        const forceEvening = req.query?.evening === "true";
        let morningBriefingSent = false;
        let eveningWrapUpSent = false;
        // 2. Morning Briefing (6:00 AM - 8:59 AM Cairo time, once daily)
        if (forceMorning || (cairoHour >= 6 && cairoHour <= 8)) {
            const locked = await tryClaimMorningBriefingLock(todayStr);
            if (locked) {
                morningBriefingSent = await sendMorningBriefing(adminId, todayStr);
            }
        }
        // 3. Evening Wrap-Up & Lab Coat Alert (10:00 PM Cairo time, once daily)
        if (forceEvening || cairoHour === 22) {
            const eveningLocked = await tryClaimEveningWrapUpLock(adminId, todayStr);
            if (eveningLocked) {
                eveningWrapUpSent = await sendEveningWrapUp(adminId, todayStr);
            }
        }
        return res.status(200).json({
            status: "cron_executed",
            cairo_date: todayStr,
            cairo_hour: cairoHour,
            notifications: notifStats,
            morning_briefing_sent: morningBriefingSent,
            evening_wrapup_sent: eveningWrapUpSent
        });
    }
    catch (e) {
        console.error("[Cron] Execution error:", e);
        return res.status(500).json({
            status: "error",
            message: e?.message || "Internal cron error"
        });
    }
}
