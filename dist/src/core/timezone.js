"use strict";
// src/core/timezone.ts
// Timezone Configurations — Africa/Cairo is the single source of truth for Dr. Marko's Bot
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TIMEZONE = void 0;
exports.getCairoParts = getCairoParts;
exports.getCurrentTime = getCurrentTime;
exports.getCurrentDateStr = getCurrentDateStr;
exports.getCurrentTimeStr = getCurrentTimeStr;
exports.getCurrentTimestampStr = getCurrentTimestampStr;
exports.addDaysToCairoDate = addDaysToCairoDate;
exports.getTomorrowDateStr = getTomorrowDateStr;
exports.getDayAfterTomorrowDateStr = getDayAfterTomorrowDateStr;
exports.getCairoDayOfWeek = getCairoDayOfWeek;
exports.getCairoDayNameAr = getCairoDayNameAr;
exports.getCairoDayNameEn = getCairoDayNameEn;
exports.getCairoIsoOffset = getCairoIsoOffset;
exports.normalizeTimeStr = normalizeTimeStr;
exports.cairoDateTimeToUtcIso = cairoDateTimeToUtcIso;
exports.formatTimeToArabic12h = formatTimeToArabic12h;
exports.formatDateToArabicFriendly = formatDateToArabicFriendly;
exports.getCairoContextHeader = getCairoContextHeader;
exports.DEFAULT_TIMEZONE = "Africa/Cairo";
const ARABIC_DAYS = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت"
];
const ENGLISH_DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
];
/**
 * Extracts exact date/time components in Africa/Cairo timezone
 * avoiding Node.js 24:00:00 midnight quirks and UTC drift.
 */
function getCairoParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: exports.DEFAULT_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
        hourCycle: "h23" // Strict 00-23, never 24
    });
    const parts = formatter.formatToParts(date);
    const map = {};
    for (const part of parts) {
        if (part.type !== "literal") {
            map[part.type] = part.value;
        }
    }
    const rawHour = map.hour === "24" ? "00" : (map.hour || "00");
    return {
        year: map.year || "2026",
        month: map.month || "01",
        day: map.day || "01",
        hour: rawHour.padStart(2, "0"),
        minute: (map.minute || "00").padStart(2, "0"),
        second: (map.second || "00").padStart(2, "0"),
        weekdayShort: map.weekday || "Sun"
    };
}
function getCurrentTime() {
    return new Date();
}
/**
 * Returns YYYY-MM-DD in Africa/Cairo timezone
 */
function getCurrentDateStr(date = new Date()) {
    const { year, month, day } = getCairoParts(date);
    return `${year}-${month}-${day}`;
}
/**
 * Returns HH:MM:SS in Africa/Cairo timezone (strictly 00:00:00 to 23:59:59)
 */
function getCurrentTimeStr(date = new Date()) {
    const { hour, minute, second } = getCairoParts(date);
    return `${hour}:${minute}:${second}`;
}
/**
 * Returns human-readable timestamp in Africa/Cairo
 */
function getCurrentTimestampStr(date = new Date()) {
    return `${getCurrentDateStr(date)} ${getCurrentTimeStr(date)}`;
}
/**
 * Adds N days to a YYYY-MM-DD date string safely in Cairo calendar days
 */
function addDaysToCairoDate(daysToAdd, baseDateStr) {
    const base = baseDateStr || getCurrentDateStr();
    const [y, m, d] = base.split("-").map(Number);
    // Use noon UTC to avoid any DST boundary jump when adding calendar days
    const utcNoon = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + daysToAdd, 12, 0, 0));
    return getCurrentDateStr(utcNoon);
}
function getTomorrowDateStr() {
    return addDaysToCairoDate(1);
}
function getDayAfterTomorrowDateStr() {
    return addDaysToCairoDate(2);
}
/**
 * Returns day of week in Africa/Cairo: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
function getCairoDayOfWeek(date = new Date()) {
    const { weekdayShort } = getCairoParts(date);
    const map = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6
    };
    return map[weekdayShort] ?? 0;
}
function getCairoDayNameAr(date = new Date()) {
    return ARABIC_DAYS[getCairoDayOfWeek(date)] || "";
}
function getCairoDayNameEn(date = new Date()) {
    return ENGLISH_DAYS[getCairoDayOfWeek(date)] || "";
}
/**
 * Returns the dynamic GMT offset for Africa/Cairo on a given YYYY-MM-DD date
 * Automatically handles Egypt DST (+03:00 in summer, +02:00 in winter).
 */
function getCairoIsoOffset(dateStr) {
    try {
        const targetDate = dateStr || getCurrentDateStr();
        const probe = new Date(`${targetDate}T12:00:00Z`);
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: exports.DEFAULT_TIMEZONE,
            timeZoneName: "longOffset"
        }).formatToParts(probe);
        const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
        const match = tzName.match(/GMT([+-]\d{2}:\d{2})/);
        return match ? match[1] : "+02:00";
    }
    catch {
        return "+02:00";
    }
}
/**
 * Normalizes various time inputs ("9:00", "9:30 PM", "24:00", "09:00:00")
 * into strict 24-hour "HH:MM:SS" for PostgreSQL TIME columns.
 */
function normalizeTimeStr(rawTime) {
    if (!rawTime)
        return null;
    const trimmed = rawTime.trim();
    if (!trimmed)
        return null;
    // Check for 12-hour indicators (ص / م / am / pm)
    const isPM = /(?:pm|م|مساء|بالليل|العصر|المغرب|العشاء)/i.test(trimmed);
    const isAM = /(?:am|ص|صباح|الفجر|الصبح)/i.test(trimmed);
    const timeMatch = trimmed.match(/(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?/);
    if (!timeMatch)
        return null;
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] || "0", 10);
    const seconds = parseInt(timeMatch[3] || "0", 10);
    if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) {
        return null;
    }
    if (isPM && hours < 12) {
        hours += 12;
    }
    else if (isAM && hours === 12) {
        hours = 0;
    }
    else if (hours === 24) {
        hours = 0;
    }
    if (hours < 0 || hours > 23)
        return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
/**
 * Converts a Cairo date ("YYYY-MM-DD") and time ("HH:MM" or "HH:MM:SS")
 * into an exact UTC ISO string for storing in `notifications.scheduled_at`.
 */
function cairoDateTimeToUtcIso(dateStr, timeStr) {
    const cleanDate = dateStr.trim();
    const normalizedTime = normalizeTimeStr(timeStr) || "09:00:00";
    const offset = getCairoIsoOffset(cleanDate);
    const isoWithOffset = `${cleanDate}T${normalizedTime}${offset}`;
    const parsed = new Date(isoWithOffset);
    if (isNaN(parsed.getTime())) {
        // Fallback: 1 hour from now
        return new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }
    return parsed.toISOString();
}
/**
 * Formats a 24h time string ("09:00:00" or "21:30") into Egyptian Arabic 12h format:
 * e.g., "9:00 ص" or "9:30 م"
 */
function formatTimeToArabic12h(timeStr) {
    const normalized = normalizeTimeStr(timeStr);
    if (!normalized)
        return "";
    const [hStr, mStr] = normalized.split(":");
    let hour = parseInt(hStr, 10);
    const suffix = hour >= 12 ? "م" : "ص";
    if (hour === 0)
        hour = 12;
    else if (hour > 12)
        hour -= 12;
    return `${hour}:${mStr} ${suffix}`;
}
/**
 * Formats a YYYY-MM-DD date string into friendly Egyptian Arabic:
 * "النهارده", "غداً", "بعد بكره", or "الخميس 2026-10-29"
 */
function formatDateToArabicFriendly(dateStr) {
    if (!dateStr)
        return "النهارده";
    const clean = dateStr.trim();
    const today = getCurrentDateStr();
    const tomorrow = getTomorrowDateStr();
    const dayAfter = getDayAfterTomorrowDateStr();
    if (clean === today)
        return "النهارده";
    if (clean === tomorrow)
        return "غداً";
    if (clean === dayAfter)
        return "بعد بكره";
    const [y, m, d] = clean.split("-").map(Number);
    if (y && m && d) {
        const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        const dayAr = getCairoDayNameAr(utcNoon);
        return `${dayAr} ${clean}`;
    }
    return clean;
}
/**
 * Builds a complete temporal reference block for AI prompts (Maestro & Gemini)
 * so relative dates like "بكره", "بعد بكره", "يوم الخميس" are resolved with 100% accuracy.
 */
function getCairoContextHeader() {
    const now = new Date();
    const todayStr = getCurrentDateStr(now);
    const timeStr = formatTimeToArabic12h(getCurrentTimeStr(now));
    const dayAr = getCairoDayNameAr(now);
    const tomorrowStr = getTomorrowDateStr();
    const dayAfterStr = getDayAfterTomorrowDateStr();
    // Build upcoming 7 days map for accurate day-name resolution
    const upcomingDays = [];
    for (let i = 1; i <= 7; i++) {
        const dStr = addDaysToCairoDate(i, todayStr);
        const [y, m, d] = dStr.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        upcomingDays.push(`${getCairoDayNameAr(dt)}=${dStr}`);
    }
    return [
        `[توقيت القاهرة الآن: ${dayAr} ${todayStr} | الساعة: ${timeStr}]`,
        `[المرجع الزمني: النهارده=${todayStr} | بكره/غداً=${tomorrowStr} | بعد بكره=${dayAfterStr}]`,
        `[خريطة الأسبوع القادم: ${upcomingDays.join(" ، ")}]`
    ].join("\n");
}
