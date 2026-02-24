#!/bin/bash
set -e

# Usage: ralph/setup.sh <app_dir> <root_dir> <prototype_type>
#
# Prototype types:
#   nextjs   — Full Next.js app (create-next-app with TypeScript, Tailwind, App Router)
#   bare     — Empty directory, no scaffolding
#   node     — Plain Node.js project (bun init, no framework)
#
# The script always writes: biome.json, bunfig.toml, check, CLAUDE.md
# The scaffolding step varies by type.

APP_DIR="$1"
ROOT_DIR="$2"
PROTO_TYPE="${3:-nextjs}"

if [[ -z "$APP_DIR" || -z "$ROOT_DIR" ]]; then
    echo "Usage: ralph/setup.sh <app_dir> <root_dir> [prototype_type]"
    exit 1
fi

echo "Setting up prototype at $APP_DIR (type: $PROTO_TYPE)"

# --- Scaffold by type ---

case "$PROTO_TYPE" in
    nextjs)
        mkdir -p "$(dirname "$APP_DIR")"
        bunx create-next-app@latest "$APP_DIR" \
            --typescript --tailwind --eslint --app --src-dir --use-bun --yes
        ;;

    bare)
        mkdir -p "$APP_DIR"
        ;;

    node)
        mkdir -p "$APP_DIR"
        cd "$APP_DIR"
        bun init -y
        cd - > /dev/null
        ;;

    *)
        echo "Unknown prototype type: $PROTO_TYPE"
        echo "Valid types: nextjs, bare, node"
        exit 1
        ;;
esac

# --- Common config files ---

# biome.json — copy from root
cp "$ROOT_DIR/biome.json" "$APP_DIR/biome.json"

# bunfig.toml — relaxed test coverage
cat > "$APP_DIR/bunfig.toml" << 'BUNFIG'
[test]
coverage = true
coverageThreshold = 0
coverageSkipTestFiles = true
BUNFIG

# check script — quality gate
cat > "$APP_DIR/check" << 'CHECK'
#!/bin/bash
set -e
cd "$(dirname "$0")"
bunx biome check --write .
bun test --dots
CHECK
chmod +x "$APP_DIR/check"

# CLAUDE.md — prototype agent instructions (varies by type)
case "$PROTO_TYPE" in
    nextjs)
        cat > "$APP_DIR/CLAUDE.md" << 'CLAUDEMD'
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
CLAUDEMD
        ;;

    bare)
        cat > "$APP_DIR/CLAUDE.md" << 'CLAUDEMD'
# Prototype Agent Instructions

This is a bare prototype directory. Use **bun** as your package manager.

```bash
bun install           # Install dependencies
bun test              # Run tests
./check               # Run quality gates (biome + tests)
```

## Rules

- Work ONLY within this directory
- Do NOT run git commands (the outer loop handles commits)
- Do NOT interact with bd/beads (the outer loop handles issue tracking)
- Install any dependencies you need with `bun add <pkg>`
- Set up the project structure from scratch as needed
- Write tests for key functionality
- Run `./check` before declaring work complete
CLAUDEMD
        ;;

    node)
        cat > "$APP_DIR/CLAUDE.md" << 'CLAUDEMD'
# Prototype Agent Instructions

This is a plain Node.js prototype. Use **bun** as your package manager.

```bash
bun install           # Install dependencies
bun test              # Run tests
./check               # Run quality gates (biome + tests)
```

## Rules

- Work ONLY within this directory
- Do NOT run git commands (the outer loop handles commits)
- Do NOT interact with bd/beads (the outer loop handles issue tracking)
- Install any dependencies you need with `bun add <pkg>`
- Implement the full spec
- Write tests for key functionality
- Run `./check` before declaring work complete
CLAUDEMD
        ;;
esac

echo "Setup complete ($PROTO_TYPE)"
