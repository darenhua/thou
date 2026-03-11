import dagre from '@dagrejs/dagre'
import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from '@xyflow/react'
import type { NodeType, PrototypeNode } from './types'

export type { NodeType, PrototypeNode }

export interface PrototypeNodeData {
  question: string
  nodeType: NodeType
  approved_at: string | null
  completed_at: string | null
  sourceNodeId: string | null
  shortId: string
  description: string | null
  port: number | null
  isPrototype: boolean
  projectSlug: string | null
  projectColor: string | null
  [key: string]: unknown
}

export const NODE_WIDTH = 320
export const NODE_HEIGHT = 280

export function prototypeToFlowNode(
  node: PrototypeNode,
  extra?: {
    description?: string | null
    port?: number | null
    projectColor?: string | null
  }
): ReactFlowNode<PrototypeNodeData> {
  const isProto = node.id.startsWith('thou-demo-')
  return {
    id: node.id,
    data: {
      question: node.question,
      nodeType: node.nodeType,
      approved_at: node.timestamps.approved_at,
      completed_at: node.timestamps.completed_at,
      sourceNodeId: node.sourceNodeId,
      shortId: node.id.slice(0, 8),
      description: extra?.description ?? null,
      port: extra?.port ?? null,
      isPrototype: isProto,
      projectSlug: node.project ?? null,
      projectColor: extra?.projectColor ?? null,
    },
    type: 'prototypeNode',
    position: { x: 0, y: 0 },
  }
}

export function layoutGraph(
  nodes: PrototypeNode[],
  protoMeta?: Map<string, { description: string; port: number }>,
  projectColors?: Map<string, string>
): {
  nodes: ReactFlowNode<PrototypeNodeData>[]
  edges: ReactFlowEdge[]
} {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] }
  }

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 })

  const nodeMap = new Map<string, PrototypeNode>()
  for (const node of nodes) {
    nodeMap.set(node.id, node)
  }

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  const edges: ReactFlowEdge[] = []

  for (const node of nodes) {
    for (const childId of node.childIds) {
      if (nodeMap.has(childId)) {
        g.setEdge(node.id, childId)
        edges.push({
          id: `${node.id}->${childId}`,
          source: node.id,
          target: childId,
          type: 'default',
        })
      }
    }

    if (
      node.sourceNodeId &&
      nodeMap.has(node.sourceNodeId) &&
      !node.childIds.includes(node.sourceNodeId)
    ) {
      g.setEdge(node.id, node.sourceNodeId)
      edges.push({
        id: `variant:${node.id}->${node.sourceNodeId}`,
        source: node.id,
        target: node.sourceNodeId,
        type: 'default',
      })
    }
  }

  dagre.layout(g)

  const flowNodes: ReactFlowNode<PrototypeNodeData>[] = nodes.map(node => {
    const dagreNode = g.node(node.id)
    const meta = protoMeta?.get(node.id)
    const projectColor = node.project
      ? projectColors?.get(node.project) ?? null
      : null
    const flowNode = prototypeToFlowNode(node, {
      description: meta?.description,
      port: meta?.port,
      projectColor,
    })
    flowNode.position = {
      x: dagreNode.x - NODE_WIDTH / 2,
      y: dagreNode.y - NODE_HEIGHT / 2,
    }
    return flowNode
  })

  // Tint edges to match project color when both endpoints share the same project
  const nodeProjectMap = new Map(nodes.map(n => [n.id, n.project]))
  const coloredEdges = edges.map(edge => {
    const srcProject = nodeProjectMap.get(edge.source)
    const tgtProject = nodeProjectMap.get(edge.target)
    if (srcProject && srcProject === tgtProject && projectColors?.has(srcProject)) {
      return { ...edge, style: { stroke: projectColors.get(srcProject) } }
    }
    return edge
  })

  return { nodes: flowNodes, edges: coloredEdges }
}
