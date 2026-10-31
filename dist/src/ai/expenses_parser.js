"use strict";
// src/ai/expenses_parser.ts (expenses_parser.ts)
// Stage 6: Egyptian Colloquial & Dental Supplies Expense Parser + Brief Confirmation Formatter
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseSchema = void 0;
exports.normalizeArabicDigits = normalizeArabicDigits;
exports.formatExpenseConfirmation = formatExpenseConfirmation;
exports.parseExpense = parseExpense;
const zod_1 = require("zod");
const gemini_1 = require("../gemini");
const timezone_1 = require("../core/timezone");
const expenses_1 = require("../db/expenses");
exports.ExpenseSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().default("EGP"),
    category: zod_1.z.string().min(1),
    description: zod_1.z.string().nullable().optional(),
    merchant: zod_1.z.string().nullable().optional(),
    payment_method: zod_1.z.string().nullable().optional(),
    expense_date: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
});
/**
 * Converts Arabic/Indic digits (٠١٢٣٤٥٦٧٨٩) to standard ASCII digits (0123456789)
 */
function normalizeArabicDigits(input) {
    if (!input)
        return "";
    return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}
/**
 * Formats the saved expense in the exact concise Brief format:
 * e.g., "✅ تم تسجيل: 45 EGP - أكل" or "✅ تم تسجيل: 250 EGP - أدوات أسنان (بيرات - معمل النور)"
 */
function formatExpenseConfirmation(expense) {
    const currency = expense.currency || "EGP";
    const category = expense.category || "عام";
    const detailsParts = [];
    if (expense.description &&
        expense.description.trim() &&
        expense.description.trim() !== category) {
        detailsParts.push(expense.description.trim());
    }
    if (expense.merchant &&
        expense.merchant.trim() &&
        !detailsParts.join(" ").toLowerCase().includes(expense.merchant.trim().toLowerCase())) {
        detailsParts.push(expense.merchant.trim());
    }
    const extra = detailsParts.length > 0 ? ` (${detailsParts.join(" - ")})` : "";
    return `✅ تم تسجيل: ${expense.amount} ${currency} - ${category}${extra}`;
}
/**
 * Parses Egyptian Arabic expense text or receipt OCR summary into structured Expense fields.
 * Recognizes dental supplies (بيرات، كونترا، ألجينات، أسنان أكليريك، كاست، معمل) automatically.
 */
async function parseExpense(rawText) {
    const normalizedText = normalizeArabicDigits(rawText).trim();
    if (!normalizedText)
        return null;
    const todayStr = (0, timezone_1.getCurrentDateStr)();
    const cairoHeader = (0, timezone_1.getCairoContextHeader)();
    const prompt = `${cairoHeader}

استخرج تفاصيل المصروف من نص دكتور ماركو (طالب طب أسنان سنة 3) التالي:
النص: "${normalizedText}"

القواعد الصارمة:
1. "amount": المبلغ كرقم (Number) فقط. لو فيه أكتر من صنف في نفس الجملة اجمعهم في رقم واحد واكتب التفصيلة في description.
2. "currency": العملة، افتراضياً "EGP".
3. "category": اختر الفئة الأنسب بدقة:
   - "أدوات أسنان": لأي خامات أو مستلزمات كلية أو عيادة أو معمل (مثل: بيرات، بير، كونترا، ألجينات، أسنان أكليريك، كاست، أمالجم، كومبوزيت، فايلات إندو، رابر دام، جبس، شمع، حساب معمل، بالطو، جلافز، بنج).
   - "أكل": مطاعم، فطار، غدا، عشا، ساندوتشات، سوبرماركت.
   - "كافيه": قهوة، شاي، عصير، كافيه.
   - "مواصلات": أوبر، تاكسي، مترو، ميكروباص، بنزين.
   - "دراسة وكورسات": ملازم، تصوير ورق، كتب، كورسات.
   - "شخصي": أي مصروف شخصي آخر.
4. "description": وصف مختصر جداً للصنف (مثلاً: "بيرات وألجينات" أو "KFC" أو "مواصلات الكلية").
5. "merchant": اسم المحل أو المطعم أو المعمل إن ذُكر (مثل "KFC" أو "معمل النور")، وإلا null.
6. "payment_method": طريقة الدفع إن ذُكرت ("Cash", "InstaPay", "Vodafone Cash", "Card")، وإلا null.
7. "expense_date": تاريخ المصروف بصيغة YYYY-MM-DD (النهارده="${todayStr}").

أرجع JSON فقط بهذا الشكل:
{
  "amount": 250,
  "currency": "EGP",
  "category": "أدوات أسنان",
  "description": "بيرات وأسنان أكليريك",
  "merchant": null,
  "payment_method": null,
  "expense_date": "${todayStr}"
}`;
    try {
        const rawJson = await (0, gemini_1.executeTextModelWithFallback)("MAESTRO_FAST", prompt, {
            systemInstruction: "You are a precise financial and dental-supplies expense parser for an Egyptian dental student. Return ONLY valid JSON.",
            jsonMode: true,
            maxTokens: 250,
            temperature: 0.0
        });
        const parsed = JSON.parse((0, gemini_1.cleanJsonString)(rawJson));
        if (parsed && typeof parsed.amount === "string") {
            parsed.amount = parseFloat(normalizeArabicDigits(parsed.amount));
        }
        const validated = exports.ExpenseSchema.parse({
            ...parsed,
            expense_date: parsed?.expense_date || todayStr
        });
        // Enforce "أدوات أسنان" category if dental keywords are present in description/text
        if ((0, expenses_1.isDentalExpense)({
            category: validated.category,
            description: validated.description || normalizedText,
            merchant: validated.merchant
        })) {
            validated.category = "أدوات أسنان";
        }
        return validated;
    }
    catch (e) {
        console.error("[expenses_parser] AI parseExpense failed, attempting regex fallback:", e);
        // Fast deterministic regex fallback so simple expenses like "صرفت 45 جنيه أكل" never fail
        const amountMatch = normalizedText.match(/(\d+(?:\.\d+)?)/);
        if (!amountMatch)
            return null;
        const amount = parseFloat(amountMatch[1]);
        if (isNaN(amount) || amount <= 0)
            return null;
        let category = "شخصي";
        if ((0, expenses_1.isDentalExpense)({ description: normalizedText })) {
            category = "أدوات أسنان";
        }
        else if (/(?:أكل|اكل|فطار|غدا|عشا|ساندوتش|كشري|برجر|بيتزا|kfc|ماك)/i.test(normalizedText)) {
            category = "أكل";
        }
        else if (/(?:قهوة|قهوه|شاي|كافيه|عصير|ستاربكس)/i.test(normalizedText)) {
            category = "كافيه";
        }
        else if (/(?:مواصلات|أوبر|اوبر|مترو|ميكروباص|تاكسي|بنزين)/i.test(normalizedText)) {
            category = "مواصلات";
        }
        else if (/(?:ملازم|تصوير|كتاب|كتب|كورس)/i.test(normalizedText)) {
            category = "دراسة وكورسات";
        }
        return {
            amount,
            currency: "EGP",
            category,
            description: null,
            merchant: null,
            payment_method: null,
            expense_date: todayStr
        };
    }
}
