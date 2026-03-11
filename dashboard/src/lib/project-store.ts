import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProjectMeta } from './types'

export const PROJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#A855F7', // purple
]

export async function loadProjects(
  projectsDir: string
): Promise<Record<string, ProjectMeta>> {
  let files: string[]
  try {
    files = (await readdir(projectsDir)).filter(f => f.endsWith('.json'))
  } catch {
    return {}
  }

  const projects: Record<string, ProjectMeta> = {}
  for (const file of files) {
    try {
      const raw = await readFile(join(projectsDir, file), 'utf-8')
      const meta = JSON.parse(raw) as ProjectMeta
      projects[meta.slug] = meta
    } catch {
      // skip malformed files
    }
  }
  return projects
}

export async function saveProject(
  projectsDir: string,
  project: ProjectMeta
): Promise<void> {
  await mkdir(projectsDir, { recursive: true })
  await writeFile(
    join(projectsDir, `${project.slug}.json`),
    JSON.stringify(project, null, 2),
    'utf-8'
  )
}

export async function deleteProject(
  projectsDir: string,
  slug: string
): Promise<void> {
  await unlink(join(projectsDir, `${slug}.json`)).catch(() => {})
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function pickColor(existingProjects: Record<string, ProjectMeta>): string {
  const usedColors = new Set(Object.values(existingProjects).map(p => p.color))
  for (const color of PROJECT_COLORS) {
    if (!usedColors.has(color)) return color
  }
  // All colors used — cycle back
  return PROJECT_COLORS[Object.keys(existingProjects).length % PROJECT_COLORS.length]
}
