import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function findRoot(from: string): string {
  let dir = from
  while (dir !== '/') {
    const pkgPath = resolve(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(
          require('node:fs').readFileSync(pkgPath, 'utf-8')
        )
        if (pkg.name === 'thou-demo') return dir
      } catch {
        // continue searching
      }
    }
    dir = dirname(dir)
  }
  throw new Error('Could not find thou-demo project root')
}

export const ROOT = findRoot(import.meta.dir)
