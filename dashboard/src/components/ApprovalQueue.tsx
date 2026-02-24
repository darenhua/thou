import { useReactFlow } from '@xyflow/react'
import { useEffect, useState } from 'react'
import type { PrototypeNode } from '@/lib/types'

interface ApprovalQueueProps {
  graphNodes: PrototypeNode[]
  protoMeta: Record<string, { description: string; port: number }>
  onSelectNode: (nodeId: string) => void
}

type QueueStatus = 'in-progress' | 'ready-for-review' | 'no-server'

function getStatus(node: PrototypeNode, hasPort: boolean): QueueStatus {
  if (!node.timestamps.completed_at) return 'in-progress'
  if (!hasPort) return 'no-server'
  return 'ready-for-review'
}

const STATUS_STYLES: Record<
  QueueStatus,
  { bg: string; ring: string; label: string; extra?: string }
> = {
  'ready-for-review': {
    bg: 'bg-amber-200/80',
    ring: 'ring-amber-300/60',
    label: 'Ready for review',
  },
  'in-progress': {
    bg: 'bg-gray-200/80',
    ring: 'ring-gray-300/60',
    label: 'In progress',
    extra: 'queue-in-progress',
  },
  'no-server': {
    bg: 'bg-red-200/80',
    ring: 'ring-red-300/60',
    label: 'No dev server',
  },
}

const MAX_VISIBLE = 6

export default function ApprovalQueue({
  graphNodes,
  protoMeta,
  onSelectNode,
}: ApprovalQueueProps) {
  const reactFlow = useReactFlow()
  const [offset, setOffset] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  const nonApproved = graphNodes.filter(n => !n.timestamps.approved_at)

  // Mount / unmount animation
  useEffect(() => {
    if (nonApproved.length > 0) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true))
      })
    } else {
      setAnimateIn(false)
      const t = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(t)
    }
  }, [nonApproved.length])

  // Clamp carousel offset
  useEffect(() => {
    const max = Math.max(0, nonApproved.length - MAX_VISIBLE)
    if (offset > max) setOffset(max)
  }, [nonApproved.length, offset])

  const handleClick = (nodeId: string) => {
    onSelectNode(nodeId)
    // Delay fitView so the side-sheet viewport shift settles first
    setTimeout(() => {
      reactFlow.fitView({
        nodes: [{ id: nodeId }],
        duration: 400,
        padding: 0.3,
      })
    }, 350)
  }

  if (!mounted) return null

  const visible = nonApproved.slice(offset, offset + MAX_VISIBLE)
  const canLeft = offset > 0
  const canRight = offset + MAX_VISIBLE < nonApproved.length

  return (
    <div
      className={`
        flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-md
        border border-gray-200/80 px-2 py-1 mb-1.5
        transition-all duration-300 ease-out
        ${animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
      `}
    >
      <button
        type="button"
        disabled={!canLeft}
        onClick={() => setOffset(o => Math.max(0, o - 1))}
        className={`w-4 h-5 flex items-center justify-center text-[10px] transition-colors shrink-0 ${
          canLeft ? 'text-gray-400 hover:text-gray-600 cursor-pointer' : 'text-gray-200 cursor-default'
        }`}
      >
        ‹
      </button>

      <div className="flex items-center gap-1">
        {visible.map(node => {
          const status = getStatus(node, !!protoMeta[node.id])
          const s = STATUS_STYLES[status]
          const label =
            node.question.length > 40
              ? `${node.question.slice(0, 40)}…`
              : node.question
          return (
            <button
              key={node.id}
              type="button"
              title={`${label} — ${s.label}`}
              onClick={() => handleClick(node.id)}
              className={`
                w-5 h-5 rounded-md ${s.bg} ring-1 ${s.ring}
                hover:scale-125 active:scale-90
                transition-all duration-150 ease-out
                cursor-pointer shrink-0
                ${s.extra ?? ''}
              `}
            />
          )
        })}
      </div>

      <button
        type="button"
        disabled={!canRight}
        onClick={() => setOffset(o => o + 1)}
        className={`w-4 h-5 flex items-center justify-center text-[10px] transition-colors shrink-0 ${
          canRight ? 'text-gray-400 hover:text-gray-600 cursor-pointer' : 'text-gray-200 cursor-default'
        }`}
      >
        ›
      </button>
    </div>
  )
}
