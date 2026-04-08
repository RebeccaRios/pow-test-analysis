'use strict';

const PERIOD_OPTIONS = [14, 21, 30, 45, 60, 90];

/**
 * Compute the Minimum Detectable Effect (MDE) for a given test duration.
 *
 * Two formulas depending on metric type:
 *  - Rate/proportion  → MDE = Z · √( 2·p·(1−p) / n )
 *  - Continuous/value → MDE = Z · √( 2·σ² / n )       where σ² = (baseline · CV)²
 *
 * @param {object} p
 * @param {number} p.traffic  - daily visitors / sessions
 * @param {number} p.days     - test duration in days
 * @param {number} p.cr       - baseline conversion rate as a fraction (e.g. 0.1042)
 * @param {number} p.variance - variance of the continuous metric  (stddev²)
 * @param {number} p.m2Base   - baseline value of the continuous metric
 * @param {number} p.Z        - combined z-score  (z_alpha/2 + z_beta)
 * @returns {{ n, m1_abs, m1_rel, m2_abs, m2_rel }}
 */
function computeMDE({ traffic, days, cr, variance, m2Base, Z }) {
  const n = (traffic * days) / 2;

  const m1_abs = Z * Math.sqrt((2 * cr * (1 - cr)) / n);
  const m1_rel = (m1_abs / cr) * 100;

  const m2_abs = Z * Math.sqrt((2 * variance) / n);
  const m2_rel = (m2_abs / m2Base) * 100;

  return { n, m1_abs, m1_rel, m2_abs, m2_rel };
}

/**
 * Required test duration (days) to detect a `targetPct`% relative lift on the
 * rate metric at the given confidence and power.
 *
 * Standard two-sample power formula (two-sided):
 *   n = Z² · 2 · p(1−p) / δ²     where δ = p · (targetPct / 100)
 *
 * @param {object} p
 * @param {number} p.traffic   - daily units
 * @param {number} p.cr        - baseline rate (fraction)
 * @param {number} p.Z         - z_alpha/2 + z_beta
 * @param {number} p.targetPct - target relative lift in percent (e.g. 5 for 5%)
 * @returns {number} required days (continuous, not rounded)
 */
function requiredDays({ traffic, cr, Z, targetPct }) {
  const delta = cr * (targetPct / 100);                       // absolute effect size
  const n_req = (Z * Z * 2 * cr * (1 - cr)) / (delta * delta);
  return (2 * n_req) / traffic;
}

/**
 * Returns the first period option (days) where the available sample size
 * meets the required sample size for the given target lift.
 * Returns null if none of the options is long enough.
 *
 * @param {object} p  - same shape as requiredDays()
 * @returns {number|null}
 */
function getRecommendedPeriod({ traffic, cr, Z, targetPct }) {
  const days_req = requiredDays({ traffic, cr, Z, targetPct });
  return PERIOD_OPTIONS.find(d => d >= days_req) ?? null;
}

/**
 * Build (x, y) data series for the MDE diminishing-returns curve
 * across the range 7–120 days (one point per day).
 *
 * @param {object} p
 * @param {number} p.traffic
 * @param {number} p.cr
 * @param {number} p.variance
 * @param {number} p.m2Base
 * @param {number} p.Z
 * @returns {{ m1: Array<{x,y}>, m2: Array<{x,y}> }}
 */
function buildChartData({ traffic, cr, variance, m2Base, Z }) {
  const m1 = [];
  const m2 = [];

  for (let d = 7; d <= 120; d++) {
    const pn = (traffic * d) / 2;
    m1.push({ x: d, y: (Z * Math.sqrt((2 * cr * (1 - cr)) / pn)) / cr * 100 });
    m2.push({ x: d, y: variance > 0 ? (Z * Math.sqrt((2 * variance) / pn)) / m2Base * 100 : 0 });
  }

  return { m1, m2 };
}

module.exports = { computeMDE, requiredDays, getRecommendedPeriod, buildChartData, PERIOD_OPTIONS };
