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
  const variants  = test.variants ?? []

  return (
    <div className="space-y-8">

      {/* ── Preview variants ─────────────────────────────────────────────── */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-1">Preview variants</h2>
        <p className="text-sm text-gray-500 mb-4">
          Open your live page with a specific variant applied — no logging, no cookie set.
          Great for checking desktop and mobile layouts before launching.
        </p>

        {variants.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No variants defined yet.</p>
        ) : (
          <div className="space-y-3">
            {variants.map((v) => (
              <VariantPreviewCard key={v.id} variant={v} baseUrl={test.url} />
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          Scan the QR code on your phone to preview on real mobile hardware, or open on desktop and press <kbd className="font-mono bg-gray-100 px-1 rounded text-gray-500">Cmd+Shift+M</kbd> in Chrome for device emulation.
        </p>
      </div>

      <hr className="border-gray-200" />

      {/* ── Snippet install ───────────────────────────────────────────────── */}
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
            will serve variants to real visitors.
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
          before any other scripts. It runs on every page load and fetches whichever tests
          are currently running for this URL.
        </Step>

        <Step n={2} title="Variants apply automatically">
          The snippet hides the page briefly, assigns the visitor to a variant (or reads their
          existing 30-day cookie), applies the element changes, then reveals the page — all
          before first paint.
        </Step>

        <Step n={3} title="Log conversions">
          Call <code className="font-mono text-xs bg-gray-100 px-1 rounded">SplitTake.convert()</code> anywhere
          in your page JS when a conversion occurs (button click, form submit, checkout, etc).
          <div className="mt-2 font-mono text-xs bg-gray-900 text-green-400 rounded-lg px-4 py-3 whitespace-pre">
            {`// Log for all active tests:\nSplitTake.convert()\n\n// Or target a specific test:\nSplitTake.convert('${test.id}')`}
          </div>
        </Step>

        <Step n={4} title="Multiple tests, same URL">
          You can run multiple tests on this URL simultaneously. The snippet handles all of them
          in a single request — visitors are assigned and tracked per-test independently.
        </Step>
      </div>

      {/* Test ID */}
      <div className="card px-4 py-3 bg-gray-50">
        <p className="text-xs text-gray-500 mb-1">Test ID</p>
        <code className="font-mono text-xs text-gray-700 break-all">{test.id}</code>
      </div>
    </div>
  )
}

// ── Variant preview card ──────────────────────────────────────────────────────

function VariantPreviewCard({ variant, baseUrl }) {
  const [copied,      setCopied]      = useState(false)
  const [showQR,      setShowQR]      = useState(false)

  const previewUrl = `${baseUrl}?_st_preview=${variant.id}`
  const qrUrl      = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(previewUrl)}`

  function copyLink() {
    navigator.clipboard.writeText(previewUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Variant label */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {variant.is_control && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">control</span>
          )}
          <span className="font-medium text-sm text-gray-900 truncate">{variant.label}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copyLink}
            className={`btn text-xs px-2.5 py-1.5 transition-all ${
              copied
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'btn-secondary'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>

          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs px-2.5 py-1.5"
          >
            Open ↗
          </a>

          <button
            onClick={() => setShowQR((q) => !q)}
            className="btn-ghost text-xs px-2.5 py-1.5"
            title="Show QR code for mobile preview"
          >
            📱 QR
          </button>
        </div>
      </div>

      {/* QR code panel */}
      {showQR && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-4">
          <img
            src={qrUrl}
            alt={`QR code for ${variant.label} preview`}
            width={90}
            height={90}
            className="rounded border border-gray-200 shrink-0"
          />
          <div className="text-xs text-gray-500 leading-relaxed">
            <p className="font-medium text-gray-700 mb-1">Mobile preview</p>
            <p>Scan with your phone to see <strong>{variant.label}</strong> on real mobile hardware.</p>
            <p className="mt-1 text-gray-400 break-all font-mono">{previewUrl}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step component ────────────────────────────────────────────────────────────

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
