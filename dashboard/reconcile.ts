/**
 * reconcile.ts — Populate tree file edges from beads dependency data.
 *
 * Only processes beads that have an actual prototype directory.
 * Maps each bead's dependencies into childIds (filtering to deps that
 * also have prototype dirs), then writes updated tree files.
 *
 * Usage: bun reconcile.ts [--dry-run]
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { TreeFile } from './src/lib/types'

interface BeadIssue {
  id: string
  title: string
  description: string
  status: string
  labels: string[]
  dependencies: { depends_on_id: string }[]
}

const ROOT = resolve(import.meta.dir, '..')
const PROTOTYPES_DIR = resolve(ROOT, 'prototypes')
const TREE_DIR = resolve(ROOT, 'tree')
const dryRun = process.argv.includes('--dry-run')
const clean = process.argv.includes('--clean')

// 1. Discover which prototype directories actually exist
const existingDirs = new Set(
  (await readdir(PROTOTYPES_DIR)).filter(d => d.startsWith('thou-demo-'))
)
console.log(`Found ${existingDirs.size} prototype directories on disk`)

// 2. Load current tree files
await mkdir(TREE_DIR, { recursive: true })
const treeFileNames = (await readdir(TREE_DIR)).filter(f => f.endsWith('.json'))
const treeFiles = new Map<string, TreeFile>()

for (const file of treeFileNames) {
  try {
    const raw = await readFile(join(TREE_DIR, file), 'utf-8')
    const tf = JSON.parse(raw) as TreeFile
    treeFiles.set(tf.id, tf)
  } catch {
    // skip malformed files
  }
}
console.log(`Loaded ${treeFiles.size} tree files`)

// 3. If --clean, remove ghost tree files
if (clean) {
  let removed = 0
  for (const [id] of treeFiles) {
    if (id.startsWith('thou-demo-') && !existingDirs.has(id)) {
      treeFiles.delete(id)
      removed++
    }
  }
  if (removed > 0) {
    console.log(
      `Cleaned ${removed} ghost tree files (beads without prototype dirs)`
    )
  }

  // Remove childIds pointing to nodes no longer in the tree
  let danglingRemoved = 0
  for (const tf of treeFiles.values()) {
    const before = tf.childIds.length
    tf.childIds = tf.childIds.filter(id => treeFiles.has(id))
    danglingRemoved += before - tf.childIds.length
  }
  if (danglingRemoved > 0) {
    console.log(`Cleaned ${danglingRemoved} dangling childId references`)
  }
}

// 4. Get all beads
const proc = Bun.spawn(['bd', 'list', '--json', '--all'], {
  cwd: ROOT,
  stdout: 'pipe',
  stderr: 'pipe',
})
const bdOutput = await new Response(proc.stdout).text()
await proc.exited

const beads: BeadIssue[] = JSON.parse(bdOutput)
console.log(`Loaded ${beads.length} beads\n`)

// 5. Reconcile: only process beads that have a prototype directory
const now = new Date().toISOString()
let edgesAdded = 0
let titlesUpdated = 0

for (const bead of beads) {
  // Skip beads without a prototype directory
  if (!existingDirs.has(bead.id)) continue

  const nodeType = bead.labels.includes('join') ? 'join' : 'generate'
  // Only include deps that also have prototype dirs
  const childIds = (bead.dependencies ?? [])
    .map(d => d.depends_on_id)
    .filter(id => existingDirs.has(id))

  if (!treeFiles.has(bead.id)) continue // node not in tree yet

  const tf = treeFiles.get(bead.id)!
  const existingChildren = new Set(tf.childIds)
  const newChildren = childIds.filter(c => !existingChildren.has(c))

  if (newChildren.length > 0) {
    tf.childIds = [...tf.childIds, ...newChildren]
    tf.timestamps.updated_at = now
    edgesAdded += newChildren.length
    console.log(
      `  ~ ${bead.id} +${newChildren.length} children -> [${tf.childIds.join(', ')}]`
    )
  }

  // Update title from bead if node still has placeholder
  if (tf.question === tf.id && bead.title) {
    tf.question = bead.title
    titlesUpdated++
  }

  // Update nodeType from labels
  if (nodeType === 'join' && tf.nodeType !== 'join') {
    tf.nodeType = 'join'
  }
}

// 6. Write
console.log('\nSummary:')
console.log(`  Edges added:    ${edgesAdded}`)
console.log(`  Titles updated: ${titlesUpdated}`)

if (dryRun) {
  console.log(`\n--dry-run: not writing to ${TREE_DIR}`)
} else {
  for (const tf of treeFiles.values()) {
    await writeFile(
      join(TREE_DIR, `${tf.id}.json`),
      `${JSON.stringify(tf, null, 2)}\n`
    )
  }
  console.log(`\nWrote ${treeFiles.size} tree files to ${TREE_DIR}`)
}
