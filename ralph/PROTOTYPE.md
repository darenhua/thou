# Prototype Implementation Instructions

You are implementing a single Next.js prototype application.
Your job is to build the complete spec as a working application.

## Architecture

- Next.js App Router (`src/app/`)
- TypeScript throughout
- Tailwind CSS for styling
- Biome for linting/formatting

## Directory Structure

```
src/
  app/           # App Router pages and layouts
    layout.tsx   # Root layout
    page.tsx     # Home page
    api/         # API routes if needed
  components/    # Reusable components
  lib/           # Utility functions and shared logic
  __tests__/     # Test files
```

## Quality Requirements

1. All code must pass `./check` (biome lint + tests)
2. Write tests for core logic and key user flows
3. Use TypeScript strict mode
4. Use Tailwind CSS — no inline styles or CSS modules unless necessary

## What NOT to Do

- Do NOT run git commands
- Do NOT interact with bd/beads
- Do NOT modify files outside your prototype directory
- Do NOT create additional configuration at the project root
