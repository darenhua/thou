import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type NodeMouseHandler,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import '@xyflow/react/dist/style.css'

import ApprovalQueue from '@/components/ApprovalQueue'
import OperationModal from '@/components/OperationModal'
import type { OperationType } from '@/components/OperationToolbar'
import OperationToolbar from '@/components/OperationToolbar'
import PrototypeNode from '@/components/PrototypeNode'
import SessionLog from '@/components/SessionLog'
import {
  layoutGraph,
  type PrototypeNodeData,
} from '@/lib/graph-layout'
import type { PrototypeNode as PrototypeNodeType } from '@/lib/types'

const nodeTypes = { prototypeNode: PrototypeNode }

type ProtoMeta = Record<string, { description: string; port: number }>

function TypeBadge({ nodeType }: { nodeType: string }) {
  const badges: Record<string, { label: string; bg: string; text: string }> = {
    generate: { label: 'GEN', bg: 'bg-blue-100', text: 'text-blue-700' },
    decompose: { label: 'DEC', bg: 'bg-green-100', text: 'text-green-700' },
    variant: { label: 'VAR', bg: 'bg-orange-100', text: 'text-orange-700' },
    join: { label: 'JOIN', bg: 'bg-purple-100', text: 'text-purple-700' },
  }
  const badge = badges[nodeType] ?? badges.generate
  return (
    <span
      className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
    >
      {badge.label}
    </span>
  )
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Not approved'
  return new Date(ts).toLocaleString()
}

function GraphEditor() {
  const [graphNodes, setGraphNodes] = useState<PrototypeNodeType[]>([])
  const [protoMeta, setProtoMeta] = useState<ProtoMeta>({})
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PrototypeNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalType, setModalType] = useState<OperationType | null>(null)
  const [loading, setLoading] = useState(true)
  const reactFlow = useReactFlow()
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchGraph = useCallback(
    async (meta?: ProtoMeta) => {
      const [graphRes, metaRes] = await Promise.all([
        fetch('/api/graph'),
        meta ? null : fetch('/api/prototypes'),
      ])

      const data = (await graphRes.json()) as Record<string, PrototypeNodeType>
      const currentMeta: ProtoMeta = meta ??
        ((metaRes ? await metaRes.json() : {}) as ProtoMeta)

      if (!meta) {
        setProtoMeta(currentMeta)
      }

      const nodeList = Object.values(data)
      setGraphNodes(nodeList)

      const metaMap = new Map(
        Object.entries(currentMeta).map(([id, m]) => [id, m])
      )
      const layout = layoutGraph(nodeList, metaMap)
      setNodes(layout.nodes)
      setEdges(layout.edges)
      setLoading(false)
      return nodeList
    },
    [setNodes, setEdges]
  )

  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    if (event.shiftKey) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(node.id)) {
          next.delete(node.id)
        } else if (next.size < 2) {
          next.add(node.id)
        } else {
          const entries = Array.from(next)
          next.clear()
          next.add(entries[1])
          next.add(node.id)
        }
        return next
      })
    } else {
      setSelectedIds(new Set([node.id]))
    }
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleOperation = useCallback((type: OperationType) => {
    setModalType(type)
  }, [])

  const handleModalSubmit = useCallback(
    async (data: Record<string, string>) => {
      if (!modalType) return
      const selectedArr = Array.from(selectedIds)

      let body: Record<string, unknown>

      switch (modalType) {
        case 'generate':
          body = { type: 'generate', question: data.value.trim() }
          break
        case 'decompose': {
          const childQuestions = data.value
            .split('\n')
            .filter(l => l.trim())
            .slice(0, 2)
            .map(l => l.trim())
          body = {
            type: 'decompose',
            parentNodeId: selectedArr[0],
            childQuestions,
          }
          break
        }
        case 'variant':
          body = {
            type: 'variant',
            sourceNodeId: selectedArr[0],
            question: data.value.trim() || undefined,
          }
          break
        case 'join':
          body = {
            type: 'join',
            child1Id: selectedArr[0],
            child2Id: selectedArr[1],
            parentQuestion: data.value.trim(),
          }
          break
      }

      const res = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) return

      const result = (await res.json()) as {
        graph: Record<string, PrototypeNodeType>
        createdNodeIds: string[]
      }

      const nodeList = Object.values(result.graph)
      setGraphNodes(nodeList)

      const metaMap = new Map(
        Object.entries(protoMeta).map(([id, m]) => [id, m])
      )
      const layout = layoutGraph(nodeList, metaMap)

      setNodes(
        layout.nodes.map(n => ({
          ...n,
          className: result.createdNodeIds.includes(n.id)
            ? 'animate-highlight'
            : undefined,
        }))
      )
      setEdges(layout.edges)

      // Auto-select the first created node so user sees the session stream
      if (result.createdNodeIds.length > 0) {
        setSelectedIds(new Set([result.createdNodeIds[0]]))
      } else {
        setSelectedIds(new Set())
      }
      setModalType(null)

      setTimeout(() => {
        reactFlow.fitView({ padding: 0.2, duration: 300 })
      }, 50)

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = setTimeout(() => {
        setNodes(prev => prev.map(n => ({ ...n, className: undefined })))
      }, 1500)
    },
    [modalType, selectedIds, protoMeta, setNodes, setEdges, reactFlow]
  )

  const handleApprove = useCallback(
    async (nodeId: string) => {
      await fetch('/api/graph/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      })
      await fetchGraph(protoMeta)
    },
    [fetchGraph, protoMeta]
  )

  const handleDelete = useCallback(
    async (nodeId: string) => {
      if (
        !window.confirm(
          `Delete ${nodeId} from the graph?\nFiles on disk are kept.`
        )
      )
        return

      await fetch('/api/graph/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      })

      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })

      await fetchGraph(protoMeta)
    },
    [fetchGraph, protoMeta]
  )

  const handleRestart = useCallback(
    async (nodeId: string) => {
      await fetch('/api/graph/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      })
      await fetchGraph()
    },
    [fetchGraph]
  )

  const selectedNodeData = graphNodes.filter(n => selectedIds.has(n.id))
  const sheetOpen = selectedNodeData.length > 0
  const prevSheetOpen = useRef(false)

  useEffect(() => {
    if (sheetOpen === prevSheetOpen.current) return
    prevSheetOpen.current = sheetOpen

    const vp = reactFlow.getViewport()
    const shift = 300 // half the sheet width
    reactFlow.setViewport(
      { ...vp, x: vp.x + (sheetOpen ? -shift : shift) },
      { duration: 300 }
    )
  }, [sheetOpen, reactFlow])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-gray-400">
        Loading graph...
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes.map(n => ({
            ...n,
            selected: selectedIds.has(n.id),
          }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background gap={16} size={1} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} pannable zoomable />
          <Panel position="bottom-center">
            <div className="flex flex-col items-center mb-2">
              <ApprovalQueue
                graphNodes={graphNodes}
                protoMeta={protoMeta}
                onSelectNode={nodeId => setSelectedIds(new Set([nodeId]))}
              />
              <OperationToolbar
                selectedCount={selectedIds.size}
                onOperation={handleOperation}
              />
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {sheetOpen && (
        <div className="w-[600px] border-l border-gray-200 bg-gray-50 overflow-y-auto p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">
              {selectedNodeData.length === 1
                ? 'Details'
                : `${selectedNodeData.length} Nodes Selected`}
            </h2>
            {selectedNodeData.length === 1 && protoMeta[selectedNodeData[0].id] && (
              <button
                type="button"
                onClick={() => handleRestart(selectedNodeData[0].id)}
                title="Restart dev server"
                className="text-[11px] font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md px-2 py-0.5 transition-all"
              >
                Restart
              </button>
            )}
          </div>

          {selectedNodeData.map(node => {
            const meta = protoMeta[node.id]
            return (
              <div
                key={node.id}
                className="bg-white rounded-lg shadow-sm border border-gray-100 mb-3 flex flex-col flex-1 min-h-0"
              >
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <TypeBadge nodeType={node.nodeType} />
                    <span className="text-xs text-gray-400 font-mono">
                      {node.id}
                    </span>
                    {node.timestamps.approved_at && (
                      <span className="ml-auto text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded-full">
                        Approved
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-gray-800 mb-1">{node.question}</p>

                  {node.result?.session_id && (
                    <code className="block text-[9px] text-gray-500 bg-gray-100 rounded px-2 py-1 mb-2 font-mono select-all whitespace-pre-line">
                      {`cd ~/Desktop/cool-projects/ralph-kit-test/THOU-DEMO/prototypes/${node.id}\nclaude --resume ${node.result.session_id} --dangerously-skip-permissions`}
                    </code>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {meta && (
                      <div>
                        <span className="font-medium">Port:</span>{' '}
                        <a
                          href={`http://localhost:${meta.port}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {meta.port}
                        </a>
                      </div>
                    )}
                    {node.parentIds.length > 0 && (
                      <div>
                        <span className="font-medium">Parents:</span>{' '}
                        {node.parentIds.map(id => id.slice(0, 8)).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-2">
                    {!node.timestamps.approved_at && (
                      <button
                        type="button"
                        onClick={() => handleApprove(node.id)}
                        className="flex-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(node.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg px-3 py-1.5 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {node.timestamps.completed_at && meta ? (
                  <div className="flex-1 min-h-0 p-2">
                    <iframe
                      src={`http://localhost:${meta.port}`}
                      title={node.question}
                      className="w-full h-full min-h-[400px] rounded-lg border border-gray-200 bg-white"
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 px-4 pb-4">
                    <SessionLog nodeId={node.id} onComplete={() => fetchGraph()} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalType && (
        <OperationModal
          type={modalType}
          selectedNodes={selectedNodeData.map(n => ({
            id: n.id,
            question: n.question,
          }))}
          onSubmit={handleModalSubmit}
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <GraphEditor />
    </ReactFlowProvider>
  )
}
