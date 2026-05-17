import { checksumBuffer } from '../src/state/checksum';

test('checksum determinism', () => {
    const a = Buffer.from('hello');
    const b = Buffer.from('hello');
    expect(checksumBuffer(a)).toBe(checksumBuffer(b));
});
