"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcademicEventSchema = exports.ExpenseSchema = exports.CollegeScheduleSchema = void 0;
exports.parseCollegeSchedule = parseCollegeSchedule;
exports.parseExpense = parseExpense;
exports.parseAcademicUpdate = parseAcademicUpdate;
const zod_1 = require("zod");
const errors_1 = require("../core/errors");
const timezone_1 = require("../core/timezone");
const gemini_1 = require("../gemini");
/**
 * Helper to strip markdown code fences (```json ... ```) from LLM output
 * before parsing with JSON.parse.
 */
function parseCleanJson(rawText) {
    const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    return JSON.parse(cleaned);
}
// ============================================================================
// 1. College Schedule Parser (VISION_AND_SCHEDULE)
// ============================================================================
const RawSessionSchema = zod_1.z.object({
    course_name: zod_1.z.string().min(1),
    day_of_week: zod_1.z
        .number()
        .int()
        .min(0)
        .max(6)
        .describe("0 for Sunday, 1 for Monday, up to 6 for Saturday"),
    start_time: zod_1.z.string().describe("HH:MM or HH:MM:SS in 24-hour format"),
    end_time: zod_1.z.string().describe("HH:MM or HH:MM:SS in 24-hour format"),
    session_type: zod_1.z
        .enum(["Theoretical", "Practical"])
        .catch("Theoretical")
        .describe("'Theoretical' or 'Practical'"),
    location: zod_1.z.string().nullable().optional(),
    event_type: zod_1.z
        .enum(["A3", "A-block", "B-block", "Unknown"])
        .catch("Unknown")
        .describe("Is this for A3 specifically, all of block A, all of block B, or Unknown?"),
});
exports.CollegeScheduleSchema = zod_1.z.object({
    sessions: zod_1.z.array(RawSessionSchema),
});
async function parseCollegeSchedule(text) {
    if (!text || !text.trim()) {
        return null;
    }
    try {
        const prompt = `
أنت محلل جداول جامعية دقيق لطالب طب أسنان بالفرقة الثالثة في مصر (مجموعة A3).
استخرج جدول الكلية من النص التالي. نحن يهمنا سكشن A3 بشكل أساسي، بالإضافة للمحاضرات العامة لمجموعة A-block.

النص المنسوخ من الجدول:
"""
${text.trim()}
"""

القواعد الصارمة للاستخراج:
1. أرجع كائن JSON فقط بدون أي نص إضافي يحتوي على مصفوفة "sessions".
2. "day_of_week": الأحد = 0، الاثنين = 1، الثلاثاء = 2، الأربعاء = 3، الخميس = 4، الجمعة = 5، السبت = 6.
3. "session_type": إما "Theoretical" للمحاضرات والنظري (Lecture)، أو "Practical" للسكاشن والعيادات والعملي (Section / Lab / Clinic).
4. "start_time" و "end_time": بصيغة 24 ساعة دقيقة HH:MM:SS (مثال: "09:00:00" أو "14:30:00").
5. "location": اسم المدرج أو المعمل أو العيادة إن وُجد، أو null.
6. "event_type":
   - اختر "A3" لو كانت الحصة مخصصة لسكشن A3 تحديداً (أو تشمل A3 ضمن تقسيم السكاشن).
   - اختر "A-block" لو كانت محاضرة مجمعة للفرقة كلها أو لمجموعة A بالكامل.
   - اختر "B-block" لو كانت مخصصة لمجموعة B فقط أو لسكشن آخر غير A3 (مثل A1, A2, A4, B1, B2...).
   - وإلا اختر "Unknown".

الشكل المطلوب للـ JSON:
{
  "sessions": [
    {
      "course_name": "Operative Dentistry",
      "day_of_week": 0,
      "start_time": "09:00:00",
      "end_time": "11:00:00",
      "session_type": "Practical",
      "location": "Lab 3",
      "event_type": "A3"
    }
  ]
}
`.trim();
        const rawResponse = await (0, gemini_1.executeTextModelWithFallback)("VISION_AND_SCHEDULE", prompt, { jsonMode: true, temperature: 0.1 });
        const parsedJson = parseCleanJson(rawResponse);
        const validated = exports.CollegeScheduleSchema.parse(parsedJson);
        const normalizedSessions = validated.sessions.map((session) => {
            const normStart = (0, timezone_1.normalizeTimeStr)(session.start_time) ?? "09:00:00";
            const normEnd = (0, timezone_1.normalizeTimeStr)(session.end_time) ?? "11:00:00";
            return {
                ...session,
                course_name: session.course_name.trim(),
                start_time: normStart,
                end_time: normEnd,
                location: session.location?.trim() || undefined,
            };
        });
        return { sessions: normalizedSessions };
    }
    catch (error) {
        console.error("[academic_parser] parseCollegeSchedule Error:", error);
        if (error instanceof errors_1.GeminiError) {
            throw error;
        }
        return null;
    }
}
// ============================================================================
// 2. Expense Parser (MAESTRO_FAST)
// ============================================================================
exports.ExpenseSchema = zod_1.z.object({
    amount: zod_1.z.number().positive().nullable(),
    currency: zod_1.z.string().default("EGP"),
    category: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    merchant: zod_1.z.string().nullable().optional(),
    payment_method: zod_1.z.string().nullable().optional(),
    expense_date: zod_1.z.string().optional(),
});
async function parseExpense(text) {
    if (!text || !text.trim()) {
        return null;
    }
    try {
        const cairoContext = (0, timezone_1.getCairoContextHeader)();
        const todayDateStr = (0, timezone_1.getCurrentDateStr)();
        const prompt = `
${cairoContext}

استخرج بيانات المصروف من النص التالي لطالب طب أسنان في مصر:
النص: "${text.trim()}"

أرجع JSON فقط يحتوي على الحقول التالية:
- "amount": المبلغ كرقم (Number)، وإذا لم تجد رقماً واضحاً ضع null.
- "currency": العملة (الافتراضي "EGP").
- "category": اختر فئة واحدة فقط من القائمة التالية:
  ["🍔 Food", "🥤 Drinks", "🛒 Shopping", "🦷 Dental Tools", "📚 Education", "🚕 Transportation", "🎮 Entertainment", "📱 Internet", "📞 Phone", "🏠 Personal", "💊 Medical", "📦 Other"]
  (ملاحظة: أي أدوات أسنان، بير، كونترا، كومبوزيت، ألجينات، أسنان أكليريك، عيادة = "🦷 Dental Tools").
- "description": وصف مختصر وواضح لما تم شراؤه.
- "merchant": اسم المكان أو المحل إن ذُكر، أو null.
- "payment_method": طريقة الدفع إن ذُكرت (مثل "Cash", "InstaPay", "Vodafone Cash", "Card")، أو null.
- "expense_date": تاريخ الصرف بصيغة "YYYY-MM-DD" بتوقيت القاهرة (الافتراضي اليوم "${todayDateStr}").
`.trim();
        const rawResponse = await (0, gemini_1.executeTextModelWithFallback)("MAESTRO_FAST", prompt, { jsonMode: true, temperature: 0.1 });
        const parsedJson = parseCleanJson(rawResponse);
        const validated = exports.ExpenseSchema.parse(parsedJson);
        return {
            ...validated,
            currency: validated.currency || "EGP",
            expense_date: validated.expense_date || todayDateStr,
        };
    }
    catch (error) {
        console.error("[academic_parser] parseExpense Error:", error);
        return null;
    }
}
// ============================================================================
// 3. WhatsApp & Academic Event Parser (MAESTRO_FAST)
// ============================================================================
exports.AcademicEventSchema = zod_1.z.object({
    events: zod_1.z.array(zod_1.z.object({
        event_type: zod_1.z.enum(["QUIZ", "EXAM", "ASSIGNMENT", "LECTURE_UPDATE"]),
        title: zod_1.z
            .string()
            .min(1)
            .describe("Concise title, e.g., 'كويز Operative', 'امتحان عملي Endo'"),
        event_date: zod_1.z
            .string()
            .nullable()
            .describe("YYYY-MM-DD or ISO 8601 timestamp in Cairo time, or null if unknown"),
        event_time: zod_1.z
            .string()
            .nullable()
            .optional()
            .describe("HH:MM:SS in 24h Cairo time if mentioned, or null"),
    })),
});
async function parseAcademicUpdate(text) {
    if (!text || !text.trim()) {
        return { events: [] };
    }
    try {
        const cairoContext = (0, timezone_1.getCairoContextHeader)();
        const prompt = `
${cairoContext}

أنت محلل رسائل دفعة طب الأسنان (الفرقة الثالثة - مصر - مجموعة A3).
حلل الرسالة التالية (سواء كانت رسالة من دكتور ماركو أو رسالة معاد توجيهها من جروب واتساب الدفعة).
إذا كانت دردشة عادية لا تحتوي على كويز أو امتحان أو تسليم أو تعديل محاضرة، أرجع مصفوفة فارغة في "events".
إذا كانت تحتوي على كويز (QUIZ)، امتحان ميتيرم/فاينل/عملي (EXAM)، تسليم ريبورت/شغل عملي/أساينمنت (ASSIGNMENT)، أو إلغاء/تأجيل محاضرة (LECTURE_UPDATE)، استخرج الأحداث بدقة.

الرسالة:
"""
${text.trim()}
"""

أرجع JSON فقط يطابق هذا الشكل:
{
  "events": [
    {
      "event_type": "QUIZ" | "EXAM" | "ASSIGNMENT" | "LECTURE_UPDATE",
      "title": "عنوان مختصر وواضح مثل: كويز Operative أو تسليم كيس Endo",
      "event_date": "YYYY-MM-DD" أو null لو التاريخ غير معروف,
      "event_time": "HH:MM:SS" بصيغة 24 ساعة أو null لو الوقت غير محدد
    }
  ]
}
`.trim();
        const rawResponse = await (0, gemini_1.executeTextModelWithFallback)("MAESTRO_FAST", prompt, { jsonMode: true, temperature: 0.1 });
        const parsedJson = parseCleanJson(rawResponse);
        const validated = exports.AcademicEventSchema.parse(parsedJson);
        const normalizedEvents = validated.events.map((ev) => {
            let finalIsoDate = null;
            if (ev.event_date) {
                const rawDate = ev.event_date.trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                    const normTime = (0, timezone_1.normalizeTimeStr)(ev.event_time) ?? "09:00:00";
                    finalIsoDate = (0, timezone_1.cairoDateTimeToUtcIso)(rawDate, normTime);
                }
                else {
                    const parsedDate = new Date(rawDate);
                    if (!Number.isNaN(parsedDate.getTime())) {
                        finalIsoDate = parsedDate.toISOString();
                    }
                }
            }
            return {
                event_type: ev.event_type,
                title: ev.title.trim(),
                event_date: finalIsoDate,
                event_time: (0, timezone_1.normalizeTimeStr)(ev.event_time) ?? null,
            };
        });
        return { events: normalizedEvents };
    }
    catch (error) {
        console.error("[academic_parser] parseAcademicUpdate Error:", error);
        return { events: [] };
    }
}
