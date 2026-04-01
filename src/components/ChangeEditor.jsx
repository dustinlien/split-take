import { useState } from 'react'
import { upsertChange, deleteChange } from '../lib/supabase'

const CHANGE_TYPES = [
  { value: 'text',          label: 'Swap text',      isInsert: false },
  { value: 'image',         label: 'Swap image URL', isInsert: false },
  { value: 'visibility',    label: 'Show / hide',    isInsert: false },
  { value: 'insert_after',  label: 'Insert after',   isInsert: true  },
  { value: 'insert_before', label: 'Insert before',  isInsert: true  },
]

const VISIBILITY_OPTIONS = [
  { value: 'hide', label: 'Hide' },
  { value: 'show', label: 'Show' },
]

const TEMPLATES = [
  {
    label: 'Text',
    icon: '¶',
    html: `<p style="margin: 12px 0; font-size: 16px; color: #333;">Your text here</p>`,
  },
  {
    label: 'Button',
    icon: '⬡',
    html: `<a href="#" style="display: inline-block; padding: 12px 28px; background: #000; color: #fff; text-decoration: none; border-radius: 4px; font-size: 15px; font-weight: 600;">Click here</a>`,
  },
  {
    label: 'Badge',
    icon: '◉',
    html: `<span style="display: inline-block; padding: 4px 12px; background: #fef3c7; color: #92400e; border-radius: 99px; font-size: 13px; font-weight: 600;">⭐ Best Seller</span>`,
  },
  {
    label: 'Banner',
    icon: '▬',
    html: `<div style="padding: 12px 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 14px; color: #166534; text-align: center; margin: 8px 0;">🎉 Limited time offer — free shipping on all orders</div>`,
  },
  {
    label: 'Image',
    icon: '🖼',
    html: `<img src="https://your-image-url.jpg" alt="" style="max-width: 100%; height: auto; display: block; margin: 8px 0;" />`,
  },
  {
    label: 'Divider',
    icon: '—',
    html: `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />`,
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function ChangeEditor({ variant, onRefresh, readonly }) {
  const changes = variant.variant_changes ?? []

  return (
    <div className="space-y-3">
      {changes.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          {readonly
            ? 'No element changes defined.'
            : 'No changes yet — this variant serves the original page. Add a change below.'}
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

// ── Insert field: template palette + textarea + live preview ──────────────────

function InsertField({ value, onChange, onBlur }) {
  const [showPreview, setShowPreview] = useState(!!value)

  function applyTemplate(html) {
    onChange({ target: { value: html } })
    setShowPreview(true)
  }

  return (
    <div className="space-y-2 w-full">
      {/* Template palette */}
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => applyTemplate(t.html)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:border-sky-400 hover:text-sky-700 transition-colors"
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* HTML textarea */}
      <textarea
        className="input text-xs font-mono w-full resize-y"
        rows={4}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="<div>Your HTML here</div>"
        spellCheck={false}
      />

      {/* Preview toggle + pane */}
      {value.trim() && (
        <div>
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="text-xs text-sky-600 hover:text-sky-800 font-medium"
          >
            {showPreview ? '▲ Hide preview' : '▼ Show preview'}
          </button>

          {showPreview && (
            <div className="mt-2 rounded-md border border-gray-200 overflow-hidden bg-white">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-400">
                Preview
              </div>
              <iframe
                title="Element preview"
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:16px;font-family:system-ui,sans-serif;font-size:15px;}</style></head><body>${value}</body></html>`}
                sandbox="allow-same-origin"
                className="w-full"
                style={{ height: '120px', border: 'none', display: 'block' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared value field (delegates to InsertField for insert types) ─────────────

function ValueField({ changeType, value, onChange, onBlur, readonly }) {
  const isInsert = CHANGE_TYPES.find((t) => t.value === changeType)?.isInsert

  if (readonly) {
    return (
      <span className="truncate max-w-xs text-gray-600">
        {isInsert
          ? <span className="italic text-gray-400">HTML ({value.length} chars)</span>
          : value}
      </span>
    )
  }

  if (changeType === 'visibility') {
    return (
      <select className="input text-xs" value={value} onChange={onChange} onBlur={onBlur}>
        {VISIBILITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  if (isInsert) {
    return <InsertField value={value} onChange={onChange} onBlur={onBlur} />
  }

  return (
    <input
      className="input text-xs"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={changeType === 'image' ? 'https://…/image.jpg' : 'New text content'}
    />
  )
}

// ── Existing change row ───────────────────────────────────────────────────────

function ChangeRow({ change, variantId, onRefresh, readonly }) {
  const [elementId,  setElementId]  = useState(change.element_id)
  const [changeType, setChangeType] = useState(change.change_type)
  const [newValue,   setNewValue]   = useState(change.new_value)
  const [saving,     setSaving]     = useState(false)

  const isInsert = CHANGE_TYPES.find((t) => t.value === changeType)?.isInsert

  async function save() {
    if (!elementId.trim() || !newValue.trim()) return
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
        <span>{CHANGE_TYPES.find(t => t.value === change.change_type)?.label ?? change.change_type}</span>
        <span className="text-gray-400">→</span>
        <ValueField changeType={change.change_type} value={change.new_value} readonly />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3 space-y-3">
      {/* Selector + type + delete */}
      <div className="flex flex-wrap items-end gap-2">
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

        <div className="w-44">
          <label className="label text-xs">Change type</label>
          <select
            className="input text-xs"
            value={changeType}
            onChange={(e) => setChangeType(e.target.value)}
            onBlur={save}
          >
            {CHANGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-1 pb-0.5">
          {saving && <span className="text-xs text-gray-400 animate-pulse">saving…</span>}
          <button onClick={remove} className="btn-ghost text-red-400 text-xs h-9 px-2" title="Remove">✕</button>
        </div>
      </div>

      {/* Value field */}
      <div>
        <label className="label text-xs">
          {isInsert ? 'HTML to insert' : changeType === 'visibility' ? 'Action' : 'New value'}
        </label>
        <ValueField
          changeType={changeType}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onBlur={save}
        />
      </div>
    </div>
  )
}

// ── Add new change row ────────────────────────────────────────────────────────

function AddChangeRow({ variantId, onRefresh }) {
  const [adding,     setAdding]    = useState(false)
  const [elementId,  setElementId] = useState('')
  const [changeType, setChangeType]= useState('text')
  const [newValue,   setNewValue]  = useState('')
  const [loading,    setLoading]   = useState(false)

  const isInsert = CHANGE_TYPES.find((t) => t.value === changeType)?.isInsert

  function reset() {
    setElementId('')
    setChangeType('text')
    setNewValue('')
    setAdding(false)
  }

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
      reset()
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
    <div className="bg-white border border-dashed border-gray-300 rounded-md p-3 space-y-3">
      {/* Selector + type */}
      <div className="flex flex-wrap items-end gap-2">
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

        <div className="w-44">
          <label className="label text-xs">Change type</label>
          <select
            className="input text-xs"
            value={changeType}
            onChange={(e) => { setChangeType(e.target.value); setNewValue('') }}
          >
            {CHANGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Value field */}
      <div>
        <label className="label text-xs">
          {isInsert ? 'HTML to insert' : changeType === 'visibility' ? 'Action' : 'New value'}
        </label>
        <ValueField
          changeType={changeType}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={add}
          disabled={loading || !elementId.trim() || !newValue.trim()}
          className="btn-primary text-xs disabled:opacity-40"
        >
          {loading ? '…' : 'Add change'}
        </button>
        <button onClick={reset} className="btn-ghost text-xs">Cancel</button>
      </div>
    </div>
  )
}
