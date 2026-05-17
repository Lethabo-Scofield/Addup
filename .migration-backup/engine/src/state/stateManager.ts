type JobState = {
    step: string;
    version: number;
    bank_file_checksum?: string;
    ledger_file_checksum?: string;
};

import { insertJob, getJobRow } from '../db/store';

const inMemorySeq = { v: 0 };

export function createJob(state: JobState, result?: any) {
    const ts = new Date().toISOString().replace(/[:T\-.Z]/g, '').slice(0, 14);
    inMemorySeq.v += 1;
    const seq = inMemorySeq.v.toString().padStart(3, '0');
    const job_id = `rec_${ts}_${seq}`;
    const job = { job_id, state };
    // persist state and optional full result
    insertJob(job_id, state, result ?? null);
    return job;
}

export function getJob(job_id: string) {
    return getJobRow(job_id);
}

export default { createJob, getJob };
