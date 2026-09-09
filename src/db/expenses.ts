import { supabase } from "../supabase";
import { DatabaseError } from "../core/errors";

export interface Expense {
    id?: string;
    telegram_id: string;
    amount: number;
    currency?: string;
    category: string;
    subcategory?: string;
    description?: string;
    merchant?: string;
    payment_method?: string;
    expense_date?: string;
}

export async function addExpense(expense: Expense) {
    try {
        const { error } = await supabase.from('expenses').insert([{
            telegram_id: expense.telegram_id,
            amount: expense.amount,
            currency: expense.currency || 'EGP',
            category: expense.category,
            subcategory: expense.subcategory,
            description: expense.description,
            merchant: expense.merchant,
            payment_method: expense.payment_method
        }]);
        
        if (error) throw new DatabaseError("Failed to save expense", error);
    } catch (e: any) {
        console.error(e);
        throw e;
    }
}

export async function getRecentExpenses(telegramId: string, limit: number = 10): Promise<Expense[]> {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('telegram_id', telegramId)
            .order('created_at', { ascending: false })
            .limit(limit);
            
        if (error) throw new DatabaseError("Failed to fetch expenses", error);
        return data || [];
    } catch (e: any) {
        console.error(e);
        return [];
    }
}

export async function getExpensesInRange(telegramId: string, startDate: string, endDate: string): Promise<Expense[]> {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('telegram_id', telegramId)
            // assuming created_at is timestamp and we compare string directly (Postgres handles ISO strings well)
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59.999');
            
        if (error) throw new DatabaseError("Failed to fetch expenses in range", error);
        return data || [];
    } catch (e: any) {
        console.error(e);
        return [];
    }
}
