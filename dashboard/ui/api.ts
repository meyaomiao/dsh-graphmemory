import type {
  GraphMemoryStatus,
  GraphNodeDetail,
  GraphSnapshot,
  GraphSnapshotRequest,
} from "../types.ts";
import type { GraphStats } from "./stats.ts";

export const API_PREFIX = "/graph-memory/api";

interface ApiSuccess<T> {
  ok: true;
  snapshot?: T;
  detail?: T;
  stats?: T;
  status?: T;
}

interface ApiFailure {
  ok: false;
  error?: string;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<ApiSuccess<T>> {
  const response = await fetch(path, {
    method: "GET",
    signal,
    headers: { accept: "application/json" },
  });
  let body: ApiSuccess<T> | ApiFailure;
  try {
    body = await response.json() as ApiSuccess<T> | ApiFailure;
  } catch {
    throw new Error(`Graph Memory API 返回了无效响应 (HTTP ${response.status})`);
  }
  if (!response.ok || !body.ok) {
    throw new Error((body as ApiFailure).error || `Graph Memory API 请求失败 (HTTP ${response.status})`);
  }
  return body as ApiSuccess<T>;
}

export async function fetchStats(signal?: AbortSignal): Promise<GraphStats> {
  const body = await getJson<GraphStats>(`${API_PREFIX}/stats`, signal);
  if (!body.stats) throw new Error("Graph Memory API 缺少 stats 数据");
  return body.stats;
}

export async function fetchStatus(signal?: AbortSignal): Promise<GraphMemoryStatus> {
  const body = await getJson<GraphMemoryStatus>(`${API_PREFIX}/status`, signal);
  if (!body.status) throw new Error("Graph Memory API 缺少 status 数据");
  return body.status;
}

export async function fetchSnapshot(
  request: GraphSnapshotRequest,
  signal?: AbortSignal,
): Promise<GraphSnapshot> {
  const params = new URLSearchParams();
  if (request.query) params.set("q", request.query);
  for (const type of request.nodeTypes ?? []) params.append("type", type);
  if (request.maxNodes !== undefined) params.set("maxNodes", String(request.maxNodes));
  const query = params.toString();
  const body = await getJson<GraphSnapshot>(`${API_PREFIX}/snapshot${query ? `?${query}` : ""}`, signal);
  if (!body.snapshot) throw new Error("Graph Memory API 缺少 snapshot 数据");
  return body.snapshot;
}

export async function fetchNodeDetail(
  id: string,
  signal?: AbortSignal,
): Promise<GraphNodeDetail | null> {
  const body = await getJson<GraphNodeDetail | null>(`${API_PREFIX}/nodes/${encodeURIComponent(id)}`, signal);
  return body.detail ?? null;
}
