import { useState } from 'react'
import { upsertVariant, deleteVariant } from '../lib/supabase'
import ChangeEditor from './ChangeEditor'

export default function VariantEditor({ test, onRefresh, readonly }) {
  const variants = test.variants ?? []
  const totalWeight = variants.reduce((s, v) => s + (v.traffic_weight || 0), 0)
  const weightOk    = totalWeight === 100
  const hasControl  = variants.some((v) => v.is_control)

  return (
    <div className="space-y-6">
      {/* Validation banner */}
      {!readonly && (
        <div className="flex gap-4 text-sm">
          <WeightIndicator weight={totalWeight} />
          {!hasControl && (
            <span className="text-red-600">⚠ No control variant defined</span>
          )}
          {variants.length < 2 && (
            <span className="text-yellow-600">⚠ Add at least one variant</span>
          )}
          {weightOk && hasControl && variants.length >= 2 && (
            <span className="text-green-700">✓ Ready to launch</span>
          )}
        </div>
      )}

      {/* Variant cards */}
      {variants.map((variant) => (
        <VariantCard
          key={variant.id}
          variant={variant}
          testId={test.id}
          onRefresh={onRefresh}
          readonly={readonly}
        />
      ))}

      {/* Add variant */}
      {!readonly && variants.length < 4 && (
        <AddVariantRow testId={test.id} onRefresh={onRefresh} />
      )}

      {!readonly && variants.length >= 4 && (
        <p className="text-xs text-gray-400">Maximum of 4 variants per test.</p>
      )}
    </div>
  )
}

function WeightIndicator({ weight }) {
  const ok = weight === 100
  return (
    <div className={`flex items-center gap-1.5 font-medium ${ok ? 'text-green-700' : 'text-red-600'}`}>
      <div className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      Traffic weights: {weight}% / 100%
    </div>
  )
}

function VariantCard({ variant, testId, onRefresh, readonly }) {
  const [label,  setLabel]  = useState(variant.label)
  const [weight, setWeight] = useState(variant.traffic_weight)
  const [saving, setSaving] = useState(false)
  const [open,   setOpen]   = useState(false)

  async function save() {
    setSaving(true)
    try {
      await upsertVariant({
        id:             variant.id,
        test_id:        testId,
        label:          label.trim() || 'Variant',
        traffic_weight: Number(weight) || 0,
        is_control:     variant.is_control,
      })
      await onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete "${variant.label}"? This removes all its changes and visit data.`)) return
    await deleteVariant(variant.id)
    await onRefresh()
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3">
        {/* Control badge */}
        {variant.is_control && (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Control
          </span>
        )}

        {/* Label */}
        {readonly ? (
          <span className="flex-1 font-medium text-gray-900">{variant.label}</span>
        ) : (
          <input
            className="input flex-1 text-sm font-medium"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={save}
            placeholder="Variant name"
          />
        )}

        {/* Weight */}
        <div className="flex items-center gap-1.5 shrink-0">
          {readonly ? (
            <span className="text-sm text-gray-700">{weight}%</span>
          ) : (
            <>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                className="input w-20 text-sm text-right"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onBlur={save}
              />
              <span className="text-sm text-gray-500">%</span>
            </>
          )}
        </div>

        {/* Expand changes */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="btn-ghost text-xs px-2"
          title="Element changes"
        >
          {open ? '▲' : '▼'} {variant.variant_changes?.length ?? 0} change{variant.variant_changes?.length !== 1 ? 's' : ''}
        </button>

        {/* Delete */}
        {!readonly && !variant.is_control && (
          <button onClick={remove} className="btn-ghost text-red-400 text-xs px-2" title="Delete variant">
            ✕
          </button>
        )}

        {saving && <span className="text-xs text-gray-400 animate-pulse">saving…</span>}
      </div>

      {/* Changes panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <ChangeEditor
            variant={variant}
            onRefresh={onRefresh}
            readonly={readonly}
          />
        </div>
      )}
    </div>
  )
}

function AddVariantRow({ testId, onRefresh }) {
  const [adding,  setAdding]  = useState(false)
  const [label,   setLabel]   = useState('')
  const [weight,  setWeight]  = useState(50)
  const [loading, setLoading] = useState(false)

  async function add() {
    if (!label.trim()) return
    setLoading(true)
    try {
      await upsertVariant({
        test_id:        testId,
        label:          label.trim(),
        traffic_weight: Number(weight) || 0,
        is_control:     false,
      })
      setLabel('')
      setWeight(50)
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
        className="btn-secondary w-full justify-center border-dashed"
      >
        + Add variant
      </button>
    )
  }

  return (
    <div className="card px-5 py-4 flex items-center gap-3">
      <input
        className="input flex-1 text-sm"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Variant B"
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <input
        type="number"
        min="0"
        max="100"
        className="input w-20 text-sm text-right"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <span className="text-sm text-gray-500 shrink-0">%</span>
      <button onClick={add} disabled={loading} className="btn-primary shrink-0">
        {loading ? '…' : 'Add'}
      </button>
      <button onClick={() => setAdding(false)} className="btn-ghost shrink-0">
        Cancel
      </button>
    </div>
  )
}
