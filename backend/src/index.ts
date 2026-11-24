import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import hazardsRouter from './routes/hazards';
import routesRouter from './routes/routes';
import aiRouter from './routes/ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/hazards', hazardsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/ai', aiRouter);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
