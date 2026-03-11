import { access, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { PROJECTS_DIR, PROTOTYPES_DIR, THOU_HOME, TREE_DIR } from '../paths'
import { ROOT } from '../root'

export const initCommand = new Command('init')
  .description('Initialize project directories and install dashboard deps')
  .action(async () => {
    const progressFile = resolve(ROOT, 'ralph/progress.txt')
    const dashboardDir = resolve(ROOT, 'dashboard')

    // Create directories
    await mkdir(THOU_HOME, { recursive: true })
    await mkdir(PROTOTYPES_DIR, { recursive: true })
    await mkdir(TREE_DIR, { recursive: true })
    await mkdir(PROJECTS_DIR, { recursive: true })
    console.log(`Created ${THOU_HOME}/{prototypes,tree,projects}/ directories`)

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
    console.log('  ~/.thou/prototypes/  — prototype apps go here')
    console.log('  ~/.thou/tree/        — graph state (JSON files)')
    console.log('  ~/.thou/projects/    — project metadata (JSON files)')
    console.log('  dashboard/           — graph visualization UI')
  })
