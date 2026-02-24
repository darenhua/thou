import type { NodeType, OperationResult, PrototypeNode } from './types'

export type OperationPayload =
  | { type: 'generate'; question: string }
  | {
      type: 'decompose'
      parentNodeId: string
      childQuestions: string[]
    }
  | { type: 'variant'; sourceNodeId: string; question?: string }
  | {
      type: 'join'
      child1Id: string
      child2Id: string
      parentQuestion: string
    }

function generateId(): string {
  return `thou-demo-${crypto.randomUUID().slice(0, 8)}`
}

function now(): string {
  return new Date().toISOString()
}

function createNode(
  overrides: Partial<PrototypeNode> & {
    question: string
    nodeType: NodeType
  }
): PrototypeNode {
  const ts = now()
  return {
    id: generateId(),
    childIds: [],
    parentIds: [],
    sourceNodeId: null,
    prompt: null,
    bead: null,
    result: null,
    timestamps: {
      created_at: ts,
      updated_at: ts,
      completed_at: null,
      approved_at: null,
    },
    ...overrides,
  }
}

export function applyOperation(
  graph: Record<string, PrototypeNode>,
  op: OperationPayload
): OperationResult {
  const updated = { ...graph }
  const createdNodeIds: string[] = []
  const updatedNodeIds: string[] = []

  switch (op.type) {
    case 'generate': {
      const node = createNode({
        question: op.question,
        nodeType: 'generate',
      })
      updated[node.id] = node
      createdNodeIds.push(node.id)
      break
    }

    case 'decompose': {
      const parent = updated[op.parentNodeId]
      if (!parent) {
        throw new Error(`Parent node "${op.parentNodeId}" does not exist`)
      }
      if (parent.childIds.length >= 2) {
        throw new Error(
          `Parent node "${op.parentNodeId}" already has 2 children`
        )
      }
      const maxNew = 2 - parent.childIds.length
      const questions = op.childQuestions.slice(0, maxNew)
      if (questions.length === 0) {
        throw new Error('At least one child question is required')
      }

      const updatedParent = {
        ...parent,
        childIds: [...parent.childIds],
        timestamps: { ...parent.timestamps, updated_at: now() },
      }

      for (const q of questions) {
        const child = createNode({
          question: q,
          nodeType: 'decompose',
        })
        updatedParent.childIds.push(child.id)
        updated[child.id] = child
        createdNodeIds.push(child.id)
      }

      updated[op.parentNodeId] = updatedParent
      updatedNodeIds.push(op.parentNodeId)
      break
    }

    case 'variant': {
      const source = updated[op.sourceNodeId]
      if (!source) {
        throw new Error(`Source node "${op.sourceNodeId}" does not exist`)
      }
      const node = createNode({
        question: op.question ?? source.question,
        nodeType: 'variant',
        sourceNodeId: op.sourceNodeId,
        childIds: [op.sourceNodeId],
      })
      updated[node.id] = node
      createdNodeIds.push(node.id)
      break
    }

    case 'join': {
      const child1 = updated[op.child1Id]
      const child2 = updated[op.child2Id]
      if (!child1) {
        throw new Error(`Child node "${op.child1Id}" does not exist`)
      }
      if (!child2) {
        throw new Error(`Child node "${op.child2Id}" does not exist`)
      }

      const parent = createNode({
        question: op.parentQuestion,
        nodeType: 'join',
        childIds: [op.child1Id, op.child2Id],
      })

      updated[parent.id] = parent
      createdNodeIds.push(parent.id)
      break
    }
  }

  // Recompute all parentIds from childIds
  for (const node of Object.values(updated)) {
    node.parentIds = []
  }
  for (const node of Object.values(updated)) {
    for (const childId of node.childIds) {
      if (updated[childId]) {
        updated[childId].parentIds.push(node.id)
      }
    }
  }

  return { graph: updated, createdNodeIds, updatedNodeIds }
}
