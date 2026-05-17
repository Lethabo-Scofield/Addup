import { Transaction } from '../types/transaction';

type ValidationResult = { transactions: Transaction[]; issues: any[] };

export function validateTransactions(txns: Transaction[]): ValidationResult {
    const issues: any[] = [];
    const out: Transaction[] = [];

    txns.forEach((t, idx) => {
        const rowIssues: string[] = [];
        if (!t.date) rowIssues.push('missing_date');
        if (typeof t.amount !== 'number' || Number.isNaN(t.amount)) rowIssues.push('invalid_amount');
        if (!t.raw_row) rowIssues.push('missing_raw_row');

        if (rowIssues.length) {
            issues.push({ index: idx, id: t.id, issues: rowIssues });
        }
        out.push(t);
    });

    return { transactions: out, issues };
}

export default { validateTransactions };
