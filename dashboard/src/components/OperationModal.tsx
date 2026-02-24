import { useCallback, useEffect, useRef, useState } from 'react'
import type { OperationType } from './OperationToolbar'

interface OperationModalProps {
  type: OperationType
  selectedNodes: { id: string; question: string }[]
  onSubmit: (data: Record<string, string>) => void
  onClose: () => void
}

const MODAL_CONFIG: Record<
  OperationType,
  { title: string; icon: string; color: string }
> = {
  generate: { title: 'Generate', icon: '+', color: 'text-blue-600' },
  decompose: { title: 'Decompose', icon: '\u2193', color: 'text-green-600' },
  variant: { title: 'Variant', icon: '~', color: 'text-orange-600' },
  join: { title: 'Join', icon: '\u2295', color: 'text-purple-600' },
}

export default function OperationModal({
  type,
  selectedNodes,
  onSubmit,
  onClose,
}: OperationModalProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const config = MODAL_CONFIG[type]

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        onSubmit({ value })
      }
    },
    [onClose, onSubmit, value]
  )

  const childLines = value.split('\n').filter(l => l.trim().length > 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <span className={`text-xl ${config.color}`}>{config.icon}</span>
          <h2 className="text-lg font-semibold text-gray-900">
            {config.title}
          </h2>
        </div>

        <div className="px-5 py-4 space-y-3">
          {type === 'decompose' && selectedNodes[0] && (
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">Decomposing:</span>{' '}
              {selectedNodes[0].question}
            </div>
          )}

          {type === 'variant' && selectedNodes[0] && (
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">Source:</span>{' '}
              {selectedNodes[0].question}
            </div>
          )}

          {type === 'join' && (
            <div className="text-sm text-gray-500 space-y-1">
              <div>
                <span className="font-medium text-gray-700">Child 1:</span>{' '}
                {selectedNodes[0]?.question}
              </div>
              <div>
                <span className="font-medium text-gray-700">Child 2:</span>{' '}
                {selectedNodes[1]?.question}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="op-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {type === 'generate' && 'Question'}
              {type === 'decompose' && 'Child questions (one per line, max 2)'}
              {type === 'variant' && 'Question (leave blank to reuse source)'}
              {type === 'join' && 'Parent question'}
            </label>
            <textarea
              id="op-input"
              ref={textareaRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              rows={type === 'decompose' ? 3 : 2}
              placeholder={
                type === 'variant'
                  ? 'Optional: override question...'
                  : 'Enter question...'
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            />
            {type === 'decompose' && (
              <p
                className={`text-xs mt-1 ${childLines.length > 2 ? 'text-red-500' : 'text-gray-400'}`}
              >
                {childLines.length}/2 children
                {childLines.length > 2 && ' \u2014 only first 2 will be used'}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ value })}
            disabled={type !== 'variant' && value.trim() === ''}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        </div>

        <div className="px-5 py-2 border-t border-gray-50 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Esc to close &middot; Cmd+Enter to submit
          </p>
        </div>
      </div>
    </div>
  )
}
