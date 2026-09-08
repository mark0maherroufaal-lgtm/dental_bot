import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export async function chatGemini(text: string) {
    const res = await model.generateContent("أنت سكرتير طبي لدكتور ماركو. أجب باختصار.\n\n" + text);
    return res.response.text();
}
export async function parseReminder(text: string) {
    const res = await model.generateContent(`استخرج المهمة والتاريخ بصيغة JSON {"task": "...", "date": "YYYY-MM-DD"}. النص: ${text}`);
    try {
        const t = res.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(t);
    } catch(e) { return null; }
}
