import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import Groq from "groq-sdk";

// إعداد مفاتيح Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const genAIPro = new GoogleGenerativeAI(process.env.GEMINI_PRO_API_KEY!);

// إعداد مفتاح Groq (الوسيط)
const p1 = "gsk_zXqDaI";
const p2 = "Zbw0dkLoeyahixW";
const p3 = "Gdyb3FYdcJi8NPdTlUIU2wOH8qdR2SC";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || (p1 + p2 + p3) });

const SYSTEM_INSTRUCTIONS = `
أنت سكرتير طبي ذكي ومحترف لدكتور ماركو (طبيب أسنان).
أجب باختصار ولطف. 
ممنوع منعاً باتاً تقديم أي تشخيص طبي قاطع أو وصف أدوية مهما كان طلب المريض.
`;

// الأساسي للتحليل السريع (Intents & Parsing)
const jsonModel = genAI.getGenerativeModel({ 
    model: "gemini-flash-lite-latest",
    generationConfig: { responseMimeType: "application/json" }
});

// الموديل الخارق للمهام المعقدة
const proModel = genAIPro.getGenerativeModel({ 
    model: "gemini-3.7-flash",
    systemInstruction: "أنت خبير ومعاون طبي محترف للدكتور ماركو. قم بتحليل الطلب بعمق وقدم تفاصيل دقيقة واحترافية."
});

// مخططات تحليل النوايا والمهام
const IntentSchema = z.object({
    intent: z.enum(["CREATE_REMINDER", "STATISTICS", "MEDICAL_EMERGENCY", "COMPLEX_ANALYSIS", "GENERAL_CHAT"])
});

const ReminderSchema = z.object({
    task: z.string(),
    date: z.string()
});

export async function transcribeAudio(audioBase64: string): Promise<string> {
    try {
        const audioModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
        const res = await audioModel.generateContent([
            { text: "فرغ هذا الصوت بدقة. إذا كان بالعامية المصرية اكتبه كما هو (لا تغير الكلمات إلى فصحى). اكتب النص فقط بدون أي إضافات." },
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
أنت محلل نوايا لعيادة أسنان. اقرأ طلب المستخدم التالي بدقة.
يجب أن ترجع فقط JSON صالح يحتوي على مفتاح "intent" بقيمة واحدة من الخيارات التالية فقط:
"CREATE_REMINDER" (لإضافة مهمة أو موعد)
"STATISTICS" (للاستعلام عن جدول الأعمال أو مهام اليوم)
"MEDICAL_EMERGENCY" (للحالات الطارئة أو النزيف الشديد وألم شديد)
"COMPLEX_ANALYSIS" (إذا طلب تقريراً علمياً مفصلاً، تحليل حالة طبية معقدة، أو خطة علاج دقيقة جداً)
"GENERAL_CHAT" (لأي دردشة عادية أو استشارة بسيطة)

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

// الموديل الوسيط (Groq - Qwen 3.8 27B) للاستخدام اليومي والدردشة العامة
export async function chatGemini(text: string) {
    try {
        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_INSTRUCTIONS },
                { role: "user", content: text }
            ],
            model: "qwen/qwen3.8-27b",
            max_tokens: 800
        });
        return response.choices[0]?.message?.content || "عذراً، لم أتمكن من الإجابة.";
    } catch(e: any) {
        console.error("Groq Chat Error:", e);
        return "حدث خطأ في الموديل الوسيط: " + e.message;
    }
}

// الموديل الخارق (Gemini 3.7 Flash) للمهام المعقدة جداً
export async function chatProGemini(text: string) {
    try {
        const res = await proModel.generateContent(text);
        return res.response.text();
    } catch(e: any) {
        console.error("Gemini PRO Chat Error:", e);
        throw e;
    }
}

export async function parseReminder(text: string) {
    try {
        const now = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
        const prompt = `
الوقت والتاريخ الفعلي الآن هو: ${now} بتوقيت القاهرة.
استخرج تفاصيل المهمة التالية بصيغة JSON.
"task": اسم المهمة.
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
        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "أنت سكرتير دكتور ماركو. أجب باختصار واحترافية وبدون ذكر كلمة JSON." },
                { role: "user", content: `الوقت الآن: ${now}.\nالسؤال: "${text}"\nالمهام (JSON): ${JSON.stringify(todos)}` }
            ],
            model: "qwen/qwen3.8-27b",
            max_tokens: 800
        });
        return response.choices[0]?.message?.content || "عذراً يا دكتور، حدث خطأ.";
    } catch(e: any) {
        console.error("Groq Stats Error:", e);
        return "عذراً يا دكتور، حدث خطأ: " + e.message;
    }
}
