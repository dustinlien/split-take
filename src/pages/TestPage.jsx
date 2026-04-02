import { useState, useCallback } from 'react'
import { fetchTest, updateTestStatus, endTest } from '../lib/supabase'
import VariantEditor    from '../components/VariantEditor'
import ResultsDashboard from '../components/ResultsDashboard'
import SnippetPanel     from '../components/SnippetPanel'
import EndTestModal     from '../components/EndTestModal'
import { STMark }       from './LoginPage'

const STATUS_DOT = {
  draft:   'bg-gray-300',
  running: 'bg-emerald-500',
  paused:  'bg-amber-400',
  ended:   'bg-gray-300',
}

const STATUS_LABEL = {
  draft:   'text-gray-500',
  running: 'text-emerald-700',
  paused:  'text-amber-600',
  ended:   'text-gray-400',
}

const TABS = ['Setup', 'Snippet', 'Results']

export default function TestPage({ test: initialTest, onBack, onTestUpdated }) {
  const [test,    setTest]    = useState(initialTest)
  const [tab,     setTab]     = useState('Setup')
  const [loading, setLoading] = useState(false)
  const [showEnd, setShowEnd] = useState(false)
  const [error,   setError]   = useState(null)

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

  const canLaunch  = test.status === 'draft'  || test.status === 'paused'
  const canPause   = test.status === 'running'
  const canEnd     = test.status === 'running' || test.status === 'paused'
  const isEnded    = test.status === 'ended'

  const totalWeight = (test.variants ?? []).reduce((s, v) => s + v.traffic_weight, 0)
  const hasControl  = (test.variants ?? []).some((v) => v.is_control)
  const canLaunchOk = totalWeight === 100 && hasControl && (test.variants ?? []).length >= 2

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6">
          {/* Top bar */}
          <div className="h-14 flex items-center gap-4">
            {/* Back + logo */}
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <STMark size={24} />
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Test name + status */}
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[test.status]}`} />
              <span className="font-semibold text-gray-900 text-sm truncate">{test.name}</span>
              <span className={`text-xs font-medium capitalize shrink-0 ${STATUS_LABEL[test.status]}`}>
                {test.status}
              </span>
              {test.winner_variant_id && (
                <span className="text-xs text-amber-600 font-medium shrink-0">Winner set</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {canLaunch && (
                <button
                  onClick={() => handleStatusChange('running')}
                  disabled={loading || !canLaunchOk}
                  title={!canLaunchOk ? 'Weights must sum to 100, include a control, and have ≥2 variants' : ''}
                  className="h-8 px-3 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {test.status === 'paused' ? 'Resume' : 'Launch'}
                </button>
              )}
              {canPause && (
                <button
                  onClick={() => handleStatusChange('paused')}
                  disabled={loading}
                  className="h-8 px-3 text-xs font-medium border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Pause
                </button>
              )}
              {canEnd && (
                <button
                  onClick={() => setShowEnd(true)}
                  disabled={loading}
                  className="h-8 px-3 text-xs font-medium border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                >
                  End test
                </button>
              )}
              <button
                onClick={reload}
                className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors text-sm"
              >
                ↻
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* URL subtitle */}
          <div className="pb-2 -mt-1">
            <span className="text-xs text-gray-400 truncate">{test.url}</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-200 -mb-px">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === 'Setup'   && <VariantEditor    test={test} onRefresh={reload} readonly={isEnded} />}
        {tab === 'Snippet' && <SnippetPanel     test={test} />}
        {tab === 'Results' && <ResultsDashboard test={test} />}
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
