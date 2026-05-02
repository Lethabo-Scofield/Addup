import { parse } from 'csv-parse/sync';

type InvalidRow = { line: number; raw: string; reason: string };

export function cleanCSVBuffer(buffer: Buffer) {
    const invalidRows: InvalidRow[] = [];
    if (!buffer || buffer.length === 0) return { records: [], invalidRows };
    const text = buffer.toString('utf8');
    // First try strict parse to preserve original behavior when possible
    try {
        const strictRecords = parse(text, { columns: true, skip_empty_lines: true, trim: true });
        return { records: strictRecords.map((r: any) => ({ ...r })), invalidRows };
    } catch (err) {
        // fallback to relaxed parsing using arrays
    }

    const rows: string[][] = parse(text, { columns: false, skip_empty_lines: true, trim: true, relax_column_count: true });
    if (!rows || rows.length === 0) return { records: [], invalidRows };

    const header = rows[0].map((h) => String(h || '').trim());
    const headerLen = header.length;
    const records: any[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const lineNum = i + 1; // 1-based
        if (!row || row.length === 0 || row.every((c) => c === '')) continue;
        if (row.length === headerLen) {
            const obj: any = {};
            for (let j = 0; j < headerLen; j++) obj[header[j] || `col_${j}`] = row[j];
            records.push(obj);
        } else if (row.length < headerLen) {
            // pad missing columns
            const obj: any = {};
            for (let j = 0; j < headerLen; j++) obj[header[j] || `col_${j}`] = row[j] !== undefined ? row[j] : '';
            records.push(obj);
            invalidRows.push({ line: lineNum, raw: row.join(','), reason: 'missing_columns' });
        } else {
            // extra columns: merge extras into last header column
            const obj: any = {};
            for (let j = 0; j < headerLen - 1; j++) obj[header[j] || `col_${j}`] = row[j];
            const extra = row.slice(headerLen - 1).join(',');
            obj[header[headerLen - 1] || `col_${headerLen - 1}`] = extra;
            records.push(obj);
            invalidRows.push({ line: lineNum, raw: row.join(','), reason: 'extra_columns_merged' });
        }
    }

    return { records, invalidRows };
}

export default { cleanCSVBuffer };
