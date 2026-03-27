const express = require('express');
const cors = require('cors');
const path = require('path');
const { rateLimit } = require('express-rate-limit');

const transactionsRouter = require('./routes/transactions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rate-limit API endpoints: 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

// API routes
app.use('/api', apiLimiter);
app.use('/api/transactions', transactionsRouter);

// Serve React frontend static build in production
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));

// Fallback: serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
