import { useState, useEffect, useCallback } from 'react'
import { fetchResults } from '../lib/supabase'
import { computeResults } from '../lib/stats'

export default function ResultsDashboard({ test }) {
  const [results,   setResults]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [lastFetch, setLastFetch] = useState(null)
  const [error,     setError]     = useState(null)

  const variants = test.variants ?? []

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { visits, conversions } = await fetchResults(test.id)
      const computed = computeResults(variants, visits, conversions)
      setResults(computed)
      setLastFetch(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [test.id, variants])

  useEffect(() => { load() }, [load])

  const totalVisitors    = results?.reduce((s, r) => s + r.visitors,   0) ?? 0
  const totalConversions = results?.reduce((s, r) => s + r.converters, 0) ?? 0
  const totalRevenue     = results?.reduce((s, r) => s + r.revenue,    0) ?? 0
  const hasRevenue       = results?.some((r) => r.revenue > 0) ?? false

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Results</h2>
          {lastFetch && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated {lastFetch.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm">
          {loading ? '↻ Loading…' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Winner banner */}
      {test.winner_variant_id && results && (
        <WinnerBanner winnerVariantId={test.winner_variant_id} results={results} />
      )}

      {/* Summary cards */}
      <div className={`grid gap-4 ${hasRevenue ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
        <StatCard label="Total visitors"    value={loading ? '—' : totalVisitors.toLocaleString()} />
        <StatCard label="Total conversions" value={loading ? '—' : totalConversions.toLocaleString()} />
        <StatCard
          label="Overall CVR"
          value={loading || totalVisitors === 0 ? '—' : formatPct(totalConversions / totalVisitors)}
        />
        {hasRevenue && (
          <StatCard
            label="Total revenue"
            value={loading ? '—' : formatCurrency(totalRevenue)}
            highlight
          />
        )}
      </div>

      {/* Per-variant table */}
      {loading && !results ? (
        <div className="text-center py-12 text-gray-400 text-sm animate-pulse">Loading results…</div>
      ) : results?.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No data yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Variant</Th>
                <Th align="right">Visitors</Th>
                <Th align="right">Conversions</Th>
                <Th align="right">CVR</Th>
                <Th align="right">CVR Lift</Th>
                {hasRevenue && <Th align="right">Revenue</Th>}
                {hasRevenue && <Th align="right">RPV</Th>}
                {hasRevenue && <Th align="right">AOV</Th>}
                {hasRevenue && <Th align="right">RPV Lift</Th>}
                <Th align="right">Confidence</Th>
              </tr>
            </thead>
            <tbody>
              {results?.map((r) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  isWinner={r.id === test.winner_variant_id}
                  hasRevenue={hasRevenue}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Methodology note */}
      <p className="text-xs text-gray-400">
        Significance uses a one-tailed two-proportion z-test. ≥95% confidence is flagged as significant.
        Unique visitors and converters only. RPV = revenue per visitor. AOV = average order value.
      </p>

      {/* Conversion logging reminder */}
      <div className="card px-5 py-4 bg-amber-50 border-amber-200 space-y-2">
        <p className="text-xs font-medium text-amber-800">Logging conversions with revenue</p>
        <p className="text-xs text-amber-700">
          Pass the order value as the second argument to track revenue per variant:
        </p>
        <div className="font-mono text-xs bg-gray-900 text-green-400 rounded-lg px-4 py-3 whitespace-pre">
          {`// Click conversion (no revenue):\nSplitTake.convert()\n\n// Purchase conversion (Shopify):\nSplitTake.convert(null, {{ checkout.total_price | divided_by: 100.0 }})`}
        </div>
      </div>
    </div>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────

function ResultRow({ result, isWinner, hasRevenue }) {
  const cvr = result.visitors > 0 ? result.converters / result.visitors : 0

  return (
    <tr className={`border-b border-gray-50 last:border-0 ${isWinner ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
      {/* Label */}
      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {result.label}
          {result.is_control && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">control</span>
          )}
          {isWinner && <span className="text-base">🏆</span>}
        </div>
      </td>

      <Td>{result.visitors.toLocaleString()}</Td>
      <Td>{result.converters.toLocaleString()}</Td>
      <Td>{result.visitors > 0 ? formatPct(cvr) : '—'}</Td>

      {/* CVR lift */}
      <Td>
        <LiftCell value={result.lift} />
      </Td>

      {/* Revenue columns */}
      {hasRevenue && <Td>{result.revenue > 0 ? formatCurrency(result.revenue) : '—'}</Td>}
      {hasRevenue && <Td>{result.rpv  > 0 ? formatCurrency(result.rpv)     : '—'}</Td>}
      {hasRevenue && <Td>{result.aov  > 0 ? formatCurrency(result.aov)     : '—'}</Td>}
      {hasRevenue && <Td><LiftCell value={result.rpvLift} /></Td>}

      {/* Confidence */}
      <Td>
        {result.is_control || !result.significance ? (
          <span className="text-gray-400">—</span>
        ) : (
          <ConfidencePill
            confidence={result.significance.confidence}
            significant={result.significance.significant}
          />
        )}
      </Td>
    </tr>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiftCell({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>
  return (
    <span className={`font-medium ${value >= 0 ? 'text-green-700' : 'text-red-600'}`}>
      {value >= 0 ? '+' : ''}{value}%
    </span>
  )
}

function ConfidencePill({ confidence, significant }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
      significant ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
    }`}>
      {confidence}%{significant ? ' ✓' : ''}
    </span>
  )
}

function WinnerBanner({ winnerVariantId, results }) {
  const winner = results.find((r) => r.id === winnerVariantId)
  if (!winner) return null
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
      <span className="text-2xl">🏆</span>
      <div>
        <p className="text-sm font-semibold text-amber-900">Winner: {winner.label}</p>
        <p className="text-xs text-amber-700">This variant is now serving 100% of traffic.</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`card px-4 py-3 ${highlight ? 'bg-green-50 border-green-200' : ''}`}>
      <p className={`text-xs mb-0.5 ${highlight ? 'text-green-700' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-2xl font-semibold ${highlight ? 'text-green-800' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function Th({ children, align = 'left' }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-medium text-gray-500 text-${align} whitespace-nowrap`}>
      {children}
    </th>
  )
}

function Td({ children }) {
  return <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{children}</td>
}

function formatPct(n) {
  return (n * 100).toFixed(2) + '%'
}

function formatCurrency(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
