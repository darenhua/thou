import { useCallback, useEffect, useRef, useState } from 'react'

interface SaveProjectModalProps {
  onSave: (name: string, description: string) => void
  onClose: () => void
}

export default function SaveProjectModal({ onSave, onClose }: SaveProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && name.trim()) {
        e.preventDefault()
        onSave(name.trim(), description.trim())
      }
    },
    [onClose, onSave, name, description]
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <span className="text-xl text-blue-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </span>
          <h2 className="text-lg font-semibold text-gray-900">
            Save as Project
          </h2>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500">
            All unsaved nodes will be assigned to this project.
          </p>

          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
              Project Name
            </label>
            <input
              id="project-name"
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Project"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="project-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this project about?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            />
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
            onClick={() => onSave(name.trim(), description.trim())}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Save Project
          </button>
        </div>

        <div className="px-5 py-2 border-t border-gray-50 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Esc to close &middot; Cmd+Enter to save
          </p>
        </div>
      </div>
    </div>
  )
}
