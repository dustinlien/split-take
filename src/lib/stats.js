/**
 * Statistical significance utilities for Split Take.
 * Uses a two-proportion z-test to compare each variant against control.
 */

/**
 * Normal CDF approximation (Abramowitz & Stegun, error < 7.5e-8).
 * Returns P(X <= x) for X ~ N(0,1).
 */
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const poly =
    t * (0.319381530 +
    t * (-0.356563782 +
    t * (1.781477937 +
    t * (-1.821255978 +
    t * 1.330274429))))
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
  const cdf = 1 - pdf * poly
  return x >= 0 ? cdf : 1 - cdf
}

/**
 * Two-proportion z-test (one-tailed: is variant better than control?).
 */
export function zTest(n1, c1, n2, c2) {
  if (n1 < 1 || n2 < 1) return { z: 0, confidence: 0, significant: false }

  const p1    = c1 / n1
  const p2    = c2 / n2
  const pPool = (c1 + c2) / (n1 + n2)
  const se    = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2))

  if (se === 0) return { z: 0, confidence: 0, significant: false }

  const z          = (p2 - p1) / se
  const confidence = normalCDF(z)

  return {
    z:           Math.round(z * 1000) / 1000,
    confidence:  Math.round(confidence * 10000) / 100,
    significant: confidence >= 0.95,
  }
}

/**
 * Compute % lift of variant CVR over control CVR.
 */
export function lift(controlCVR, variantCVR) {
  if (controlCVR === 0) return null
  return Math.round(((variantCVR - controlCVR) / controlCVR) * 10000) / 100
}

/**
 * Given raw visits/conversions arrays and variants array,
 * returns per-variant result objects including revenue metrics.
 */
export function computeResults(variants, visits, conversions) {
  // Unique visitors per variant
  const visitorsByVariant = {}
  for (const { variant_id, visitor_token } of visits) {
    if (!visitorsByVariant[variant_id]) visitorsByVariant[variant_id] = new Set()
    visitorsByVariant[variant_id].add(visitor_token)
  }

  // Unique converters + total revenue per variant
  // Revenue is summed across all conversion events (not deduplicated — one purchase = one row)
  const convertersByVariant = {}
  const revenueByVariant    = {}

  for (const { variant_id, visitor_token, revenue } of conversions) {
    if (!convertersByVariant[variant_id]) convertersByVariant[variant_id] = new Set()
    convertersByVariant[variant_id].add(visitor_token)

    revenueByVariant[variant_id] = (revenueByVariant[variant_id] ?? 0) + (Number(revenue) || 0)
  }

  const results = variants.map((v) => {
    const visitors   = visitorsByVariant[v.id]?.size   ?? 0
    const converters = convertersByVariant[v.id]?.size ?? 0
    const revenue    = revenueByVariant[v.id]          ?? 0
    const cvr        = visitors   > 0 ? converters / visitors   : 0
    const rpv        = visitors   > 0 ? revenue    / visitors   : 0  // revenue per visitor
    const aov        = converters > 0 ? revenue    / converters : 0  // avg order value

    return { ...v, visitors, converters, cvr, revenue, rpv, aov }
  })

  const hasRevenue = results.some((r) => r.revenue > 0)
  const control    = results.find((r) => r.is_control)

  return results.map((r) => {
    if (r.is_control || !control) {
      return { ...r, lift: null, rpvLift: null, significance: null, hasRevenue }
    }

    const sig      = zTest(control.visitors, control.converters, r.visitors, r.converters)
    const liftPct  = lift(control.cvr, r.cvr)
    const rpvLift  = lift(control.rpv, r.rpv)

    return { ...r, lift: liftPct, rpvLift, significance: sig, hasRevenue }
  })
}
