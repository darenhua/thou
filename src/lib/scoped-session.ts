import { join, resolve } from 'node:path'
import type {
  HookCallback,
  PreToolUseHookInput,
  SyncHookJSONOutput,
} from '@anthropic-ai/claude-agent-sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionEventType = 'text' | 'tool_use' | 'result' | 'error'

export interface SessionEvent {
  type: SessionEventType
  nodeId: string
  timestamp: string
  data: Record<string, unknown>
}

export type PrototypeType = 'nextjs' | 'bare' | 'node'

export interface ScopedSessionConfig {
  nodeId: string
  prompt: string
  outputDir: string
  prototypesDir: string
  rootDir: string
  prototypeType?: PrototypeType
  maxTurns?: number
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function isUnderDir(filePath: string, dir: string): boolean {
  const resolved = resolve(filePath)
  const normalizedDir = resolve(dir)
  return resolved === normalizedDir || resolved.startsWith(`${normalizedDir}/`)
}

export function isReadablePath(
  filePath: string,
  outputDir: string,
  prototypesDir: string
): boolean {
  return isUnderDir(filePath, prototypesDir) || isUnderDir(filePath, outputDir)
}

export function isWritablePath(filePath: string, outputDir: string): boolean {
  return isUnderDir(filePath, outputDir)
}

export function getPathFromInput(
  toolName: string,
  input: Record<string, unknown>
): string | null {
  if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') {
    return (input.file_path as string) ?? null
  }
  if (toolName === 'Glob' || toolName === 'Grep') {
    return (input.path as string) ?? null
  }
  return null
}

// ---------------------------------------------------------------------------
// PreToolUse hook — enforces file boundaries
// ---------------------------------------------------------------------------

const READ_TOOLS = new Set(['Read', 'Glob', 'Grep'])
const WRITE_TOOLS = new Set(['Write', 'Edit'])

export function buildScopedHook(
  outputDir: string,
  prototypesDir: string
): HookCallback {
  return async input => {
    const hookInput = input as PreToolUseHookInput
    const toolName = hookInput.tool_name
    const toolInput = hookInput.tool_input as Record<string, unknown>
    const filePath = getPathFromInput(toolName, toolInput)

    // Bash — allow (cwd is already scoped to outputDir)
    if (toolName === 'Bash') {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse' as const,
          permissionDecision: 'allow' as const,
        },
      } satisfies SyncHookJSONOutput
    }

    // Read tools — must target readable directories
    if (READ_TOOLS.has(toolName)) {
      if (filePath && !isReadablePath(filePath, outputDir, prototypesDir)) {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse' as const,
            permissionDecision: 'deny' as const,
            permissionDecisionReason: `Read denied outside allowed dirs: ${prototypesDir}, ${outputDir}`,
          },
        } satisfies SyncHookJSONOutput
      }
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse' as const,
          permissionDecision: 'allow' as const,
        },
      } satisfies SyncHookJSONOutput
    }

    // Write tools — must target output directory only
    if (WRITE_TOOLS.has(toolName)) {
      if (filePath && !isWritablePath(filePath, outputDir)) {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse' as const,
            permissionDecision: 'deny' as const,
            permissionDecisionReason: `Write denied outside output dir: ${outputDir}`,
          },
        } satisfies SyncHookJSONOutput
      }
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse' as const,
          permissionDecision: 'allow' as const,
        },
      } satisfies SyncHookJSONOutput
    }

    // Everything else — let bypassPermissions handle it
    return {}
  }
}

// ---------------------------------------------------------------------------
// Prototype scaffolding — runs ralph/setup.sh
// ---------------------------------------------------------------------------

export async function setupPrototype(
  outputDir: string,
  rootDir: string,
  prototypeType: PrototypeType = 'nextjs'
): Promise<void> {
  const setupScript = join(rootDir, 'ralph', 'setup.sh')
  const proc = Bun.spawn(
    ['bash', setupScript, outputDir, rootDir, prototypeType],
    {
      cwd: rootDir,
      stdio: ['ignore', 'inherit', 'inherit'],
    }
  )
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`setup.sh exited with code ${exitCode}`)
  }
}

// ---------------------------------------------------------------------------
// Scoped session runner — async generator yielding SessionEvents
// ---------------------------------------------------------------------------

export async function* runScopedSession(
  config: ScopedSessionConfig
): AsyncGenerator<SessionEvent> {
  const {
    nodeId,
    prompt,
    outputDir,
    prototypesDir,
    rootDir,
    prototypeType = 'nextjs',
    maxTurns,
  } = config

  // Scaffold the prototype directory (Next.js/bare/node + biome + check + CLAUDE.md)
  await setupPrototype(outputDir, rootDir, prototypeType)

  const scopedHook = buildScopedHook(outputDir, prototypesDir)
  const protoMdPath = join(rootDir, 'ralph', 'PROTOTYPE.md')
  const startTime = Date.now()

  const session = query({
    prompt: `
You have access to two directories:
- All prototypes (READ-only): ${prototypesDir}
- Your output directory (READ + WRITE): ${outputDir}

Read ${outputDir}/CLAUDE.md for project conventions.
Read ${protoMdPath} for implementation guidelines.

Your task:
${prompt}

Important:
- Use absolute paths for all file operations.
- Install any dependencies you need with \`bun add <pkg>\` (run from ${outputDir}).
- Run ${outputDir}/check to verify quality gates pass when done.
`.trim(),
    options: {
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      cwd: outputDir,
      additionalDirectories: [prototypesDir],
      hooks: {
        PreToolUse: [{ hooks: [scopedHook] }],
      },
      ...(maxTurns != null ? { maxTurns } : { maxTurns: 100 }),
      executable: 'bun',
      systemPrompt: [
        'You are a code agent with scoped file permissions.',
        `You can READ from the prototypes directory: ${prototypesDir}`,
        `You can only WRITE to your output directory: ${outputDir}`,
        'Bash is disabled — do not attempt shell commands.',
        'Use absolute paths for all file operations.',
      ].join('\n'),
    },
  })

  for await (const message of session) {
    if (message.type === 'assistant') {
      // biome-ignore lint/suspicious/noExplicitAny: SDK message types not fully typed
      const blocks = (message as Record<string, any>).message?.content ?? []
      for (const block of blocks) {
        if (block.type === 'text' && block.text) {
          yield {
            type: 'text',
            nodeId,
            timestamp: new Date().toISOString(),
            data: { text: block.text },
          }
        } else if (block.type === 'tool_use') {
          yield {
            type: 'tool_use',
            nodeId,
            timestamp: new Date().toISOString(),
            data: {
              tool: block.name,
              input: block.input,
            },
          }
        }
      }
    } else if (message.type === 'result') {
      // biome-ignore lint/suspicious/noExplicitAny: SDK result type not fully typed
      const result = message as Record<string, any>
      const durationMs = Date.now() - startTime
      yield {
        type: 'result',
        nodeId,
        timestamp: new Date().toISOString(),
        data: {
          status: 'completed',
          cost_usd: result.total_cost_usd ?? null,
          turns: result.num_turns ?? null,
          duration_ms: durationMs,
          session_id: result.session_id ?? null,
        },
      }
    }
  }
}
