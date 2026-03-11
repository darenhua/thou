import type { ProjectMeta } from '@/lib/types'

interface ProjectSwitcherProps {
  projects: Record<string, ProjectMeta>
  currentProject: string | '__unsaved__' | null
  unsavedCount: number
  onSwitch: (project: string | '__unsaved__' | null) => void
  onSave: () => void
  onDelete: (slug: string) => void
}

export default function ProjectSwitcher({
  projects,
  currentProject,
  unsavedCount,
  onSwitch,
  onSave,
  onDelete,
}: ProjectSwitcherProps) {
  const projectList = Object.values(projects).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt)
  )

  return (
    <div className="flex flex-col gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 p-2 min-w-[160px]">
      {/* All projects view */}
      <button
        type="button"
        onClick={() => onSwitch(null)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
          currentProject === null
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 flex-shrink-0" />
        All Projects
      </button>

      {/* Unsaved pill */}
      <button
        type="button"
        onClick={() => onSwitch('__unsaved__')}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
          currentProject === '__unsaved__'
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0" />
        Unsaved
        {unsavedCount > 0 && (
          <span className="ml-auto text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {unsavedCount}
          </span>
        )}
      </button>

      {/* Divider */}
      {projectList.length > 0 && <div className="border-t border-gray-100 my-0.5" />}

      {/* Project pills */}
      {projectList.map(project => (
        <div key={project.slug} className="group flex items-center">
          <button
            type="button"
            onClick={() => onSwitch(project.slug)}
            className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
              currentProject === project.slug
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <span className="truncate">{project.name}</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(project.slug)}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 px-1 transition-opacity"
            title="Delete project"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Save Project button — visible in unsaved view when nodes exist */}
      {currentProject === '__unsaved__' && unsavedCount > 0 && (
        <>
          <div className="border-t border-gray-100 my-0.5" />
          <button
            type="button"
            onClick={onSave}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Save as Project
          </button>
        </>
      )}
    </div>
  )
}
