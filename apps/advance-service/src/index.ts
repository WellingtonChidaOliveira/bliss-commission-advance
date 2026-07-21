import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT ?? 3002;
app.listen(port, () => {
  console.log(`advance-service listening on port ${port}`);
});
