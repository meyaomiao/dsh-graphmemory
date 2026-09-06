export const APP_PREFIX = "/graph-memory";
export const API_PREFIX = `${APP_PREFIX}/api`;
export const APP_PATH = `${APP_PREFIX}/app`;
export const STANDALONE_JS_PATH = `${APP_PREFIX}/standalone.js`;
const SNAPSHOT_LIMIT = 200;
const STATS_LIMIT = 1000;
function sendJson(res, status, body) {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
}
const STANDALONE_HTML = (scriptPath) => `<!doctype html>
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
export function isLoopback(req) {
    const remote = req.socket?.remoteAddress ?? "";
    if (remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1")
        return true;
    return /^::ffff:127\.\d{1,3}(?:\.\d{1,3}){2}$/.test(remote);
}
function boundedInt(value, fallback, max) {
    if (value === null || value.trim() === "")
        return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1)
        throw Object.assign(new Error("maxNodes 必须是正整数"), { status: 400 });
    return Math.min(parsed, max);
}
function parseNodeTypes(params) {
    const values = params.getAll("type").flatMap((value) => value.split(","));
    if (values.length === 0)
        return undefined;
    const allowed = new Set(["TASK", "SKILL", "EVENT"]);
    const result = [...new Set(values.map((value) => value.trim().toUpperCase()))];
    if (result.some((value) => !allowed.has(value))) {
        throw Object.assign(new Error("type 只支持 TASK、SKILL 或 EVENT"), { status: 400 });
    }
    return result;
}
export function parseSnapshotRequest(url) {
    const query = url.searchParams.get("q")?.trim().slice(0, 200) || undefined;
    const nodeTypes = parseNodeTypes(url.searchParams);
    return {
        ...(query ? { query } : {}),
        ...(nodeTypes ? { nodeTypes } : {}),
        maxNodes: boundedInt(url.searchParams.get("maxNodes"), 80, SNAPSHOT_LIMIT),
    };
}
function makeStats(snapshot) {
    const byType = { TASK: 0, SKILL: 0, EVENT: 0 };
    const communities = new Set();
    for (const node of snapshot.nodes) {
        byType[node.type] += 1;
        if (node.communityId)
            communities.add(node.communityId);
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
function relativePath(url) {
    const raw = url.pathname;
    const stripped = raw.startsWith(APP_PREFIX) ? raw.slice(APP_PREFIX.length) : raw;
    return stripped.replace(/\/+$/, "") || "/";
}
function decodeNodeId(value) {
    try {
        const id = decodeURIComponent(value);
        if (!id || id.length > 512)
            throw new Error("节点 id 无效");
        return id;
    }
    catch {
        throw Object.assign(new Error("节点 id 无效"), { status: 400 });
    }
}
/**
 * 创建只读仪表盘路由，收到的 req.url 是完整路径。
 * 同一前缀 /graph-memory 同时服务 JSON API 与独立 UI 页面。
 */
export function createDashboardRouter(deps) {
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
        }
        catch (error) {
            const status = typeof error === "object" && error !== null && "status" in error
                ? Number(error.status) || 500
                : 500;
            const message = status < 500 && error instanceof Error ? error.message : "Graph Memory 服务暂时不可用";
            sendJson(res, status, { ok: false, error: message });
        }
    };
}
