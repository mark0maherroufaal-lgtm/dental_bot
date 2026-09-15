"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCollegeSchedule = parseCollegeSchedule;
exports.parseExpense = parseExpense;
exports.parseAcademicUpdate = parseAcademicUpdate;
const generative_ai_1 = require("@google/generative-ai");
const zod_1 = require("zod");
const errors_1 = require("../core/errors");
let _genAI = null;
function getGenAI() {
    if (!process.env.GEMINI_API_KEY) {
        throw new errors_1.GeminiError("GEMINI_API_KEY is not configured.");
    }
    if (!_genAI) {
        _genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return _genAI;
}
function getJsonModel() {
    return getGenAI().getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
}
const CollegeScheduleSchema = zod_1.z.object({
    sessions: zod_1.z.array(zod_1.z.object({
        course_name: zod_1.z.string(),
        day_of_week: zod_1.z.number().describe("0 for Sunday, 1 for Monday, up to 6 for Saturday"),
        start_time: zod_1.z.string().describe("HH:MM in 24-hour format"),
        end_time: zod_1.z.string().describe("HH:MM in 24-hour format"),
        session_type: zod_1.z.string().describe("'Theoretical' or 'Practical'"),
        location: zod_1.z.string().optional(),
        event_type: zod_1.z.enum(['A3', 'A-block', 'B-block', 'Unknown']).describe("Is this for A3 specifically, all of block A, all of block B, or Unknown?")
    }))
});
async function parseCollegeSchedule(text) {
    try {
        const prompt = `
        استخرج جدول الكلية من النص التالي. نحن يهمنا مجموعة A3 بشكل أساسي، بالإضافة للمحاضرات العامة لـ A-block.
        النص: "${text}"
        يجب أن تُرجع JSON يحتوي على مصفوفة "sessions".
        "day_of_week": الأحد = 0, الاثنين = 1, الثلاثاء = 2, الأربعاء = 3, الخميس = 4, الجمعة = 5, السبت = 6.
        "session_type": إما "Theoretical" للمحاضرات والنظري، أو "Practical" للسكاشن والعملي.
        "start_time" و "end_time" بصيغة 24 ساعة (مثال: 14:30).
        "event_type": اختر "A3" لو كانت لسكشن A3 تحديداً. اختر "A-block" لو كانت محاضرة مجمعة أو لـ A بالكامل. اختر "B-block" لو كانت لسكشن B فقط. وإلا "Unknown".
        `;
        const res = await getJsonModel().generateContent(prompt);
        const parsed = JSON.parse(res.response.text());
        return CollegeScheduleSchema.parse(parsed);
    }
    catch (e) {
        console.error("AI Parse Schedule Error:", e);
        return null;
    }
}
const ExpenseSchema = zod_1.z.object({
    amount: zod_1.z.number().nullable(),
    currency: zod_1.z.string().default('EGP'),
    category: zod_1.z.string(),
    description: zod_1.z.string().optional()
});
async function parseExpense(text) {
    try {
        const prompt = `
        استخرج المصروفات من النص التالي:
        النص: "${text}"
        
        استخرج:
        - "amount" (المبلغ كرقم، وإذا لم تجد رقماً دقيقاً ضع null)
        - "currency" (مثل EGP)
        - "category" (اختر واحدة: 🍔 Food, 🥤 Drinks, 🛒 Shopping, 🦷 Dental Tools, 📚 Education, 🚕 Transportation, 🎮 Entertainment, 📱 Internet, 📞 Phone, 🏠 Personal, 💊 Medical, 📦 Other)
        - "description" (وصف قصير لما تم شراؤه)
        `;
        const res = await getJsonModel().generateContent(prompt);
        const parsed = JSON.parse(res.response.text());
        return ExpenseSchema.parse(parsed);
    }
    catch (e) {
        console.error("AI Parse Expense Error:", e);
        return null;
    }
}
// --- WhatsApp Academic Event Parser ---
const AcademicEventSchema = zod_1.z.object({
    events: zod_1.z.array(zod_1.z.object({
        event_type: zod_1.z.enum(['QUIZ', 'EXAM', 'ASSIGNMENT', 'LECTURE_UPDATE']),
        title: zod_1.z.string().describe("Concise title, e.g., 'Operative Quiz', 'Endo Assignment'"),
        event_date: zod_1.z.string().nullable().describe("ISO timestamp of the event, or null if unknown"),
    }))
});
async function parseAcademicUpdate(text) {
    try {
        const today = new Date().toISOString();
        const prompt = `
        Analyze this college WhatsApp message. If it's general chat, return an empty array for "events". 
        If it contains a quiz, exam, assignment, or lecture cancellation/postponement, extract the exact event type, inferred date/time, and a concise title.
        Note: The current context is a 5th-year dental student. Today's date is ${today}.
        
        Message: "${text}"
        
        Return JSON matching this schema:
        {
          "events": [
            {
               "event_type": "QUIZ" | "EXAM" | "ASSIGNMENT" | "LECTURE_UPDATE",
               "title": "String",
               "event_date": "ISO 8601 Timestamp or null"
            }
          ]
        }
        `;
        const res = await getJsonModel().generateContent(prompt);
        const parsed = JSON.parse(res.response.text().trim());
        return AcademicEventSchema.parse(parsed);
    }
    catch (e) {
        console.error("AI Parse Academic Update Error:", e);
        return { events: [] };
    }
}
