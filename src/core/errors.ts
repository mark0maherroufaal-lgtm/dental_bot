// src/core/errors.ts
import { ErrorRegistry, ErrorSeverity } from './ErrorRegistry';

export class AppError extends Error {
    public readonly type: string;
    public readonly isOperational: boolean;
    public readonly errorId: string;
    public readonly originalCause?: any;

    constructor(
        message: string,
        type: string,
        isOperational = true,
        severity: ErrorSeverity = 'HIGH',
        component = 'System',
        originalCause?: any
    ) {
        super(message);
        this.type = type;
        this.isOperational = isOperational;
        this.originalCause = originalCause;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        let file = 'unknown';
        let line = 0;
        let functionName = 'unknown';

        if (this.stack) {
            const lines = this.stack.split('\n');
            if (lines.length > 1) {
                const match =
                    lines[1].match(/at (.+) \((.+):(\d+):(\d+)\)/) ||
                    lines[1].match(/at (.+):(\d+):(\d+)/);
                if (match) {
                    if (match.length === 5) {
                        functionName = match[1];
                        file = match[2];
                        line = parseInt(match[3], 10);
                    } else if (match.length === 4) {
                        file = match[1];
                        line = parseInt(match[2], 10);
                    }
                }
            }
        }

        // Safely register with ErrorRegistry without risking secondary throws in Serverless
        let registeredId = `err_${Date.now()}`;
        try {
            const registry = ErrorRegistry.getInstance();
            const record = registry.registerError({
                severity,
                component,
                functionName,
                file,
                line,
                originalError: this.originalCause ? this.originalCause : this
            });
            if (record?.id) {
                registeredId = record.id;
            }
        } catch (regErr) {
            console.error('[AppError] Failed to register error in ErrorRegistry:', regErr);
        }

        this.errorId = registeredId;
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 'ValidationError', true, 'MEDIUM', 'Validation');
    }
}

export class DatabaseError extends AppError {
    constructor(message: string, public readonly originalCause?: any) {
        super(message, 'DatabaseError', true, 'HIGH', 'Database', originalCause);
    }
}

export class GeminiError extends AppError {
    constructor(message: string, public readonly originalCause?: any) {
        super(message, 'GeminiError', true, 'HIGH', 'API', originalCause);
    }
}

export class GroqError extends AppError {
    constructor(message: string, public readonly originalCause?: any) {
        super(message, 'GroqError', true, 'HIGH', 'API', originalCause);
    }
}

export class TelegramError extends AppError {
    constructor(message: string, public readonly originalCause?: any) {
        super(message, 'TelegramError', true, 'HIGH', 'Telegram', originalCause);
    }
}

export class NotionError extends AppError {
    constructor(message: string) {
        super(message, 'NotionError', true, 'MEDIUM', 'API');
    }
}

/**
 * Converts any caught error into a short, natural Egyptian Arabic message for Dr. Marko
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
    if (error instanceof ValidationError) {
        return `⚠️ ${error.message}`;
    }
    if (error instanceof DatabaseError) {
        return '⚠️ حصلت مشكلة سريعة وأنا بحفظ في الداتابيز، جرب تاني بعد ثواني.';
    }
    if (error instanceof GeminiError || error instanceof GroqError) {
        return '⚠️ سيرفر الذكاء الاصطناعي عليه ضغط لحظي، ابعتها تاني كده؟';
    }
    return '⚠️ حصلت لخبطة بسيطة، جرب تبعتها تاني يا دكتور.';
}