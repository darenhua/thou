# Implementation Plan: thou-demo CLI

## Starting Point

The `THOU-DEMO/` folder is a bun project boilerplate with `commander` already installed. The CLI entry point is `index.ts`. This plan describes how to build out four commands and bring in all necessary features from the parent repo.

**Companion document**: `../NEW_APP_MIGRATION.md` contains detailed descriptions of every feature being ported, with source file paths and explanations. Use it as a reading guide when implementing each section below.

---

## Final Directory Structure

```
THOU-DEMO/
├── package.json              # CLI package with bin field
├── index.ts                  # Commander CLI entrypoint (4 commands)
├── tsconfig.json             # Already exists
├── .gitignore                # Already exists (extend with prototypes/*/node_modules etc.)
├── CLAUDE.md                 # Project-level agent instructions (rewrite for thou-demo)
│
├── src/
│   └── commands/
│       ├── init.ts           # thou-demo init
│       ├── ralph.ts          # thou-demo ralph
│       ├── graph.ts          # thou-demo graph
│       └── yank.ts           # thou-demo yank
│
├── ralph/                    # Copied + adapted from source
│   ├── run                   # Main bash loop (modified paths/prefix)
│   ├── setup.sh              # Prototype scaffolding
│   ├── PROTOTYPE.md          # Inner agent instructions
│   └── progress.txt          # Append-only log (created at runtime)
│
├── dashboard/                # Copied from prototypes/graph-thing/ (adapted)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── start.ts              # Dev server orchestrator (adapted paths)
│   ├── reconcile.ts          # Bead → tree reconciliation (adapted paths)
│   └── src/
│       ├── app/
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── api/
│       │       ├── graph/
│       │       │   ├── route.ts
│       │       │   └── approve/route.ts
│       │       └── prototypes/route.ts
│       ├── components/
│       │   ├── PrototypeNode.tsx
│       │   ├── OperationToolbar.tsx
│       │   └── OperationModal.tsx
│       └── lib/
│           ├── types.ts
│           ├── operations.ts
│           ├── graph-layout.ts
│           ├── graph-store.ts
│           └── prototypes.ts
│
├── .devcontainer/            # Copied from source (optional — for sandboxed ralph)
│   ├── devcontainer.json
│   ├── Dockerfile
│   ├── init-firewall.sh
│   ├── setup-git.sh
│   ├── parse-claude-stream.js
│   ├── parse-claude-stream.test.js
│   └── bunfig.toml
│
├── biome.json                # Shared linter config (copied from source root)
├── bunfig.toml               # Root test config (already exists? if not, create)
├── check                     # Root quality gate script
│
├── tree/                     # Created by `thou-demo init`, populated at runtime
├── prototypes/               # Created by `thou-demo init`, populated at runtime
└── beads_thou-demo/          # Created by `bd onboard` (if using beads)
```

---

## Step 1: Set up package.json and CLI entrypoint

### package.json changes

Add a `bin` field so the CLI can be invoked as `thou-demo`:

```json
{
  "name": "thou-demo",
  "bin": {
    "thou-demo": "./index.ts"
  },
  "type": "module",
  "private": true,
  "dependencies": {
    "commander": "^14.0.3"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

The CLI is invoked via `bun run index.ts <command>` or, after `bun link`, as `thou-demo <command>`.

### index.ts — Commander setup

```
import { Command } from 'commander'

const program = new Command()
program.name('thou-demo').description('Prototype factory CLI').version('0.1.0')

program.command('init')    → import from ./src/commands/init.ts
program.command('ralph')   → import from ./src/commands/ralph.ts
program.command('graph')   → import from ./src/commands/graph.ts
program.command('yank')    → import from ./src/commands/yank.ts

program.parse()
```

---

## Step 2: `thou-demo init`

### What it does
Creates the directory structure needed for the project to function. Idempotent — safe to run multiple times.

### Implementation (`src/commands/init.ts`)

1. Resolve the project root as the directory containing `package.json` with name `thou-demo` (walk up from `import.meta.dir`, or simply use `process.cwd()` since commands are run from the project root)
2. `mkdir -p` the following:
   - `prototypes/`
   - `tree/`
   - `ralph/progress.txt` (touch if not exists)
3. If `ralph/run` doesn't exist, warn that ralph scripts need to be set up
4. If `dashboard/package.json` exists but `dashboard/node_modules` doesn't, run `bun install` in `dashboard/`
5. Print a summary of what was created/verified

### Dependencies on source files
- None directly — this is new code. But the folders it creates are expected by every other command.

---

## Step 3: `thou-demo ralph`

### What it does
Spawns `ralph/run` as a child process with full stdout/stderr passthrough. The bash script does all the real work (bead polling, scaffolding, Claude invocation, tree file writing, git commit). Commander just launches it.

### Implementation (`src/commands/ralph.ts`)

1. Resolve `ROOT` (the thou-demo project root)
2. Verify `ralph/run` exists and is executable
3. Spawn via `Bun.spawn` or `child_process.spawn`:
   ```
   spawn('bash', ['ralph/run'], {
     cwd: ROOT,
     stdio: 'inherit',   // full passthrough — same stdout logging as running ./ralph/run
     env: { ...process.env }
   })
   ```
4. Forward SIGINT/SIGTERM to the child process
5. Exit with the child's exit code

### Source files the coding agent must read to create `ralph/run` and friends

| Source file (relative to repo root) | What to copy/adapt |
|---|---|
| `ralph/run` | **Copy entirely**, then change: (1) prototype prefix from `ralph-kit-test-` to `thou-demo-` (or make configurable), (2) verify `TREE_DIR`, `APP_DIR` paths resolve correctly from the THOU-DEMO root |
| `ralph/setup.sh` | **Copy entirely**, then change: prototype prefix in any hardcoded strings. The three scaffold types (nextjs, bare, node) and the four injected files (biome.json, bunfig.toml, check, CLAUDE.md) should work as-is. |
| `ralph/PROTOTYPE.md` | **Copy as-is** — generic instructions for the inner Claude agent |
| `ralph/RALPH.md` | **Copy and update** names/references |
| `.devcontainer/parse-claude-stream.js` | **Copy as-is** — used by `ralph/run` for human-readable output. Place at `.devcontainer/parse-claude-stream.js` (same relative path from root). |
| `.devcontainer/parse-claude-stream.test.js` | **Copy as-is** — tests for the stream parser |

### Critical path details in `ralph/run`

The bash script resolves its own root on line 3:
```bash
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
```
This means `ralph/run` already finds the project root by going one level up from `ralph/`. No change needed here — it's already portable.

Lines that reference the prototype prefix `ralph-kit-test-`:
- Line 171 (git add): references `prototypes/$BEAD_ID` — no prefix hardcoded here, the bead ID itself contains the prefix
- The prefix comes from beads — when you create beads for a project named `thou-demo`, bead IDs will be `thou-demo-xxx`

**Key realization**: The prototype prefix is determined by the beads project name, NOT hardcoded in ralph/run. So if the beads database is named `beads_thou-demo`, bead IDs will be `thou-demo-xxx` automatically. The only places that filter by prefix are in the **dashboard** code.

---

## Step 4: `thou-demo graph`

### What it does
Starts all prototype dev servers on sequential ports + the dashboard Next.js app. Equivalent to running `bun start.ts` from the graph-thing directory.

### Implementation (`src/commands/graph.ts`)

1. Resolve `ROOT` and `DASHBOARD_DIR = join(ROOT, 'dashboard')`
2. Verify `dashboard/package.json` exists
3. Check if `dashboard/node_modules` exists — if not, run `bun install` in dashboard dir first
4. Spawn the orchestrator:
   ```
   spawn('bun', ['start.ts'], {
     cwd: DASHBOARD_DIR,
     stdio: 'inherit'
   })
   ```
5. Forward SIGINT/SIGTERM, exit with child's exit code

Alternatively, inline the start.ts logic directly in the commander handler (scan prototypes, spawn dev servers, spawn next dev). But spawning `start.ts` is simpler and keeps the dashboard self-contained.

### Source files the coding agent must read to create the dashboard

**Every file listed under Feature 4 (all sub-features 4a–4l) in `NEW_APP_MIGRATION.md`** must be read and adapted. Here's the critical adaptation summary:

#### Path changes (dashboard/ is one level deep instead of two)

The dashboard was at `prototypes/graph-thing/` (two levels below root). Now it's at `dashboard/` (one level below root). Every `../../` becomes `../`:

| File | Old path resolution | New path resolution |
|---|---|---|
| `src/app/api/graph/route.ts` line 8 | `resolve(process.cwd(), '../../tree')` | `resolve(process.cwd(), '../tree')` |
| `src/app/api/graph/approve/route.ts` line 5 | `resolve(process.cwd(), '../../tree')` | `resolve(process.cwd(), '../tree')` |
| `src/lib/prototypes.ts` line 10 | `resolve(process.cwd(), '..')` → scans `prototypes/` | `resolve(process.cwd(), '../prototypes')` |
| `start.ts` line 7 | `resolve(ROOT, '..')` → scans `prototypes/` | `resolve(ROOT, '../prototypes')` |
| `reconcile.ts` line 22 | `resolve(import.meta.dir, '../..')` | `resolve(import.meta.dir, '..')` |

#### Prototype prefix changes

These files filter by `ralph-kit-test-` and must be updated to `thou-demo-` (or made configurable):

| File | Line | What to change |
|---|---|---|
| `src/lib/prototypes.ts` | line 25 | `d.startsWith('ralph-kit-test-')` → `d.startsWith('thou-demo-')` |
| `src/lib/graph-layout.ts` | line 30 | `node.id.startsWith('ralph-kit-test-')` → `node.id.startsWith('thou-demo-')` |
| `start.ts` | line 26 | `d.startsWith('ralph-kit-test-')` → `d.startsWith('thou-demo-')` |
| `reconcile.ts` | line 33 | `d.startsWith('ralph-kit-test-')` → `d.startsWith('thou-demo-')` |

#### Dashboard dependencies to install

From `prototypes/graph-thing/package.json`:
```
bun add next@16 react react-dom @xyflow/react @dagrejs/dagre
bun add -d tailwindcss@4 @tailwindcss/postcss typescript@5 eslint eslint-config-next @types/node @types/react @types/react-dom
```

Run these inside `dashboard/`.

---

## Step 5: `thou-demo yank`

### What it does
Copies an existing Next.js project into the `prototypes/` folder so it becomes a node in the graph. Creates a corresponding tree file so the dashboard sees it.

### Implementation (`src/commands/yank.ts`)

**Usage**: `thou-demo yank [source-path]`
- `source-path` defaults to `.` (current working directory)

**Steps**:

1. Resolve `ROOT` (thou-demo project root — use a shared helper, e.g. walk up from `import.meta.dir` to find `package.json` with name `thou-demo`)
2. Resolve `sourcePath` (the nextjs project to yank)
3. Verify `sourcePath` has a `package.json` (basic sanity check)
4. Generate an ID: `thou-demo-<3chars>` where 3 chars are random alphanumeric (matching the bead ID pattern). Or let the user pass `--id <name>`.
5. Set `destPath = join(ROOT, 'prototypes', id)`
6. Copy the source directory to dest:
   ```
   cp -r <sourcePath> <destPath>
   ```
   - Exclude `node_modules/` and `.next/` during copy (use `rsync --exclude` or manual filter)
7. Run `bun install` in the destination directory
8. Read the source's `package.json` name field for the question/title
9. Write a tree file at `tree/<id>.json`:
   ```json
   {
     "id": "<id>",
     "question": "<package name or directory name>",
     "prompt": null,
     "nodeType": "generate",
     "childIds": [],
     "sourceNodeId": null,
     "timestamps": {
       "created_at": "<now>",
       "updated_at": "<now>",
       "completed_at": "<now>",
       "approved_at": null
     },
     "bead": null,
     "result": null
   }
   ```
10. Print: `Yanked <source> → prototypes/<id>/ (tree/<id>.json created)`

### Options
- `--id <custom-id>`: override the generated ID
- `--question <text>`: set the question/title (defaults to package.json name)

### Source files to understand the tree file schema
| Source file | What to learn |
|---|---|
| `prototypes/graph-thing/src/lib/types.ts` | The `TreeFile` interface — the exact shape to write |
| `tree/ralph-kit-test-p7g.json` | Example of a real prototype's tree file |

---

## Step 6: Shared Config Files

### Files to copy to THOU-DEMO root

| Source file | Destination | Changes needed |
|---|---|---|
| `biome.json` | `biome.json` | Update `files.ignore` paths for new structure (e.g. `!dashboard` instead of `!prototypes`) |
| `check` | `check` | Copy as-is: `bunx biome check --write . && bun test --dots` |

### .gitignore additions

Add to the existing `.gitignore`:
```
prototypes/*/node_modules
prototypes/*/.next
dashboard/node_modules
dashboard/.next
```

---

## Step 7: CLAUDE.md for thou-demo

Rewrite `CLAUDE.md` at the THOU-DEMO root for the new project context. The coding agent should read the source `CLAUDE.md` at the repo root for the pattern, but rewrite it with:

| Source file | What to learn |
|---|---|
| `CLAUDE.md` (repo root) | Pattern: bun usage, bd commands, quality gates, push workflow |

Changes:
- Project name → `thou-demo`
- CLI commands → `thou-demo init`, `thou-demo ralph`, `thou-demo graph`, `thou-demo yank`
- Same mandatory push workflow

---

## Step 8: Root-Level Helper for Resolving Project Root

Multiple commands need to find the thou-demo project root. Create a shared utility:

### `src/root.ts`

```typescript
// Finds the thou-demo project root by walking up from the CLI's location
// Returns the directory containing package.json with name "thou-demo"
export function findRoot(): string { ... }
```

This is used by every command to resolve `prototypes/`, `tree/`, `ralph/`, `dashboard/` paths.

---

## Dependency Summary

### Root-level (THOU-DEMO/package.json)
Already installed:
- `commander` (CLI framework)

Need to add:
- Nothing else needed at root — the CLI is thin, just spawns subprocesses

### Dashboard-level (dashboard/package.json)
All installed via `bun install` inside `dashboard/`:
- `next@16`, `react`, `react-dom`
- `@xyflow/react`, `@dagrejs/dagre`
- `tailwindcss@4`, `@tailwindcss/postcss`
- `typescript@5`, `eslint`, `eslint-config-next`
- `@types/node`, `@types/react`, `@types/react-dom`

### System-level (must be pre-installed)
- `bun` (runtime)
- `bd` (beads CLI — for ralph integration)
- `jq` (used by ralph/run for JSON manipulation)
- `claude` (Claude Code CLI — used by ralph/run to invoke the agent)
- `git` (used by ralph/run for commits)

---

## Implementation Order for the Coding Agent

1. **Read `NEW_APP_MIGRATION.md`** — understand all features being ported
2. **Set up CLI skeleton** — `index.ts` with commander, `src/commands/*.ts` stubs
3. **Create `src/root.ts`** — shared project root resolver
4. **Implement `thou-demo init`** — creates folders, verifies structure
5. **Copy ralph/ directory** — `run`, `setup.sh`, `PROTOTYPE.md`, adapt prototype prefix
6. **Copy .devcontainer/** — all files as-is (except update any `ralph-kit-test` refs)
7. **Implement `thou-demo ralph`** — spawns `ralph/run` with stdio inherit
8. **Copy dashboard/** — all source files from `prototypes/graph-thing/`, fix all paths (../../ → ../), fix all prototype prefixes
9. **Install dashboard deps** — `bun install` inside `dashboard/`
10. **Implement `thou-demo graph`** — spawns `bun start.ts` in dashboard/
11. **Implement `thou-demo yank`** — copy + tree file creation
12. **Copy root configs** — biome.json, check script, update .gitignore
13. **Rewrite CLAUDE.md** — for thou-demo context
14. **Verify** — run `thou-demo init`, `thou-demo graph` (should show empty graph), test yank with a dummy project

---

## Source Files Master Index

Every file the coding agent needs to read, organized by feature:

### CLI & Root
- `THOU-DEMO/package.json` — starting boilerplate
- `THOU-DEMO/index.ts` — starting entrypoint (replace contents)
- `THOU-DEMO/tsconfig.json` — keep as-is
- `CLAUDE.md` (repo root) — pattern for rewriting

### Ralph
- `ralph/run` — **read fully** (191 lines, the core loop)
- `ralph/setup.sh` — **read fully** (153 lines, scaffolding)
- `ralph/PROTOTYPE.md` — copy
- `ralph/RALPH.md` — copy and adapt
- `ralph/run-in-devcontainer` — copy (optional, for docker usage)
- `.devcontainer/parse-claude-stream.js` — copy (used by ralph/run)
- `.devcontainer/parse-claude-stream.test.js` — copy

### Dashboard
- `prototypes/graph-thing/package.json` — dependencies list
- `prototypes/graph-thing/tsconfig.json` — config with path aliases
- `prototypes/graph-thing/next.config.ts` — empty config
- `prototypes/graph-thing/postcss.config.mjs` — tailwind v4 plugin
- `prototypes/graph-thing/eslint.config.mjs` — next.js eslint
- `prototypes/graph-thing/start.ts` — **read fully** (orchestrator, adapt paths)
- `prototypes/graph-thing/reconcile.ts` — **read fully** (adapt paths)
- `prototypes/graph-thing/src/lib/types.ts` — **read fully** (shared types)
- `prototypes/graph-thing/src/lib/operations.ts` — **read fully** (4 operations)
- `prototypes/graph-thing/src/lib/graph-store.ts` — **read fully** (tree file I/O)
- `prototypes/graph-thing/src/lib/graph-layout.ts` — **read fully** (dagre layout)
- `prototypes/graph-thing/src/lib/prototypes.ts` — **read fully** (scanner, adapt paths)
- `prototypes/graph-thing/src/app/page.tsx` — **read fully** (entire UI)
- `prototypes/graph-thing/src/app/globals.css` — copy (animation keyframes)
- `prototypes/graph-thing/src/app/layout.tsx` — copy
- `prototypes/graph-thing/src/app/api/graph/route.ts` — **read fully** (adapt paths)
- `prototypes/graph-thing/src/app/api/graph/approve/route.ts` — **read fully** (adapt paths)
- `prototypes/graph-thing/src/app/api/prototypes/route.ts` — copy
- `prototypes/graph-thing/src/components/PrototypeNode.tsx` — copy
- `prototypes/graph-thing/src/components/OperationToolbar.tsx` — **read fully** (toolbar)
- `prototypes/graph-thing/src/components/OperationModal.tsx` — **read fully** (modal)

### Devcontainer (optional)
- `.devcontainer/devcontainer.json` — copy and adapt
- `.devcontainer/Dockerfile` — copy
- `.devcontainer/init-firewall.sh` — copy
- `.devcontainer/setup-git.sh` — copy
- `.devcontainer/bunfig.toml` — copy

### Tree File Examples (for understanding the schema)
- `tree/ralph-kit-test-p7g.json` — real prototype example
- `tree/3d364481.json` — toolbar-created node example

### Config
- `biome.json` (repo root) — copy and adapt ignore paths
- `check` (repo root) — copy as-is
