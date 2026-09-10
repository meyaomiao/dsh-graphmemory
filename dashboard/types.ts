/**
 * Dashboard shared types: graph data projection, better-sidebar duck types,
 * and the runtime status payload served by dashboard/server.ts.
 *
 * The browser never touches SQLite directly; everything crosses this plugin's
 * loopback-only HTTP API under /graph-memory/api.
 */

export type NodeType = "TASK" | "SKILL" | "EVENT";
export type NodeStatus = "active" | "deprecated";
export type EdgeType =
  | "USED_SKILL"
  | "SOLVED_BY"
  | "REQUIRES"
  | "PATCHES"
  | "CONFLICTS_WITH";

export interface GraphSnapshotRequest {
  query?: string;
  nodeTypes?: NodeType[];
  maxNodes?: number;
}

export interface GraphSnapshotNode {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  status: NodeStatus;
  validatedCount: number;
  sourceSessionCount: number;
  communityId: string | null;
  pagerank: number;
  createdAt: number;
  updatedAt: number;
}

export interface GraphSnapshotEdge {
  id: string;
  fromId: string;
  toId: string;
  type: EdgeType;
  instruction: string;
  condition?: string;
  createdAt: number;
}

export interface GraphSnapshot {
  generatedAt: number;
  nodes: GraphSnapshotNode[];
  edges: GraphSnapshotEdge[];
  totals: { nodes: number; edges: number };
  truncated: { nodes: boolean; edges: boolean };
}

export interface GraphNodeDetail extends GraphSnapshotNode {
  content: string;
  contentTruncated: boolean;
}

/** better-sidebar 鸭子类型（可选 peer；服务缺失时客户端须优雅降级）。 */
export interface SidebarTabProps {
  scope: { sessionId: string; cwd?: string };
  visible: boolean;
  tab: { id: string; type: string; path?: string; meta?: unknown };
}

export interface SidebarTabDescriptor {
  id: string;
  title: string | (() => string);
  icon?: unknown;
  order?: number;
  single?: boolean;
  component: (props: SidebarTabProps) => unknown;
}

export interface BetterSidebarService {
  registerTab(descriptor: SidebarTabDescriptor): () => void;
}

export interface ClientContext {
  readonly betterSidebar?: BetterSidebarService;
  logger?: {
    info(message: unknown, ...args: unknown[]): void;
    warn(message: unknown, ...args: unknown[]): void;
  };
  effect(factory: () => (() => void) | void, label?: string): void;
  /**
   * 运行时服务等待(cordis Context 方法,非服务属性):DSH 0.1.5+ 用于
   * 等待官方原生右侧栏服务 sidebarRightTabs。
   */
  inject?(
    deps: readonly string[],
    fn: (ctx: { get(name: string): unknown }) => (() => void) | void,
  ): { dispose?: () => void };
  /** 官方座位系统(DSH web client 核心服务;原生右侧栏内容体注册需要)。 */
  readonly slots?: {
    inject(name: string, fn: () => (() => void) | void): () => void;
    register(spec: Record<string, unknown>, component: unknown): () => void;
  };
}

/** 抽取管线健康度：由积压量与近期消化速率推导。 */
export type ExtractionHealth = "draining" | "slow" | "stalled" | "idle";

export interface GraphMemoryExtractionStatus {
  pending: number;
  succeeded: number;
  quarantined: number;
  lastSucceededAt: number | null;
  recent5m: number;
  recent1h: number;
  recent24h: number;
  health: ExtractionHealth;
}

export interface GraphMemoryRecallStatus {
  state: "vector-ready" | "degraded" | "fts-only" | "initializing";
  vectors: number;
  /** 向量覆盖率 0-1；节点数为 0 或数据异常时为 null。 */
  coverage: number | null;
  dimensions: number | null;
  model: string | null;
}

export interface GraphMemoryRecentError {
  kind: string;
  count: number;
  lastSeenAt: number;
}

export interface GraphMemoryCompactionStatus {
  enabled: boolean;
  freshTurnCount: number;
  attached: number;
  selected: number;
  succeeded: number;
  unavailable: number;
  failed: number;
}

/** 记忆图谱运行概览：引擎内存指标 + 本插件 DB 只读聚合。 */
export interface GraphMemoryStatus {
  generatedAt: number;
  dbPath: string;
  dbSizeBytes: number | null;
  graph: { nodes: number; edges: number; communities: number; messages: number };
  extraction: GraphMemoryExtractionStatus;
  recall: GraphMemoryRecallStatus;
  compaction: GraphMemoryCompactionStatus;
  routes: string[];
  drain: { maxBatchChars: number; maxBatchMessages: number; maxRetries: number; streamTimeoutMs: number };
  retention: { keep: string; revision: string };
  recentErrors: GraphMemoryRecentError[];
}
