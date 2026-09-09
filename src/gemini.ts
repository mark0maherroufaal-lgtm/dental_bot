import { GoogleGenerativeAI } from "@google/generative-ai";
import { Groq } from "groq-sdk";
import { z } from "zod";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
const patientModel = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "أنت سكرتير ومساعد افتراضي لطيف ومهني في عيادة د. ماركو لطب الأسنان. مهمتك الرد على المرضى، تقديم نصائح عامة حول صحة الفم، وتوجيههم لزيارة العيادة في الحالات التي تحتاج طبيباً. لا تقم بتشخيص طبي قاطع أبداً. اجعل ردودك قصيرة ومطمئنة."
});

const SYSTEM_INSTRUCTIONS = "أنت مساعد شخصي ذكي جداً يعمل لدكتور ماركو (طبيب أسنان). تتحدث بلهجة مصرية، إجاباتك قصيرة وواضحة جداً.";

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
        return "حدث خطأ في الموديل الأساسي.";
    }
}

export async function chatPatientGemini(text: string, history: {role: string, content: string}[] = []): Promise<string> {
    try {
        const chat = patientModel.startChat({
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.content }]
            }))
        });
        const res = await chat.sendMessage(text);
        return res.response.text();
    } catch(e) {
        return "عذراً، حدث خطأ أثناء الاتصال بالنظام.";
    }
}

export async function chatGemini(text: string, history: {role: string, content: string}[] = []) {
    try {
        const messages: any[] = [{ role: "system", content: SYSTEM_INSTRUCTIONS }];
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
        try {
            const fallbackReply = await chatMainGemini(text, history);
            return `⚠️ **تم التحويل تلقائياً للمحرك الأساسي (Gemini 1.5):**\n\n${fallbackReply}`;
        } catch (fallbackError: any) {
             return `❌ فشل كلا المحركين.`;
        }
    }
}

export async function chatProGemini(text: string, history: {role: string, content: string}[] = []) {
    try {
        const chat = proModel.startChat({
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.content }]
            }))
        });
        const res = await chat.sendMessage(text);
        return res.response.text();
    } catch(e: any) {
        throw e;
    }
}

const IntentSchema = z.object({
    intent: z.enum(["CREATE_REMINDER", "STATISTICS", "MEDICAL_EMERGENCY", "COMPLEX_ANALYSIS", "COLLEGE_SCHEDULE", "EXPENSE", "ARTICLE_SUMMARY", "GENERAL_CHAT"])
});

export async function analyzeIntent(text: string) {
    try {
        const prompt = `حلل النية: CREATE_REMINDER, STATISTICS, MEDICAL_EMERGENCY, COMPLEX_ANALYSIS, COLLEGE_SCHEDULE, EXPENSE, ARTICLE_SUMMARY, GENERAL_CHAT. النص: "${text}"`;
        const res = await textModel.generateContent({
            contents: [{role: "user", parts: [{text: prompt}]}],
            generationConfig: { responseMimeType: "application/json" }
        });
        const t = res.response.text().trim();
        const parsed = JSON.parse(t);
        return IntentSchema.parse(parsed);
    } catch(e) {
        return { intent: "GENERAL_CHAT" };
    }
}

export async function parseReminder(text: string) {
    return { task: text, date: new Date().toISOString() };
}

export async function generateStatsReply(text: string, statsData: any) {
    const prompt = `أنت سكرتير. النص: "${text}"\nبيانات: ${JSON.stringify(statsData)}`;
    return await chatMainGemini(prompt);
}

export async function transcribeAudio(audioBase64: string): Promise<string> {
    return "Transcribed audio.";
}

export async function processReceiptImage(imageBase64: string): Promise<string> {
    return "Parsed receipt.";
}
