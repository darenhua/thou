import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface PrototypeMeta {
  id: string
  description: string
  port: number
}

const FIRST_PORT = 4001

async function parseResultTitle(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const titleMatch = content.match(/^# Prototype Result: (.+)$/m)
    return titleMatch?.[1]?.trim() ?? null
  } catch {
    return null
  }
}

export async function getPrototypeDirs(
  prototypesDir: string
): Promise<string[]> {
  const dirs = await readdir(prototypesDir)
  return dirs.filter(d => d.startsWith('thou-demo-')).sort()
}

export async function getPrototypeMeta(
  prototypesDir: string
): Promise<Map<string, PrototypeMeta>> {
  const dirs = await getPrototypeDirs(prototypesDir)
  const meta = new Map<string, PrototypeMeta>()

  let port = FIRST_PORT
  for (const dir of dirs) {
    const resultPath = join(prototypesDir, dir, 'RESULT.md')
    const title = await parseResultTitle(resultPath)
    meta.set(dir, {
      id: dir,
      description: title ?? dir,
      port: port++,
    })
  }

  return meta
}
