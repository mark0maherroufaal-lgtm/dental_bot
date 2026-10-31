"use strict";
// src/db/expenses.ts (expenses_db.ts)
// Stage 6: Expenses Database Engine, 60s Duplicate Guard, Undo/Delete, Dental vs. Personal Breakdown & Cairo Period Summaries
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDentalExpense = isDentalExpense;
exports.addExpense = addExpense;
exports.deleteExpenseById = deleteExpenseById;
exports.getRecentExpenses = getRecentExpenses;
exports.getExpensesInRange = getExpensesInRange;
exports.getDentalExpensesBreakdown = getDentalExpensesBreakdown;
exports.getExpensesSummary = getExpensesSummary;
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
const config_1 = require("../core/config");
const timezone_1 = require("../core/timezone");
const DENTAL_CATEGORY_OR_ITEM_REGEX = /(?:dental|أدوات\s*أسنان|ادوات\s*اسنان|خامات|عيادة|معمل|بير|بيرات|burs?|كونترا|contra|ألجينات|الجينات|alginate|أكليريك|اكريليك|أكريل|acrylic|كاست|cast|أمالجم|امالجم|amalgam|كومبوزيت|composite|إندو|اندو|endo|فايلات|files|رابر\s*دام|rubber\s*dam|بنج|كاربولات|جبس|stone|شمع|wax|بالطو|جلافز|ماسك)/i;
/**
 * Normalizes a raw DB row into a type-safe Expense object (converting DECIMAL strings to numbers)
 */
function normalizeExpenseRow(row) {
    return {
        id: row.id,
        telegram_id: String(row.telegram_id || config_1.config.ADMIN_ID),
        amount: Number(row.amount) || 0,
        currency: row.currency || "EGP",
        category: row.category || "عام",
        subcategory: row.subcategory || null,
        description: row.description || null,
        merchant: row.merchant || null,
        payment_method: row.payment_method || null,
        expense_date: row.expense_date ||
            (row.created_at ? (0, timezone_1.getCurrentDateStr)(new Date(row.created_at)) : (0, timezone_1.getCurrentDateStr)()),
        created_at: row.created_at
    };
}
/**
 * Checks if an expense belongs to Dental College Supplies / Lab fees
 */
function isDentalExpense(expense) {
    const combined = [
        expense.category || "",
        expense.subcategory || "",
        expense.description || "",
        expense.merchant || ""
    ].join(" ");
    return DENTAL_CATEGORY_OR_ITEM_REGEX.test(combined);
}
/**
 * Inserts a new expense with a 60-second duplicate guard and returns the saved row (including `id` for the undo button).
 */
async function addExpense(expense) {
    try {
        const cleanAmount = Number(expense.amount);
        if (isNaN(cleanAmount) || cleanAmount <= 0) {
            throw new errors_1.DatabaseError("Invalid expense amount");
        }
        const expenseDate = expense.expense_date || (0, timezone_1.getCurrentDateStr)();
        const autoDentalCategory = isDentalExpense(expense) &&
            (!expense.category || expense.category === "عام" || expense.category === "شخصي")
            ? "🦷 أدوات أسنان"
            : expense.category || "عام";
        // 60-Second Duplicate Guard: prevent double-insert on network retry
        const sixtySecondsAgoIso = new Date(Date.now() - 60 * 1000).toISOString();
        const { data: recentDup } = await supabase_1.supabase
            .from("expenses")
            .select("*")
            .eq("telegram_id", expense.telegram_id)
            .eq("amount", cleanAmount)
            .eq("category", autoDentalCategory)
            .gte("created_at", sixtySecondsAgoIso)
            .order("created_at", { ascending: false })
            .limit(1);
        if (recentDup && recentDup.length > 0) {
            return normalizeExpenseRow(recentDup[0]);
        }
        const payload = {
            telegram_id: expense.telegram_id,
            amount: cleanAmount,
            currency: expense.currency || "EGP",
            category: autoDentalCategory,
            subcategory: expense.subcategory || null,
            description: expense.description || null,
            merchant: expense.merchant || null,
            payment_method: expense.payment_method || null,
            expense_date: expenseDate
        };
        const { data, error } = await supabase_1.supabase
            .from("expenses")
            .insert([payload])
            .select("*")
            .single();
        if (error || !data) {
            throw new errors_1.DatabaseError("Failed to save expense", error);
        }
        return normalizeExpenseRow(data);
    }
    catch (e) {
        console.error("[expenses_db] addExpense error:", e);
        if (!(e instanceof errors_1.DatabaseError)) {
            throw new errors_1.DatabaseError(e.message || "Failed to save expense", e);
        }
        throw e;
    }
}
/**
 * Deletes an expense by ID (used by the interactive [🗑️ مسح المصروف] undo button)
 * and returns the deleted expense details for confirmation.
 */
async function deleteExpenseById(id, telegramId = config_1.config.ADMIN_ID) {
    try {
        const { data: existing, error: fetchErr } = await supabase_1.supabase
            .from("expenses")
            .select("*")
            .eq("id", id)
            .eq("telegram_id", telegramId)
            .maybeSingle();
        if (fetchErr || !existing) {
            return null;
        }
        const { error: delErr } = await supabase_1.supabase
            .from("expenses")
            .delete()
            .eq("id", id)
            .eq("telegram_id", telegramId);
        if (delErr) {
            throw new errors_1.DatabaseError("Failed to delete expense", delErr);
        }
        return normalizeExpenseRow(existing);
    }
    catch (e) {
        console.error("[expenses_db] deleteExpenseById error:", e);
        return null;
    }
}
async function getRecentExpenses(telegramId, limit = 10) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("expenses")
            .select("*")
            .eq("telegram_id", telegramId)
            .order("created_at", { ascending: false })
            .limit(limit);
        if (error)
            throw new errors_1.DatabaseError("Failed to fetch expenses", error);
        return (data || []).map(normalizeExpenseRow);
    }
    catch (e) {
        console.error("[expenses_db] getRecentExpenses error:", e);
        return [];
    }
}
/**
 * Fetches expenses in a YYYY-MM-DD Cairo date range accurately across full day boundaries (00:00:00 to 23:59:59 Cairo time).
 */
async function getExpensesInRange(telegramId, startDate, endDate) {
    try {
        const cleanStart = startDate.slice(0, 10);
        const cleanEnd = endDate.slice(0, 10);
        const startUtcIso = (0, timezone_1.cairoDateTimeToUtcIso)(cleanStart, "00:00:00");
        const endUtcIso = (0, timezone_1.cairoDateTimeToUtcIso)(cleanEnd, "23:59:59");
        const { data, error } = await supabase_1.supabase
            .from("expenses")
            .select("*")
            .eq("telegram_id", telegramId)
            .gte("created_at", startUtcIso)
            .lte("created_at", endUtcIso)
            .order("created_at", { ascending: false });
        if (error)
            throw new errors_1.DatabaseError("Failed to fetch expenses in range", error);
        return (data || []).map(normalizeExpenseRow);
    }
    catch (e) {
        console.error("[expenses_db] getExpensesInRange error:", e);
        return [];
    }
}
/**
 * Separates Dental College Supplies & Lab Expenses from Personal Expenses in a given Cairo date range.
 */
async function getDentalExpensesBreakdown(startDate, endDate, telegramId = config_1.config.ADMIN_ID) {
    const expenses = await getExpensesInRange(telegramId, startDate, endDate);
    let totalSpent = 0;
    let dentalTotal = 0;
    let personalTotal = 0;
    let dentalItemsCount = 0;
    let personalItemsCount = 0;
    const byCategory = {};
    for (const exp of expenses) {
        const amt = Number(exp.amount) || 0;
        totalSpent += amt;
        const catKey = exp.category || "عام";
        byCategory[catKey] = (byCategory[catKey] || 0) + amt;
        if (isDentalExpense(exp)) {
            dentalTotal += amt;
            dentalItemsCount++;
        }
        else {
            personalTotal += amt;
            personalItemsCount++;
        }
    }
    const dentalPercentage = totalSpent > 0 ? Math.round((dentalTotal / totalSpent) * 100) : 0;
    return {
        startDate,
        endDate,
        totalSpent: Math.round(totalSpent * 100) / 100,
        dentalTotal: Math.round(dentalTotal * 100) / 100,
        personalTotal: Math.round(personalTotal * 100) / 100,
        dentalPercentage,
        dentalItemsCount,
        personalItemsCount,
        byCategory,
        expenses
    };
}
/**
 * Returns a complete Cairo-timezone summary for 'today' | 'week' | 'month'
 * with Dental vs. Personal breakdown.
 */
async function getExpensesSummary(period, telegramId = config_1.config.ADMIN_ID) {
    const todayStr = (0, timezone_1.getCurrentDateStr)();
    let startDate = todayStr;
    let periodLabelAr = "النهارده";
    if (period === "week") {
        startDate = (0, timezone_1.addDaysToCairoDate)(-6, todayStr);
        periodLabelAr = "آخر 7 أيام";
    }
    else if (period === "month") {
        startDate = `${todayStr.slice(0, 7)}-01`;
        periodLabelAr = "الشهر ده";
    }
    const breakdown = await getDentalExpensesBreakdown(startDate, todayStr, telegramId);
    let formattedSummary = "";
    if (breakdown.totalSpent === 0) {
        formattedSummary = `💸 مفيش أي مصاريف متسجلة ${periodLabelAr} لحد دلوقتي.`;
    }
    else {
        const lines = [
            `💰 **ملخص مصاريفك (${periodLabelAr}):**`,
            `• الإجمالي الكلي: **${breakdown.totalSpent} EGP**`,
            `• 🦷 أدوات وخامات أسنان: **${breakdown.dentalTotal} EGP** (${breakdown.dentalPercentage}%)`,
            `• 👤 مصاريف شخصية ويومية: **${breakdown.personalTotal} EGP**`
        ];
        formattedSummary = lines.join("\n");
    }
    return {
        ...breakdown,
        period,
        periodLabelAr,
        formattedSummary
    };
}
