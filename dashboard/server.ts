/**
 * Dashboard HTTP API: loopback-only, read-only routes served in-process.
 *
 * Routes (all GET, JSON):
 *   /snapshot          graph nodes+edges projection (bounded)
 *   /stats             totals by type/community
 *   /nodes/:id         single node detail with bounded content
 *   /status            runtime overview for the dashboard overview section
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

export const API_PREFIX = "/graph-memory/api";
const SNAPSHOT_LIMIT = 200;
const STATS_LIMIT = 1000;

export interface DashboardGraphSource {
  getSnapshot(request?: GraphSnapshotRequest): GraphSnapshot;
  getNodeDetail(id: string): GraphNodeDetail | null;
}

export interface DashboardStatusSource {
  getStatus(): GraphMemoryStatus;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

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
  const stripped = raw.startsWith(API_PREFIX) ? raw.slice(API_PREFIX.length) : raw;
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
}

/** 创建只读仪表盘 API，路由收到的是完整 req.url。 */
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
      if (path === "/snapshot") {
        const snapshot = deps.graph.getSnapshot(parseSnapshotRequest(url));
        sendJson(res, 200, { ok: true, snapshot });
        return;
      }
      if (path === "/stats") {
        const snapshot = deps.graph.getSnapshot({ maxNodes: STATS_LIMIT });
        sendJson(res, 200, { ok: true, stats: makeStats(snapshot) });
        return;
      }
      if (path === "/status") {
        sendJson(res, 200, { ok: true, status: deps.status.getStatus() });
        return;
      }
      if (path.startsWith("/nodes/")) {
        const id = decodeNodeId(path.slice("/nodes/".length));
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
