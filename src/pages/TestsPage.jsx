import { useState, useEffect, useCallback } from 'react'
import { fetchTests, signOut } from '../lib/supabase'
import CreateTestModal from '../components/CreateTestModal'

const STATUS_COLORS = {
  draft:   'bg-gray-100 text-gray-600',
  running: 'bg-green-100 text-green-700',
  paused:  'bg-yellow-100 text-yellow-700',
  ended:   'bg-slate-100 text-slate-600',
}

export default function TestsPage({ onOpenTest }) {
  const [tests,       setTests]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)
  const [filter,      setFilter]      = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchTests()
      setTests(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all'
    ? tests
    : tests.filter((t) => t.status === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚗️</span>
          <span className="font-semibold text-gray-900">Split Take</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="btn-ghost text-xs">
            ↻ Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            + New Test
          </button>
          <button onClick={() => signOut()} className="btn-ghost text-xs text-gray-400">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {['all', 'running', 'paused', 'draft', 'ended'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                filter === f
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm animate-pulse">Loading tests…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🧪</div>
            <p className="text-gray-500 text-sm">
              {filter === 'all' ? 'No tests yet. Create your first test.' : `No ${filter} tests.`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary mt-4"
              >
                + New Test
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((test) => (
              <button
                key={test.id}
                onClick={() => onOpenTest(test)}
                className="card w-full text-left p-5 hover:border-sky-300 hover:shadow transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[test.status]}`}
                      >
                        {test.status}
                      </span>
                      {test.winner_variant_id && (
                        <span className="text-xs text-amber-600">🏆 Winner set</span>
                      )}
                    </div>
                    <div className="font-medium text-gray-900 truncate">{test.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{test.url}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-gray-600">
                      {test.variants?.length ?? 0} variant{test.variants?.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(test.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateTestModal
          onClose={() => setShowCreate(false)}
          onCreated={(test) => {
            setShowCreate(false)
            onOpenTest(test)
          }}
        />
      )}
    </div>
  )
}
