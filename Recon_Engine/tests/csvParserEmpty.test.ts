import { parseCSVBuffer } from '../src/parsers/csvParser';

test('empty buffer returns empty array', () => {
    const res = parseCSVBuffer(Buffer.from('', 'utf8'));
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
});
