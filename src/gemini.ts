import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

const jsonModel = genAI.getGenerativeModel({ 
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json" }
});

// 1. محلل النوايا (Intent AI) - محدث لدعم الإحصائيات
export async function analyzeIntent(text: string) {
    try {
        const prompt = `
أنت نظام فرز للمحادثات. حدد نية المستخدم من النص التالي بدقة.
يجب أن تعود بـ JSON يحتوي على مفتاح "intent" بواحدة من القيم التالية فقط:
"CREATE_REMINDER" (إذا كان يطلب تذكيره بشيء أو إضافة مهمة جديدة)
"STATISTICS" (إذا كان يسأل عن مهامه، جدول أعماله، ماذا لديه اليوم، أو يطلب إحصائيات مواعيده)
"MEDICAL_EMERGENCY" (إذا كان يطلب تشخيصاً طبياً لحالة خطيرة أو طوارئ أو أدوية)
"GENERAL_CHAT" (إذا كان سؤالاً عاماً، دردشة، أو استفسار طبي بسيط)

النص: "${text}"
        `;
        const res = await jsonModel.generateContent(prompt);
        return JSON.parse(res.response.text());
    } catch(e) {
        console.error("Intent Error:", e);
        return { intent: "GENERAL_CHAT" }; 
    }
}

// 2. المحادثة الطبيعية (Conversation AI)
export async function chatGemini(text: string) {
    try {
        const res = await model.generateContent("أنت سكرتير طبي ذكي ومحترف لدكتور ماركو. أجب باختصار ولطف. ممنوع تقديم أي تشخيص طبي قاطع أو كتابة أدوية.\n\n" + text);
        return res.response.text();
    } catch(e) {
        console.error("Gemini Chat Error:", e);
        return "عذراً يا دكتور، السيرفر مشغول حالياً.";
    }
}

// 3. مستخرج المواعيد (Reminder AI)
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
        return JSON.parse(res.response.text());
    } catch(e) { 
        console.error("Gemini Parse Error:", e);
        return null; 
    }
}

// 4. 🚀 [جديد] صانع تقارير الإحصائيات (Stats AI)
export async function generateStatsReply(text: string, todos: any[]) {
    try {
        const now = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
        const prompt = `
أنت سكرتير طبي ذكي لدكتور ماركو. 
الوقت والتاريخ الفعلي الآن هو: ${now} بتوقيت القاهرة.

المستخدم يسأل: "${text}"

إليك قائمة بمهامه ومواعيده المسجلة في قاعدة البيانات (بصيغة JSON):
${JSON.stringify(todos)}

المطلوب:
اقرأ البيانات جيداً، ثم أجب على سؤاله بدقة بناءً عليها وبأسلوب احترافي ومنظم.
إذا كان يسأل عن مهام "اليوم"، فابحث في التواريخ واعرض مهام اليوم فقط.
إذا كانت القائمة فارغة، أخبره بلطف أنه ليس لديه مهام مسجلة.
لا تذكر له كلمة JSON، فقط اعرض التقرير بشكل جميل.
        `;
        const res = await model.generateContent(prompt);
        return res.response.text();
    } catch(e) {
        console.error("Gemini Stats Error:", e);
        return "عذراً يا دكتور، حدث خطأ أثناء قراءة جدول أعمالك.";
    }
}
