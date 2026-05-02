import XLSX from 'xlsx';

export function parseXLSXBuffer(buffer: Buffer) {
    if (!buffer || buffer.length === 0) return [];
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return records as any[];
}

export default { parseXLSXBuffer };
