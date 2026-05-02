import { parseCSVBuffer } from '../src/parsers/csvParser';

test('parses simple CSV', () => {
    const csv = 'date,description,amount\n2021-01-01,Test,100.50';
    const res = parseCSVBuffer(Buffer.from(csv, 'utf8'));
    expect(res.length).toBe(1);
    expect(res[0].date).toBe('2021-01-01');
    expect(res[0].amount).toBe('100.50');
});
