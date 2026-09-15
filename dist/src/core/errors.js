"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotionError = exports.TelegramError = exports.GeminiError = exports.DatabaseError = exports.ValidationError = exports.AppError = void 0;
const ErrorRegistry_1 = require("./ErrorRegistry");
class AppError extends Error {
    constructor(message, type, isOperational = true, severity = 'HIGH', component = 'System', originalCause) {
        super(message);
        this.type = type;
        this.isOperational = isOperational;
        this.originalCause = originalCause;
        Error.captureStackTrace(this, this.constructor);
        let file = 'unknown';
        let line = 0;
        let functionName = 'unknown';
        if (this.stack) {
            const lines = this.stack.split('\n');
            if (lines.length > 1) {
                const match = lines[1].match(/at (.+) \((.+):(\d+):(\d+)\)/) || lines[1].match(/at (.+):(\d+):(\d+)/);
                if (match) {
                    if (match.length === 5) {
                        functionName = match[1];
                        file = match[2];
                        line = parseInt(match[3], 10);
                    }
                    else if (match.length === 4) {
                        file = match[1];
                        line = parseInt(match[2], 10);
                    }
                }
            }
        }
        const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
        const record = registry.registerError({
            severity,
            component,
            functionName,
            file,
            line,
            originalError: this.originalCause ? this.originalCause : this
        });
        this.errorId = record.id;
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 'ValidationError', true, 'MEDIUM', 'Validation');
    }
}
exports.ValidationError = ValidationError;
class DatabaseError extends AppError {
    constructor(message, originalCause) {
        super(message, 'DatabaseError', true, 'HIGH', 'Database', originalCause);
        this.originalCause = originalCause;
    }
}
exports.DatabaseError = DatabaseError;
class GeminiError extends AppError {
    constructor(message, originalCause) {
        super(message, 'GeminiError', true, 'HIGH', 'API', originalCause);
        this.originalCause = originalCause;
    }
}
exports.GeminiError = GeminiError;
class TelegramError extends AppError {
    constructor(message, originalCause) {
        super(message, 'TelegramError', true, 'HIGH', 'Telegram', originalCause);
        this.originalCause = originalCause;
    }
}
exports.TelegramError = TelegramError;
class NotionError extends AppError {
    constructor(message) {
        super(message, 'NotionError', true, 'MEDIUM', 'API');
    }
}
exports.NotionError = NotionError;
