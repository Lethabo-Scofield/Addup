import { Request, Response } from 'express';
import { processUpload } from '../services/reconciliation.service';

export async function uploadController(req: Request, res: Response) {
    try {
        const files = req.files as any;
        const bankFile = files?.bankFile?.[0];
        const ledgerFile = files?.ledgerFile?.[0];

        if (!bankFile || !ledgerFile) {
            return res.status(400).json({ error: 'Both bankFile and ledgerFile are required' });
        }

        const result = await processUpload(bankFile, ledgerFile);
        return res.status(200).json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Internal error' });
    }
}

export async function getJobController(req: Request, res: Response) {
    try {
        const job_id = req.params.job_id;
        if (!job_id) return res.status(400).json({ error: 'job_id required' });
        const { getJob } = await import('../state/stateManager');
        const row = getJob(job_id);
        if (!row) return res.status(404).json({ error: 'job not found' });
        return res.status(200).json(row);
    } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Internal error' });
    }
}

export default { uploadController };
