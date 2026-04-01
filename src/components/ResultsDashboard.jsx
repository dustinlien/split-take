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

  const control = results?.find((r) => r.is_control)
  const totalVisitors = results?.reduce((s, r) => s + r.visitors, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Header row */}
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
        <WinnerBanner
          winnerVariantId={test.winner_variant_id}
          results={results}
        />
      )}

      {/* Summary stat */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total visitors" value={loading ? '—' : totalVisitors.toLocaleString()} />
        <StatCard
          label="Total conversions"
          value={loading ? '—' : (results?.reduce((s, r) => s + r.converters, 0) ?? 0).toLocaleString()}
        />
        <StatCard
          label="Overall CVR"
          value={
            loading || totalVisitors === 0 ? '—' :
            formatPct((results?.reduce((s, r) => s + r.converters, 0) ?? 0) / totalVisitors)
          }
        />
      </div>

      {/* Per-variant table */}
      {loading && !results ? (
        <div className="text-center py-12 text-gray-400 text-sm animate-pulse">Loading results…</div>
      ) : results?.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No data yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <Th>Variant</Th>
                <Th align="right">Visitors</Th>
                <Th align="right">Conversions</Th>
                <Th align="right">CVR</Th>
                <Th align="right">Lift vs Control</Th>
                <Th align="right">Confidence</Th>
              </tr>
            </thead>
            <tbody>
              {results?.map((r) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  isWinner={r.id === test.winner_variant_id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Methodology note */}
      <p className="text-xs text-gray-400">
        Significance is calculated using a one-tailed two-proportion z-test.
        Confidence ≥ 95% is considered statistically significant. Unique visitors and converters only.
      </p>

      {/* How to trigger conversions */}
      <div className="card px-5 py-4 bg-amber-50 border-amber-200">
        <p className="text-xs font-medium text-amber-800 mb-1">Logging conversions</p>
        <p className="text-xs text-amber-700">
          Call <code className="font-mono bg-amber-100 px-1 rounded">SplitTake.convert()</code> anywhere
          on your page when a conversion event fires (e.g. form submit, CTA click, purchase).
          It automatically logs for all active tests the visitor is enrolled in.
        </p>
      </div>
    </div>
  )
}

function ResultRow({ result, isWinner }) {
  const cvr = result.visitors > 0 ? result.converters / result.visitors : 0

  return (
    <tr className={`border-b border-gray-50 last:border-0 ${isWinner ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
      <td className="px-4 py-3 font-medium text-gray-900">
        <div className="flex items-center gap-2">
          {result.label}
          {result.is_control && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">control</span>
          )}
          {isWinner && <span className="text-amber-500 text-base">🏆</span>}
        </div>
      </td>
      <Td>{result.visitors.toLocaleString()}</Td>
      <Td>{result.converters.toLocaleString()}</Td>
      <Td>{result.visitors > 0 ? formatPct(cvr) : '—'}</Td>
      <Td>
        {result.is_control ? (
          <span className="text-gray-400">—</span>
        ) : result.lift === null ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span className={result.lift >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
            {result.lift >= 0 ? '+' : ''}{result.lift}%
          </span>
        )}
      </Td>
      <Td>
        {result.is_control ? (
          <span className="text-gray-400">—</span>
        ) : result.significance ? (
          <ConfidencePill confidence={result.significance.confidence} significant={result.significance.significant} />
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </Td>
    </tr>
  )
}

function ConfidencePill({ confidence, significant }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        significant
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
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
        <p className="text-xs text-amber-700">
          This variant is now serving 100% of traffic.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function Th({ children, align = 'left' }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-medium text-gray-500 text-${align}`}>
      {children}
    </th>
  )
}

function Td({ children }) {
  return (
    <td className="px-4 py-3 text-right text-gray-700">{children}</td>
  )
}

function formatPct(n) {
  return (n * 100).toFixed(2) + '%'
}
