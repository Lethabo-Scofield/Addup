import { detectFileType } from '../src/parsers/fileTypeDetector';

test('detects csv by extension and mimetype', () => {
    expect(detectFileType('bank.csv', 'text/csv')).toBe('csv');
    expect(detectFileType('file.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('excel');
    expect(detectFileType('doc.pdf', 'application/pdf')).toBe('pdf');
});
