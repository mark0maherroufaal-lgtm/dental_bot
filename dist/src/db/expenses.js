"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addExpense = addExpense;
exports.getRecentExpenses = getRecentExpenses;
exports.getExpensesInRange = getExpensesInRange;
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
async function addExpense(expense) {
    try {
        const { error } = await supabase_1.supabase.from('expenses').insert([{
                telegram_id: expense.telegram_id,
                amount: expense.amount,
                currency: expense.currency || 'EGP',
                category: expense.category,
                subcategory: expense.subcategory,
                description: expense.description,
                merchant: expense.merchant,
                payment_method: expense.payment_method
            }]);
        if (error)
            throw new errors_1.DatabaseError("Failed to save expense", error);
    }
    catch (e) {
        console.error(e);
        throw e;
    }
}
async function getRecentExpenses(telegramId, limit = 10) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('expenses')
            .select('*')
            .eq('telegram_id', telegramId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error)
            throw new errors_1.DatabaseError("Failed to fetch expenses", error);
        return data || [];
    }
    catch (e) {
        console.error(e);
        return [];
    }
}
async function getExpensesInRange(telegramId, startDate, endDate) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('expenses')
            .select('*')
            .eq('telegram_id', telegramId)
            // assuming created_at is timestamp and we compare string directly (Postgres handles ISO strings well)
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59.999');
        if (error)
            throw new errors_1.DatabaseError("Failed to fetch expenses in range", error);
        return data || [];
    }
    catch (e) {
        console.error(e);
        return [];
    }
}
