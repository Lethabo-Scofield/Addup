import { validateTransactions } from '../src/validators/transactionValidator';

test('validates missing fields', () => {
    const txns: any[] = [{ id: '1', date: '', amount: NaN, raw_row: {} }];
    const res = validateTransactions(txns as any);
    expect(res.issues.length).toBe(1);
});
