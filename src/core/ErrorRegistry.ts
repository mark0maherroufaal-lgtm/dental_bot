import { supabase } from '../supabase';

export type ErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type ErrorStatus = 'OPEN' | 'INVESTIGATING' | 'FIXED' | 'VERIFIED' | 'WONT_FIX';

export interface ErrorRecord {
    id: string;
    timestamp: string;
    severity: ErrorSeverity;
    command?: string;
    component: string;
    functionName: string;
    file: string;
    line: number;
    column?: number;
    originalError: string;
    source?: string;
    rootCause: string;
    status: ErrorStatus;
    fix?: string;
    verification?: string;
    occurrences: number;
    lastSeen: string;
}

const SECRETS_REGEX = /(bot\d+:[a-zA-Z0-9_-]+)|(sk-[a-zA-Z0-9]{32,})|(ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g;

export class ErrorRegistry {
    private static instance: ErrorRegistry;
    private records: Map<string, ErrorRecord> = new Map();
    private pendingInserts: any[] = [];
    private sequence: number = 0;

    private constructor() {
        // Initialize sequence randomly for the session to prevent collisions
        this.sequence = Math.floor(Math.random() * 10000);
    }

    public static getInstance(): ErrorRegistry {
        if (!ErrorRegistry.instance) {
            ErrorRegistry.instance = new ErrorRegistry();
        }
        return ErrorRegistry.instance;
    }

    private generateId(): string {
        this.sequence++;
        const year = new Date().getFullYear();
        const num = this.sequence.toString().padStart(6, '0');
        const r = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ERR-${year}-${num}-${r}`;
    }

    public static redact(text: string | object | undefined): string {
        if (!text) return "";
        let str = typeof text === 'string' ? text : JSON.stringify(text);
        return str.replace(SECRETS_REGEX, '[REDACTED_SECRET]');
    }

    public registerError(params: {
        severity?: ErrorSeverity;
        component: string;
        functionName: string;
        file: string;
        line: number;
        column?: number;
        originalError: any;
        source?: string;
        command?: string;
    }): ErrorRecord {
        const errorMsg = ErrorRegistry.redact(params.originalError instanceof Error ? params.originalError.message : String(params.originalError));
        const stackTrace = params.originalError instanceof Error ? ErrorRegistry.redact(params.originalError.stack) : "";
        const now = new Date().toISOString();

        // Duplicate control
        for (const [id, record] of this.records.entries()) {
            if (record.file === params.file && record.line === params.line && record.component === params.component) {
                record.occurrences++;
                record.lastSeen = now;
                return record;
            }
        }

        const newId = this.generateId();
        const rootCause = `Error at ${params.file}:${params.line} - ${errorMsg}`;

        const newRecord: ErrorRecord = {
            id: newId,
            timestamp: now,
            severity: params.severity || 'HIGH',
            command: params.command,
            component: params.component,
            functionName: params.functionName,
            file: params.file,
            line: params.line,
            column: params.column,
            originalError: errorMsg + (stackTrace ? `\n${stackTrace}` : ''),
            source: params.source,
            rootCause,
            status: 'OPEN',
            occurrences: 1,
            lastSeen: now
        };

        this.records.set(newId, newRecord);
        this.logToConsole(newRecord);

        // Queue for DB insertion
        this.pendingInserts.push({
            error_id: newId,
            severity: newRecord.severity,
            component: newRecord.component,
            message: newRecord.originalError.substring(0, 500),
            stack: stackTrace,
            context: {
                file: newRecord.file,
                line: newRecord.line,
                function: newRecord.functionName
            },
            status: 'OPEN'
        });

        return newRecord;
    }

    public async flush() {
        if (this.pendingInserts.length === 0) return;
        
        const inserts = [...this.pendingInserts];
        this.pendingInserts = [];
        
        try {
            const { error } = await supabase.from('errors').insert(inserts);
            if (error) console.error("[ErrorRegistry] Failed to flush to DB:", error);
        } catch (e) {
            console.error("[ErrorRegistry] Exception during flush:", e);
        }
    }

    private logToConsole(record: ErrorRecord) {
        console.error(`[${record.id}] [${record.severity}] [${record.component}] ${record.functionName}() ${record.file}:${record.line}`);
    }

    public getActiveErrors(): ErrorRecord[] {
        return Array.from(this.records.values()).filter(r => r.status === 'OPEN' || r.status === 'INVESTIGATING');
    }

    public getAllErrors(): ErrorRecord[] {
        return Array.from(this.records.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    public getError(id: string): ErrorRecord | undefined {
        return this.records.get(id);
    }
}
