import { FileWithBuffer } from '../types/reconciliation';
import { detectFileType } from '../parsers/fileTypeDetector';
import { parseCSVBuffer, parseCSVWithReport } from '../parsers/csvParser';
import { parseXLSXBuffer } from '../parsers/xlsxParser';
import { normalizeTransactionsBatch } from '../normalizers/transactionNormalizer';
import { validateTransactions } from '../validators/transactionValidator';
import { checksumBuffer } from '../state/checksum';
import { createJob } from '../state/stateManager';
import crypto from 'crypto';

export async function processUpload(bankFile: FileWithBuffer, ledgerFile: FileWithBuffer) {
    const bankChecksum = checksumBuffer(bankFile.buffer);
    const ledgerChecksum = checksumBuffer(ledgerFile.buffer);

    const bankType = detectFileType(bankFile.originalname, bankFile.mimetype);
    const ledgerType = detectFileType(ledgerFile.originalname, ledgerFile.mimetype);

    const bankParse = bankType === 'csv' ? parseCSVWithReport(bankFile.buffer) : bankType === 'excel' ? { records: parseXLSXBuffer(bankFile.buffer), invalidRows: [] } : { records: [], invalidRows: [] };
    const ledgerParse = ledgerType === 'csv' ? parseCSVWithReport(ledgerFile.buffer) : ledgerType === 'excel' ? { records: parseXLSXBuffer(ledgerFile.buffer), invalidRows: [] } : { records: [], invalidRows: [] };

    const bankRows = bankParse.records || [];
    const ledgerRows = ledgerParse.records || [];
    const bankInvalidRows = bankParse.invalidRows || [];
    const ledgerInvalidRows = ledgerParse.invalidRows || [];

    if (!bankRows.length || !ledgerRows.length) {
        return {
            error: 'Uploaded files could not be parsed or are empty',
            status: 'error'
        };
    }

    // Normalize bank first to extract reference years for ledger correction
    const bankNormalized = normalizeTransactionsBatch(bankRows, 'bank');
    // derive bank years from normalized bank transactions
    const bankYears: number[] = bankNormalized
        .map((t: any) => {
            if (!t || !t.date) return null;
            const d = new Date(t.date);
            return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
        })
        .filter((y: any) => y !== null) as number[];

    const ledgerNormalized = normalizeTransactionsBatch(ledgerRows, 'ledger', { bankYears });

    const bankValidated = validateTransactions(bankNormalized);
    const ledgerValidated = validateTransactions(ledgerNormalized);

    const state = {
        bank_file_checksum: bankChecksum,
        ledger_file_checksum: ledgerChecksum,
        step: 'parsed',
        version: 1
    };

    const fullResult = {
        bank: {
            transactions: bankValidated.transactions,
            schema: bankRows.length ? Object.keys(bankRows[0]) : {},
            issues: bankValidated.issues,
            invalid_rows: bankInvalidRows
        },
        ledger: {
            transactions: ledgerValidated.transactions,
            schema: ledgerRows.length ? Object.keys(ledgerRows[0]) : {},
            issues: ledgerValidated.issues,
            invalid_rows: ledgerInvalidRows
        },
        issues: [...bankValidated.issues, ...ledgerValidated.issues, ...(bankInvalidRows.map(r => ({ type: 'invalid_row', source: 'bank', ...r })) || []), ...(ledgerInvalidRows.map(r => ({ type: 'invalid_row', source: 'ledger', ...r })) || [])]
    };

    const job = createJob(state, fullResult);

    return {
        job_id: job.job_id,
        status: 'parsed',
        state: job.state,
        ...fullResult,
        next_step: 'normalize_review'
    };
}

export default { processUpload };
