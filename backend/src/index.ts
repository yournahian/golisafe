import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import hazardsRouter from './routes/hazards';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/hazards', hazardsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
