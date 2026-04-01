import { useState } from 'react'
import { generateSnippet } from '../lib/snippet-template'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  ?? 'YOUR_SUPABASE_URL'
const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'YOUR_ANON_KEY'

export default function SnippetPanel({ test }) {
  const [copied, setCopied] = useState(false)

  const snippet = generateSnippet(SUPABASE_URL, ANON_KEY)

  function copy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isRunning = test.status === 'running'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-gray-900 mb-1">Install snippet</h2>
        <p className="text-sm text-gray-500">
          Paste this once into the <code className="font-mono text-xs bg-gray-100 px-1 rounded">&lt;head&gt;</code> of{' '}
          <strong className="font-medium text-gray-800 break-all">{test.url}</strong>.
          It never needs to change — all test config is pulled from Supabase at runtime.
        </p>
      </div>

      {!isRunning && (
        <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5">⚠</span>
          <span>
            This test is <strong>{test.status}</strong>. Launch it from the test header before the snippet
            will serve variants.
          </span>
        </div>
      )}

      {/* Snippet code block */}
      <div className="relative">
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={copy}
            className={`btn text-xs px-3 py-1.5 transition-all ${
              copied
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre className="card bg-gray-900 text-gray-100 text-xs leading-relaxed p-5 pr-20 overflow-x-auto rounded-xl font-mono whitespace-pre-wrap break-all">
          {snippet}
        </pre>
      </div>

      {/* Usage guide */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-800 text-sm">How it works</h3>

        <Step n={1} title="Install once">
          Paste the snippet into your page's <code className="font-mono text-xs bg-gray-100 px-1 rounded">&lt;head&gt;</code>,
          before any other scripts. It runs on every page load and automatically fetches whichever tests
          are currently running for this URL.
        </Step>

        <Step n={2} title="Variants apply automatically">
          The snippet suppresses the page briefly, fetches your running tests, assigns the visitor to a
          variant (or reads their existing assignment from a 30-day cookie), applies the element changes,
          then reveals the page — all before first paint.
        </Step>

        <Step n={3} title="Log conversions">
          Call <code className="font-mono text-xs bg-gray-100 px-1 rounded">SplitTake.convert()</code> anywhere
          in your page JS when a conversion occurs (button click, form submit, checkout, etc). It logs the
          conversion for every active test the visitor is enrolled in.
          <div className="mt-2 font-mono text-xs bg-gray-900 text-green-400 rounded-lg px-4 py-3">
            {`// Log a conversion for all active tests:\nSplitTake.convert()\n\n// Or target a specific test:\nSplitTake.convert('${test.id}')`}
          </div>
        </Step>

        <Step n={4} title="Multiple tests, same URL">
          You can run multiple tests on this URL simultaneously. The snippet handles all of them
          in a single request — visitors are assigned to variants per-test and tracked independently.
        </Step>
      </div>

      {/* Test ID */}
      <div className="card px-4 py-3 bg-gray-50">
        <p className="text-xs text-gray-500 mb-1">Test ID (for targeted conversion logging)</p>
        <code className="font-mono text-xs text-gray-700 break-all">{test.id}</code>
      </div>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="text-sm text-gray-600">
        <span className="font-medium text-gray-900">{title} — </span>
        {children}
      </div>
    </div>
  )
}
