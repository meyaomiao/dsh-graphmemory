/**
 * Dashboard HTTP surface: loopback-only, read-only routes served in-process.
 *
 * API routes (GET, JSON) under /graph-memory/api:
 *   /api/snapshot      graph nodes+edges projection (bounded)
 *   /api/stats         totals by type/community
 *   /api/nodes/:id     single node detail with bounded content
 *   /api/status        runtime overview for the dashboard overview section
 *
 * Standalone UI (works without better-sidebar):
 *   /app               self-contained HTML page mounting the React dashboard
 *   /standalone.js     the bundled dashboard app (react included)
 *
 * The browser never touches SQLite; this router runs inside the DSH host
 * process and reuses the same read-only projections as the Pro Lite API,
 * plus the runtime status built from engine metrics.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  GraphMemoryStatus,
  GraphNodeDetail,
  GraphSnapshot,
  GraphSnapshotRequest,
  NodeType,
} from "./types.ts";

export const APP_PREFIX = "/graph-memory";
export const API_PREFIX = `${APP_PREFIX}/api`;
export const APP_PATH = `${APP_PREFIX}/app`;
export const STANDALONE_JS_PATH = `${APP_PREFIX}/standalone.js`;
const SNAPSHOT_LIMIT = 200;
const STATS_LIMIT = 1000;

export interface DashboardGraphSource {
  getSnapshot(request?: GraphSnapshotRequest): GraphSnapshot;
  getNodeDetail(id: string): GraphNodeDetail | null;
}

export interface DashboardStatusSource {
  getStatus(): GraphMemoryStatus;
}

/** 读取独立 UI 静态资源（宿主实现为从 dist/ 读取；测试可注入桩）。 */
export type DashboardAssetReader = (name: string) => Promise<string>;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const STANDALONE_HTML = (scriptPath: string): string => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>记忆图谱 · Graph Memory</title>
<style>html, body { margin: 0; padding: 0; height: 100%; background: #fff; }</style>
</head>
<body>
<div id="root" style="height: 100vh"></div>
<script src="${scriptPath}"></script>
</body>
</html>
`;


/** 仅允许 DSH 本地浏览器访问，拒绝局域网直连。 */
export function isLoopback(req: IncomingMessage): boolean {
  const remote = req.socket?.remoteAddress ?? "";
  if (remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1") return true;
  return /^::ffff:127\.\d{1,3}(?:\.\d{1,3}){2}$/.test(remote);
}

function boundedInt(value: string | null, fallback: number, max: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw Object.assign(new Error("maxNodes 必须是正整数"), { status: 400 });
  return Math.min(parsed, max);
}

function parseNodeTypes(params: URLSearchParams): NodeType[] | undefined {
  const values = params.getAll("type").flatMap((value) => value.split(","));
  if (values.length === 0) return undefined;
  const allowed = new Set<NodeType>(["TASK", "SKILL", "EVENT"]);
  const result = [...new Set(values.map((value) => value.trim().toUpperCase()))];
  if (result.some((value) => !allowed.has(value as NodeType))) {
    throw Object.assign(new Error("type 只支持 TASK、SKILL 或 EVENT"), { status: 400 });
  }
  return result as NodeType[];
}

export function parseSnapshotRequest(url: URL): GraphSnapshotRequest {
  const query = url.searchParams.get("q")?.trim().slice(0, 200) || undefined;
  const nodeTypes = parseNodeTypes(url.searchParams);
  return {
    ...(query ? { query } : {}),
    ...(nodeTypes ? { nodeTypes } : {}),
    maxNodes: boundedInt(url.searchParams.get("maxNodes"), 80, SNAPSHOT_LIMIT),
  };
}

function makeStats(snapshot: GraphSnapshot): Record<string, unknown> {
  const byType = { TASK: 0, SKILL: 0, EVENT: 0 };
  const communities = new Set<string>();
  for (const node of snapshot.nodes) {
    byType[node.type] += 1;
    if (node.communityId) communities.add(node.communityId);
  }
  return {
    generatedAt: snapshot.generatedAt,
    nodes: snapshot.totals.nodes,
    edges: snapshot.totals.edges,
    byType,
    communities: communities.size,
    approximate: snapshot.truncated.nodes,
  };
}

function relativePath(url: URL): string {
  const raw = url.pathname;
  const stripped = raw.startsWith(APP_PREFIX) ? raw.slice(APP_PREFIX.length) : raw;
  return stripped.replace(/\/+$/, "") || "/";
}

function decodeNodeId(value: string): string {
  try {
    const id = decodeURIComponent(value);
    if (!id || id.length > 512) throw new Error("节点 id 无效");
    return id;
  } catch {
    throw Object.assign(new Error("节点 id 无效"), { status: 400 });
  }
}

export interface DashboardRouterDeps {
  graph: DashboardGraphSource;
  status: DashboardStatusSource;
  /** 独立 UI 静态资源读取器（宿主从 dist/ 读取；无 better-sidebar 时看板仍可用）。 */
  readAsset?: DashboardAssetReader;
}

/**
 * 创建只读仪表盘路由，收到的 req.url 是完整路径。
 * 同一前缀 /graph-memory 同时服务 JSON API 与独立 UI 页面。
 */
export function createDashboardRouter(
  deps: DashboardRouterDeps,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!isLoopback(req)) {
      sendJson(res, 403, { ok: false, error: "仅允许本机访问" });
      return;
    }

    const url = new URL(req.url ?? "/", "http://loopback");
    const path = relativePath(url);
    const method = req.method ?? "GET";
    if (method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Graph Memory 面板只读" });
      return;
    }

    try {
      if (path === "/app" || path === "/") {
        const html = STANDALONE_HTML(`${APP_PREFIX}/standalone.js`);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (path === "/standalone.js") {
        if (!deps.readAsset) {
          sendJson(res, 404, { ok: false, error: "独立 UI 资源未配置" });
          return;
        }
        const js = await deps.readAsset("standalone.js");
        res.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
        res.end(js);
        return;
      }
      if (path === "/api/snapshot") {
        const snapshot = deps.graph.getSnapshot(parseSnapshotRequest(url));
        sendJson(res, 200, { ok: true, snapshot });
        return;
      }
      if (path === "/api/stats") {
        const snapshot = deps.graph.getSnapshot({ maxNodes: STATS_LIMIT });
        sendJson(res, 200, { ok: true, stats: makeStats(snapshot) });
        return;
      }
      if (path === "/api/status") {
        sendJson(res, 200, { ok: true, status: deps.status.getStatus() });
        return;
      }
      if (path.startsWith("/api/nodes/")) {
        const id = decodeNodeId(path.slice("/api/nodes/".length));
        const detail = deps.graph.getNodeDetail(id);
        if (!detail) {
          sendJson(res, 404, { ok: false, error: "节点不存在或已归档" });
          return;
        }
        sendJson(res, 200, { ok: true, detail });
        return;
      }
      sendJson(res, 404, { ok: false, error: "未找到 Graph Memory API 路由" });
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status) || 500
        : 500;
      const message = status < 500 && error instanceof Error ? error.message : "Graph Memory 服务暂时不可用";
      sendJson(res, status, { ok: false, error: message });
    }
  };
}
