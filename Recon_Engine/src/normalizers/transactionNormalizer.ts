import { Transaction } from '../types/transaction';
import { normalizeDate, normalizeAmount } from './utils';
import bankNormalizer from './bankNormalizer';
import ledgerNormalizer from './ledgerNormalizer';
import crypto from 'crypto';

export function normalizeTransactionsBatch(rows: any[], source: 'bank' | 'ledger', context?: { bankYears?: number[] }) {
    const normalizer = source === 'bank' ? bankNormalizer : ledgerNormalizer;
    return rows.map((raw: any, idx: number) => {
        const copy = { ...raw };
        const mapped = normalizer(copy);
        let date = normalizeDate(mapped.date);
        const amount = normalizeAmount(mapped.amount, mapped.debit, mapped.credit);

        // If ledger dates look far outside bank years, attempt to align to nearest bank year
        if (source === 'ledger' && date && context && Array.isArray(context.bankYears) && context.bankYears.length) {
            const parsed = date ? new Date(date) : null;
            if (parsed && !Number.isNaN(parsed.getTime())) {
                const y = parsed.getUTCFullYear();
                // find nearest bank year
                let nearest = context.bankYears[0];
                let bestDiff = Math.abs(y - nearest);
                for (const by of context.bankYears) {
                    const diff = Math.abs(y - by);
                    if (diff < bestDiff) { bestDiff = diff; nearest = by; }
                }
                // if difference is large (e.g., >3 years) replace year with nearest bank year
                if (bestDiff > 3) {
                    const newDate = new Date(Date.UTC(nearest, parsed.getUTCMonth(), parsed.getUTCDate()));
                    if (!Number.isNaN(newDate.getTime())) date = newDate.toISOString().slice(0, 10);
                }
            }
        }

        const rawCopy = JSON.parse(JSON.stringify(raw));
        const rowPayload = { source, date, description: mapped.description, amount, reference: mapped.reference, raw_row: rawCopy };
        const rowHash = crypto.createHash('sha256').update(JSON.stringify(sortedKeys(rowPayload))).digest('hex');
        const id = `txn_${rowHash.slice(0, 12)}`;

        const txn: Transaction = {
            id,
            source,
            date,
            description: mapped.description || '',
            amount,
            debit: mapped.debit,
            credit: mapped.credit,
            reference: mapped.reference,
            raw_row: rawCopy,
            row_hash: rowHash
        };

        return txn;
    });
}

function sortedKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortedKeys);
    const keys = Object.keys(obj).sort();
    const out: any = {};
    for (const k of keys) out[k] = sortedKeys(obj[k]);
    return out;
}

export default { normalizeTransactionsBatch };
