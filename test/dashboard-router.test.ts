import { describe, expect, it } from "vitest";
import { API_PREFIX, createDashboardRouter, isLoopback, parseSnapshotRequest } from "../dashboard/server.ts";
import type { GraphMemoryStatus } from "../dashboard/types.ts";

function request(url: string, remoteAddress = "127.0.0.1", method = "GET"): any {
  return { method, url, socket: { remoteAddress } };
}

function response(): { value: Promise<{ status: number; body: any }>; target: any } {
  let resolve!: (value: { status: number; body: any }) => void;
  const value = new Promise<{ status: number; body: any }>((next) => { resolve = next; });
  const target = {
    writeHead(status: number) { this.status = status; },
    end(body: string) { resolve({ status: this.status, body: JSON.parse(body) }); },
    status: 500,
  };
  return { value, target };
}

const snapshot = {
  generatedAt: 1,
  nodes: [{
    id: "n-1", type: "TASK", name: "节点", description: "摘要", status: "active",
    validatedCount: 0, sourceSessionCount: 1, communityId: null, pagerank: 0.1,
    createdAt: 1, updatedAt: 2,
  }],
  edges: [],
  totals: { nodes: 1, edges: 0 },
  truncated: { nodes: false, edges: false },
};

const statusPayload: GraphMemoryStatus = {
  generatedAt: 7,
  dbPath: "/tmp/x.db",
  dbSizeBytes: 10,
  graph: { nodes: 1, edges: 0, communities: 0, messages: 3 },
  extraction: {
    pending: 1, succeeded: 2, quarantined: 0, lastSucceededAt: 6,
    recent5m: 1, recent1h: 1, recent24h: 2, health: "draining",
  },
  recall: { state: "vector-ready", vectors: 1, coverage: 1, dimensions: 1024, model: "bge-m3" },
  compaction: { enabled: false, freshTurnCount: 5, attached: 0, selected: 0, succeeded: 0, unavailable: 0, failed: 0 },
  routes: ["grok/grok-4.6"],
  drain: { maxBatchChars: 8000, maxBatchMessages: 15, maxRetries: 2, streamTimeoutMs: 180000 },
  retention: { keep: "all", revision: "rev" },
  recentErrors: [],
};

function deps() {
  return {
    graph: {
      getSnapshot: () => snapshot,
      getNodeDetail: (id: string) => (id === "n-1" ? { ...snapshot.nodes[0], content: "正文", contentTruncated: false } : null),
    },
    status: { getStatus: () => statusPayload },
  };
}

describe("dashboard router", () => {
  it("guards loopback, method, and serves status/snapshot/stats/nodes", async () => {
    const router = createDashboardRouter(deps());

    const denied = response();
    await router(request(`${API_PREFIX}/status`, "10.0.0.5"), denied.target);
    expect((await denied.value).status).toBe(403);

    const badMethod = response();
    await router(request(`${API_PREFIX}/status`, "127.0.0.1", "POST"), badMethod.target);
    expect((await badMethod.value).status).toBe(405);

    const status = response();
    await router(request(`${API_PREFIX}/status`), status.target);
    const statusBody = await status.value;
    expect(statusBody.status).toBe(200);
    expect(statusBody.body.ok).toBe(true);
    expect(statusBody.body.status.extraction.health).toBe("draining");
    expect(statusBody.body.status.routes[0]).toBe("grok/grok-4.6");

    const snap = response();
    await router(request(`${API_PREFIX}/snapshot?maxNodes=5`), snap.target);
    expect((await snap.value).body.snapshot.totals.nodes).toBe(1);

    const stats = response();
    await router(request(`${API_PREFIX}/stats`), stats.target);
    expect((await stats.value).body.stats.byType.TASK).toBe(1);

    const node = response();
    await router(request(`${API_PREFIX}/nodes/n-1`), node.target);
    expect((await node.value).body.detail.content).toBe("正文");

    const missing = response();
    await router(request(`${API_PREFIX}/nodes/nope`), missing.target);
    expect((await missing.value).status).toBe(404);

    const unknown = response();
    await router(request(`${API_PREFIX}/whatever`), unknown.target);
    expect((await unknown.value).status).toBe(404);
  });

  it("bounds snapshot input and validates node types", () => {
    const parsed = parseSnapshotRequest(new URL("http://loopback/api?q=%20hello%20&type=skill&type=TASK&maxNodes=9999"));
    expect(parsed).toEqual({ query: "hello", nodeTypes: ["SKILL", "TASK"], maxNodes: 200 });
    expect(() => parseSnapshotRequest(new URL("http://loopback/api?type=UNKNOWN"))).toThrow(/TASK、SKILL 或 EVENT/);
  });

  it("rejects lan addresses as non-loopback", () => {
    expect(isLoopback({ socket: { remoteAddress: "192.168.1.8" } } as any)).toBe(false);
    expect(isLoopback({ socket: { remoteAddress: "::ffff:127.0.0.1" } } as any)).toBe(true);
  });
});
