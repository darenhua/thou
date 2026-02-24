# Ralph Loop — Prototype Factory

This Ralph loop creates independent Next.js prototypes from beads.

## How It Works

1. `ralph/run` reads the next ready bead from bd
2. Claims the bead (`bd update <id> --status in_progress`)
3. Scaffolds a Next.js app at `prototypes/<bead-id>/`
4. Copies biome config and generates local check script + CLAUDE.md
5. Invokes Claude with the bead spec as the implementation prompt
6. Claude implements the spec within the prototype directory
7. The loop closes the bead, logs progress, and commits the prototype

Each iteration = one bead = one independent prototype.

## Files

- `ralph/run` — The orchestration loop
- `ralph/PROTOTYPE.md` — Agent instructions for the inner Claude
- `ralph/progress.txt` — Log of completed iterations

## Usage

```bash
./ralph/run        # Run up to 30 iterations (default)
./ralph/run 5      # Run up to 5 iterations
```

## Creating Work

Each bead's description is the full prototype spec:

```bash
bd create "Todo App" --description "Build a todo app with add/remove/toggle functionality, persistent localStorage, and a dark mode toggle."
```
