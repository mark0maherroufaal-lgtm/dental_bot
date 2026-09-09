import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const jsonModel = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" }
});

const CollegeScheduleSchema = z.object({
    sessions: z.array(z.object({
        course_name: z.string(),
        day_of_week: z.number().describe("0 for Sunday, 1 for Monday, up to 6 for Saturday"),
        start_time: z.string().describe("HH:MM in 24-hour format"),
        end_time: z.string().describe("HH:MM in 24-hour format"),
        session_type: z.string().describe("'Theoretical' or 'Practical'"),
        location: z.string().optional()
    }))
});

export async function parseCollegeSchedule(text: string) {
    try {
        const prompt = `
        استخرج جدول الكلية من النص التالي.
        النص: "${text}"
        يجب أن تُرجع JSON يحتوي على مصفوفة "sessions".
        "day_of_week": الأحد = 0, الاثنين = 1, الثلاثاء = 2, الأربعاء = 3, الخميس = 4, الجمعة = 5, السبت = 6.
        "session_type": إما "Theoretical" للمحاضرات والنظري، أو "Practical" للسكاشن والعملي.
        "start_time" و "end_time" بصيغة 24 ساعة (مثال: 14:30).
        `;
        const res = await jsonModel.generateContent(prompt);
        const parsed = JSON.parse(res.response.text());
        return CollegeScheduleSchema.parse(parsed);
    } catch (e) {
        console.error("AI Parse Schedule Error:", e);
        return null;
    }
}

const ExpenseSchema = z.object({
    amount: z.number().nullable(),
    currency: z.string().default('EGP'),
    category: z.string(),
    description: z.string().optional()
});

export async function parseExpense(text: string) {
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
        const res = await jsonModel.generateContent(prompt);
        const parsed = JSON.parse(res.response.text());
        return ExpenseSchema.parse(parsed);
    } catch (e) {
        console.error("AI Parse Expense Error:", e);
        return null;
    }
}
