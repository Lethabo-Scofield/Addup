import express from 'express';
import bodyParser from 'body-parser';
import reconciliationRoutes from './routes/reconciliation.routes';
import logger from './logger';

const app = express();
app.use(bodyParser.json());

app.use('/api/reconciliation', reconciliationRoutes);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Addup Engine v1 listening');
    });
}

export default app;
