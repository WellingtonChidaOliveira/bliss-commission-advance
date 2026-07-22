import express from 'express';
import { salesRouter } from './sales/sales.router';
import { commissionRouter } from './commissions/commission.router';

export const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(salesRouter);
app.use(commissionRouter);
