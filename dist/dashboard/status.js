/**
 * Runtime status builder for the dashboard overview section.
 *
 * Combines in-memory engine metrics (extraction routes, embedding state,
 * rolling-compaction counters) with cheap read-only aggregates over the
 * plugin's own database (extraction queue, recent drain rates, recent
 * errors, vector coverage). Same source of truth as the gm_status tool.
 */
import { statSync } from "node:fs";
import { getExtractionStats, getStats } from "../src/store/store.js";
export const RECENT_WINDOW_5M = 5 * 60_000;
export const RECENT_WINDOW_1H = 60 * 60_000;
export const RECENT_WINDOW_24H = 24 * 60 * 60_000;
/** 依据积压量与近期消化量推导管线健康度（纯函数，便于单测）。 */
export function deriveExtractionHealth(pending, recent5m, recent1h) {
    if (!Number.isFinite(pending) || pending <= 0)
        return "idle";
    if (recent5m > 0)
        return "draining";
    if (recent1h > 0)
        return "slow";
    return "stalled";
}
/** 向量覆盖率 0-1；节点数为 0 或输入异常时返回 null（纯函数，便于单测）。 */
export function vectorCoverage(vectors, nodes) {
    if (!Number.isFinite(vectors) || !Number.isFinite(nodes) || nodes <= 0 || vectors < 0)
        return null;
    return Math.max(0, Math.min(1, vectors / nodes));
}
/** 归一化错误摘要：取首行、剥掉 [graph-memory] 前缀并折叠空白（纯函数，便于单测）。 */
export function normalizeErrorKind(raw) {
    const firstLine = (raw ?? "").split("\n", 1)[0] ?? "";
    return firstLine.replace(/^\s*\[graph-memory\]\s*/, "").trim() || "未知错误";
}
const int = (value) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
/** 归并 DB 错误行 → 展示列表（纯函数，便于单测）。 */
export function summarizeErrors(rows) {
    return rows
        .map((row) => ({
        kind: normalizeErrorKind(row.kind),
        count: int(row.count),
        lastSeenAt: typeof row.last === "number" ? row.last : 0,
    }))
        .filter((row) => row.kind.length > 0);
}
export function buildRuntimeStatus(refs, now = Date.now()) {
    const { db } = refs;
    const graphStats = getStats(db);
    const queue = getExtractionStats(db);
    const messages = int(db.prepare("SELECT COUNT(*) AS c FROM gm_messages").get()?.c ?? 0);
    const activity = db.prepare(`SELECT MAX(CASE WHEN extraction_state = 'succeeded' THEN extraction_updated_at END) AS lastOk,
            SUM(extraction_state = 'succeeded' AND extraction_updated_at > ?) AS recent5m,
            SUM(extraction_state = 'succeeded' AND extraction_updated_at > ?) AS recent1h,
            SUM(extraction_state = 'succeeded' AND extraction_updated_at > ?) AS recent24h
     FROM gm_messages`).get(now - RECENT_WINDOW_5M, now - RECENT_WINDOW_1H, now - RECENT_WINDOW_24H);
    const recent5m = int(activity?.recent5m);
    const recent1h = int(activity?.recent1h);
    const vectors = db.prepare("SELECT COUNT(*) AS c, MAX(LENGTH(embedding)) AS bytes FROM gm_vectors").get();
    const vectorCount = int(vectors?.c);
    const dimensions = typeof vectors?.bytes === "number" && vectors.bytes > 0
        ? Math.trunc(vectors.bytes / 4)
        : null;
    const coverage = vectorCoverage(vectorCount, graphStats.totalNodes);
    const errorRows = db.prepare(`SELECT TRIM(substr(extraction_error, 1, 120)) AS kind,
            COUNT(*) AS count,
            MAX(extraction_updated_at) AS last
     FROM gm_messages
     WHERE extraction_error IS NOT NULL AND extraction_state != 'succeeded'
     GROUP BY kind
     ORDER BY count DESC
     LIMIT 4`).all();
    let dbSizeBytes = null;
    try {
        dbSizeBytes = statSync(refs.dbPath).size;
    }
    catch {
        // 展示信息，拿不到不阻塞。
    }
    const compaction = refs.compactionMetrics();
    return {
        generatedAt: now,
        dbPath: refs.dbPath,
        dbSizeBytes,
        graph: {
            nodes: graphStats.totalNodes,
            edges: graphStats.totalEdges,
            communities: graphStats.communities,
            messages,
        },
        extraction: {
            pending: queue.pending,
            succeeded: queue.succeeded,
            quarantined: queue.quarantined,
            lastSucceededAt: typeof activity?.lastOk === "number" ? activity.lastOk : null,
            recent5m,
            recent1h,
            recent24h: int(activity?.recent24h),
            health: deriveExtractionHealth(queue.pending, recent5m, recent1h),
        },
        recall: {
            state: refs.embeddingState(),
            vectors: vectorCount,
            coverage,
            dimensions,
            model: refs.embeddingModel,
        },
        compaction: {
            enabled: refs.contextCompactionEnabled,
            freshTurnCount: refs.freshTurnCount,
            attached: int(compaction.attached),
            selected: int(compaction.selected),
            succeeded: int(compaction.succeeded),
            unavailable: int(compaction.unavailable),
            failed: int(compaction.failed),
        },
        routes: refs.routes(),
        drain: { ...refs.drain },
        retention: { ...refs.retention },
        recentErrors: summarizeErrors(errorRows),
    };
}
