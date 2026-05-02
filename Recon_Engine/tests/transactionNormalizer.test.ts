import { normalizeTransactionsBatch } from '../src/normalizers/transactionNormalizer';

test('normalizes date and amounts and creates row_hash', () => {
    const rows = [{ date: '01/02/2021', description: 'x', debit: '10.00' }];
    const out = normalizeTransactionsBatch(rows, 'bank');
    expect(out.length).toBe(1);
    expect(out[0].date).toBe('2021-02-01');
    expect(out[0].amount).toBe(-10);
    expect(typeof out[0].row_hash).toBe('string');
});
