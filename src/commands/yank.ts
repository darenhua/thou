import { access, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Command } from 'commander'
import type { TreeFile } from '../../dashboard/src/lib/types'
import { PROTOTYPES_DIR, TREE_DIR } from '../paths'

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 3; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return `thou-demo-${id}`
}

export const yankCommand = new Command('yank')
  .description('Copy an external project into prototypes/')
  .argument('[source-path]', 'Path to source project', '.')
  .option('--id <id>', 'Override generated prototype ID')
  .option('--question <question>', 'Question/title for the tree node')
  .action(
    async (sourcePath: string, opts: { id?: string; question?: string }) => {
      const id = opts.id ?? generateId()
      const question = opts.question ?? id
      const src = resolve(sourcePath)
      const dest = join(PROTOTYPES_DIR, id)

      // Verify source exists
      const srcExists = await access(src)
        .then(() => true)
        .catch(() => false)
      if (!srcExists) {
        console.error(`Error: source path "${src}" does not exist`)
        process.exit(1)
      }

      // rsync source to destination
      await mkdir(dest, { recursive: true })
      const rsync = Bun.spawn(
        [
          'rsync',
          '-a',
          '--exclude',
          'node_modules',
          '--exclude',
          '.next',
          '--exclude',
          '.git',
          `${src}/`,
          `${dest}/`,
        ],
        { stdio: ['inherit', 'inherit', 'inherit'] }
      )
      await rsync.exited
      console.log(`Copied ${src} → ${dest}`)

      // bun install in destination if package.json exists
      const hasPkg = await access(resolve(dest, 'package.json'))
        .then(() => true)
        .catch(() => false)
      if (hasPkg) {
        console.log('Installing dependencies...')
        const install = Bun.spawn(['bun', 'install'], {
          cwd: dest,
          stdio: ['inherit', 'inherit', 'inherit'],
        })
        await install.exited
      }

      // Write tree file
      await mkdir(TREE_DIR, { recursive: true })
      const now = new Date().toISOString()
      const treeFile: TreeFile = {
        id,
        question,
        prompt: null,
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

      console.log(`\nYanked as ${id}`)
      console.log(`  Prototype: ~/.thou/prototypes/${id}/`)
      console.log(`  Tree file: ~/.thou/tree/${id}.json`)
    }
  )
