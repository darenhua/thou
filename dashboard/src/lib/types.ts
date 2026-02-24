export type NodeType = 'generate' | 'decompose' | 'variant' | 'join'

export interface TreeFile {
  id: string
  question: string
  prompt: string | null
  nodeType: NodeType
  childIds: string[]
  sourceNodeId: string | null
  timestamps: {
    created_at: string
    updated_at: string
    completed_at: string | null
    approved_at: string | null
  }
  bead: {
    id: string
    title: string
    status: string
    labels: string[]
  } | null
  result: {
    status: string
    cost_usd: number | null
    turns: number | null
    duration_ms: number | null
    session_id: string | null
  } | null
}

export interface PrototypeNode extends TreeFile {
  parentIds: string[]
}

export interface OperationResult {
  graph: Record<string, PrototypeNode>
  createdNodeIds: string[]
  updatedNodeIds: string[]
}

export type SessionEventType = 'text' | 'tool_use' | 'result' | 'error'

export interface SessionEvent {
  type: SessionEventType
  nodeId: string
  timestamp: string
  data: Record<string, unknown>
}

export type SessionStatus = 'running' | 'completed' | 'error' | 'none'
