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
 *
 * @param {number} n1  - visitors in control
 * @param {number} c1  - converters in control
 * @param {number} n2  - visitors in variant
 * @param {number} c2  - converters in variant
 * @returns {{ z: number, confidence: number, significant: boolean }}
 */
export function zTest(n1, c1, n2, c2) {
  if (n1 < 1 || n2 < 1) return { z: 0, confidence: 0, significant: false }

  const p1 = c1 / n1
  const p2 = c2 / n2
  const pPool = (c1 + c2) / (n1 + n2)
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2))

  if (se === 0) return { z: 0, confidence: 0, significant: false }

  const z = (p2 - p1) / se
  // One-tailed confidence: how confident are we the variant is *better*?
  const confidence = normalCDF(z)

  return {
    z: Math.round(z * 1000) / 1000,
    confidence: Math.round(confidence * 10000) / 100, // as %
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
 * returns per-variant result objects.
 */
export function computeResults(variants, visits, conversions) {
  // Unique visitors and converters per variant
  const visitorsByVariant = {}
  const convertersByVariant = {}

  for (const { variant_id, visitor_token } of visits) {
    if (!visitorsByVariant[variant_id]) visitorsByVariant[variant_id] = new Set()
    visitorsByVariant[variant_id].add(visitor_token)
  }

  for (const { variant_id, visitor_token } of conversions) {
    if (!convertersByVariant[variant_id]) convertersByVariant[variant_id] = new Set()
    convertersByVariant[variant_id].add(visitor_token)
  }

  const results = variants.map((v) => {
    const visitors   = visitorsByVariant[v.id]?.size   ?? 0
    const converters = convertersByVariant[v.id]?.size ?? 0
    const cvr        = visitors > 0 ? converters / visitors : 0

    return { ...v, visitors, converters, cvr }
  })

  // Find control
  const control = results.find((r) => r.is_control)

  return results.map((r) => {
    if (r.is_control || !control) {
      return { ...r, lift: null, significance: null }
    }
    const sig  = zTest(control.visitors, control.converters, r.visitors, r.converters)
    const liftPct = lift(control.cvr, r.cvr)
    return { ...r, lift: liftPct, significance: sig }
  })
}
