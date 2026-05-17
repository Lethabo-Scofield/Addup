import { parse } from 'csv-parse/sync';
import { cleanCSVBuffer } from './csvCleaner';

export function parseCSVBuffer(buffer: Buffer) {
    const { records } = cleanCSVBuffer(buffer);
    return records;
}

export function parseCSVWithReport(buffer: Buffer) {
    return cleanCSVBuffer(buffer);
}

export default { parseCSVBuffer, parseCSVWithReport };
