import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import { fetchNodeDetail, fetchSnapshot, fetchStats, fetchStatus } from './api.ts';
import { nodeBox } from './layout.ts';
import { layoutLayeredTree } from './graph-layout.ts';
import type { GraphStats } from './stats.ts';
import type {
  ExtractionHealth,
  GraphMemoryStatus,
  GraphNodeDetail,
  GraphSnapshot,
  GraphSnapshotEdge,
  GraphSnapshotNode,
  NodeType,
} from '../types.ts';

export interface GraphMemoryAppProps {
  visible: boolean;
}

type NodeFilter = 'ALL' | NodeType;

const GRAPH_NODE_LIMIT = 72;
const GRAPH_VIEW_LIMIT = 72;
const GRAPH_WIDTH = 960;
const GRAPH_DEFAULT_ZOOM = 0.72;
const GRAPH_MIN_ZOOM = 0.55;
const GRAPH_MAX_ZOOM = 1.25;

const NODE_LABELS: Record<NodeFilter, string> = {
  ALL: '全部类型',
  TASK: '任务',
  SKILL: '技能',
  EVENT: '事件',
};

const EDGE_LABELS: Record<string, string> = {
  USED_SKILL: '使用技能',
  SOLVED_BY: '由事件解决',
  REQUIRES: '依赖',
  PATCHES: '修复',
  CONFLICTS_WITH: '冲突',
};

function shortName(value: string, max = 22): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '未知时间';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '未知时间';
  }
}

function relativeTime(value: number | null): string {
  if (!value || !Number.isFinite(value) || value <= 0) return '从未';
  const delta = Date.now() - value;
  if (delta < 45_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.max(1, Math.round(delta / 60_000))} 分钟前`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} 小时前`;
  return `${Math.round(delta / 86_400_000)} 天前`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : '—';
}

const HEALTH_META: Record<ExtractionHealth, { label: string; tone: string }> = {
  draining: { label: '抽取中', tone: 'ok' },
  slow: { label: '缓慢', tone: 'warn' },
  stalled: { label: '停滞', tone: 'bad' },
  idle: { label: '空闲', tone: 'idle' },
};

const RECALL_LABELS: Record<string, string> = {
  'vector-ready': '向量召回就绪',
  degraded: '向量召回降级',
  'fts-only': '纯全文召回',
  initializing: '向量初始化中',
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nodeColorClass(type: NodeType): string {
  return `gm-node-${type.toLowerCase()}`;
}

function StatCard(props: { label: string; value: string; tone?: string }): JSX.Element {
  return (
    <div className={`gm-stat-card ${props.tone ?? ''}`}>
      <span className="gm-stat-label">{props.label}</span>
      <strong className="gm-stat-value">{props.value}</strong>
    </div>
  );
}

function StatusMetric(props: { label: string; value: string; title?: string }): JSX.Element {
  return (
    <div className="gm-status-metric" title={props.title}>
      <span className="gm-status-metric-label">{props.label}</span>
      <span className="gm-status-metric-value">{props.value}</span>
    </div>
  );
}

function StatusOverview(props: { status: GraphMemoryStatus | null; error: string | null }): JSX.Element {
  const status = props.status;
  if (!status) {
    return (
      <section className="gm-status" data-testid="graph-memory-status">
        <div className="gm-status-offline">
          {props.error ? `运行概览暂不可用：${props.error}` : '正在读取运行概览…'}
        </div>
      </section>
    );
  }
  const health = HEALTH_META[status.extraction.health];
  const queueTotal = status.extraction.pending + status.extraction.succeeded + status.extraction.quarantined;
  const donePct = queueTotal > 0 ? Math.round((status.extraction.succeeded / queueTotal) * 100) : 100;
  const recallCoverage = status.recall.coverage === null
    ? '—'
    : `${Math.round(status.recall.coverage * 100)}%`;
  const updated = relativeTime(status.generatedAt);
  return (
    <section className="gm-status" data-testid="graph-memory-status" aria-label="记忆图谱运行概览">
      <div className="gm-status-heading">
        <div><h3>运行概览</h3><span>抽取路由 {status.routes.length > 0 ? status.routes.join(' → ') : '未配置'}</span></div>
        <div className="gm-status-chips">
          <span className={`gm-health-chip is-${health.tone}`} title={`管线健康度：${health.label}`}>{health.label}</span>
          <span className="gm-status-updated" title={formatTime(status.generatedAt)}>{updated}更新</span>
        </div>
      </div>
      <div className="gm-status-grid">
        <div className="gm-status-card" title={`数据库：${status.dbPath}`}>
          <div className="gm-status-card-title">运行状态</div>
          <StatusMetric label="向量召回" value={RECALL_LABELS[status.recall.state] ?? status.recall.state} />
          <StatusMetric
            label="向量覆盖"
            value={`${recallCoverage} · ${formatNumber(status.recall.vectors)} 向量${status.recall.dimensions ? ` · ${status.recall.dimensions} 维` : ''}`}
            title={status.recall.model ? `嵌入模型：${status.recall.model}` : undefined}
          />
          <StatusMetric label="数据库" value={formatBytes(status.dbSizeBytes)} />
          <StatusMetric
            label="滚动压缩"
            value={status.compaction.enabled
              ? `开启 · 成功 ${formatNumber(status.compaction.succeeded)}`
              : '关闭（DSH 原生兜底）'}
          />
        </div>
        <div className="gm-status-card">
          <div className="gm-status-card-title">抽取进展</div>
          <div className="gm-status-queue">
            <span className="gm-queue-pill is-pending">待抽取 {formatNumber(status.extraction.pending)}</span>
            <span className="gm-queue-pill is-done">已抽取 {formatNumber(status.extraction.succeeded)}</span>
            <span className="gm-queue-pill is-quarantine">隔离 {formatNumber(status.extraction.quarantined)}</span>
          </div>
          <div className="gm-progress" role="progressbar" aria-valuenow={donePct} aria-valuemin={0} aria-valuemax={100} title={`已抽取占比 ${donePct}%`}>
            <i style={{ width: `${donePct}%` }} />
          </div>
          <div className="gm-progress-caption">知识覆盖率 {donePct}% · 消息 {formatNumber(status.graph.messages)} 条</div>
        </div>
        <div className="gm-status-card">
          <div className="gm-status-card-title">实时情况</div>
          <StatusMetric label="近 5 分钟" value={`${formatNumber(status.extraction.recent5m)} 条`} />
          <StatusMetric label="近 1 小时" value={`${formatNumber(status.extraction.recent1h)} 条`} />
          <StatusMetric label="最后成功" value={relativeTime(status.extraction.lastSucceededAt)} />
          {status.recentErrors.length > 0 ? (
            <div className="gm-status-errors">
              {status.recentErrors.slice(0, 2).map((item) => (
                <div key={item.kind} className="gm-status-error" title={`${item.kind} · 最近 ${relativeTime(item.lastSeenAt)}`}>
                  <span className="gm-status-error-kind">{item.kind}</span>
                  <span className="gm-status-error-count">×{formatNumber(item.count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="gm-progress-caption">近期无抽取错误</div>
          )}
        </div>
      </div>
    </section>
  );
}

function NodeBadge({ type }: { type: NodeType }): JSX.Element {
  return <span className={`gm-node-badge ${nodeColorClass(type)}`}>{NODE_LABELS[type]}</span>;
}

interface PanState {
  pointerId: number;
  originClientX: number;
  originClientY: number;
  originScrollLeft: number;
  originScrollTop: number;
}

function clampZoom(value: number): number {
  return Math.min(GRAPH_MAX_ZOOM, Math.max(GRAPH_MIN_ZOOM, value));
}

type DepthTarget = 3 | 5;

function GraphCanvas(props: {
  nodes: readonly GraphSnapshotNode[];
  edges: readonly GraphSnapshotEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const nodes = useMemo(() => props.nodes.slice(0, GRAPH_VIEW_LIMIT), [props.nodes]);
  const rootId = useMemo(
    () => (props.selectedId && nodes.some((node) => node.id === props.selectedId) ? props.selectedId : nodes[0]?.id ?? ''),
    [nodes, props.selectedId],
  );
  const rootNode = nodes.find((node) => node.id === rootId);
  const [depthTarget, setDepthTarget] = useState<DepthTarget>(3);
  const [visibleDepth, setVisibleDepth] = useState(3);
  const [zoom, setZoom] = useState(GRAPH_DEFAULT_ZOOM);
  const [panning, setPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<PanState | null>(null);
  const tree = useMemo(
    () => layoutLayeredTree(nodes, props.edges, rootId, visibleDepth, GRAPH_WIDTH),
    [nodes, props.edges, rootId, visibleDepth],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
    panRef.current = null;
    setPanning(false);
  }, [tree]);

  useEffect(() => {
    if (rootId) setVisibleDepth(3);
  }, [rootId]);

  const onViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('.gm-svg-node')) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable in a few embedded WebKit contexts.
    }
    panRef.current = {
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originScrollLeft: viewport.scrollLeft,
      originScrollTop: viewport.scrollTop,
    };
    setPanning(true);
  };

  const onViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !viewport) return;
    event.preventDefault();
    viewport.scrollLeft = pan.originScrollLeft - (event.clientX - pan.originClientX);
    viewport.scrollTop = pan.originScrollTop - (event.clientY - pan.originClientY);
  };

  const finishPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    try {
      viewport?.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
    panRef.current = null;
    setPanning(false);
  };

  const selectDepthTarget = (target: DepthTarget): void => {
    setDepthTarget(target);
    setVisibleDepth((current) => Math.min(current, target));
  };

  const resetView = (): void => {
    setZoom(GRAPH_DEFAULT_ZOOM);
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  };

  if (nodes.length === 0) {
    return <div className="gm-graph-empty">没有符合条件的关系数据</div>;
  }

  return (
    <div className="gm-graph-wrap" data-testid="graph-memory-graph">
      <div className="gm-graph-toolbar">
        <span className="gm-graph-help" title={`根节点：${rootNode?.name ?? '当前节点'}`}>
          根：{shortName(rootNode?.name ?? '当前节点', 18)} · {visibleDepth}/{depthTarget} 层
        </span>
        <div className="gm-graph-controls" aria-label="关系图控制">
          <div className="gm-depth-controls" aria-label="关联层级">
            <span className="gm-control-caption">层级</span>
            <button type="button" className={`gm-depth-button ${depthTarget === 3 ? 'is-active' : ''}`} onClick={() => selectDepthTarget(3)}>3</button>
            <button type="button" className={`gm-depth-button ${depthTarget === 5 ? 'is-active' : ''}`} onClick={() => selectDepthTarget(5)}>5</button>
            <button type="button" className="gm-graph-reset" disabled={visibleDepth <= 1} onClick={() => setVisibleDepth((current) => Math.max(1, current - 1))} aria-label="收起一层">−层</button>
            <button type="button" className="gm-graph-reset" disabled={visibleDepth >= depthTarget} onClick={() => setVisibleDepth((current) => Math.min(depthTarget, current + 1))} aria-label="展开一层">＋层</button>
          </div>
          <button type="button" className="gm-graph-control" onClick={() => setZoom((value) => clampZoom(value - 0.1))} aria-label="缩小关系图">−</button>
          <span className="gm-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="gm-graph-control" onClick={() => setZoom((value) => clampZoom(value + 0.1))} aria-label="放大关系图">+</button>
          <button type="button" className="gm-graph-reset" onClick={resetView} aria-label="复位视图" title="复位视图">↺</button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`gm-graph-viewport ${panning ? 'is-panning' : ''}`}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
      >
        <svg
          className="gm-graph"
          width={tree.width * zoom}
          height={tree.height * zoom}
          viewBox={`0 0 ${tree.width} ${tree.height}`}
          role="img"
          aria-label="按层级展示且可拖动画布的知识图谱关系图"
        >
          <defs>
            <marker id="gm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="gm-edge-arrow" />
            </marker>
          </defs>
          {tree.edges.map(({ edge, parentId, childId }) => {
            const from = tree.points.get(parentId);
            const to = tree.points.get(childId);
            if (!from || !to) return null;
            const bendX = (from.x + to.x) / 2;
            return (
              <path
                key={edge.id}
                d={`M ${from.x} ${from.y} H ${bendX} V ${to.y} H ${to.x}`}
                className={`gm-edge-line gm-edge-${edge.type.toLowerCase()}`}
                markerEnd="url(#gm-arrow)"
              >
                <title>{EDGE_LABELS[edge.type] ?? edge.type}</title>
              </path>
            );
          })}
          {tree.nodes.map((node) => {
            const point = tree.points.get(node.id);
            if (!point) return null;
            const box = nodeBox(node);
            const selected = node.id === props.selectedId;
            const depth = tree.depthById.get(node.id) ?? 0;
            return (
              <g
                key={node.id}
                className={`gm-svg-node ${nodeColorClass(node.type)} ${selected ? 'is-selected' : ''}`}
                transform={`translate(${point.x} ${point.y})`}
                tabIndex={0}
                role="button"
                aria-label={`查看${NODE_LABELS[node.type]} ${node.name}`}
                onClick={() => props.onSelect(node.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    props.onSelect(node.id);
                  }
                }}
              >
                <rect
                  className="gm-node-label-bg"
                  x={-box.width / 2}
                  y={-box.height / 2}
                  width={box.width}
                  height={box.height}
                  rx={8}
                />
                <circle cy={-8} r={selected ? 13 : 10} />
                <text y={18} textAnchor="middle">{shortName(node.name, 16)}</text>
                <title>{node.name} · 第 {depth} 层</title>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="gm-graph-legend" aria-label="节点类型图例">
        <span><i className="gm-legend-dot gm-node-task" />任务</span>
        <span><i className="gm-legend-dot gm-node-skill" />技能</span>
        <span><i className="gm-legend-dot gm-node-event" />事件</span>
      </div>
      <p className="gm-hint">
        空白处拖动画布；点击节点查看详情。当前显示 {tree.nodes.length} 个节点、{tree.edges.length} 条树形关系。
        {tree.hiddenEdgeCount > 0 ? `已隐藏 ${tree.hiddenEdgeCount} 条回边/重复关系以避免连线交叉；` : ''}
选择 5 层后可继续点击“＋层”查看更深关联，列表仍保留完整快照。
      </p>
    </div>
  );
}

function NodeList(props: {
  nodes: readonly GraphSnapshotNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}): JSX.Element {
  if (props.loading) return <div className="gm-list-placeholder">正在读取记忆节点…</div>;
  if (props.nodes.length === 0) return <div className="gm-list-placeholder">没有找到匹配节点</div>;

  return (
    <div className="gm-node-list" data-testid="graph-memory-node-list">
      {props.nodes.map((node) => (
        <button
          type="button"
          key={node.id}
          className={`gm-node-row ${node.id === props.selectedId ? 'is-selected' : ''}`}
          onClick={() => props.onSelect(node.id)}
        >
          <span className="gm-node-row-main">
            <span className="gm-node-row-title">{node.name}</span>
            <NodeBadge type={node.type} />
          </span>
          <span className="gm-node-row-description">{node.description || '暂无摘要'}</span>
          <span className="gm-node-row-meta">
            <span>验证 {node.validatedCount}</span>
            <span>来源 {node.sourceSessionCount} 个会话</span>
            <span>Rank {node.pagerank.toFixed(3)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function NodeDetail(props: {
  detail: GraphNodeDetail | null;
  loading: boolean;
  onCopy: () => void;
}): JSX.Element {
  if (props.loading) return <div className="gm-detail-placeholder">正在读取节点详情…</div>;
  if (!props.detail) {
    return (
      <div className="gm-detail-placeholder">
        <span className="gm-detail-placeholder-icon">⌁</span>
        <strong>选择一个节点</strong>
        <span>查看完整内容、验证次数与更新时间</span>
      </div>
    );
  }

  const detail = props.detail;
  return (
    <article className="gm-detail-card" data-testid="graph-memory-node-detail">
      <div className="gm-detail-header">
        <div>
          <NodeBadge type={detail.type} />
          <h3>{detail.name}</h3>
        </div>
        <button type="button" className="gm-quiet-button" onClick={props.onCopy} title="复制节点内容">复制</button>
      </div>
      <p className="gm-detail-description">{detail.description || '暂无摘要'}</p>
      <div className="gm-detail-facts">
        <span>验证 {detail.validatedCount} 次</span>
        <span>来源 {detail.sourceSessionCount} 个会话</span>
        <span>社区 {detail.communityId ?? '未分组'}</span>
        <span>更新于 {formatTime(detail.updatedAt)}</span>
      </div>
      <pre className="gm-detail-content">{detail.content || '暂无正文'}</pre>
      {detail.contentTruncated && <p className="gm-hint">正文已按 Host 安全上限截断。</p>}
    </article>
  );
}

export function GraphMemoryApp(props: GraphMemoryAppProps): JSX.Element {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [detail, setDetail] = useState<GraphNodeDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [nodeFilter, setNodeFilter] = useState<NodeFilter>('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<GraphMemoryStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // 运行概览：可见期间每 5 秒轮询一次；失败静默降级，不打断图谱主功能。
  useEffect(() => {
    if (!props.visible) return undefined;
    let cancelled = false;
    const load = (signal: AbortSignal): void => {
      fetchStatus(signal)
        .then((value) => {
          if (cancelled) return;
          setStatus(value);
          setStatusError(null);
        })
        .catch((reason) => {
          if (!cancelled && !signal.aborted) setStatusError(errorText(reason));
        });
    };
    const controller = new AbortController();
    load(controller.signal);
    const timer = setInterval(() => load(controller.signal), 5000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [props.visible, reloadKey]);

  useEffect(() => {
    if (!props.visible) return undefined;
    const controller = new AbortController();
    setSummaryLoading(true);
    fetchStats(controller.signal)
      .then((value) => {
        setStats(value);
        setError(null);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorText(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSummaryLoading(false);
      });
    return () => controller.abort();
  }, [props.visible, reloadKey]);

  useEffect(() => {
    if (!props.visible) return undefined;
    const controller = new AbortController();
    setGraphLoading(true);
    const request = {
      query: activeQuery || undefined,
      nodeTypes: nodeFilter === 'ALL' ? undefined : [nodeFilter],
      maxNodes: GRAPH_NODE_LIMIT,
    };
    fetchSnapshot(request, controller.signal)
      .then((value) => {
        setSnapshot(value);
        setSelectedId(null);
        setDetail(null);
        setError(null);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorText(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setGraphLoading(false);
      });
    return () => controller.abort();
  }, [props.visible, activeQuery, nodeFilter, reloadKey]);

  useEffect(() => {
    if (!props.visible || !selectedId) {
      setDetail(null);
      setDetailLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    fetchNodeDetail(selectedId, controller.signal)
      .then((value) => {
        setDetail(value);
        if (!value) setError('该节点已不存在或已被归档');
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorText(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [props.visible, selectedId]);

  const onSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setActiveQuery(query.trim());
  };

  const onSelect = (id: string): void => setSelectedId(id);

  const onCopy = (): void => {
    if (!detail?.content) return;
    const copy = navigator.clipboard?.writeText(detail.content);
    if (copy) void copy.catch((reason) => setError(errorText(reason)));
  };

  const onExport = (): void => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), stats, snapshot }, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `graph-memory-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const visibleNodeCount = snapshot?.nodes.length ?? 0;
  const statsPrefix = stats?.approximate ? '≥' : '';

  return (
    <main className="gm-shell" data-testid="graph-memory-dashboard">
      <header className="gm-header">
        <div>
          <p className="gm-eyebrow">GRAPH MEMORY</p>
          <h2>记忆图谱</h2>
          <p className="gm-subtitle">跨会话知识、技能与事件的可追溯视图</p>
        </div>
        <div className="gm-header-actions">
          <button type="button" className="gm-icon-button" onClick={() => setReloadKey((value) => value + 1)} title="刷新" aria-label="刷新">↻</button>
          <button type="button" className="gm-icon-button" onClick={onExport} disabled={!snapshot} title="导出当前快照" aria-label="导出当前快照">⇩</button>
        </div>
      </header>

      <StatusOverview status={status} error={statusError} />

      <section className="gm-stats" aria-label="记忆统计">
        <StatCard label="知识节点" value={summaryLoading && !stats ? '…' : `${statsPrefix}${stats?.nodes ?? '—'}`} tone="blue" />
        <StatCard label="关系边" value={summaryLoading && !stats ? '…' : `${statsPrefix}${stats?.edges ?? '—'}`} tone="purple" />
        <StatCard label="社区" value={summaryLoading && !stats ? '…' : `${statsPrefix}${stats?.communities ?? '—'}`} tone="gold" />
        <StatCard label="当前结果" value={`${visibleNodeCount}`} tone="green" />
      </section>

      <section className="gm-type-summary" aria-label="节点类型统计">
        {(['TASK', 'SKILL', 'EVENT'] as const).map((type) => (
          <span key={type}><i className={`gm-legend-dot ${nodeColorClass(type)}`} />{NODE_LABELS[type]} {stats?.byType[type] ?? '—'}</span>
        ))}
        {stats?.approximate && <span className="gm-hint">统计为快照下界</span>}
      </section>

      <form className="gm-search" onSubmit={onSearch}>
        <div className="gm-search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、摘要或正文…"
            aria-label="搜索记忆"
          />
          {query && <button type="button" className="gm-clear-button" onClick={() => { setQuery(''); setActiveQuery(''); }} aria-label="清除搜索">×</button>}
        </div>
        <select value={nodeFilter} onChange={(event) => setNodeFilter(event.target.value as NodeFilter)} aria-label="节点类型">
          {(Object.keys(NODE_LABELS) as NodeFilter[]).map((value) => <option key={value} value={value}>{NODE_LABELS[value]}</option>)}
        </select>
        <button type="submit" className="gm-primary-button">搜索</button>
      </form>

      {error && (
        <div className="gm-error" role="alert">
          <span>读取 Graph Memory 失败：{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="关闭错误">×</button>
        </div>
      )}

      <section className="gm-section gm-graph-section">
        <div className="gm-section-heading">
          <div><h3>关系视图</h3><span>{snapshot?.edges.length ?? 0} 条关系</span></div>
          {snapshot?.truncated.nodes && <span className="gm-warning-chip">结果已限制</span>}
        </div>
        <GraphCanvas
          nodes={snapshot?.nodes ?? []}
          edges={snapshot?.edges ?? []}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </section>

      <section className="gm-section">
        <div className="gm-section-heading">
          <div><h3>知识节点</h3><span>{visibleNodeCount} 个结果</span></div>
          {graphLoading && <span className="gm-loading-dot">读取中</span>}
        </div>
        <NodeList nodes={snapshot?.nodes ?? []} selectedId={selectedId} onSelect={onSelect} loading={graphLoading && !snapshot} />
      </section>

      <section className="gm-section gm-detail-section">
        <div className="gm-section-heading"><div><h3>节点详情</h3><span>只读安全视图</span></div></div>
        <NodeDetail detail={detail} loading={detailLoading} onCopy={onCopy} />
      </section>

      <footer className="gm-footer">
        <span>数据由 Graph Memory Pro Lite 提供</span>
        <span>写入仍由 Graph Memory 自动抽取或 gm_record 管理</span>
      </footer>
    </main>
  );
}
