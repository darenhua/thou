import { useEffect, useRef, useState } from 'react'
import type { SessionEvent, SessionStatus } from './types'

interface UseSessionStreamResult {
  events: SessionEvent[]
  status: SessionStatus
  isStreaming: boolean
}

export function useSessionStream(nodeId: string | null): UseSessionStreamResult {
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [status, setStatus] = useState<SessionStatus>('none')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!nodeId) {
      setEvents([])
      setStatus('none')
      return
    }

    // Reset state for new node
    setEvents([])
    setStatus('none')

    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${nodeId}`)
        if (!res.ok) return
        const data = await res.json()
        setStatus(data.status as SessionStatus)
        setEvents(data.events as SessionEvent[])
      } catch {
        // network error, will retry next interval
      }
    }

    // Fetch immediately, then poll every 1s
    poll()
    intervalRef.current = setInterval(poll, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [nodeId])

  // Stop polling once session is done
  useEffect(() => {
    if ((status === 'completed' || status === 'error') && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [status])

  return {
    events,
    status,
    isStreaming: status === 'running',
  }
}
