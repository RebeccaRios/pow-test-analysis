'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const {
  computeMDE,
  requiredDays,
  getRecommendedPeriod,
  buildChartData,
  PERIOD_OPTIONS,
} = require('./stats');

const app = express();
app.use(cors());
app.use(express.json());

// ── Serve the frontend from the repo root ──────────────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ── POST /api/calculate ────────────────────────────────────────────────────
// Body (JSON):
//   traffic    {number}  daily visitors/sessions
//   days       {number}  selected test duration
//   m1Base     {number}  baseline rate metric (percent, e.g. 10.42)
//   m2Base     {number}  baseline value metric
//   m2CV       {number}  coefficient of variation for value metric
//   confidence {number}  z_alpha/2  (1.645 | 1.96 | 2.576)
//   power      {number}  z_beta     (0.524 | 0.842 | 1.282)
//   targetLift {number}  minimum relative lift to detect (percent, e.g. 5)
//
// Response (JSON): MDE results + recommendation + chart series
app.post('/api/calculate', (req, res) => {
  const { traffic, days, m1Base, m2Base, m2CV, confidence, power, targetLift } = req.body;

  if (!traffic || !days || !m1Base || !m2Base) {
    return res.status(400).json({ error: 'Missing required fields: traffic, days, m1Base, m2Base.' });
  }

  const cr       = m1Base / 100;
  const Z        = confidence + power;
  const variance = Math.pow(m2Base * m2CV, 2);

  const mde       = computeMDE({ traffic, days, cr, variance, m2Base, Z });
  const days_req  = requiredDays({ traffic, cr, Z, targetPct: targetLift });
  const recommended = getRecommendedPeriod({ traffic, cr, Z, targetPct: targetLift });
  const chartData = buildChartData({ traffic, cr, variance, m2Base, Z });

  res.json({
    ...mde,
    requiredDays:      days_req,
    recommendedPeriod: recommended,
    periodOptions:     PERIOD_OPTIONS,
    chartData,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Stats API  → http://localhost:${PORT}/api/calculate`);
  console.log(`Frontend   → http://localhost:${PORT}`);
});
