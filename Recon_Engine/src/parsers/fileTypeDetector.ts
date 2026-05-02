export function detectFileType(filename: string, mimetype?: string) {
    const name = filename || '';
    const lower = name.toLowerCase();
    if (mimetype && mimetype.includes('csv')) return 'csv';
    if (lower.endsWith('.csv')) return 'csv';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'excel';
    if (lower.endsWith('.pdf')) return 'pdf';
    return 'unknown';
}

export default { detectFileType };
