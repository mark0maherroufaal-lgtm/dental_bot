import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// مفتاح الموديل السريع (Flash)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
// مفتاح الموديل الخارق (Pro)
const genAIPro = new GoogleGenerativeAI(process.env.GEMINI_PRO_API_KEY!);

const SYSTEM_INSTRUCTIONS = `
أنت سكرتير طبي ذكي ومحترف لدكتور ماركو (طبيب أسنان).
أجب باختصار ولطف. 
ممنوع منعاً باتاً تقديم أي تشخيص طبي قاطع أو وصف أدوية مهما كان طلب المريض.
`;

const chatModel = genAI.getGenerativeModel({ 
    model: "gemini-3.8-flash",
    systemInstruction: SYSTEM_INSTRUCTIONS
});

const jsonModel = genAI.getGenerativeModel({ 
    model: "gemini-3.8-flash",
    generationConfig: { responseMimeType: "application/json" }
});

// 🚀 الموديل الخارق للمهام المعقدة
const proModel = genAIPro.getGenerativeModel({ 
    model: "gemini-3.1-pro",
    systemInstruction: "أنت خبير ومعاون طبي محترف للدكتور ماركو. قم بتحليل الطلب بعمق وقدم تفاصيل دقيقة واحترافية."
});

// تمت إضافة نية "التحليل المعقد"
const IntentSchema = z.object({
    intent: z.enum(["CREATE_REMINDER", "STATISTICS", "MEDICAL_EMERGENCY", "COMPLEX_ANALYSIS", "GENERAL_CHAT"])
});

const ReminderSchema = z.object({
    task: z.string(),
    date: z.string()
});

export async function transcribeAudio(audioBase64: string): Promise<string> {
    try {
        const res = await chatModel.generateContent([
            { text: "أنت ناسخ محترف. قم بتفريغ هذه الرسالة الصوتية إلى نص عربي دقيق جداً (باللهجة المصرية إن وجدت). اكتب النص فقط بدون أي تعليقات أو شروحات إضافية." },
            { inlineData: { data: audioBase64, mimeType: "audio/ogg" } }
        ]);
        return res.response.text().trim();
    } catch(e) {
        console.error("Audio Transcription Error:", e);
        throw new Error("Failed to transcribe audio");
    }
}

export async function analyzeIntent(text: string) {
    try {
        const prompt = `
أنت نظام فرز للمحادثات. حدد نية المستخدم من النص التالي بدقة.
يجب أن تعود بـ JSON يحتوي على مفتاح "intent" بواحدة من القيم التالية فقط:
"CREATE_REMINDER" (لإضافة مهمة أو تذكير)
"STATISTICS" (للاستعلام عن جدول الأعمال أو مهام اليوم)
"MEDICAL_EMERGENCY" (لحالات الطوارئ أو الاستشارات الطبية الخطيرة)
"COMPLEX_ANALYSIS" (إذا كان الطلب معقداً جداً ويحتاج تحليلاً عميقاً، أو يطلب بحثاً طبياً مفصلاً، أو ترجمة ونقاشات علمية طويلة)
"GENERAL_CHAT" (للدردشة العامة والأسئلة البسيطة)

النص: "${text}"
        `;
        const res = await jsonModel.generateContent(prompt);
        const parsed = JSON.parse(res.response.text());
        return IntentSchema.parse(parsed);
    } catch(e) {
        console.error("Intent Zod Validation Error:", e);
        return { intent: "GENERAL_CHAT" };
    }
}

export async function chatGemini(text: string) {
    try {
        const res = await chatModel.generateContent(text);
        return res.response.text();
    } catch(e) {
        console.error("Gemini Chat Error:", e);
        return "عذراً يا دكتور، السيرفر مشغول حالياً.";
    }
}

// 🚀 دالة المحادثة الخاصة بموديل برو
export async function chatProGemini(text: string) {
    try {
        const res = await proModel.generateContent(text);
        return res.response.text();
    } catch(e) {
        console.error("Gemini PRO Chat Error:", e);
        throw e; // لنقم بالتقاط الخطأ في bot.ts لتحويله للفلاش كاحتياطي
    }
}

export async function parseReminder(text: string) {
    try {
        const now = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
        const prompt = `
الوقت والتاريخ الفعلي الآن هو: ${now} بتوقيت القاهرة.
استخرج المهمة والتاريخ المطلوب بصيغة JSON.
"task": وصف المهمة.
"date": التاريخ بصيغة YYYY-MM-DD.
النص: ${text}
        `;
        const res = await jsonModel.generateContent(prompt);
        const parsed = JSON.parse(res.response.text());
        return ReminderSchema.parse(parsed);
    } catch(e) { 
        console.error("Gemini/Zod Parse Error:", e);
        return null; 
    }
}

export async function generateStatsReply(text: string, todos: any[]) {
    try {
        const now = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
        const prompt = `
الوقت والتاريخ الفعلي الآن هو: ${now} بتوقيت القاهرة.
المستخدم يسأل: "${text}"
قائمة المهام المسجلة (JSON): ${JSON.stringify(todos)}

اقرأ البيانات ثم أجب على سؤاله بدقة بناءً عليها بأسلوب احترافي كأنك سكرتيره. لا تذكر كلمة JSON.
        `;
        const res = await chatModel.generateContent(prompt); 
        return res.response.text();
    } catch(e) {
        console.error("Gemini Stats Error:", e);
        return "عذراً يا دكتور، حدث خطأ أثناء قراءة جدول أعمالك.";
    }
}
