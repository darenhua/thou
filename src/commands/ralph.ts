import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { ROOT } from '../root'

export const ralphCommand = new Command('ralph')
  .description('Run the ralph prototype loop')
  .action(async () => {
    const runScript = resolve(ROOT, 'ralph/run')

    const exists = await access(runScript)
      .then(() => true)
      .catch(() => false)
    if (!exists) {
      console.error('Error: ralph/run not found')
      process.exit(1)
    }

    const child = Bun.spawn(['bash', runScript], {
      cwd: ROOT,
      stdio: ['inherit', 'inherit', 'inherit'],
    })

    process.on('SIGINT', () => child.kill())
    process.on('SIGTERM', () => child.kill())

    const code = await child.exited
    process.exit(code)
  })
