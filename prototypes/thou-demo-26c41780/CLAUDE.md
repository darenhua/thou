# Prototype Agent Instructions

This is an independent Next.js prototype. Use **bun** as your package manager.

```bash
bun install           # Install dependencies
bun run dev           # Start dev server
bun run build         # Build the project
bun test              # Run tests
./check               # Run quality gates (biome + tests)
```

## Rules

- Work ONLY within this directory
- Do NOT run git commands (the outer loop handles commits)
- Do NOT interact with bd/beads (the outer loop handles issue tracking)
- Install any additional dependencies you need with `bun add <pkg>`
- Implement the full spec: pages, components, API routes, and tests
- Run `./check` before declaring work complete
- Use the App Router (src/app/) for all routes
