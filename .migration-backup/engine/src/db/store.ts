import fs from 'fs';
import path from 'path';

const DB_DIR = process.env.AD_DUP_DB_DIR || path.join(process.cwd(), 'db');
const JOBS_FILE = path.join(DB_DIR, 'jobs.json');

function ensureDir() {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, JSON.stringify({}), 'utf8');
}

export function insertJob(job_id: string, state: any, result?: any) {
    ensureDir();
    const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8') || '{}');
    data[job_id] = { state, result: result ?? null, created_at: new Date().toISOString() };
    fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function getJobRow(job_id: string) {
    ensureDir();
    const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8') || '{}');
    const entry = data[job_id];
    if (!entry) return null;
    return { job_id, state: entry.state, result: entry.result ?? null, meta: { created_at: entry.created_at } };
}

export default { insertJob, getJobRow };
