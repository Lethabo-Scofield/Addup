export type Transaction = {
    id: string;
    source: 'bank' | 'ledger';
    date: string;
    description: string;
    amount: number;
    debit?: number;
    credit?: number;
    reference?: string;
    raw_row: Record<string, any>;
    row_hash: string;
};
