import { useEffect, useRef } from 'react'
import { useSessionStream } from '@/lib/useSessionStream'
import type { SessionEvent } from '@/lib/types'

function EventLine({ event }: { event: SessionEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString()

  switch (event.type) {
    case 'text':
      return (
        <div className="text-gray-200">
          <span className="text-gray-500 text-[10px] mr-2">{time}</span>
          {event.data.text as string}
        </div>
      )
    case 'tool_use':
      return (
        <div className="text-cyan-400">
          <span className="text-gray-500 text-[10px] mr-2">{time}</span>
          <span className="font-bold">{event.data.tool as string}</span>
          <span className="text-cyan-600 ml-1 text-[11px]">
            {JSON.stringify(event.data.input, null, 0).slice(0, 120)}
          </span>
        </div>
      )
    case 'result': {
      const cost = event.data.cost_usd as number | null
      const turns = event.data.turns as number | null
      const duration = event.data.duration_ms as number | null
      return (
        <div className="text-green-400 border-t border-gray-700 pt-1 mt-1">
          <span className="text-gray-500 text-[10px] mr-2">{time}</span>
          Done
          {turns != null && <span className="ml-2">{turns} turns</span>}
          {cost != null && <span className="ml-2">${cost.toFixed(4)}</span>}
          {duration != null && (
            <span className="ml-2">{(duration / 1000).toFixed(1)}s</span>
          )}
        </div>
      )
    }
    case 'error':
      return (
        <div className="text-red-400">
          <span className="text-gray-500 text-[10px] mr-2">{time}</span>
          Error: {event.data.message as string}
        </div>
      )
  }
}

function StatusIndicator({ status }: { status: string }) {
  // if (status === 'running') {
  //   return (
  //     <span className="inline-flex items-center gap-1.5 text-[10px] text-yellow-400">
  //       <span className="relative flex h-2 w-2">
  //         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
  //         <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
  //       </span>
  //       Running
  //     </span>
  //   )
  // }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-400">
        ✓ Complete
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
        ✗ Error
      </span>
    )
  }
  return null
}

export default function SessionLog({ nodeId, onComplete }: { nodeId: string; onComplete?: () => void }) {
  const { events, status, isStreaming } = useSessionStream(nodeId)
  const completeFiredRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  useEffect(() => {
    if ((status === 'completed' || status === 'error') && !completeFiredRef.current) {
      completeFiredRef.current = true
      onComplete?.()
    }
  }, [status, onComplete])

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 mt-3 flex flex-col max-h-[400px]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          Session Log
        </span>
        <StatusIndicator status={status} />
      </div>
      <div
        ref={scrollRef}
        className="p-3 overflow-y-auto flex-1 font-mono text-xs leading-relaxed space-y-0.5"
      >
        {status === 'none' && events.length === 0 && (
          <div className="text-gray-500">Connecting...</div>
        )}
        {status === 'running' && events.length === 0 && (
          <div className="text-gray-500">Waiting for Claude...</div>
        )}
        {events.map((event, i) => (
          <EventLine key={i} event={event} />
        ))}
      </div>
    </div>
  )
}
