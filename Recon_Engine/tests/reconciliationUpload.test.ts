import request from 'supertest';
import app from '../src/index';
import path from 'path';
import fs from 'fs';

test('upload endpoint accepts two csv files', async () => {
    const bankCsv = 'date,description,amount\n2021-01-01,Deposit,100.00';
    const ledgerCsv = 'date,description,amount\n2021-01-01,Sale,100.00';

    const res = await request(app)
        .post('/api/reconciliation/upload')
        .attach('bankFile', Buffer.from(bankCsv), { filename: 'bank.csv', contentType: 'text/csv' })
        .attach('ledgerFile', Buffer.from(ledgerCsv), { filename: 'ledger.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.job_id).toBeDefined();
    expect(res.body.status).toBe('parsed');
});
