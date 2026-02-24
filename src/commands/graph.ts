import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { ROOT } from '../root'

export const graphCommand = new Command('graph')
  .description('Start the dashboard (API + Vite frontend)')
  .action(async () => {
    const dashboardDir = resolve(ROOT, 'dashboard')
    const pkgJson = resolve(dashboardDir, 'package.json')

    const exists = await access(pkgJson)
      .then(() => true)
      .catch(() => false)
    if (!exists) {
      console.error('Error: dashboard/package.json not found')
      process.exit(1)
    }

    // Install deps if needed
    const hasModules = await access(resolve(dashboardDir, 'node_modules'))
      .then(() => true)
      .catch(() => false)
    if (!hasModules) {
      console.log('Installing dashboard dependencies...')
      const install = Bun.spawn(['bun', 'install'], {
        cwd: dashboardDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      })
      await install.exited
    }

    const child = Bun.spawn(['bun', 'start.ts'], {
      cwd: dashboardDir,
      stdio: ['inherit', 'inherit', 'inherit'],
    })

    process.on('SIGINT', () => child.kill())
    process.on('SIGTERM', () => child.kill())

    const code = await child.exited
    process.exit(code)
  })
