import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PrototypeNode, TreeFile } from './types'

export async function loadGraph(
  treeDir: string
): Promise<Record<string, PrototypeNode>> {
  let files: string[]
  try {
    files = (await readdir(treeDir)).filter(f => f.endsWith('.json'))
  } catch {
    return {}
  }

  const treeFiles: TreeFile[] = []
  for (const file of files) {
    try {
      const raw = await readFile(join(treeDir, file), 'utf-8')
      treeFiles.push(JSON.parse(raw) as TreeFile)
    } catch {
      // skip malformed files
    }
  }

  // Build nodes with empty parentIds
  const graph: Record<string, PrototypeNode> = {}
  for (const tf of treeFiles) {
    graph[tf.id] = { ...tf, parentIds: [] }
  }

  // Compute parentIds by inverting childIds
  for (const node of Object.values(graph)) {
    for (const childId of node.childIds) {
      if (graph[childId]) {
        graph[childId].parentIds.push(node.id)
      }
    }
  }

  return graph
}

export async function saveNode(
  treeDir: string,
  node: PrototypeNode
): Promise<void> {
  await mkdir(treeDir, { recursive: true })
  // Strip parentIds — they're computed at load time
  const { parentIds: _, ...treeFile } = node
  await writeFile(
    join(treeDir, `${node.id}.json`),
    JSON.stringify(treeFile, null, 2),
    'utf-8'
  )
}

export async function saveNodes(
  treeDir: string,
  nodes: PrototypeNode[]
): Promise<void> {
  await mkdir(treeDir, { recursive: true })
  await Promise.all(nodes.map(node => saveNode(treeDir, node)))
}

export async function deleteNode(
  treeDir: string,
  nodeId: string
): Promise<void> {
  await unlink(join(treeDir, `${nodeId}.json`)).catch(() => {})
  await unlink(join(treeDir, `${nodeId}.session.jsonl`)).catch(() => {})
}
