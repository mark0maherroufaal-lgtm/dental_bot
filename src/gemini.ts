import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import Groq from "groq-sdk";

// إعداد مفاتيح Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const genAIPro = new GoogleGenerativeAI(process.env.GEMINI_PRO_API_KEY!);

// إعداد مفتاح Groq (الوسيط)
if (!process.env.GROQ_API_KEY) {
    console.warn("WARNING: GROQ_API_KEY is missing. Groq AI calls will fail.");
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "missing_key" });

const SYSTEM_INSTRUCTIONS = `
أنت سكرتير طبي ذكي ومحترف لدكتور ماركو (طبيب أسنان).
أجب باختصار ولطف. 
ممنوع منعاً باتاً تقديم أي تشخيص طبي قاطع أو وصف أدوية مهما كان طلب المريض.
`;

// الأساسي للتحليل السريع (Intents & Parsing)
const jsonModel = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
});

const textModel = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTIONS
});

export async function chatMainGemini(text: string, history: {role: string, content: string}[] = []): Promise<string> {
    try {
        const chat = textModel.startChat({
            history: history.map(h => ({
                role: h.role, // 'user' or 'model'
                parts: [{ text: h.content }]
            }))
        });
        const res = await chat.sendMessage(text);
        return res.response.text();
    } catch(e) {
        console.error("Gemini Main Chat Error:", e);
        return "حدث خطأ في الموديل الأساسي.";
    }
}

// الموديل الخارق للمهام المعقدة
const proModel = genAIPro.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    systemInstruction: "أنت خبير ومعاون طبي محترف للدكتور ماركو. قم بتحليل الطلب بعمق وقدم تفاصيل دقيقة واحترافية."
});

// مخططات تحليل النوايا والمهام
const IntentSchema = z.object({
    intent: z.enum(["CREATE_REMINDER", "STATISTICS", "MEDICAL_EMERGENCY", "COMPLEX_ANALYSIS", "COLLEGE_SCHEDULE", "EXPENSE", "ARTICLE_SUMMARY", "GENERAL_CHAT"])
});

const ReminderSchema = z.object({
    task: z.string(),
    date: z.string()
});

export async function transcribeAudio(audioBase64: string): Promise<string> {
    try {
        const audioModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

export async function processReceiptImage(imageBase64: string): Promise<string> {
    try {
        const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const res = await visionModel.generateContent([
            { text: "هذه صورة إيصال أو فاتورة. استخرج منها العناصر التالية واكتبها في نص واضح: إجمالي المبلغ، العملة، وماذا تم الشراء (أو تصنيفه التقريبي)." },
            { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
        ]);
        return res.response.text().trim();
    } catch(e) {
        console.error("Image Processing Error:", e);
        throw new Error("Failed to process receipt image");
    }
}

export async function analyzeIntent(text: string) {
    try {
        const prompt = `
أنت محلل نوايا لعيادة أسنان ولإدارة حياة دكتور ماركو. اقرأ طلب المستخدم التالي بدقة.
يجب أن ترجع فقط JSON صالح يحتوي على مفتاح "intent" بقيمة واحدة من الخيارات التالية فقط:
"CREATE_REMINDER" (لإضافة مهمة أو موعد)
"STATISTICS" (للاستعلام عن جدول الأعمال أو الإحصائيات)
"COLLEGE_SCHEDULE" (إذا كان المستخدم يرسل جدول كليته أو مواعيد سكاشن ومحاضرات)
"EXPENSE" (إذا كان المستخدم يسجل مصروفات، دفع أموال، أو اشترى شيئاً)
"ARTICLE_SUMMARY" (إذا طلب المستخدم تلخيص مقال طبي أو أرسل نص/abstract ليتم تلخيصه)
"MEDICAL_EMERGENCY" (للحالات الطارئة أو النزيف الشديد وألم شديد)
"COMPLEX_ANALYSIS" (إذا طلب تقريراً علمياً مفصلاً، تحليل حالة طبية معقدة)
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
export async function chatGemini(text: string, history: {role: string, content: string}[] = []) {
    try {
        const messages: any[] = [{ role: "system", content: SYSTEM_INSTRUCTIONS }];
        
        // Add context history
        history.forEach(h => {
            messages.push({ role: h.role === 'model' ? 'assistant' : 'user', content: h.content });
        });
        
        messages.push({ role: "user", content: text });

        const response = await groq.chat.completions.create({
            messages: messages,
            model: "qwen/qwen3.8-27b",
            max_tokens: 800
        });
        return response.choices[0]?.message?.content || "عذراً، لم أتمكن من الإجابة.";
    } catch(e: any) {
        console.error("Groq Chat Error:", e);
        try {
            // Fallback to Gemini 1.5 Flash
            const fallbackReply = await chatMainGemini(text, history);
            return `⚠️ **تنبيه تقني:** توقف المحرك الوسيط (Groq) للسبب التالي:\n\`${e.message}\`\n\n🤖 **تم التحويل تلقائياً للمحرك الأساسي (Gemini 1.5)، اليك الرد:**\n\n${fallbackReply}`;
        } catch (fallbackError: any) {
             return `❌ فشل كارثي! كلا المحركين متوقفان.\n\nخطأ Groq:\n\`${e.message}\`\n\nخطأ Gemini:\n\`${fallbackError.message}\``;
        }
    }
}

// الموديل الخارق (Gemini 1.5 Pro) للمهام المعقدة جداً
export async function chatProGemini(text: string, history: {role: string, content: string}[] = []) {
    try {
        const chat = proModel.startChat({
            history: history.map(h => ({
                role: h.role, // 'user' or 'model'
                parts: [{ text: h.content }]
            }))
        });
        const res = await chat.sendMessage(text);
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

export async function generateStatsReply(text: string, statsData: any) {
    try {
        const now = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "أنت سكرتير دكتور ماركو ومحلل بيانات. أجب باختصار واحترافية وبدون ذكر كلمة JSON. قدم ملخصاً لإنتاجيته والمصروفات." },
                { role: "user", content: `الوقت الآن: ${now}.\nالسؤال: "${text}"\nبيانات الإحصائيات (JSON): ${JSON.stringify(statsData)}` }
            ],
            model: "qwen/qwen3.8-27b",
            max_tokens: 800
        });
        return response.choices[0]?.message?.content || "عذراً يا دكتور، حدث خطأ.";
    } catch(e: any) {
        console.error("Groq Stats Error:", e);
        try {
            const now = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
            const prompt = `أنت سكرتير دكتور ماركو ومحلل بيانات. أجب باختصار واحترافية وبدون ذكر كلمة JSON.\nالوقت الآن: ${now}.\nالسؤال: "${text}"\nبيانات الإحصائيات (JSON): ${JSON.stringify(statsData)}`;
            const fallbackReply = await chatMainGemini(prompt);
            return `⚠️ **تنبيه تقني:** توقف المحرك الوسيط للسبب التالي:\n\`${e.message}\`\n\n🤖 **تم تلخيص إحصائياتك بواسطة المحرك الأساسي البديل:**\n\n${fallbackReply}`;
        } catch (fallbackError: any) {
            return `❌ تعطلت جميع المحركات!\nخطأ Groq: \`${e.message}\`\nخطأ Gemini: \`${fallbackError.message}\``;
        }
    }
}
