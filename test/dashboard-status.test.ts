import { describe, expect, it } from "vitest";
import { openDb } from "../src/store/db.ts";
import { upsertNode } from "../src/store/store.ts";
import type { DatabaseSyncInstance } from "../src/store/sqlite.ts";
import {
  buildRuntimeStatus,
  deriveExtractionHealth,
  normalizeErrorKind,
  summarizeErrors,
  vectorCoverage,
} from "../dashboard/status.ts";

function insertMessage(
  db: DatabaseSyncInstance,
  id: string,
  extractionState: string,
  updatedAt: number,
  extractionError?: string,
): void {
  db.prepare(
    `INSERT INTO gm_messages (id, session_id, turn_index, role, content, extracted, created_at,
       extraction_state, extraction_attempts, extraction_error, extraction_updated_at)
     VALUES (?, 'sess', 0, 'user', 'content', 1, ?, ?, 0, ?, ?)`,
  ).run(id, updatedAt, extractionState, extractionError ?? null, updatedAt);
}

function seedDb(): DatabaseSyncInstance {
  const db = openDb(":memory:");
  const { node } = upsertNode(db, {
    name: "seed-skill",
    type: "SKILL",
    description: "seed",
    content: "seed",
  }, "sess");
  db.prepare("INSERT INTO gm_vectors (node_id, content_hash, embedding) VALUES (?, 'h', ?)")
    .run(node.id, Buffer.alloc(4096));
  return db;
}

describe("deriveExtractionHealth", () => {
  it("derives pipeline health from backlog and drain rate", () => {
    expect(deriveExtractionHealth(0, 0, 0)).toBe("idle");
    expect(deriveExtractionHealth(10, 3, 9)).toBe("draining");
    expect(deriveExtractionHealth(10, 0, 3)).toBe("slow");
    expect(deriveExtractionHealth(10, 0, 0)).toBe("stalled");
    expect(deriveExtractionHealth(-5, 0, 0)).toBe("idle");
  });
});

describe("vectorCoverage", () => {
  it("clamps and rejects degenerate inputs", () => {
    expect(vectorCoverage(50, 100)).toBe(0.5);
    expect(vectorCoverage(150, 100)).toBe(1);
    expect(vectorCoverage(0, 100)).toBe(0);
    expect(vectorCoverage(10, 0)).toBeNull();
    expect(vectorCoverage(-1, 10)).toBeNull();
  });
});

describe("normalizeErrorKind", () => {
  it("strips prefix, keeps first line, falls back", () => {
    expect(normalizeErrorKind("[graph-memory] DSH LLM error: 429 rate limited\nsecond line"))
      .toBe("DSH LLM error: 429 rate limited");
    expect(normalizeErrorKind("   ")).toBe("未知错误");
    expect(normalizeErrorKind(null)).toBe("未知错误");
  });

  it("collapses JSON parse failures that only differ by byte offset", () => {
    expect(normalizeErrorKind(
      "[graph-memory] extraction parse failed: SyntaxError: Expected ',' or ']' after array element in JSON at position 8954",
    )).toBe("extraction parse failed: SyntaxError (JSON)");
    expect(normalizeErrorKind(
      "extraction parse failed: SyntaxError: Unterminated string in JSON at position 10773",
    )).toBe("extraction parse failed: SyntaxError (JSON)");
  });
});

describe("summarizeErrors", () => {
  it("maps rows, labels blank kinds, and keeps them out of the void", () => {
    const rows = summarizeErrors([
      { kind: " [graph-memory] boom ", count: 3, last: 42 },
      { kind: null, count: 1, last: 0 },
      { kind: "   ", count: 2, last: 5 },
    ]);
    expect(rows).toEqual([
      { kind: "boom", count: 3, lastSeenAt: 42 },
      { kind: "未知错误", count: 3, lastSeenAt: 5 },
    ]);
  });

  it("merges JSON parse variants and sorts by lastSeenAt", () => {
    const rows = summarizeErrors([
      { kind: "extraction parse failed: SyntaxError: Expected ',' at position 1", count: 2, last: 10 },
      { kind: "extraction parse failed: SyntaxError: Unterminated string at position 9", count: 5, last: 40 },
      { kind: "DSH LLM error: timeout", count: 1, last: 30 },
    ]);
    expect(rows.map((row) => ({ kind: row.kind, count: row.count, lastSeenAt: row.lastSeenAt }))).toEqual([
      { kind: "extraction parse failed: SyntaxError (JSON)", count: 7, lastSeenAt: 40 },
      { kind: "DSH LLM error: timeout", count: 1, lastSeenAt: 30 },
    ]);
  });
});

describe("buildRuntimeStatus", () => {
  it("aggregates queue, recall, and errors from the db", () => {
    const db = seedDb();
    const now = Date.now();
    insertMessage(db, "ok-recent", "succeeded", now - 60_000);
    insertMessage(db, "ok-old", "succeeded", now - 2 * 3_600_000);
    insertMessage(db, "p1", "pending", now, "429 too fast");
    insertMessage(db, "p2", "pending", now);
    insertMessage(db, "q1", "quarantined", now - 3_600_000, "[graph-memory] DSH LLM error: 429 quota");
    insertMessage(
      db,
      "fossil",
      "quarantined",
      now - 13 * 3_600_000,
      "[graph-memory] configure llmProvider/llmModel for extraction; session model is not used",
    );
    insertMessage(
      db,
      "parse-now",
      "pending",
      now - 30_000,
      "[graph-memory] extraction parse failed: SyntaxError: Expected ',' or ']' after array element in JSON at position 8954",
    );

    const status = buildRuntimeStatus({
      db,
      dbPath: "/tmp/graph-memory-test.db",
      contextCompactionEnabled: false,
      freshTurnCount: 5,
      embeddingState: () => "vector-ready",
      embeddingModel: "bge-m3",
      routes: () => ["grok/grok-4.6", "zai/glm-5.3-flash"],
      compactionMetrics: () => ({ attached: 2, selected: 0, succeeded: 0, unavailable: 0, failed: 0 }),
      drain: { maxBatchChars: 8000, maxBatchMessages: 15, maxRetries: 2, streamTimeoutMs: 180000 },
      retention: { keep: "all", revision: "rev-1" },
    }, now);

    expect(status.extraction.pending).toBe(3);
    expect(status.extraction.succeeded).toBe(2);
    expect(status.extraction.quarantined).toBe(2);
    expect(status.extraction.recent5m).toBe(1);
    expect(status.extraction.recent1h).toBe(1);
    expect(status.extraction.recent24h).toBe(2);
    expect(status.extraction.health).toBe("draining");
    expect(status.extraction.lastSucceededAt).toBe(now - 60_000);
    expect(status.graph.nodes).toBe(1);
    expect(status.graph.messages).toBe(7);
    expect(status.recall.vectors).toBe(1);
    expect(status.recall.dimensions).toBe(1024);
    expect(status.recall.coverage).toBe(1);
    expect(status.routes).toEqual(["grok/grok-4.6", "zai/glm-5.3-flash"]);
    expect(status.compaction.enabled).toBe(false);
    expect(status.drain.maxBatchChars).toBe(8000);
    expect(status.recentErrors.map((row) => row.kind)).toEqual([
      "429 too fast",
      "extraction parse failed: SyntaxError (JSON)",
    ]);
    expect(status.recentErrors.some((row) => row.kind.includes("configure llmProvider"))).toBe(false);
    expect(status.recentErrors.some((row) => row.kind.includes("429 quota"))).toBe(false);
    db.close();
  });
});
