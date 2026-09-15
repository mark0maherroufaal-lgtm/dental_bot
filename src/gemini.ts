import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { Groq } from "groq-sdk";
import { z } from "zod";
import { GeminiError } from "./core/errors";

let _genAI: GoogleGenerativeAI | null = null;
let _groq: Groq | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (!process.env.GEMINI_API_KEY) {
        throw new GeminiError("GEMINI_API_KEY is not configured.");
    }
    if (!_genAI) {
        _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return _genAI;
}

function getGroq(): Groq {
    if (!process.env.GROQ_API_KEY) {
        throw new GeminiError("GROQ_API_KEY is not configured.");
    }
    if (!_groq) {
        _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return _groq;
}

function getTextModel(): GenerativeModel {
    return getGenAI().getGenerativeModel({ model: "gemini-1.5-flash" });
}

function getProModel(): GenerativeModel {
    return getGenAI().getGenerativeModel({ model: "gemini-1.5-pro" });
}

function getPatientModel(): GenerativeModel {
    return getGenAI().getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: "أنت سكرتير ومساعد افتراضي لطيف ومهني في عيادة د. ماركو لطب الأسنان. مهمتك الرد على المرضى، تقديم نصائح عامة حول صحة الفم، وتوجيههم لزيارة العيادة في الحالات التي تحتاج طبيباً. لا تقم بتشخيص طبي قاطع أبداً. اجعل ردودك قصيرة ومطمئنة."
    });
}

const SYSTEM_INSTRUCTIONS = "أنت مساعد شخصي ذكي جداً يعمل لدكتور ماركو (طبيب أسنان). تتحدث بلهجة مصرية، إجاباتك قصيرة وواضحة جداً.";

export async function chatMainGemini(text: string, history: {role: string, content: string}[] = []): Promise<string> {
    try {
        const chat = getTextModel().startChat({
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
        const chat = getPatientModel().startChat({
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

        const response = await getGroq().chat.completions.create({
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
        const chat = getProModel().startChat({
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
        const res = await getTextModel().generateContent({
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

const ReminderSchema = z.object({
    task: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:MM").nullable(),
    action: z.enum(["CREATE", "EDIT", "RESCHEDULE", "CANCEL"])
});

export type ParsedReminder = z.infer<typeof ReminderSchema>;

export async function parseReminder(text: string): Promise<ParsedReminder | null> {
    try {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
        const timeNow = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: '2-digit', minute:'2-digit' });
        
        const prompt = `Extract reminder details from this text. Today is ${today}, and the current time is ${timeNow}.
Text: "${text}"

Return JSON with exactly these fields:
- "task": string (the task description in the user's language)
- "date": string (YYYY-MM-DD)
- "time": string (HH:MM in 24-hour format) or null if no specific time is mentioned. DO NOT invent a time.
- "action": string ("CREATE" for new, "EDIT" or "RESCHEDULE" for changing an existing one, "CANCEL" for deleting)

Examples:
"فكرني بكرة الساعة 7 أراجع" -> {"task": "أراجع", "date": "tomorrow's date", "time": "19:00", "action": "CREATE"}
"فكرني الخميس أراجع Endo" -> {"task": "أراجع Endo", "date": "next Thursday's date", "time": null, "action": "CREATE"}
"خليها السبت بدل الخميس" -> {"task": "...", "date": "next Saturday's date", "time": null, "action": "RESCHEDULE"}
"امسح معاد بكرة" -> {"task": "...", "date": "tomorrow's date", "time": null, "action": "CANCEL"}

Return ONLY valid JSON.`;

        const model = getGenAI().getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
        const res = await model.generateContent(prompt);
        const parsed = JSON.parse(res.response.text().trim());
        return ReminderSchema.parse(parsed);
    } catch (e) {
        console.error("parseReminder error:", e);
        return null; // Better to fail securely than invent a date/time
    }
}

export async function generateStatsReply(text: string, statsData: any) {
    const prompt = `أنت سكرتير. النص: "${text}"\nبيانات: ${JSON.stringify(statsData)}`;
    return await chatMainGemini(prompt);
}

export async function transcribeAudio(audioBase64: string): Promise<string> {
    try {
        const model = getGenAI().getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "Transcribe the following audio accurately. It may be in Arabic or English. Return ONLY the transcribed text.";
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "audio/ogg",
                    data: audioBase64
                }
            }
        ]);
        return result.response.text().trim();
    } catch (e) {
        console.error("Audio Transcription Error:", e);
        throw new GeminiError("فشل في تحويل الصوت إلى نص.", e);
    }
}

export async function processReceiptImage(imageBase64: string): Promise<string> {
    try {
        const model = getGenAI().getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "Extract all text and expense information from this image/receipt. Return a clear text summary of what was purchased and the total amount. If it's not a receipt, just describe what's in the image.";
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBase64
                }
            }
        ]);
        return result.response.text().trim();
    } catch (e) {
        console.error("Image Processing Error:", e);
        throw new GeminiError("فشل في تحليل الصورة.", e);
    }
}
