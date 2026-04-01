import { useState, useEffect } from 'react'
import { supabase, getUser } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import TestsPage from './pages/TestsPage'
import TestPage  from './pages/TestPage'

export default function App() {
  const [user,       setUser]       = useState(undefined)   // undefined = loading
  const [view,       setView]       = useState('tests')      // 'tests' | 'test'
  const [activeTest, setActiveTest] = useState(null)

  /* ── Auth listener ──────────────────────────────────────────────────────── */
  useEffect(() => {
    getUser().then(setUser)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const email = session.user.email ?? ''
          if (email.endsWith('@curednutrition.com')) {
            setUser(session.user)
          } else {
            await supabase.auth.signOut()
            setUser(null)
          }
        } else {
          setUser(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  /* ── Navigation helpers ─────────────────────────────────────────────────── */
  function openTest(test) {
    setActiveTest(test)
    setView('test')
  }

  function backToTests() {
    setActiveTest(null)
    setView('tests')
  }

  /* ── Loading splash ─────────────────────────────────────────────────────── */
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return view === 'test'
    ? <TestPage  test={activeTest} onBack={backToTests} onTestUpdated={setActiveTest} />
    : <TestsPage onOpenTest={openTest} />
}
