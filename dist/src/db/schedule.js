"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandDentalCourseTerms = expandDentalCourseTerms;
exports.diffAndApplySchedule = diffAndApplySchedule;
exports.getScheduleForDay = getScheduleForDay;
exports.findNextCourseSession = findNextCourseSession;
exports.addAcademicEvent = addAcademicEvent;
exports.getUpcomingAcademicEvents = getUpcomingAcademicEvents;
exports.markAcademicEventCompleted = markAcademicEventCompleted;
const supabase_1 = require("../supabase");
const config_1 = require("../core/config");
const errors_1 = require("../core/errors");
const timezone_1 = require("../core/timezone");
// ============================================================================
// 1. Dental Course Aliases Dictionary (Egyptian Arabic <-> English)
// ============================================================================
const DENTAL_COURSE_ALIASES = {
    operative: [
        "operative",
        "oper",
        "أوبرا",
        "اوبرا",
        "أوبرتيف",
        "اوبرتيف",
        "أوبرتف",
        "اوبرتف",
        "حشو",
        "تحفظي",
    ],
    endodontics: [
        "endo",
        "endodontic",
        "endodontics",
        "إندو",
        "اندو",
        "علاج جذور",
        "جذور",
        "عصب",
    ],
    pathology: [
        "patho",
        "pathology",
        "oral pathology",
        "باثو",
        "باثولوجي",
        "أمراض فم",
        "امراض فم",
    ],
    pharmacology: [
        "pharma",
        "pharmacology",
        "فارما",
        "فارماكولوجي",
        "أدوية",
        "ادوية",
    ],
    fixed_prosthodontics: [
        "fixed",
        "crown",
        "bridge",
        "فيكسد",
        "فكسد",
        "كراون",
        "تركيبات ثابتة",
        "ثابتة",
    ],
    removable_prosthodontics: [
        "removable",
        "prostho",
        "prosthodontics",
        "complete denture",
        "partial denture",
        "بروسثو",
        "بروستو",
        "ريمو",
        "تركيبات متحركة",
        "تركيبات",
        "طقم",
    ],
    periodontology: [
        "perio",
        "periodontology",
        "periodontics",
        "بيريو",
        "بريو",
        "لثة",
        "طب اللثة",
    ],
    oral_surgery: [
        "surgery",
        "oral surgery",
        "exodontia",
        "جراحة",
        "جراحه",
        "خلع",
        "تخدير",
    ],
    radiology: [
        "radio",
        "radiology",
        "x-ray",
        "xray",
        "أشعة",
        "اشعة",
        "اشعه",
        "راديو",
    ],
    biomaterials: [
        "biomaterials",
        "dental materials",
        "materials",
        "ماتريال",
        "بايوماتريال",
        "خواص مواد",
        "مواد",
    ],
    pedodontics: [
        "pedo",
        "pedodontics",
        "pediatric",
        "بيدو",
        "أطفال",
        "اطفال",
        "أسنان أطفال",
    ],
    orthodontics: [
        "ortho",
        "orthodontics",
        "أورثو",
        "اورثو",
        "تقويم",
    ],
    oral_medicine: [
        "oral medicine",
        "diagnosis",
        "أورال ميديسن",
        "ميديسن",
        "تشخيص",
        "طب فم",
    ],
};
/**
 * Expands a user's course keyword (e.g., "أوبرا" or "إندو") into all matching
 * canonical search terms to match English or Arabic `course_name` in DB.
 */
function expandDentalCourseTerms(rawKeyword) {
    const clean = rawKeyword.trim().toLowerCase();
    if (!clean)
        return [];
    const matchedTerms = new Set([clean]);
    for (const [canonicalKey, aliases] of Object.entries(DENTAL_COURSE_ALIASES)) {
        const hit = aliases.some((alias) => clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean));
        if (hit) {
            matchedTerms.add(canonicalKey.replace("_", " "));
            for (const alias of aliases) {
                matchedTerms.add(alias.toLowerCase());
            }
        }
    }
    return Array.from(matchedTerms);
}
/**
 * Subtracts a given number of minutes (default 60) from an HH:MM:SS time string.
 */
function subtractMinutesFromTimeStr(timeStr, minutesToSubtract = 60) {
    const normalized = (0, timezone_1.normalizeTimeStr)(timeStr) ?? "09:00:00";
    const [hh, mm, ss] = normalized.split(":").map((part) => parseInt(part, 10));
    const totalMinutes = Math.max(0, hh * 60 + mm - minutesToSubtract);
    const outHours = Math.floor(totalMinutes / 60);
    const outMinutes = totalMinutes % 60;
    return `${String(outHours).padStart(2, "0")}:${String(outMinutes).padStart(2, "0")}:${String(ss || 0).padStart(2, "0")}`;
}
// ============================================================================
// 2. College Schedule Diffing, Retrieval & Smart Session Lookup
// ============================================================================
async function diffAndApplySchedule(telegramId = config_1.config.ADMIN_ID, newSessions) {
    try {
        // 1. Filter out B-block events in memory (event_type is NOT stored in DB)
        const validSessions = newSessions.filter((s) => s.event_type !== "B-block");
        // 2. Fetch existing active sessions for Dr. Marko
        const { data: existingData, error: fetchErr } = await supabase_1.supabase
            .from("college_schedule")
            .select("*")
            .eq("telegram_id", telegramId)
            .eq("status", "active");
        if (fetchErr) {
            throw new errors_1.DatabaseError("Failed to fetch existing college schedule", fetchErr);
        }
        const existing = (existingData || []);
        // Normalized identity key (ignores case/whitespace & enforces HH:MM:SS)
        const getIdentity = (s) => {
            const normCourse = s.course_name.trim().toLowerCase();
            const normStart = (0, timezone_1.normalizeTimeStr)(s.start_time) ?? s.start_time.trim();
            const normType = (s.session_type || "Theoretical").trim().toLowerCase();
            return `${normCourse}|${s.day_of_week}|${normStart}|${normType}`;
        };
        const existingMap = new Map();
        for (const s of existing) {
            existingMap.set(getIdentity(s), s);
        }
        const newMap = new Map();
        for (const s of validSessions) {
            newMap.set(getIdentity(s), s);
        }
        const toInsert = [];
        const toDeactivateIds = [];
        const deactivatedCourseNames = [];
        // Find removed sessions
        for (const [identity, existingSession] of existingMap.entries()) {
            if (!newMap.has(identity) && existingSession.id) {
                toDeactivateIds.push(existingSession.id);
                deactivatedCourseNames.push(existingSession.course_name);
            }
        }
        // Find newly added sessions (strictly using CollegeScheduleRow columns)
        for (const [identity, s] of newMap.entries()) {
            if (!existingMap.has(identity)) {
                const normStart = (0, timezone_1.normalizeTimeStr)(s.start_time) ?? "09:00:00";
                const normEnd = (0, timezone_1.normalizeTimeStr)(s.end_time) ?? "11:00:00";
                toInsert.push({
                    telegram_id: telegramId,
                    course_name: s.course_name.trim(),
                    day_of_week: s.day_of_week,
                    start_time: normStart,
                    end_time: normEnd,
                    session_type: s.session_type || "Theoretical",
                    location: s.location ? s.location.trim() : null,
                    status: "active",
                });
            }
        }
        // Deactivate removed sessions and safely cancel dependent preparation tasks
        if (toDeactivateIds.length > 0) {
            const { error: updErr } = await supabase_1.supabase
                .from("college_schedule")
                .update({ status: "inactive" })
                .in("id", toDeactivateIds);
            if (updErr) {
                throw new errors_1.DatabaseError("Failed to deactivate old schedule sessions", updErr);
            }
            // Cancel pending tasks with source = 'SCHEDULE_PREPARE' matching removed courses
            const { data: prepTasks } = await supabase_1.supabase
                .from("tasks")
                .select("id, title")
                .eq("telegram_id", telegramId)
                .eq("status", "pending")
                .eq("source", "SCHEDULE_PREPARE");
            if (prepTasks && prepTasks.length > 0) {
                const lowerRemovedCourses = deactivatedCourseNames.map((c) => c.toLowerCase());
                const taskIdsToCancel = prepTasks
                    .filter((t) => lowerRemovedCourses.some((course) => t.title.toLowerCase().includes(course)))
                    .map((t) => t.id);
                if (taskIdsToCancel.length > 0) {
                    const nowIso = new Date().toISOString();
                    await supabase_1.supabase
                        .from("tasks")
                        .update({ status: "cancelled", cancelled_at: nowIso })
                        .in("id", taskIdsToCancel);
                    await supabase_1.supabase
                        .from("notifications")
                        .update({ status: "CANCELLED" })
                        .eq("status", "PENDING")
                        .in("task_id", taskIdsToCancel);
                }
            }
        }
        // Insert new sessions
        if (toInsert.length > 0) {
            const { error: insErr } = await supabase_1.supabase
                .from("college_schedule")
                .insert(toInsert);
            if (insErr) {
                throw new errors_1.DatabaseError("Failed to insert new schedule sessions", insErr);
            }
        }
        return { added: toInsert.length, removed: toDeactivateIds.length };
    }
    catch (error) {
        console.error("[schedule_db] diffAndApplySchedule Error:", error);
        throw error;
    }
}
async function getScheduleForDay(telegramId = config_1.config.ADMIN_ID, dayOfWeek = (0, timezone_1.getCairoDayOfWeek)()) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("college_schedule")
            .select("*")
            .eq("telegram_id", telegramId)
            .eq("day_of_week", dayOfWeek)
            .eq("status", "active")
            .order("start_time", { ascending: true });
        if (error) {
            throw new errors_1.DatabaseError("Failed to fetch daily schedule", error);
        }
        return (data || []);
    }
    catch (error) {
        console.error("[schedule_db] getScheduleForDay Error:", error);
        return [];
    }
}
/**
 * Finds the nearest upcoming lecture or practical section for a given course keyword
 * (supports Egyptian Arabic aliases like "أوبرا", "إندو", "باثو", "فارما", "فيكسد", "بيريو").
 * Automatically calculates the exact Cairo date and a suggested reminder time 1 hour prior.
 */
async function findNextCourseSession(courseKeyword, telegramId = config_1.config.ADMIN_ID, preferredSessionType) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("college_schedule")
            .select("*")
            .eq("telegram_id", telegramId)
            .eq("status", "active");
        if (error) {
            throw new errors_1.DatabaseError("Failed to query schedule for course lookup", error);
        }
        const activeSessions = (data || []);
        if (activeSessions.length === 0) {
            return null;
        }
        // Detect session type hint from Arabic keyword if not explicitly passed
        let effectiveType = preferredSessionType;
        if (!effectiveType) {
            if (/سكشن|عملي|عيادة|عياده|معمل|section|lab|clinic/i.test(courseKeyword)) {
                effectiveType = "Practical";
            }
            else if (/محاضرة|محاضره|نظري|lecture/i.test(courseKeyword)) {
                effectiveType = "Theoretical";
            }
        }
        // Clean keyword from generic session words before alias expansion
        const strippedKeyword = courseKeyword
            .replace(/سكشن|محاضرة|محاضره|عملي|نظري|عيادة|عياده|معمل|الـ|ال|قبل|بعد|section|lecture/gi, " ")
            .trim();
        const searchTerms = expandDentalCourseTerms(strippedKeyword || courseKeyword);
        let matchingSessions = activeSessions.filter((s) => {
            const lowerCourse = s.course_name.toLowerCase();
            return searchTerms.some((term) => term.length >= 2 && (lowerCourse.includes(term) || term.includes(lowerCourse)));
        });
        if (matchingSessions.length === 0) {
            return null;
        }
        // Filter by preferred session type if matched, otherwise keep all matching sessions for that course
        if (effectiveType) {
            const typeFiltered = matchingSessions.filter((s) => s.session_type.toLowerCase() === effectiveType.toLowerCase());
            if (typeFiltered.length > 0) {
                matchingSessions = typeFiltered;
            }
        }
        const currentDow = (0, timezone_1.getCairoDayOfWeek)();
        const currentTime = (0, timezone_1.getCurrentTimeStr)();
        const todayStr = (0, timezone_1.getCurrentDateStr)();
        let bestCandidate = null;
        for (const session of matchingSessions) {
            const sessionStart = (0, timezone_1.normalizeTimeStr)(session.start_time) ?? "09:00:00";
            let daysUntil = (session.day_of_week - currentDow + 7) % 7;
            // If it's today but the session has already started/passed, schedule for next week (+7 days)
            if (daysUntil === 0 && sessionStart <= currentTime) {
                daysUntil = 7;
            }
            const nextDateStr = (0, timezone_1.addDaysToCairoDate)(daysUntil, todayStr);
            const suggestedReminderTime = subtractMinutesFromTimeStr(sessionStart, 60);
            if (!bestCandidate ||
                daysUntil < bestCandidate.daysUntil ||
                (daysUntil === bestCandidate.daysUntil &&
                    sessionStart < bestCandidate.sessionStartTime)) {
                bestCandidate = {
                    session,
                    nextDateStr,
                    daysUntil,
                    sessionStartTime: sessionStart,
                    suggestedReminderTime,
                };
            }
        }
        return bestCandidate;
    }
    catch (error) {
        console.error("[schedule_db] findNextCourseSession Error:", error);
        return null;
    }
}
// ============================================================================
// 3. Academic Events Management (academic_events - NO telegram_id column)
// ============================================================================
/**
 * Inserts a new academic event (EXAM, QUIZ, ASSIGNMENT, LECTURE_UPDATE) into `academic_events`.
 * Prevents duplicate active entries for the same event title and date.
 */
async function addAcademicEvent(input) {
    try {
        const cleanTitle = input.title.trim();
        if (!cleanTitle)
            return null;
        // Normalize event_date if provided as YYYY-MM-DD
        let finalEventDate = input.event_date ?? null;
        if (finalEventDate && /^\d{4}-\d{2}-\d{2}$/.test(finalEventDate.trim())) {
            finalEventDate = (0, timezone_1.cairoDateTimeToUtcIso)(finalEventDate.trim(), "09:00:00");
        }
        // Anti-duplicate check on active events with same event_type and title
        const { data: existingEvents } = await supabase_1.supabase
            .from("academic_events")
            .select("*")
            .eq("event_type", input.event_type)
            .eq("is_completed", false)
            .ilike("title", cleanTitle);
        if (existingEvents && existingEvents.length > 0) {
            const targetDay = finalEventDate ? finalEventDate.slice(0, 10) : null;
            const duplicate = existingEvents.find((ev) => {
                const existingDay = ev.event_date ? String(ev.event_date).slice(0, 10) : null;
                return existingDay === targetDay;
            });
            if (duplicate) {
                return duplicate;
            }
        }
        const { data, error } = await supabase_1.supabase
            .from("academic_events")
            .insert({
            event_type: input.event_type,
            title: cleanTitle,
            event_date: finalEventDate,
            original_message: input.original_message ?? null,
            is_completed: input.is_completed ?? false,
        })
            .select("*")
            .single();
        if (error) {
            throw new errors_1.DatabaseError("Failed to insert academic event", error);
        }
        return data;
    }
    catch (error) {
        console.error("[schedule_db] addAcademicEvent Error:", error);
        return null;
    }
}
/**
 * Fetches upcoming uncompleted academic events within the next `days` days (default 3 days)
 * based on Cairo timezone boundaries.
 */
async function getUpcomingAcademicEvents(days = 3) {
    try {
        const todayCairo = (0, timezone_1.getCurrentDateStr)();
        const endCairoDate = (0, timezone_1.addDaysToCairoDate)(days, todayCairo);
        const startUtcIso = (0, timezone_1.cairoDateTimeToUtcIso)(todayCairo, "00:00:00");
        const endUtcIso = (0, timezone_1.cairoDateTimeToUtcIso)(endCairoDate, "23:59:59");
        const { data, error } = await supabase_1.supabase
            .from("academic_events")
            .select("*")
            .eq("is_completed", false)
            .gte("event_date", startUtcIso)
            .lte("event_date", endUtcIso)
            .order("event_date", { ascending: true });
        if (error) {
            throw new errors_1.DatabaseError("Failed to fetch upcoming academic events", error);
        }
        return (data || []);
    }
    catch (error) {
        console.error("[schedule_db] getUpcomingAcademicEvents Error:", error);
        return [];
    }
}
/**
 * Marks an academic event as completed (`is_completed = true`).
 */
async function markAcademicEventCompleted(eventId) {
    try {
        const { error } = await supabase_1.supabase
            .from("academic_events")
            .update({ is_completed: true })
            .eq("id", eventId);
        if (error) {
            throw new errors_1.DatabaseError("Failed to mark academic event as completed", error);
        }
        return true;
    }
    catch (error) {
        console.error("[schedule_db] markAcademicEventCompleted Error:", error);
        return false;
    }
}
