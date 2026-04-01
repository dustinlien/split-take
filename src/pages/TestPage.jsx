import { useState, useEffect, useCallback } from 'react'
import { fetchTest, updateTestStatus, endTest } from '../lib/supabase'
import VariantEditor    from '../components/VariantEditor'
import ResultsDashboard from '../components/ResultsDashboard'
import SnippetPanel     from '../components/SnippetPanel'
import EndTestModal     from '../components/EndTestModal'

const STATUS_COLORS = {
  draft:   'bg-gray-100 text-gray-600',
  running: 'bg-green-100 text-green-700',
  paused:  'bg-yellow-100 text-yellow-700',
  ended:   'bg-slate-100 text-slate-500',
}

const TABS = ['Setup', 'Snippet', 'Results']

export default function TestPage({ test: initialTest, onBack, onTestUpdated }) {
  const [test,       setTest]       = useState(initialTest)
  const [tab,        setTab]        = useState('Setup')
  const [loading,    setLoading]    = useState(false)
  const [showEnd,    setShowEnd]    = useState(false)
  const [error,      setError]      = useState(null)

  const reload = useCallback(async () => {
    try {
      const fresh = await fetchTest(test.id)
      setTest(fresh)
      onTestUpdated?.(fresh)
    } catch (e) { console.error(e) }
  }, [test.id, onTestUpdated])

  async function handleStatusChange(newStatus) {
    setLoading(true)
    setError(null)
    try {
      await updateTestStatus(test.id, newStatus)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleEnd(winnerVariantId) {
    setLoading(true)
    setError(null)
    try {
      await endTest(test.id, winnerVariantId)
      await reload()
      setShowEnd(false)
      setTab('Results')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const canLaunch  = test.status === 'draft'   || test.status === 'paused'
  const canPause   = test.status === 'running'
  const canEnd     = test.status === 'running'  || test.status === 'paused'
  const isEnded    = test.status === 'ended'

  const totalWeight = (test.variants ?? []).reduce((s, v) => s + v.traffic_weight, 0)
  const hasControl  = (test.variants ?? []).some((v) => v.is_control)
  const canLaunchOk = totalWeight === 100 && hasControl && (test.variants ?? []).length >= 2

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="btn-ghost text-sm">
            ← Tests
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[test.status]}`}
              >
                {test.status}
              </span>
              {test.winner_variant_id && (
                <span className="text-xs text-amber-600 font-medium">🏆 Winner declared</span>
              )}
            </div>
            <h1 className="font-semibold text-gray-900 truncate mt-0.5">{test.name}</h1>
            <p className="text-xs text-gray-400 truncate">{test.url}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {canLaunch && (
              <button
                onClick={() => handleStatusChange('running')}
                disabled={loading || !canLaunchOk}
                title={!canLaunchOk ? 'Weights must sum to 100, have ≥2 variants, and include a control' : ''}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {test.status === 'paused' ? '▶ Resume' : '▶ Launch'}
              </button>
            )}
            {canPause && (
              <button
                onClick={() => handleStatusChange('paused')}
                disabled={loading}
                className="btn-secondary"
              >
                ⏸ Pause
              </button>
            )}
            {canEnd && (
              <button
                onClick={() => setShowEnd(true)}
                disabled={loading}
                className="btn-danger"
              >
                End Test
              </button>
            )}
            <button onClick={reload} className="btn-ghost text-xs">↻</button>
          </div>
        </div>

        {error && (
          <div className="max-w-5xl mx-auto mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="max-w-5xl mx-auto flex gap-1 mt-4 border-b border-gray-200 -mb-px">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === 'Setup'    && <VariantEditor    test={test} onRefresh={reload} readonly={isEnded} />}
        {tab === 'Snippet'  && <SnippetPanel     test={test} />}
        {tab === 'Results'  && <ResultsDashboard test={test} />}
      </main>

      {showEnd && (
        <EndTestModal
          test={test}
          onClose={() => setShowEnd(false)}
          onConfirm={handleEnd}
          loading={loading}
        />
      )}
    </div>
  )
}
