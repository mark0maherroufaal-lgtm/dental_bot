export class AppError extends Error {
    public readonly type: string;
    public readonly isOperational: boolean;

    constructor(message: string, type: string, isOperational = true) {
        super(message);
        this.type = type;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 'ValidationError', true);
    }
}

export class DatabaseError extends AppError {
    constructor(message: string, public readonly originalError?: any) {
        super(message, 'DatabaseError', true);
    }
}

export class GeminiError extends AppError {
    constructor(message: string) {
        super(message, 'GeminiError', true);
    }
}

export class TelegramError extends AppError {
    constructor(message: string) {
        super(message, 'TelegramError', true);
    }
}

export class NotionError extends AppError {
    constructor(message: string) {
        super(message, 'NotionError', true);
    }
}
