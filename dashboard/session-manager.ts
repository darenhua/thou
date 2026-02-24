/**
 * session-manager.ts — Manages Claude sessions, writes events to JSONL files,
 * and broadcasts updates to WebSocket subscribers via fs.watch.
 *
 * Also updates the tree file with completed_at + result when the session ends.
 */

import { watch } from 'node:fs'
import { appendFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ServerWebSocket } from 'bun'
import {
  runScopedSession,
  type ScopedSessionConfig,
  type SessionEvent,
} from '../src/lib/scoped-session'
import { loadGraph, saveNode } from './src/lib/graph-store'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const activeSessions = new Map<
  string,
  { status: 'running' | 'completed' | 'error' }
>()

// nodeId -> set of connected WebSocket clients
const subscribers = new Map<string, Set<ServerWebSocket<{ nodeId: string }>>>()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sessionLogPath(treeDir: string, nodeId: string): string {
  return join(treeDir, `${nodeId}.session.jsonl`)
}

export function getSessionStatus(
  nodeId: string
): 'running' | 'completed' | 'error' | 'none' {
  return activeSessions.get(nodeId)?.status ?? 'none'
}

function broadcast(nodeId: string, message: string) {
  const subs = subscribers.get(nodeId)
  if (!subs) return
  for (const ws of subs) {
    ws.send(message)
  }
}

// ---------------------------------------------------------------------------
// WebSocket subscription management
// ---------------------------------------------------------------------------

export function addSubscriber(
  nodeId: string,
  ws: ServerWebSocket<{ nodeId: string }>
) {
  let subs = subscribers.get(nodeId)
  if (!subs) {
    subs = new Set()
    subscribers.set(nodeId, subs)
  }
  subs.add(ws)
}

export function removeSubscriber(
  nodeId: string,
  ws: ServerWebSocket<{ nodeId: string }>
) {
  const subs = subscribers.get(nodeId)
  if (!subs) return
  subs.delete(ws)
  if (subs.size === 0) {
    subscribers.delete(nodeId)
  }
}

// ---------------------------------------------------------------------------
// Session runner
// ---------------------------------------------------------------------------

export async function startSession(
  config: ScopedSessionConfig,
  treeDir: string,
  onComplete?: (nodeId: string) => Promise<void> | void,
): Promise<void> {
  const { nodeId } = config
  const logPath = sessionLogPath(treeDir, nodeId)

  // Initialize empty session log (setup.sh will create outputDir)
  await writeFile(logPath, '', 'utf-8')
  activeSessions.set(nodeId, { status: 'running' })

  // Broadcast status change
  broadcast(nodeId, JSON.stringify({ type: 'status', status: 'running' }))

  // Watch the JSONL file and broadcast new lines as they're appended
  let lastSize = 0
  const watcher = watch(logPath, async () => {
    try {
      const file = Bun.file(logPath)
      const currentSize = file.size
      if (currentSize <= lastSize) return

      const raw = await file.text()
      const lines = raw.split('\n').filter(l => l.trim())

      // Only send lines we haven't sent yet
      const newLines = lines.slice(
        raw
          .substring(0, lastSize)
          .split('\n')
          .filter(l => l.trim()).length
      )

      for (const line of newLines) {
        broadcast(nodeId, line)
      }

      lastSize = currentSize
    } catch {
      // file may be mid-write, ignore
    }
  })

  // Fire-and-forget — run in background
  ;(async () => {
    let resultEvent: SessionEvent | null = null

    try {
      for await (const event of runScopedSession(config)) {
        await appendFile(logPath, `${JSON.stringify(event)}\n`, 'utf-8')

        if (event.type === 'result') {
          resultEvent = event
          activeSessions.set(nodeId, { status: 'completed' })
        }
      }

      const session = activeSessions.get(nodeId)
      if (session && session.status === 'running') {
        activeSessions.set(nodeId, { status: 'completed' })
      }
    } catch (err) {
      const errorEvent: SessionEvent = {
        type: 'error',
        nodeId,
        timestamp: new Date().toISOString(),
        data: { message: err instanceof Error ? err.message : String(err) },
      }
      await appendFile(logPath, `${JSON.stringify(errorEvent)}\n`, 'utf-8')
      activeSessions.set(nodeId, { status: 'error' })
    } finally {
      watcher.close()

      // Update tree file with completed_at + result
      try {
        const graph = await loadGraph(treeDir)
        const node = graph[nodeId]
        if (node) {
          const now = new Date().toISOString()
          node.timestamps.updated_at = now
          node.timestamps.completed_at = now
          if (resultEvent) {
            node.result = {
              status: 'completed',
              cost_usd: (resultEvent.data.cost_usd as number) ?? null,
              turns: (resultEvent.data.turns as number) ?? null,
              duration_ms: (resultEvent.data.duration_ms as number) ?? null,
              session_id: (resultEvent.data.session_id as string) ?? null,
            }
          } else {
            node.result = {
              status: getSessionStatus(nodeId) === 'error' ? 'error' : 'completed',
              cost_usd: null,
              turns: null,
              duration_ms: null,
              session_id: null,
            }
          }
          await saveNode(treeDir, node)
        }
      } catch {
        // best-effort tree file update
      }

      // Spawn dev server for the new prototype
      if (onComplete) {
        try {
          await onComplete(nodeId)
        } catch {
          // best-effort dev server spawn
        }
      }

      // Broadcast final status
      const finalStatus = getSessionStatus(nodeId)
      broadcast(
        nodeId,
        JSON.stringify({ type: 'status', status: finalStatus })
      )
    }
  })()
}

// ---------------------------------------------------------------------------
// Read full log (for initial load when WS connects)
// ---------------------------------------------------------------------------

export async function readSessionLog(
  treeDir: string,
  nodeId: string
): Promise<{ status: string; events: SessionEvent[] }> {
  const logPath = sessionLogPath(treeDir, nodeId)
  const status = getSessionStatus(nodeId)

  try {
    const raw = await Bun.file(logPath).text()
    const events = raw
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as SessionEvent)
    return { status, events }
  } catch {
    return { status, events: [] }
  }
}
