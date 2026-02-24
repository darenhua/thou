import { access, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { ROOT } from '../root'

export const initCommand = new Command('init')
  .description('Initialize project directories and install dashboard deps')
  .action(async () => {
    const prototypesDir = resolve(ROOT, 'prototypes')
    const treeDir = resolve(ROOT, 'tree')
    const progressFile = resolve(ROOT, 'ralph/progress.txt')
    const dashboardDir = resolve(ROOT, 'dashboard')

    // Create directories
    await mkdir(prototypesDir, { recursive: true })
    await mkdir(treeDir, { recursive: true })
    console.log('Created prototypes/ and tree/ directories')

    // Touch ralph/progress.txt
    const progressExists = await access(progressFile)
      .then(() => true)
      .catch(() => false)
    if (!progressExists) {
      await writeFile(progressFile, '', 'utf-8')
      console.log('Created ralph/progress.txt')
    }

    // Install dashboard deps if needed
    const dashboardModules = resolve(dashboardDir, 'node_modules')
    const hasModules = await access(dashboardModules)
      .then(() => true)
      .catch(() => false)
    if (!hasModules) {
      console.log('Installing dashboard dependencies...')
      const proc = Bun.spawn(['bun', 'install'], {
        cwd: dashboardDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      })
      await proc.exited
    }

    console.log('\nthou-demo initialized successfully!')
    console.log('  prototypes/  — prototype apps go here')
    console.log('  tree/        — graph state (JSON files)')
    console.log('  dashboard/   — graph visualization UI')
  })
