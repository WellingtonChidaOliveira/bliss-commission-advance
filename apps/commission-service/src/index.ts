import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`commission-service listening on port ${port}`);
});
