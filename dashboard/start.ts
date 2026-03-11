/**
 * start.ts — Orchestrator for thou-demo dashboard
 *
 * 1. Spawns prototype dev servers on ports 4001+
 * 2. Starts Bun.serve() API + WebSocket on port 3101
 * 3. Spawns Vite dev server on port 3105
 * 4. Cleans up on SIGINT/SIGTERM
 */

import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ServerWebSocket } from "bun";
import { deleteNode, loadGraph, saveNode } from "./src/lib/graph-store";
import { applyOperation, type OperationPayload } from "./src/lib/operations";
import {
    deleteProject,
    loadProjects,
    pickColor,
    saveProject,
    slugify,
} from "./src/lib/project-store";
import { getPrototypeDirs } from "./src/lib/prototypes";
import type { NodeType, ProjectMeta, PrototypeNode } from "./src/lib/types";
import {
    addSubscriber,
    readSessionLog,
    removeSubscriber,
    startSession,
} from "./session-manager";


import { PROTOTYPES_DIR, TREE_DIR, PROJECTS_DIR } from "../src/paths";

const DASHBOARD_DIR = import.meta.dir;
const ROOT = resolve(DASHBOARD_DIR, "..");
const TEMPLATES_DIR = resolve(ROOT, "templates");
const FIRST_PORT = 4001;
const API_PORT = 3101;

async function loadPromptTemplate(
    nodeType: NodeType,
    context: Record<string, string>,
): Promise<string> {
    const templatePath = join(TEMPLATES_DIR, `${nodeType}.md`);
    const template = await readFile(templatePath, "utf-8");
    return template.replace(/\{(\w+)\}/g, (match, key) => context[key] ?? match);
}

function buildTemplateContext(
    op: OperationPayload,
    nodeId: string,
    graph: Record<string, PrototypeNode>,
): Record<string, string> {
    const base = {
        output_dir: resolve(PROTOTYPES_DIR, nodeId),
        prototypes_dir: PROTOTYPES_DIR,
    };

    switch (op.type) {
        case "generate":
            return { ...base, prompt: op.question };
        case "decompose": {
            return {
                ...base,
                prompt: graph[nodeId]?.question ?? "",
                parent_dir: resolve(PROTOTYPES_DIR, op.parentNodeId),
            };
        }
        case "variant":
            return {
                ...base,
                prompt: op.question ?? graph[op.sourceNodeId]?.question ?? "",
                source_dir: resolve(PROTOTYPES_DIR, op.sourceNodeId),
            };
        case "join":
            return {
                ...base,
                prompt: op.parentQuestion,
                child1_dir: resolve(PROTOTYPES_DIR, op.child1Id),
                child2_dir: resolve(PROTOTYPES_DIR, op.child2Id),
            };
    }
}

const children: ReturnType<typeof Bun.spawn>[] = [];
const portMap = new Map<string, number>();
const processMap = new Map<string, ReturnType<typeof Bun.spawn>>();
let nextPort = FIRST_PORT;

async function spawnPrototypeServer(protoId: string): Promise<number | null> {
    const protoDir = join(PROTOTYPES_DIR, protoId);
    const hasPackageJson = await access(join(protoDir, "package.json")).then(
        () => true,
        () => false,
    );
    if (!hasPackageJson) return null;

    const assignedPort = nextPort++;
    portMap.set(protoId, assignedPort);

    const child = Bun.spawn(
        ["bun", "run", "dev", "--port", String(assignedPort)],
        {
            cwd: protoDir,
            stdio: ["ignore", "ignore", "ignore"],
        },
    );
    children.push(child);
    processMap.set(protoId, child);
    console.log(`  ${protoId} -> http://localhost:${assignedPort}`);
    return assignedPort;
}

function cleanup() {
    console.log("\nShutting down all servers...");
    for (const child of children) {
        child.kill();
    }
    process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// --- 1. Spawn prototype dev servers ---

let allDirs: string[];
try {
    allDirs = await readdir(PROTOTYPES_DIR);
} catch {
    allDirs = [];
}
const protoDirs = allDirs.filter((d) => d.startsWith("thou-demo-")).sort();

console.log(`Starting ${protoDirs.length} prototype dev servers...\n`);

for (const dir of protoDirs) {
    await spawnPrototypeServer(dir);
}

// --- 2. Start Bun.serve() API + WebSocket on port 3101 ---

type WsData = { nodeId: string };

Bun.serve<WsData>({
    port: API_PORT,

    async fetch(req, server) {
        const url = new URL(req.url);

        // WebSocket upgrade: /ws/sessions/:nodeId
        const wsMatch = url.pathname.match(/^\/ws\/sessions\/([^/]+)$/);
        if (wsMatch) {
            const nodeId = wsMatch[1];
            const upgraded = server.upgrade(req, { data: { nodeId } });
            if (!upgraded) {
                return new Response("WebSocket upgrade failed", { status: 400 });
            }
            return undefined;
        }

        // GET /api/projects — list all projects
        if (url.pathname === "/api/projects" && req.method === "GET") {
            const projects = await loadProjects(PROJECTS_DIR);
            return Response.json(projects);
        }

        // POST /api/projects — create a new project
        if (url.pathname === "/api/projects" && req.method === "POST") {
            const { name, description } = (await req.json()) as {
                name: string;
                description?: string;
            };
            const existing = await loadProjects(PROJECTS_DIR);
            let slug = slugify(name);
            // Ensure unique slug
            if (existing[slug]) {
                let i = 2;
                while (existing[`${slug}-${i}`]) i++;
                slug = `${slug}-${i}`;
            }
            const project: ProjectMeta = {
                slug,
                name,
                color: pickColor(existing),
                description: description ?? "",
                createdAt: new Date().toISOString(),
            };
            await saveProject(PROJECTS_DIR, project);
            return Response.json(project);
        }

        // POST /api/projects/save-current — create project + assign all unsaved nodes
        if (
            url.pathname === "/api/projects/save-current" &&
            req.method === "POST"
        ) {
            const { name, description } = (await req.json()) as {
                name: string;
                description?: string;
            };
            const existing = await loadProjects(PROJECTS_DIR);
            let slug = slugify(name);
            if (existing[slug]) {
                let i = 2;
                while (existing[`${slug}-${i}`]) i++;
                slug = `${slug}-${i}`;
            }
            const project: ProjectMeta = {
                slug,
                name,
                color: pickColor(existing),
                description: description ?? "",
                createdAt: new Date().toISOString(),
            };
            await saveProject(PROJECTS_DIR, project);

            // Assign all unsaved nodes to this project
            const graph = await loadGraph(TREE_DIR);
            for (const node of Object.values(graph)) {
                if (node.project === null) {
                    node.project = slug;
                    await saveNode(TREE_DIR, node);
                }
            }

            return Response.json({ project, assignedCount: Object.values(graph).filter(n => n.project === slug).length });
        }

        // DELETE /api/projects/:slug
        const projectDeleteMatch = url.pathname.match(
            /^\/api\/projects\/([^/]+)$/,
        );
        if (projectDeleteMatch && req.method === "DELETE") {
            const slug = projectDeleteMatch[1];

            // Revert member nodes to unsaved
            const graph = await loadGraph(TREE_DIR);
            for (const node of Object.values(graph)) {
                if (node.project === slug) {
                    node.project = null;
                    await saveNode(TREE_DIR, node);
                }
            }

            await deleteProject(PROJECTS_DIR, slug);
            return Response.json({ ok: true });
        }

        // GET /api/graph — load graph, auto-populate from proto dirs
        if (url.pathname === "/api/graph" && req.method === "GET") {
            const graph = await loadGraph(TREE_DIR);

            const dirs = await getPrototypeDirs(PROTOTYPES_DIR);
            for (const dir of dirs) {
                if (!graph[dir]) {
                    const ts = new Date().toISOString();
                    const node: PrototypeNode = {
                        id: dir,
                        question: dir,
                        prompt: null,
                        nodeType: "generate",
                        childIds: [],
                        parentIds: [],
                        sourceNodeId: null,
                        project: null,
                        timestamps: {
                            created_at: ts,
                            updated_at: ts,
                            completed_at: null,
                            approved_at: null,
                        },
                        bead: null,
                        result: null,
                    };
                    graph[dir] = node;
                    await saveNode(TREE_DIR, node);
                }
            }

            // Filter by project if specified
            const projectFilter = url.searchParams.get("project");
            if (projectFilter) {
                const filtered: Record<string, PrototypeNode> = {};
                for (const [id, node] of Object.entries(graph)) {
                    if (projectFilter === "__unsaved__") {
                        if (node.project === null) filtered[id] = node;
                    } else {
                        if (node.project === projectFilter) filtered[id] = node;
                    }
                }
                return Response.json(filtered);
            }

            return Response.json(graph);
        }

        // POST /api/graph — apply operation
        if (url.pathname === "/api/graph" && req.method === "POST") {
            const op = (await req.json()) as OperationPayload;
            const graph = await loadGraph(TREE_DIR);

            try {
                const result = applyOperation(graph, op);

                for (const id of result.createdNodeIds) {
                    const node = result.graph[id];
                    const context = buildTemplateContext(op, id, result.graph);
                    node.prompt = await loadPromptTemplate(
                        node.nodeType,
                        context,
                    );
                }

                for (const id of result.createdNodeIds) {
                    await saveNode(TREE_DIR, result.graph[id]);
                }
                for (const id of result.updatedNodeIds) {
                    await saveNode(TREE_DIR, result.graph[id]);
                }

                // Start Claude sessions for each created node
                // Await so session log + status are initialized before we respond
                for (const id of result.createdNodeIds) {
                    const node = result.graph[id];
                    const outputDir = resolve(PROTOTYPES_DIR, id);
                    await startSession(
                        {
                            nodeId: id,
                            prompt: node.prompt!,
                            outputDir,
                            prototypesDir: PROTOTYPES_DIR,
                            rootDir: ROOT,
                        },
                        TREE_DIR,
                        async (nodeId) => {
                            await spawnPrototypeServer(nodeId);
                        },
                    );
                }

                return Response.json({
                    graph: result.graph,
                    createdNodeIds: result.createdNodeIds,
                });
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                return Response.json({ error: message }, { status: 400 });
            }
        }

        // POST /api/graph/approve
        if (url.pathname === "/api/graph/approve" && req.method === "POST") {
            const { nodeId } = (await req.json()) as { nodeId: string };
            const graph = await loadGraph(TREE_DIR);

            const node = graph[nodeId];
            if (!node) {
                return Response.json(
                    { error: `Node "${nodeId}" not found` },
                    { status: 404 },
                );
            }

            const now = new Date().toISOString();
            graph[nodeId] = {
                ...node,
                timestamps: {
                    ...node.timestamps,
                    approved_at: now,
                    updated_at: now,
                },
            };

            await saveNode(TREE_DIR, graph[nodeId]);
            return Response.json({ graph });
        }

        // POST /api/graph/restart — kill + respawn dev server
        if (url.pathname === "/api/graph/restart" && req.method === "POST") {
            const { nodeId } = (await req.json()) as { nodeId: string };

            // Kill existing process
            const proc = processMap.get(nodeId);
            if (proc) {
                proc.kill();
                processMap.delete(nodeId);
            }
            portMap.delete(nodeId);

            // Respawn
            const port = await spawnPrototypeServer(nodeId);
            if (port === null) {
                return Response.json(
                    { error: "No package.json found" },
                    { status: 400 },
                );
            }

            return Response.json({ port });
        }

        // POST /api/graph/delete
        if (url.pathname === "/api/graph/delete" && req.method === "POST") {
            const { nodeId } = (await req.json()) as { nodeId: string };
            const graph = await loadGraph(TREE_DIR);

            if (!graph[nodeId]) {
                return Response.json(
                    { error: `Node "${nodeId}" not found` },
                    { status: 404 },
                );
            }

            // Remove references from other nodes
            for (const node of Object.values(graph)) {
                let dirty = false;
                if (node.childIds.includes(nodeId)) {
                    node.childIds = node.childIds.filter((id) => id !== nodeId);
                    dirty = true;
                }
                if (node.sourceNodeId === nodeId) {
                    node.sourceNodeId = null;
                    dirty = true;
                }
                if (dirty) await saveNode(TREE_DIR, node);
            }

            // Delete tree file + session log
            await deleteNode(TREE_DIR, nodeId);
            delete graph[nodeId];

            // Kill dev server if running
            const proc = processMap.get(nodeId);
            if (proc) {
                proc.kill();
                processMap.delete(nodeId);
            }
            portMap.delete(nodeId);

            return Response.json({ graph });
        }

        // GET /api/sessions/:nodeId — session log for polling
        const sessionMatch = url.pathname.match(
            /^\/api\/sessions\/([^/]+)$/,
        );
        if (sessionMatch && req.method === "GET") {
            const nodeId = sessionMatch[1];
            const { status, events } = await readSessionLog(
                TREE_DIR,
                nodeId,
            );
            return Response.json({ status, events });
        }

        // GET /api/prototypes
        if (url.pathname === "/api/prototypes" && req.method === "GET") {
            const obj: Record<string, { description: string; port: number }> =
                {};
            for (const [id, assignedPort] of portMap) {
                obj[id] = { description: id, port: assignedPort };
            }
            return Response.json(obj);
        }

        return new Response("Not found", { status: 404 });
    },

    websocket: {
        async open(ws: ServerWebSocket<WsData>) {
            const { nodeId } = ws.data;
            addSubscriber(nodeId, ws);

            // Send buffered events so the client catches up
            const { status, events } = await readSessionLog(TREE_DIR, nodeId);
            for (const event of events) {
                ws.send(JSON.stringify(event));
            }
            ws.send(JSON.stringify({ type: "status", status }));
        },
        message(_ws: ServerWebSocket<WsData>, _msg: string | Buffer) {
            // Client doesn't send messages, ignore
        },
        close(ws: ServerWebSocket<WsData>) {
            removeSubscriber(ws.data.nodeId, ws);
        },
    },
});

console.log(`\nAPI server running on http://localhost:${API_PORT}`);

// --- 3. Spawn Vite dev server ---

const vite = Bun.spawn(["bunx", "--bun", "vite"], {
    cwd: DASHBOARD_DIR,
    stdio: ["inherit", "inherit", "inherit"],
});
children.push(vite);

console.log("Dashboard -> http://localhost:3101");
console.log("Press Ctrl+C to stop all servers\n");
