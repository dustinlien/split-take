import { useState, useEffect, useCallback } from 'react'
import { fetchTests, signOut } from '../lib/supabase'
import CreateTestModal from '../components/CreateTestModal'
import { STMark } from './LoginPage'

const STATUS_COLORS = {
  draft:   'bg-gray-100 text-gray-500',
  running: 'bg-emerald-100 text-emerald-700',
  paused:  'bg-amber-100 text-amber-700',
  ended:   'bg-gray-100 text-gray-500',
}

const STATUS_DOT = {
  running: 'bg-emerald-500',
  paused:  'bg-amber-400',
  draft:   'bg-gray-300',
  ended:   'bg-gray-300',
}

export default function TestsPage({ onOpenTest }) {
  const [tests,      setTests]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter,     setFilter]     = useState('all')

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

  const filtered = filter === 'all' ? tests : tests.filter((t) => t.status === filter)

  const counts = ['running', 'paused', 'draft', 'ended'].reduce((acc, s) => {
    acc[s] = tests.filter((t) => t.status === s).length
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <STMark size={26} />
            <span className="font-semibold text-gray-900 tracking-tight">Split Take</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-8 px-3 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              Refresh
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="h-8 px-3 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              + New Test
            </button>
            <button
              onClick={() => signOut()}
              className="h-8 px-3 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6">
          <FilterTab label="All" count={tests.length} active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterTab label="Running" count={counts.running} active={filter === 'running'} onClick={() => setFilter('running')} dot="bg-emerald-500" />
          <FilterTab label="Paused"  count={counts.paused}  active={filter === 'paused'}  onClick={() => setFilter('paused')}  dot="bg-amber-400" />
          <FilterTab label="Draft"   count={counts.draft}   active={filter === 'draft'}   onClick={() => setFilter('draft')} />
          <FilterTab label="Ended"   count={counts.ended}   active={filter === 'ended'}   onClick={() => setFilter('ended')} />
        </div>

        {loading ? (
          <div className="py-24 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-gray-400 mb-4">
              {filter === 'all' ? 'No tests yet.' : `No ${filter} tests.`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowCreate(true)}
                className="h-8 px-4 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Create your first test
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((test) => (
              <button
                key={test.id}
                onClick={() => onOpenTest(test)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-4">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[test.status]}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm truncate">{test.name}</span>
                      {test.winner_variant_id && (
                        <span className="shrink-0 text-xs text-amber-600 font-medium">Winner set</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{test.url}</div>
                  </div>

                  {/* Meta */}
                  <div className="shrink-0 flex items-center gap-4 text-xs text-gray-400">
                    <span className={`px-2 py-0.5 rounded-md font-medium capitalize ${STATUS_COLORS[test.status]}`}>
                      {test.status}
                    </span>
                    <span>{test.variants?.length ?? 0} variant{test.variants?.length !== 1 ? 's' : ''}</span>
                    <span>{new Date(test.created_at).toLocaleDateString()}</span>
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
          onCreated={(test) => { setShowCreate(false); onOpenTest(test) }}
        />
      )}
    </div>
  )
}

function FilterTab({ label, count, active, onClick, dot }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-gray-900 text-white font-medium'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white opacity-70' : dot}`} />}
      {label}
      {count > 0 && (
        <span className={`text-xs ${active ? 'opacity-60' : 'text-gray-400'}`}>{count}</span>
      )}
    </button>
  )
}
