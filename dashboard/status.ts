/**
 * Runtime status builder for the dashboard overview section.
 *
 * Combines in-memory engine metrics (extraction routes, embedding state,
 * rolling-compaction counters) with cheap read-only aggregates over the
 * plugin's own database (extraction queue, recent drain rates, recent
 * errors, vector coverage). Same source of truth as the gm_status tool.
 */
import { statSync } from "node:fs";
import type { DatabaseSyncInstance } from "../src/store/sqlite.ts";
import { getExtractionStats, getStats } from "../src/store/store.ts";
import type {
  ExtractionHealth,
  GraphMemoryStatus,
} from "./types.ts";

export const RECENT_WINDOW_5M = 5 * 60_000;
export const RECENT_WINDOW_1H = 60 * 60_000;
export const RECENT_WINDOW_24H = 24 * 60 * 60_000;

/** 依据积压量与近期消化量推导管线健康度（纯函数，便于单测）。 */
export function deriveExtractionHealth(
  pending: number,
  recent5m: number,
  recent1h: number,
): ExtractionHealth {
  if (!Number.isFinite(pending) || pending <= 0) return "idle";
  if (recent5m > 0) return "draining";
  if (recent1h > 0) return "slow";
  return "stalled";
}

/** 向量覆盖率 0-1；节点数为 0 或输入异常时返回 null（纯函数，便于单测）。 */
export function vectorCoverage(vectors: number, nodes: number): number | null {
  if (!Number.isFinite(vectors) || !Number.isFinite(nodes) || nodes <= 0 || vectors < 0) return null;
  return Math.max(0, Math.min(1, vectors / nodes));
}

/** 归一化错误摘要：取首行、剥掉 [graph-memory] 前缀；JSON parse 失败归并成一类。 */
export function normalizeErrorKind(raw: string | null | undefined): string {
  const firstLine = (raw ?? "").split("\n", 1)[0] ?? "";
  const kind = firstLine.replace(/\[graph-memory\]\s*/g, "").trim() || "未知错误";
  if (/extraction parse failed:\s*SyntaxError/i.test(kind)) {
    return "extraction parse failed: SyntaxError (JSON)";
  }
  return kind;
}

const int = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

export interface RecentExtractionErrorRow {
  kind: string | null;
  count: unknown;
  last: unknown;
}

/** 归并 DB 错误行 → 展示列表；同 kind 合并计数，按最近出现排序。 */
export function summarizeErrors(rows: RecentExtractionErrorRow[]): GraphMemoryStatus["recentErrors"] {
  const merged = new Map<string, { kind: string; count: number; lastSeenAt: number }>();
  for (const row of rows) {
    const kind = normalizeErrorKind(row.kind);
    if (!kind) continue;
    const count = int(row.count);
    const lastSeenAt = typeof row.last === "number" ? row.last : 0;
    const prev = merged.get(kind);
    if (!prev) {
      merged.set(kind, { kind, count, lastSeenAt });
      continue;
    }
    prev.count += count;
    if (lastSeenAt > prev.lastSeenAt) prev.lastSeenAt = lastSeenAt;
  }
  return [...merged.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt || b.count - a.count);
}

/** 引擎侧实时指标（由 dsh.ts apply() 闭包提供，避免暴露内部可变对象）。 */
export interface DashboardEngineRefs {
  db: DatabaseSyncInstance;
  dbPath: string;
  contextCompactionEnabled: boolean;
  freshTurnCount: number;
  embeddingState: () => "fts-only" | "initializing" | "vector-ready" | "degraded";
  embeddingModel: string | null;
  routes: () => string[];
  compactionMetrics: () => {
    attached: number;
    selected: number;
    succeeded: number;
    unavailable: number;
    failed: number;
  };
  drain: { maxBatchChars: number; maxBatchMessages: number; maxRetries: number; streamTimeoutMs: number };
  retention: { keep: string; revision: string };
}

export function buildRuntimeStatus(refs: DashboardEngineRefs, now: number = Date.now()): GraphMemoryStatus {
  const { db } = refs;
  const graphStats = getStats(db);
  const queue = getExtractionStats(db);
  const messages = int((db.prepare("SELECT COUNT(*) AS c FROM gm_messages").get() as any)?.c ?? 0);

  const activity = db.prepare(
    `SELECT MAX(CASE WHEN extraction_state = 'succeeded' THEN extraction_updated_at END) AS lastOk,
            SUM(extraction_state = 'succeeded' AND extraction_updated_at > ?) AS recent5m,
            SUM(extraction_state = 'succeeded' AND extraction_updated_at > ?) AS recent1h,
            SUM(extraction_state = 'succeeded' AND extraction_updated_at > ?) AS recent24h
     FROM gm_messages`,
  ).get(now - RECENT_WINDOW_5M, now - RECENT_WINDOW_1H, now - RECENT_WINDOW_24H) as any;
  const recent5m = int(activity?.recent5m);
  const recent1h = int(activity?.recent1h);

  const vectors = db.prepare("SELECT COUNT(*) AS c, MAX(LENGTH(embedding)) AS bytes FROM gm_vectors").get() as any;
  const vectorCount = int(vectors?.c);
  const dimensions = typeof vectors?.bytes === "number" && vectors.bytes > 0
    ? Math.trunc(vectors.bytes / 4)
    : null;
  const coverage = vectorCoverage(vectorCount, graphStats.totalNodes);

  // 「实时情况」只看近 1 小时写过 error 的行。全库按 count 排序会把
  // 昨天隔离的化石（No eligible accounts / configure llmProvider）永远压在顶上。
  const errorRows = db.prepare(
    `SELECT TRIM(substr(extraction_error, 1, 120)) AS kind,
            COUNT(*) AS count,
            MAX(extraction_updated_at) AS last
     FROM gm_messages
     WHERE extraction_error IS NOT NULL AND extraction_state != 'succeeded'
       AND extraction_updated_at > ?
     GROUP BY kind
     ORDER BY last DESC, count DESC
     LIMIT 12`,
  ).all(now - RECENT_WINDOW_1H) as unknown as RecentExtractionErrorRow[];

  let dbSizeBytes: number | null = null;
  try {
    dbSizeBytes = statSync(refs.dbPath).size;
  } catch {
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
