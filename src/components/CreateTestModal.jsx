import { useState } from 'react'
import { createTest, upsertVariant, fetchTest } from '../lib/supabase'
import Modal from './ui/Modal'

export default function CreateTestModal({ onClose, onCreated }) {
  const [name,    setName]    = useState('')
  const [url,     setUrl]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return

    setLoading(true)
    setError(null)

    try {
      const test = await createTest({ name: name.trim(), url: url.trim() })

      // Auto-create a Control variant so the user has a starting point
      await upsertVariant({
        test_id:        test.id,
        label:          'Control',
        traffic_weight: 50,
        is_control:     true,
      })

      // Refresh the test so it includes variants
      const full = await fetchTest(test.id)
      onCreated(full)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="New Test" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Test name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Homepage hero headline"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label">URL to test</label>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://curednutrition.com"
            type="url"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Exact URL match (without trailing slash or hash). The snippet matches visitors on this page.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating…' : 'Create Test'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
