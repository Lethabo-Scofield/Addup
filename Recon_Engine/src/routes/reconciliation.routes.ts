import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/reconciliation.controller';
import { getJobController } from '../controllers/reconciliation.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.fields([
    { name: 'bankFile', maxCount: 1 },
    { name: 'ledgerFile', maxCount: 1 }
]), uploadController);

router.get('/job/:job_id', getJobController);

export default router;
