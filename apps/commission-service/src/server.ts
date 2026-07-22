import { app } from './app';

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`commission-service listening on port ${port}`);
});
