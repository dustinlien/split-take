import { useState } from 'react'
import Modal from './ui/Modal'

export default function EndTestModal({ test, onClose, onConfirm, loading }) {
  const [winnerId, setWinnerId] = useState('')
  const variants = test.variants ?? []

  return (
    <Modal title="End Test" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Ending the test stops all logging. Select a winner to serve that variant to 100% of future
          visitors (you can check results afterward).
        </p>

        <div>
          <label className="label">Declare winner</label>
          <div className="space-y-2">
            {variants.map((v) => (
              <label
                key={v.id}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  winnerId === v.id
                    ? 'border-sky-500 bg-sky-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="winner"
                  value={v.id}
                  checked={winnerId === v.id}
                  onChange={() => setWinnerId(v.id)}
                  className="accent-sky-600"
                />
                <span className="flex-1 text-sm font-medium text-gray-900">{v.label}</span>
                {v.is_control && (
                  <span className="text-xs text-gray-400">control</span>
                )}
                <span className="text-xs text-gray-500">{v.traffic_weight}%</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => winnerId && onConfirm(winnerId)}
            disabled={!winnerId || loading}
            className="btn-danger disabled:opacity-40"
          >
            {loading ? 'Ending…' : 'End Test & Set Winner'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
