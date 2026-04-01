import { useState } from 'react'
import { upsertChange, deleteChange } from '../lib/supabase'

const CHANGE_TYPES = [
  { value: 'text',       label: 'Swap text' },
  { value: 'image',      label: 'Swap image URL' },
  { value: 'visibility', label: 'Show / hide' },
]

const VISIBILITY_OPTIONS = [
  { value: 'show', label: 'Show' },
  { value: 'hide', label: 'Hide' },
]

export default function ChangeEditor({ variant, onRefresh, readonly }) {
  const changes = variant.variant_changes ?? []

  return (
    <div className="space-y-3">
      {changes.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          {readonly
            ? 'No element changes defined.'
            : 'No changes yet — this variant will serve the original page. Add a change below.'}
        </p>
      )}

      {changes.map((change) => (
        <ChangeRow
          key={change.id}
          change={change}
          variantId={variant.id}
          onRefresh={onRefresh}
          readonly={readonly}
        />
      ))}

      {!readonly && (
        <AddChangeRow variantId={variant.id} onRefresh={onRefresh} />
      )}
    </div>
  )
}

function ChangeRow({ change, variantId, onRefresh, readonly }) {
  const [elementId,  setElementId]  = useState(change.element_id)
  const [changeType, setChangeType] = useState(change.change_type)
  const [newValue,   setNewValue]   = useState(change.new_value)
  const [saving,     setSaving]     = useState(false)

  async function save() {
    setSaving(true)
    try {
      await upsertChange({
        id:          change.id,
        variant_id:  variantId,
        element_id:  elementId.trim(),
        change_type: changeType,
        new_value:   newValue.trim(),
      })
      await onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    await deleteChange(change.id)
    await onRefresh()
  }

  if (readonly) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-md px-3 py-2">
        <code className="font-mono bg-gray-100 px-1 rounded">{change.element_id}</code>
        <span className="text-gray-400">→</span>
        <span className="capitalize">{change.change_type}</span>
        <span className="text-gray-400">→</span>
        <span className="truncate max-w-xs">{change.new_value}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 bg-white border border-gray-200 rounded-md p-3">
      {/* CSS Selector */}
      <div className="flex-1 min-w-36">
        <label className="label text-xs">CSS selector</label>
        <input
          className="input text-xs font-mono"
          value={elementId}
          onChange={(e) => setElementId(e.target.value)}
          onBlur={save}
          placeholder="#hero-headline"
        />
      </div>

      {/* Change type */}
      <div className="w-40">
        <label className="label text-xs">Change type</label>
        <select
          className="input text-xs"
          value={changeType}
          onChange={(e) => { setChangeType(e.target.value); }}
          onBlur={save}
        >
          {CHANGE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* New value */}
      <div className="flex-1 min-w-36">
        <label className="label text-xs">
          {changeType === 'visibility' ? 'Action' : 'New value'}
        </label>
        {changeType === 'visibility' ? (
          <select
            className="input text-xs"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onBlur={save}
          >
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            className="input text-xs"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onBlur={save}
            placeholder={changeType === 'image' ? 'https://…/image.jpg' : 'New text content'}
          />
        )}
      </div>

      <div className="flex items-end gap-1">
        {saving && <span className="text-xs text-gray-400 animate-pulse pb-2">saving…</span>}
        <button onClick={remove} className="btn-ghost text-red-400 text-xs h-9" title="Remove">✕</button>
      </div>
    </div>
  )
}

function AddChangeRow({ variantId, onRefresh }) {
  const [adding,    setAdding]    = useState(false)
  const [elementId, setElementId] = useState('')
  const [changeType,setChangeType]= useState('text')
  const [newValue,  setNewValue]  = useState('')
  const [loading,   setLoading]   = useState(false)

  async function add() {
    if (!elementId.trim() || !newValue.trim()) return
    setLoading(true)
    try {
      await upsertChange({
        variant_id:  variantId,
        element_id:  elementId.trim(),
        change_type: changeType,
        new_value:   newValue.trim(),
      })
      setElementId('')
      setNewValue('')
      setChangeType('text')
      setAdding(false)
      await onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="text-xs text-sky-600 hover:text-sky-800 font-medium"
      >
        + Add element change
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 bg-white border border-dashed border-gray-300 rounded-md p-3">
      <div className="flex-1 min-w-36">
        <label className="label text-xs">CSS selector</label>
        <input
          className="input text-xs font-mono"
          value={elementId}
          onChange={(e) => setElementId(e.target.value)}
          placeholder="#element-id"
          autoFocus
        />
      </div>
      <div className="w-40">
        <label className="label text-xs">Change type</label>
        <select
          className="input text-xs"
          value={changeType}
          onChange={(e) => setChangeType(e.target.value)}
        >
          {CHANGE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-36">
        <label className="label text-xs">
          {changeType === 'visibility' ? 'Action' : 'New value'}
        </label>
        {changeType === 'visibility' ? (
          <select
            className="input text-xs"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          >
            <option value="hide">Hide</option>
            <option value="show">Show</option>
          </select>
        ) : (
          <input
            className="input text-xs"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={changeType === 'image' ? 'https://…' : 'New text'}
          />
        )}
      </div>
      <div className="flex gap-1">
        <button onClick={add} disabled={loading} className="btn-primary text-xs h-9">
          {loading ? '…' : 'Add'}
        </button>
        <button onClick={() => setAdding(false)} className="btn-ghost text-xs h-9">Cancel</button>
      </div>
    </div>
  )
}
