# thou-demo — Prototype Factory CLI

This project uses **bun** as its package manager and runtime. Do NOT use npm or yarn.

```bash
bun install           # Install dependencies
bun run build         # Build the project
bun test              # Run tests
./check               # Run quality gates (lint + tests)
bun add <pkg>         # Add a dependency
bunx <cmd>            # Run a package command
```

## CLI Commands

```bash
bun run index.ts init          # Initialize directories (prototypes/, tree/) + install dashboard deps
bun run index.ts ralph         # Run the ralph prototype loop
bun run index.ts graph         # Start the dashboard (API on :3100, Vite on :3105)
bun run index.ts yank [path]   # Copy external project into prototypes/
```

## Project Structure

```
THOU-DEMO/
├── index.ts              # Commander CLI entry point
├── src/commands/          # CLI command implementations
├── ralph/                 # Prototype factory loop (bash)
├── dashboard/             # Vite + Bun.serve() graph visualization
│   ├── start.ts           # Orchestrator (proto servers + API + Vite)
│   ├── src/               # React frontend (xyflow, dagre, tailwind)
│   └── reconcile.ts       # Bead → tree file reconciliation
├── prototypes/            # Generated prototype apps (created at runtime)
└── tree/                  # Graph state as JSON files (created at runtime)
```

## Issue Tracking (beads)

```bash
bd ready                                                     # Find available work
bd show <id>                                                 # View issue details
bd update <id> --status in_progress                          # Claim work
bd close <id>                                                # Complete work
bd sync                                                      # Sync with git
bd create "<issue name>" --description "<long description>"  # Create an issue
```

## Dashboard Architecture

- **Vite** (port 3105): React frontend with HMR, Tailwind, xyflow
- **Bun.serve()** (port 3100): API server for graph CRUD
- Vite proxies `/api` requests to the API server
- `dashboard/start.ts` orchestrates both + prototype dev servers

## Key Conventions

- Prototype IDs: `thou-demo-<3chars>` (e.g., `thou-demo-a1b`)
- Tree files: `tree/<id>.json` (one per graph node)
- Prototype prefix: `thou-demo-` (not `ralph-kit-test-`)
