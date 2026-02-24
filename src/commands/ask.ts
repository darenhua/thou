import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Command } from 'commander'
import type { TreeFile } from '../../dashboard/src/lib/types'
import { runScopedSession } from '../lib/scoped-session'
import { ROOT } from '../root'

const PROTOTYPES_DIR = resolve(ROOT, 'prototypes')
const TREE_DIR = resolve(ROOT, 'tree')
const TEMPLATES_DIR = resolve(ROOT, 'templates')
const ROOT_DIR = ROOT

function generateId(): string {
  return `thou-demo-${crypto.randomUUID().slice(0, 8)}`
}

export const askCommand = new Command('ask')
  .description('Ask Claude to work on something in a scoped prototype sandbox')
  .argument('<prompt>', 'What to ask Claude to do')
  .action(async (prompt: string) => {
    const id = generateId()
    const outputDir = resolve(PROTOTYPES_DIR, id)
    await mkdir(TREE_DIR, { recursive: true })

    // Load the generate template and interpolate the user's prompt
    const template = await readFile(join(TEMPLATES_DIR, 'generate.md'), 'utf-8')
    const interpolatedPrompt = template.replace('{prompt}', prompt)

    // Write initial tree file
    const now = new Date().toISOString()
    const treeFile: TreeFile = {
      id,
      question: prompt,
      prompt: interpolatedPrompt,
      nodeType: 'generate',
      childIds: [],
      sourceNodeId: null,
      timestamps: {
        created_at: now,
        updated_at: now,
        completed_at: null,
        approved_at: null,
      },
      bead: null,
      result: null,
    }
    await writeFile(
      join(TREE_DIR, `${id}.json`),
      `${JSON.stringify(treeFile, null, 2)}\n`,
      'utf-8'
    )

    console.log('=== thou-demo ask ===')
    console.log(`  ID:         ${id}`)
    console.log(`  READ dirs:  ${PROTOTYPES_DIR}`)
    console.log(`  WRITE dir:  ${outputDir}`)
    console.log(`  Tree file:  tree/${id}.json`)
    console.log()

    for await (const event of runScopedSession({
      nodeId: id,
      prompt: interpolatedPrompt,
      outputDir,
      prototypesDir: PROTOTYPES_DIR,
      rootDir: ROOT_DIR,
    })) {
      switch (event.type) {
        case 'text':
          console.log('[assistant]', event.data.text)
          break
        case 'tool_use':
          console.log(
            `[tool_use] ${event.data.tool}(${JSON.stringify(event.data.input, null, 2)})`
          )
          break
        case 'result': {
          // Update tree file with result metadata
          treeFile.timestamps.updated_at = new Date().toISOString()
          treeFile.timestamps.completed_at = new Date().toISOString()
          treeFile.result = {
            status: event.data.status as string,
            cost_usd: event.data.cost_usd as number | null,
            turns: event.data.turns as number | null,
            duration_ms: event.data.duration_ms as number | null,
            session_id: event.data.session_id as string | null,
          }
          await writeFile(
            join(TREE_DIR, `${id}.json`),
            `${JSON.stringify(treeFile, null, 2)}\n`,
            'utf-8'
          )

          console.log()
          console.log('=== Session Complete ===')
          console.log(`  ID:    ${id}`)
          console.log(`  Turns: ${event.data.turns}`)
          console.log(
            `  Cost:  $${(event.data.cost_usd as number)?.toFixed(4)}`
          )
          console.log(
            `  Time:  ${((event.data.duration_ms as number) / 1000).toFixed(1)}s`
          )
          console.log(`  Output:    prototypes/${id}/`)
          console.log(`  Tree file: tree/${id}.json`)
          break
        }
        case 'error':
          console.error('[error]', event.data)
          break
      }
    }
  })
