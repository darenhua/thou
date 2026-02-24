import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import type { PrototypeNodeData } from '@/lib/graph-layout'

const TYPE_BADGES: Record<string, { label: string; bg: string; text: string }> =
{
  generate: { label: 'GEN', bg: 'bg-blue-100', text: 'text-blue-700' },
  decompose: { label: 'DEC', bg: 'bg-green-100', text: 'text-green-700' },
  variant: { label: 'VAR', bg: 'bg-orange-100', text: 'text-orange-700' },
  join: { label: 'JOIN', bg: 'bg-purple-100', text: 'text-purple-700' },
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

function ShimmerSkeleton() {
  return (
    <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2 animate-pulse">
      <div className="h-6 bg-gray-200 rounded" />
      <div className="h-20 bg-gray-200 rounded" />
      <div className="h-[43px] bg-gray-200 rounded" />
    </div>
  )
}

export default function PrototypeNode({
  data,
  selected,
}: NodeProps & { data: PrototypeNodeData }) {
  const badge = TYPE_BADGES[data.nodeType] ?? TYPE_BADGES.generate
  const isApproved = data.approved_at !== null
  const isCompleted = data.completed_at !== null

  const borderColor = selected
    ? 'border-blue-500 ring-2 ring-blue-200'
    : isApproved
      ? 'border-green-400'
      : 'border-gray-200'

  return (
    <div
      className={`rounded-lg bg-white shadow-md border-2 w-[300px] overflow-hidden ${borderColor}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
          <span className="text-[10px] text-gray-400 font-mono">
            {data.shortId}
          </span>
          {isApproved && (
            <span className="ml-auto flex items-center gap-0.5 text-green-600 text-[10px]">
              <svg
                className="w-2.5 h-2.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                role="img"
                aria-label="Approved"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>

        <p className="text-[11px] text-gray-600 leading-tight mb-1.5">
          {truncate(data.description ?? data.question, 80)}
        </p>
      </div>

      {!isCompleted ? (
        <ShimmerSkeleton />
      ) : data.isPrototype && data.port ? (
        <div className="border-t border-gray-100 bg-gray-50 p-1">
          <iframe
            src={`http://localhost:${data.port}`}
            title={data.question}
            className="w-full h-[180px] rounded border border-gray-200 bg-white"
            style={{ pointerEvents: 'none' }}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-4 flex items-center justify-center">
          <span className="text-[10px] text-gray-400 italic">
            No preview available
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400"
      />
    </div>
  )
}
