window.__ModuleLoader__.load({ id: "dsh-graphmemory", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// dashboard/client.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react2 = require("react");

// dashboard/ui/app.tsx
var import_react = require("react");

// dashboard/ui/api.ts
var API_PREFIX = "/graph-memory/api";
async function getJson(path, signal) {
  const response = await fetch(path, {
    method: "GET",
    signal,
    headers: { accept: "application/json" }
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Graph Memory API \u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94 (HTTP ${response.status})`);
  }
  if (!response.ok || !body.ok) {
    throw new Error(body.error || `Graph Memory API \u8BF7\u6C42\u5931\u8D25 (HTTP ${response.status})`);
  }
  return body;
}
async function fetchStats(signal) {
  const body = await getJson(`${API_PREFIX}/stats`, signal);
  if (!body.stats) throw new Error("Graph Memory API \u7F3A\u5C11 stats \u6570\u636E");
  return body.stats;
}
async function fetchStatus(signal) {
  const body = await getJson(`${API_PREFIX}/status`, signal);
  if (!body.status) throw new Error("Graph Memory API \u7F3A\u5C11 status \u6570\u636E");
  return body.status;
}
async function fetchSnapshot(request, signal) {
  const params = new URLSearchParams();
  if (request.query) params.set("q", request.query);
  for (const type of request.nodeTypes ?? []) params.append("type", type);
  if (request.maxNodes !== void 0) params.set("maxNodes", String(request.maxNodes));
  const query = params.toString();
  const body = await getJson(`${API_PREFIX}/snapshot${query ? `?${query}` : ""}`, signal);
  if (!body.snapshot) throw new Error("Graph Memory API \u7F3A\u5C11 snapshot \u6570\u636E");
  return body.snapshot;
}
async function fetchNodeDetail(id, signal) {
  const body = await getJson(`${API_PREFIX}/nodes/${encodeURIComponent(id)}`, signal);
  return body.detail ?? null;
}

// dashboard/ui/layout.ts
var MAX_LABEL_LENGTH = 16;
var MIN_BOX_WIDTH = 76;
var MAX_BOX_WIDTH = 118;
var BOX_HEIGHT = 44;
function labelLength(node) {
  return Math.min(node.name.length, MAX_LABEL_LENGTH);
}
function nodeBox(node) {
  return {
    width: Math.min(MAX_BOX_WIDTH, Math.max(MIN_BOX_WIDTH, labelLength(node) * 6.2 + 26)),
    height: BOX_HEIGHT
  };
}

// dashboard/ui/graph-layout.ts
var GRAPH_PADDING_X = 80;
var GRAPH_PADDING_Y = 40;
var TREE_ROW_GAP = 72;
var MIN_TREE_HEIGHT = 300;
function layoutLayeredTree(nodes, edges, rootId, maxDepth, width = 960) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const root = nodeById.get(rootId) ?? nodes[0];
  if (!root) {
    return {
      rootId,
      nodes: [],
      edges: [],
      depthById: /* @__PURE__ */ new Map(),
      points: /* @__PURE__ */ new Map(),
      width,
      height: MIN_TREE_HEIGHT,
      hiddenEdgeCount: 0
    };
  }
  const boundedDepth = Math.max(0, Math.min(5, Math.floor(maxDepth)));
  const adjacency = /* @__PURE__ */ new Map();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    if (!nodeById.has(edge.fromId) || !nodeById.has(edge.toId) || edge.fromId === edge.toId) continue;
    adjacency.get(edge.fromId)?.push({ id: edge.toId, edge });
    adjacency.get(edge.toId)?.push({ id: edge.fromId, edge });
  }
  const depthById = /* @__PURE__ */ new Map([[root.id, 0]]);
  const parentById = /* @__PURE__ */ new Map();
  const parentEdgeById = /* @__PURE__ */ new Map();
  const queue = [root.id];
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    const currentDepth = depthById.get(currentId) ?? 0;
    if (currentDepth >= boundedDepth) continue;
    for (const neighbor of adjacency.get(currentId) ?? []) {
      if (depthById.has(neighbor.id)) continue;
      depthById.set(neighbor.id, currentDepth + 1);
      parentById.set(neighbor.id, currentId);
      parentEdgeById.set(neighbor.id, neighbor.edge);
      queue.push(neighbor.id);
    }
  }
  const treeNodes = nodes.filter((node) => depthById.has(node.id));
  const treeNodeIds = new Set(treeNodes.map((node) => node.id));
  const treeEdges = [];
  for (const node of treeNodes) {
    const parentId = parentById.get(node.id);
    const edge = parentEdgeById.get(node.id);
    if (parentId && edge) treeEdges.push({ edge, parentId, childId: node.id });
  }
  const treeEdgeIds = new Set(treeEdges.map(({ edge }) => edge.id));
  const hiddenEdgeCount = edges.filter(
    (edge) => treeNodeIds.has(edge.fromId) && treeNodeIds.has(edge.toId) && !treeEdgeIds.has(edge.id)
  ).length;
  const children = /* @__PURE__ */ new Map();
  for (const node of treeNodes) children.set(node.id, []);
  for (const { parentId, childId } of treeEdges) children.get(parentId)?.push(childId);
  const maxTreeDepth = Math.max(...depthById.values());
  const columnGap = maxTreeDepth > 0 ? (width - GRAPH_PADDING_X * 2) / maxTreeDepth : 0;
  const points = /* @__PURE__ */ new Map();
  let leafIndex = 0;
  const assignVerticalPositions = (id) => {
    const childIds = children.get(id) ?? [];
    if (childIds.length === 0) {
      const y2 = GRAPH_PADDING_Y + leafIndex * TREE_ROW_GAP;
      leafIndex += 1;
      const depth2 = depthById.get(id) ?? 0;
      points.set(id, {
        x: maxTreeDepth > 0 ? GRAPH_PADDING_X + depth2 * columnGap : width / 2,
        y: y2
      });
      return y2;
    }
    const childY = childIds.map(assignVerticalPositions);
    const y = (childY[0] + childY[childY.length - 1]) / 2;
    const depth = depthById.get(id) ?? 0;
    points.set(id, {
      x: maxTreeDepth > 0 ? GRAPH_PADDING_X + depth * columnGap : width / 2,
      y
    });
    return y;
  };
  assignVerticalPositions(root.id);
  const height = Math.max(
    MIN_TREE_HEIGHT,
    GRAPH_PADDING_Y * 2 + Math.max(1, leafIndex - 1) * TREE_ROW_GAP
  );
  return {
    rootId: root.id,
    nodes: treeNodes,
    edges: treeEdges,
    depthById,
    points,
    width,
    height,
    hiddenEdgeCount
  };
}

// dashboard/ui/app.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var GRAPH_NODE_LIMIT = 72;
var GRAPH_VIEW_LIMIT = 72;
var GRAPH_WIDTH = 960;
var GRAPH_DEFAULT_ZOOM = 0.72;
var GRAPH_MIN_ZOOM = 0.55;
var GRAPH_MAX_ZOOM = 1.25;
var NODE_LABELS = {
  ALL: "\u5168\u90E8\u7C7B\u578B",
  TASK: "\u4EFB\u52A1",
  SKILL: "\u6280\u80FD",
  EVENT: "\u4E8B\u4EF6"
};
var EDGE_LABELS = {
  USED_SKILL: "\u4F7F\u7528\u6280\u80FD",
  SOLVED_BY: "\u7531\u4E8B\u4EF6\u89E3\u51B3",
  REQUIRES: "\u4F9D\u8D56",
  PATCHES: "\u4FEE\u590D",
  CONFLICTS_WITH: "\u51B2\u7A81"
};
function shortName(value, max = 22) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}\u2026`;
}
function formatTime(value) {
  if (!Number.isFinite(value) || value <= 0) return "\u672A\u77E5\u65F6\u95F4";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "\u672A\u77E5\u65F6\u95F4";
  }
}
function relativeTime(value) {
  if (!value || !Number.isFinite(value) || value <= 0) return "\u4ECE\u672A";
  const delta = Date.now() - value;
  if (delta < 45e3) return "\u521A\u521A";
  if (delta < 36e5) return `${Math.max(1, Math.round(delta / 6e4))} \u5206\u949F\u524D`;
  if (delta < 864e5) return `${Math.round(delta / 36e5)} \u5C0F\u65F6\u524D`;
  return `${Math.round(delta / 864e5)} \u5929\u524D`;
}
function formatBytes(bytes) {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "\u2014";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : "\u2014";
}
var HEALTH_META = {
  draining: { label: "\u62BD\u53D6\u4E2D", tone: "ok" },
  slow: { label: "\u7F13\u6162", tone: "warn" },
  stalled: { label: "\u505C\u6EDE", tone: "bad" },
  idle: { label: "\u7A7A\u95F2", tone: "idle" }
};
var RECALL_LABELS = {
  "vector-ready": "\u5411\u91CF\u53EC\u56DE\u5C31\u7EEA",
  degraded: "\u5411\u91CF\u53EC\u56DE\u964D\u7EA7",
  "fts-only": "\u7EAF\u5168\u6587\u53EC\u56DE",
  initializing: "\u5411\u91CF\u521D\u59CB\u5316\u4E2D"
};
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function nodeColorClass(type) {
  return `gm-node-${type.toLowerCase()}`;
}
function StatCard(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `gm-stat-card ${props.tone ?? ""}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-stat-label", children: props.label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { className: "gm-stat-value", children: props.value })
  ] });
}
function StatusMetric(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-metric", title: props.title, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-status-metric-label", children: props.label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-status-metric-value", children: props.value })
  ] });
}
function StatusOverview(props) {
  const status = props.status;
  if (!status) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { className: "gm-status", "data-testid": "graph-memory-status", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-status-offline", children: props.error ? `\u8FD0\u884C\u6982\u89C8\u6682\u4E0D\u53EF\u7528\uFF1A${props.error}` : "\u6B63\u5728\u8BFB\u53D6\u8FD0\u884C\u6982\u89C8\u2026" }) });
  }
  const health = HEALTH_META[status.extraction.health];
  const queueTotal = status.extraction.pending + status.extraction.succeeded + status.extraction.quarantined;
  const donePct = queueTotal > 0 ? Math.round(status.extraction.succeeded / queueTotal * 100) : 100;
  const recallCoverage = status.recall.coverage === null ? "\u2014" : `${Math.round(status.recall.coverage * 100)}%`;
  const updated = relativeTime(status.generatedAt);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "gm-status", "data-testid": "graph-memory-status", "aria-label": "\u8BB0\u5FC6\u56FE\u8C31\u8FD0\u884C\u6982\u89C8", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "\u8FD0\u884C\u6982\u89C8" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u62BD\u53D6\u8DEF\u7531 ",
          status.routes.length > 0 ? status.routes.join(" \u2192 ") : "\u672A\u914D\u7F6E"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-chips", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `gm-health-chip is-${health.tone}`, title: `\u7BA1\u7EBF\u5065\u5EB7\u5EA6\uFF1A${health.label}`, children: health.label }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-status-updated", title: formatTime(status.generatedAt), children: [
          updated,
          "\u66F4\u65B0"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-card", title: `\u6570\u636E\u5E93\uFF1A${status.dbPath}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-status-card-title", children: "\u8FD0\u884C\u72B6\u6001" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusMetric, { label: "\u5411\u91CF\u53EC\u56DE", value: RECALL_LABELS[status.recall.state] ?? status.recall.state }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          StatusMetric,
          {
            label: "\u5411\u91CF\u8986\u76D6",
            value: `${recallCoverage} \xB7 ${formatNumber(status.recall.vectors)} \u5411\u91CF${status.recall.dimensions ? ` \xB7 ${status.recall.dimensions} \u7EF4` : ""}`,
            title: status.recall.model ? `\u5D4C\u5165\u6A21\u578B\uFF1A${status.recall.model}` : void 0
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusMetric, { label: "\u6570\u636E\u5E93", value: formatBytes(status.dbSizeBytes) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          StatusMetric,
          {
            label: "\u6EDA\u52A8\u538B\u7F29",
            value: status.compaction.enabled ? `\u5F00\u542F \xB7 \u6210\u529F ${formatNumber(status.compaction.succeeded)}` : "\u5173\u95ED\uFF08DSH \u539F\u751F\u515C\u5E95\uFF09"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-status-card-title", children: "\u62BD\u53D6\u8FDB\u5C55" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-queue", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-queue-pill is-pending", children: [
            "\u5F85\u62BD\u53D6 ",
            formatNumber(status.extraction.pending)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-queue-pill is-done", children: [
            "\u5DF2\u62BD\u53D6 ",
            formatNumber(status.extraction.succeeded)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-queue-pill is-quarantine", children: [
            "\u9694\u79BB ",
            formatNumber(status.extraction.quarantined)
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-progress", role: "progressbar", "aria-valuenow": donePct, "aria-valuemin": 0, "aria-valuemax": 100, title: `\u5DF2\u62BD\u53D6\u5360\u6BD4 ${donePct}%`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${donePct}%` } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-progress-caption", children: [
          "\u77E5\u8BC6\u8986\u76D6\u7387 ",
          donePct,
          "% \xB7 \u6D88\u606F ",
          formatNumber(status.graph.messages),
          " \u6761"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-status-card-title", children: "\u5B9E\u65F6\u60C5\u51B5" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusMetric, { label: "\u8FD1 5 \u5206\u949F", value: `${formatNumber(status.extraction.recent5m)} \u6761` }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusMetric, { label: "\u8FD1 1 \u5C0F\u65F6", value: `${formatNumber(status.extraction.recent1h)} \u6761` }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusMetric, { label: "\u6700\u540E\u6210\u529F", value: relativeTime(status.extraction.lastSucceededAt) }),
        status.recentErrors.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-status-errors", children: status.recentErrors.slice(0, 2).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-status-error", title: `${item.kind} \xB7 \u6700\u8FD1 ${relativeTime(item.lastSeenAt)}`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-status-error-kind", children: item.kind }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-status-error-count", children: [
            "\xD7",
            formatNumber(item.count)
          ] })
        ] }, item.kind)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-progress-caption", children: "\u8FD1\u671F\u65E0\u62BD\u53D6\u9519\u8BEF" })
      ] })
    ] })
  ] });
}
function NodeBadge({ type }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `gm-node-badge ${nodeColorClass(type)}`, children: NODE_LABELS[type] });
}
function clampZoom(value) {
  return Math.min(GRAPH_MAX_ZOOM, Math.max(GRAPH_MIN_ZOOM, value));
}
function GraphCanvas(props) {
  const nodes = (0, import_react.useMemo)(() => props.nodes.slice(0, GRAPH_VIEW_LIMIT), [props.nodes]);
  const rootId = (0, import_react.useMemo)(
    () => props.selectedId && nodes.some((node) => node.id === props.selectedId) ? props.selectedId : nodes[0]?.id ?? "",
    [nodes, props.selectedId]
  );
  const rootNode = nodes.find((node) => node.id === rootId);
  const [depthTarget, setDepthTarget] = (0, import_react.useState)(3);
  const [visibleDepth, setVisibleDepth] = (0, import_react.useState)(3);
  const [zoom, setZoom] = (0, import_react.useState)(GRAPH_DEFAULT_ZOOM);
  const [panning, setPanning] = (0, import_react.useState)(false);
  const viewportRef = (0, import_react.useRef)(null);
  const panRef = (0, import_react.useRef)(null);
  const tree = (0, import_react.useMemo)(
    () => layoutLayeredTree(nodes, props.edges, rootId, visibleDepth, GRAPH_WIDTH),
    [nodes, props.edges, rootId, visibleDepth]
  );
  (0, import_react.useEffect)(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
    panRef.current = null;
    setPanning(false);
  }, [tree]);
  (0, import_react.useEffect)(() => {
    if (rootId) setVisibleDepth(3);
  }, [rootId]);
  const onViewportPointerDown = (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".gm-svg-node")) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {
    }
    panRef.current = {
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originScrollLeft: viewport.scrollLeft,
      originScrollTop: viewport.scrollTop
    };
    setPanning(true);
  };
  const onViewportPointerMove = (event) => {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !viewport) return;
    event.preventDefault();
    viewport.scrollLeft = pan.originScrollLeft - (event.clientX - pan.originClientX);
    viewport.scrollTop = pan.originScrollTop - (event.clientY - pan.originClientY);
  };
  const finishPan = (event) => {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    try {
      viewport?.releasePointerCapture(event.pointerId);
    } catch {
    }
    panRef.current = null;
    setPanning(false);
  };
  const selectDepthTarget = (target) => {
    setDepthTarget(target);
    setVisibleDepth((current) => Math.min(current, target));
  };
  const resetView = () => {
    setZoom(GRAPH_DEFAULT_ZOOM);
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  };
  if (nodes.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-graph-empty", children: "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u5173\u7CFB\u6570\u636E" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-graph-wrap", "data-testid": "graph-memory-graph", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-graph-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-graph-help", title: `\u6839\u8282\u70B9\uFF1A${rootNode?.name ?? "\u5F53\u524D\u8282\u70B9"}`, children: [
        "\u6839\uFF1A",
        shortName(rootNode?.name ?? "\u5F53\u524D\u8282\u70B9", 18),
        " \xB7 ",
        visibleDepth,
        "/",
        depthTarget,
        " \u5C42"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-graph-controls", "aria-label": "\u5173\u7CFB\u56FE\u63A7\u5236", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-depth-controls", "aria-label": "\u5173\u8054\u5C42\u7EA7", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-control-caption", children: "\u5C42\u7EA7" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `gm-depth-button ${depthTarget === 3 ? "is-active" : ""}`, onClick: () => selectDepthTarget(3), children: "3" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `gm-depth-button ${depthTarget === 5 ? "is-active" : ""}`, onClick: () => selectDepthTarget(5), children: "5" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-graph-reset", disabled: visibleDepth <= 1, onClick: () => setVisibleDepth((current) => Math.max(1, current - 1)), "aria-label": "\u6536\u8D77\u4E00\u5C42", children: "\u2212\u5C42" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-graph-reset", disabled: visibleDepth >= depthTarget, onClick: () => setVisibleDepth((current) => Math.min(depthTarget, current + 1)), "aria-label": "\u5C55\u5F00\u4E00\u5C42", children: "\uFF0B\u5C42" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-graph-control", onClick: () => setZoom((value) => clampZoom(value - 0.1)), "aria-label": "\u7F29\u5C0F\u5173\u7CFB\u56FE", children: "\u2212" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-zoom-label", children: [
          Math.round(zoom * 100),
          "%"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-graph-control", onClick: () => setZoom((value) => clampZoom(value + 0.1)), "aria-label": "\u653E\u5927\u5173\u7CFB\u56FE", children: "+" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-graph-reset", onClick: resetView, "aria-label": "\u590D\u4F4D\u89C6\u56FE", title: "\u590D\u4F4D\u89C6\u56FE", children: "\u21BA" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        ref: viewportRef,
        className: `gm-graph-viewport ${panning ? "is-panning" : ""}`,
        onPointerDown: onViewportPointerDown,
        onPointerMove: onViewportPointerMove,
        onPointerUp: finishPan,
        onPointerCancel: finishPan,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "svg",
          {
            className: "gm-graph",
            width: tree.width * zoom,
            height: tree.height * zoom,
            viewBox: `0 0 ${tree.width} ${tree.height}`,
            role: "img",
            "aria-label": "\u6309\u5C42\u7EA7\u5C55\u793A\u4E14\u53EF\u62D6\u52A8\u753B\u5E03\u7684\u77E5\u8BC6\u56FE\u8C31\u5173\u7CFB\u56FE",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("marker", { id: "gm-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "5", markerHeight: "5", orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M 0 0 L 10 5 L 0 10 z", className: "gm-edge-arrow" }) }) }),
              tree.edges.map(({ edge, parentId, childId }) => {
                const from = tree.points.get(parentId);
                const to = tree.points.get(childId);
                if (!from || !to) return null;
                const bendX = (from.x + to.x) / 2;
                return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "path",
                  {
                    d: `M ${from.x} ${from.y} H ${bendX} V ${to.y} H ${to.x}`,
                    className: `gm-edge-line gm-edge-${edge.type.toLowerCase()}`,
                    markerEnd: "url(#gm-arrow)",
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: EDGE_LABELS[edge.type] ?? edge.type })
                  },
                  edge.id
                );
              }),
              tree.nodes.map((node) => {
                const point = tree.points.get(node.id);
                if (!point) return null;
                const box = nodeBox(node);
                const selected = node.id === props.selectedId;
                const depth = tree.depthById.get(node.id) ?? 0;
                return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "g",
                  {
                    className: `gm-svg-node ${nodeColorClass(node.type)} ${selected ? "is-selected" : ""}`,
                    transform: `translate(${point.x} ${point.y})`,
                    tabIndex: 0,
                    role: "button",
                    "aria-label": `\u67E5\u770B${NODE_LABELS[node.type]} ${node.name}`,
                    onClick: () => props.onSelect(node.id),
                    onKeyDown: (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        props.onSelect(node.id);
                      }
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "rect",
                        {
                          className: "gm-node-label-bg",
                          x: -box.width / 2,
                          y: -box.height / 2,
                          width: box.width,
                          height: box.height,
                          rx: 8
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cy: -8, r: selected ? 13 : 10 }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { y: 18, textAnchor: "middle", children: shortName(node.name, 16) }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("title", { children: [
                        node.name,
                        " \xB7 \u7B2C ",
                        depth,
                        " \u5C42"
                      ] })
                    ]
                  },
                  node.id
                );
              })
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-graph-legend", "aria-label": "\u8282\u70B9\u7C7B\u578B\u56FE\u4F8B", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "gm-legend-dot gm-node-task" }),
        "\u4EFB\u52A1"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "gm-legend-dot gm-node-skill" }),
        "\u6280\u80FD"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "gm-legend-dot gm-node-event" }),
        "\u4E8B\u4EF6"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "gm-hint", children: [
      "\u7A7A\u767D\u5904\u62D6\u52A8\u753B\u5E03\uFF1B\u70B9\u51FB\u8282\u70B9\u67E5\u770B\u8BE6\u60C5\u3002\u5F53\u524D\u663E\u793A ",
      tree.nodes.length,
      " \u4E2A\u8282\u70B9\u3001",
      tree.edges.length,
      " \u6761\u6811\u5F62\u5173\u7CFB\u3002",
      tree.hiddenEdgeCount > 0 ? `\u5DF2\u9690\u85CF ${tree.hiddenEdgeCount} \u6761\u56DE\u8FB9/\u91CD\u590D\u5173\u7CFB\u4EE5\u907F\u514D\u8FDE\u7EBF\u4EA4\u53C9\uFF1B` : "",
      "\u9009\u62E9 5 \u5C42\u540E\u53EF\u7EE7\u7EED\u70B9\u51FB\u201C\uFF0B\u5C42\u201D\u67E5\u770B\u66F4\u6DF1\u5173\u8054\uFF0C\u5217\u8868\u4ECD\u4FDD\u7559\u5B8C\u6574\u5FEB\u7167\u3002"
    ] })
  ] });
}
function NodeList(props) {
  if (props.loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-list-placeholder", children: "\u6B63\u5728\u8BFB\u53D6\u8BB0\u5FC6\u8282\u70B9\u2026" });
  if (props.nodes.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-list-placeholder", children: "\u6CA1\u6709\u627E\u5230\u5339\u914D\u8282\u70B9" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-node-list", "data-testid": "graph-memory-node-list", children: props.nodes.map((node) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      className: `gm-node-row ${node.id === props.selectedId ? "is-selected" : ""}`,
      onClick: () => props.onSelect(node.id),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-node-row-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-node-row-title", children: node.name }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NodeBadge, { type: node.type })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-node-row-description", children: node.description || "\u6682\u65E0\u6458\u8981" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gm-node-row-meta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            "\u9A8C\u8BC1 ",
            node.validatedCount
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            "\u6765\u6E90 ",
            node.sourceSessionCount,
            " \u4E2A\u4F1A\u8BDD"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            "Rank ",
            node.pagerank.toFixed(3)
          ] })
        ] })
      ]
    },
    node.id
  )) });
}
function NodeDetail(props) {
  if (props.loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-detail-placeholder", children: "\u6B63\u5728\u8BFB\u53D6\u8282\u70B9\u8BE6\u60C5\u2026" });
  if (!props.detail) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-detail-placeholder", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-detail-placeholder-icon", children: "\u2301" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u9009\u62E9\u4E00\u4E2A\u8282\u70B9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u67E5\u770B\u5B8C\u6574\u5185\u5BB9\u3001\u9A8C\u8BC1\u6B21\u6570\u4E0E\u66F4\u65B0\u65F6\u95F4" })
    ] });
  }
  const detail = props.detail;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "gm-detail-card", "data-testid": "graph-memory-node-detail", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-detail-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NodeBadge, { type: detail.type }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: detail.name })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-quiet-button", onClick: props.onCopy, title: "\u590D\u5236\u8282\u70B9\u5185\u5BB9", children: "\u590D\u5236" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gm-detail-description", children: detail.description || "\u6682\u65E0\u6458\u8981" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-detail-facts", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u9A8C\u8BC1 ",
        detail.validatedCount,
        " \u6B21"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u6765\u6E90 ",
        detail.sourceSessionCount,
        " \u4E2A\u4F1A\u8BDD"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u793E\u533A ",
        detail.communityId ?? "\u672A\u5206\u7EC4"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u66F4\u65B0\u4E8E ",
        formatTime(detail.updatedAt)
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "gm-detail-content", children: detail.content || "\u6682\u65E0\u6B63\u6587" }),
    detail.contentTruncated && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gm-hint", children: "\u6B63\u6587\u5DF2\u6309 Host \u5B89\u5168\u4E0A\u9650\u622A\u65AD\u3002" })
  ] });
}
function GraphMemoryApp(props) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [stats, setStats] = (0, import_react.useState)(null);
  const [detail, setDetail] = (0, import_react.useState)(null);
  const [selectedId, setSelectedId] = (0, import_react.useState)(null);
  const [detailLoading, setDetailLoading] = (0, import_react.useState)(false);
  const [graphLoading, setGraphLoading] = (0, import_react.useState)(false);
  const [summaryLoading, setSummaryLoading] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [query, setQuery] = (0, import_react.useState)("");
  const [activeQuery, setActiveQuery] = (0, import_react.useState)("");
  const [nodeFilter, setNodeFilter] = (0, import_react.useState)("ALL");
  const [reloadKey, setReloadKey] = (0, import_react.useState)(0);
  const [status, setStatus] = (0, import_react.useState)(null);
  const [statusError, setStatusError] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    if (!props.visible) return void 0;
    let cancelled = false;
    const load = (signal) => {
      fetchStatus(signal).then((value) => {
        if (cancelled) return;
        setStatus(value);
        setStatusError(null);
      }).catch((reason) => {
        if (!cancelled && !signal.aborted) setStatusError(errorText(reason));
      });
    };
    const controller = new AbortController();
    load(controller.signal);
    const timer = setInterval(() => load(controller.signal), 5e3);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [props.visible, reloadKey]);
  (0, import_react.useEffect)(() => {
    if (!props.visible) return void 0;
    const controller = new AbortController();
    setSummaryLoading(true);
    fetchStats(controller.signal).then((value) => {
      setStats(value);
      setError(null);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(errorText(reason));
    }).finally(() => {
      if (!controller.signal.aborted) setSummaryLoading(false);
    });
    return () => controller.abort();
  }, [props.visible, reloadKey]);
  (0, import_react.useEffect)(() => {
    if (!props.visible) return void 0;
    const controller = new AbortController();
    setGraphLoading(true);
    const request = {
      query: activeQuery || void 0,
      nodeTypes: nodeFilter === "ALL" ? void 0 : [nodeFilter],
      maxNodes: GRAPH_NODE_LIMIT
    };
    fetchSnapshot(request, controller.signal).then((value) => {
      setSnapshot(value);
      setSelectedId(null);
      setDetail(null);
      setError(null);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(errorText(reason));
    }).finally(() => {
      if (!controller.signal.aborted) setGraphLoading(false);
    });
    return () => controller.abort();
  }, [props.visible, activeQuery, nodeFilter, reloadKey]);
  (0, import_react.useEffect)(() => {
    if (!props.visible || !selectedId) {
      setDetail(null);
      setDetailLoading(false);
      return void 0;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    fetchNodeDetail(selectedId, controller.signal).then((value) => {
      setDetail(value);
      if (!value) setError("\u8BE5\u8282\u70B9\u5DF2\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5F52\u6863");
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(errorText(reason));
    }).finally(() => {
      if (!controller.signal.aborted) setDetailLoading(false);
    });
    return () => controller.abort();
  }, [props.visible, selectedId]);
  const onSearch = (event) => {
    event.preventDefault();
    setActiveQuery(query.trim());
  };
  const onSelect = (id) => setSelectedId(id);
  const onCopy = () => {
    if (!detail?.content) return;
    const copy = navigator.clipboard?.writeText(detail.content);
    if (copy) void copy.catch((reason) => setError(errorText(reason)));
  };
  const onExport = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), stats, snapshot }, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `graph-memory-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };
  const visibleNodeCount = snapshot?.nodes.length ?? 0;
  const statsPrefix = stats?.approximate ? "\u2265" : "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { className: "gm-shell", "data-testid": "graph-memory-dashboard", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "gm-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gm-eyebrow", children: "GRAPH MEMORY" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u8BB0\u5FC6\u56FE\u8C31" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gm-subtitle", children: "\u8DE8\u4F1A\u8BDD\u77E5\u8BC6\u3001\u6280\u80FD\u4E0E\u4E8B\u4EF6\u7684\u53EF\u8FFD\u6EAF\u89C6\u56FE" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-header-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-icon-button", onClick: () => setReloadKey((value) => value + 1), title: "\u5237\u65B0", "aria-label": "\u5237\u65B0", children: "\u21BB" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-icon-button", onClick: onExport, disabled: !snapshot, title: "\u5BFC\u51FA\u5F53\u524D\u5FEB\u7167", "aria-label": "\u5BFC\u51FA\u5F53\u524D\u5FEB\u7167", children: "\u21E9" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusOverview, { status, error: statusError }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "gm-stats", "aria-label": "\u8BB0\u5FC6\u7EDF\u8BA1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, { label: "\u77E5\u8BC6\u8282\u70B9", value: summaryLoading && !stats ? "\u2026" : `${statsPrefix}${stats?.nodes ?? "\u2014"}`, tone: "blue" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, { label: "\u5173\u7CFB\u8FB9", value: summaryLoading && !stats ? "\u2026" : `${statsPrefix}${stats?.edges ?? "\u2014"}`, tone: "purple" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, { label: "\u793E\u533A", value: summaryLoading && !stats ? "\u2026" : `${statsPrefix}${stats?.communities ?? "\u2014"}`, tone: "gold" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, { label: "\u5F53\u524D\u7ED3\u679C", value: `${visibleNodeCount}`, tone: "green" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "gm-type-summary", "aria-label": "\u8282\u70B9\u7C7B\u578B\u7EDF\u8BA1", children: [
      ["TASK", "SKILL", "EVENT"].map((type) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: `gm-legend-dot ${nodeColorClass(type)}` }),
        NODE_LABELS[type],
        " ",
        stats?.byType[type] ?? "\u2014"
      ] }, type)),
      stats?.approximate && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-hint", children: "\u7EDF\u8BA1\u4E3A\u5FEB\u7167\u4E0B\u754C" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "gm-search", onSubmit: onSearch, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-search-box", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\u2315" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            value: query,
            onChange: (event) => setQuery(event.target.value),
            placeholder: "\u641C\u7D22\u540D\u79F0\u3001\u6458\u8981\u6216\u6B63\u6587\u2026",
            "aria-label": "\u641C\u7D22\u8BB0\u5FC6"
          }
        ),
        query && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "gm-clear-button", onClick: () => {
          setQuery("");
          setActiveQuery("");
        }, "aria-label": "\u6E05\u9664\u641C\u7D22", children: "\xD7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: nodeFilter, onChange: (event) => setNodeFilter(event.target.value), "aria-label": "\u8282\u70B9\u7C7B\u578B", children: Object.keys(NODE_LABELS).map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value, children: NODE_LABELS[value] }, value)) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", className: "gm-primary-button", children: "\u641C\u7D22" })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-error", role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u8BFB\u53D6 Graph Memory \u5931\u8D25\uFF1A",
        error
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => setError(null), "aria-label": "\u5173\u95ED\u9519\u8BEF", children: "\xD7" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "gm-section gm-graph-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-section-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "\u5173\u7CFB\u89C6\u56FE" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            snapshot?.edges.length ?? 0,
            " \u6761\u5173\u7CFB"
          ] })
        ] }),
        snapshot?.truncated.nodes && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-warning-chip", children: "\u7ED3\u679C\u5DF2\u9650\u5236" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        GraphCanvas,
        {
          nodes: snapshot?.nodes ?? [],
          edges: snapshot?.edges ?? [],
          selectedId,
          onSelect
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "gm-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gm-section-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "\u77E5\u8BC6\u8282\u70B9" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            visibleNodeCount,
            " \u4E2A\u7ED3\u679C"
          ] })
        ] }),
        graphLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gm-loading-dot", children: "\u8BFB\u53D6\u4E2D" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NodeList, { nodes: snapshot?.nodes ?? [], selectedId, onSelect, loading: graphLoading && !snapshot })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "gm-section gm-detail-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gm-section-heading", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "\u8282\u70B9\u8BE6\u60C5" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u53EA\u8BFB\u5B89\u5168\u89C6\u56FE" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NodeDetail, { detail, loading: detailLoading, onCopy })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "gm-footer", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u6570\u636E\u7531 Graph Memory Pro Lite \u63D0\u4F9B" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5199\u5165\u4ECD\u7531 Graph Memory \u81EA\u52A8\u62BD\u53D6\u6216 gm_record \u7BA1\u7406" })
    ] })
  ] });
}

// dashboard/ui/styles.ts
var STYLE_ID = "graph-memory-dashboard-styles";
var CSS = `
.gm-shell {
  --gm-bg: var(--dsw-alias-bg-layer-1, #ffffff);
  --gm-surface: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  --gm-surface-strong: var(--dsw-alias-bg-layer-3, rgba(127, 127, 127, 0.14));
  --gm-text: var(--dsw-alias-label-primary, #1f2937);
  --gm-muted: var(--dsw-alias-label-secondary, #6b7280);
  --gm-border: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.18));
  --gm-accent: #4d6bfe;
  --gm-purple: #866bd8;
  --gm-task: #527fe8;
  --gm-skill: #1ca78c;
  --gm-event: #d89839;
  --gm-error: #b33b3b;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  padding: 16px;
  background: var(--gm-bg);
  color: var(--gm-text);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 12px;
}
body[data-ds-dark-theme] .gm-shell {
  --gm-bg: #232324;
  --gm-surface: #2c2c2e;
  --gm-surface-strong: #353638;
  --gm-text: #f9fafb;
  --gm-muted: #cfd3d6;
  --gm-border: #ffffff1f;
  --gm-accent: #8fb0ff;
  --gm-purple: #b9a4ff;
  --gm-task: #8fb0ff;
  --gm-skill: #55d7bb;
  --gm-event: #f2bd65;
  --gm-error: #f25a5a;
}
.gm-shell *, .gm-shell *::before, .gm-shell *::after { box-sizing: border-box; }
.gm-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.gm-header h2 { margin: 2px 0 4px; font-size: 19px; line-height: 1.2; letter-spacing: -0.02em; }
.gm-eyebrow { margin: 0; color: var(--gm-accent); font-size: 9px; font-weight: 800; letter-spacing: 0.14em; }
.gm-subtitle { margin: 0; color: var(--gm-muted); font-size: 11px; line-height: 1.45; }
.gm-header-actions { display: flex; gap: 6px; }
.gm-icon-button, .gm-quiet-button, .gm-clear-button, .gm-search select, .gm-primary-button {
  border: 1px solid var(--gm-border);
  border-radius: 7px;
  background: var(--gm-surface);
  color: var(--gm-text);
  cursor: pointer;
  font: inherit;
}
.gm-icon-button { width: 30px; height: 30px; padding: 0; font-size: 17px; line-height: 1; }
.gm-icon-button:hover, .gm-quiet-button:hover { background: var(--gm-surface-strong); }
.gm-icon-button:disabled { cursor: not-allowed; opacity: .42; }
.gm-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-bottom: 7px; }
.gm-stat-card { min-width: 0; padding: 10px 9px; border: 1px solid var(--gm-border); border-radius: 9px; background: var(--gm-surface); }
.gm-stat-label { display: block; overflow: hidden; color: var(--gm-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.gm-stat-value { display: block; margin-top: 3px; font-size: 17px; line-height: 1.05; }
.gm-stat-card.blue .gm-stat-value { color: var(--gm-task); }
.gm-stat-card.purple .gm-stat-value { color: var(--gm-purple); }
.gm-stat-card.gold .gm-stat-value { color: var(--gm-event); }
.gm-stat-card.green .gm-stat-value { color: var(--gm-skill); }
.gm-type-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 2px 13px; color: var(--gm-muted); font-size: 10px; }
.gm-type-summary > span { display: inline-flex; align-items: center; gap: 4px; }
.gm-legend-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--gm-muted); }
.gm-legend-dot.gm-node-task { background: var(--gm-task); }
.gm-legend-dot.gm-node-skill { background: var(--gm-skill); }
.gm-legend-dot.gm-node-event { background: var(--gm-event); }
.gm-search { display: flex; align-items: center; gap: 6px; margin-bottom: 13px; }
.gm-search-box { display: flex; align-items: center; flex: 1; min-width: 0; height: 32px; padding: 0 8px; border: 1px solid var(--gm-border); border-radius: 8px; background: var(--gm-surface); color: var(--gm-muted); }
.gm-search-box > span { margin-right: 6px; font-size: 16px; line-height: 1; }
.gm-search-box input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--gm-text); font: inherit; }
.gm-search-box input::placeholder { color: var(--gm-muted); opacity: .8; }
.gm-clear-button { flex: 0 0 auto; width: 20px; height: 20px; padding: 0; border: 0; background: transparent; color: var(--gm-muted); font-size: 16px; line-height: 16px; }
.gm-search select { height: 32px; max-width: 86px; padding: 0 5px; outline: 0; }
.gm-primary-button { height: 32px; padding: 0 10px; border-color: transparent; background: var(--gm-accent); color: #fff; font-weight: 700; }
.gm-primary-button:hover { filter: brightness(.94); }
.gm-error { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin: -3px 0 12px; padding: 9px 10px; border: 1px solid color-mix(in srgb, var(--gm-error) 34%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--gm-error) 9%, transparent); color: var(--gm-error); line-height: 1.4; }
.gm-error button { flex: 0 0 auto; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 16px; line-height: 1; }
.gm-section { margin-bottom: 13px; padding: 11px; border: 1px solid var(--gm-border); border-radius: 10px; background: color-mix(in srgb, var(--gm-bg) 88%, var(--gm-surface)); }
.gm-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
.gm-section-heading > div { display: flex; align-items: baseline; gap: 7px; min-width: 0; }
.gm-section-heading h3 { margin: 0; font-size: 13px; }
.gm-section-heading span { color: var(--gm-muted); font-size: 10px; }
.gm-warning-chip { padding: 3px 6px; border-radius: 99px; background: rgba(216, 152, 57, .13); color: var(--gm-event) !important; }
.gm-loading-dot { color: var(--gm-accent) !important; }
.gm-graph-wrap { position: relative; border-radius: 8px; background: var(--gm-surface); }
.gm-graph-toolbar { display: flex; align-items: center; gap: 6px; min-height: 32px; overflow: hidden; padding: 5px 7px; border-bottom: 1px solid var(--gm-border); }
.gm-graph-help { min-width: 0; overflow: hidden; color: var(--gm-muted); font-size: 9px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.gm-graph-controls { display: flex; flex: 0 0 auto; align-items: center; justify-content: flex-end; flex-wrap: nowrap; gap: 2px; white-space: nowrap; }
.gm-depth-controls { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; margin-right: 2px; }
.gm-control-caption { color: var(--gm-muted); font-size: 8px; }
.gm-graph-control, .gm-graph-reset, .gm-depth-button { flex: 0 0 auto; height: 22px; padding: 0 4px; border: 1px solid var(--gm-border); border-radius: 5px; background: var(--gm-bg); color: var(--gm-text); cursor: pointer; font: inherit; white-space: nowrap; }
.gm-graph-control { width: 22px; padding: 0; font-size: 14px; line-height: 1; }
.gm-depth-button { min-width: 22px; padding: 0 4px; color: var(--gm-muted); font-size: 9px; }
.gm-depth-button.is-active { border-color: var(--gm-accent); background: color-mix(in srgb, var(--gm-accent) 14%, var(--gm-bg)); color: var(--gm-accent); font-weight: 700; }
.gm-graph-control:hover, .gm-graph-reset:hover, .gm-depth-button:hover { background: var(--gm-surface-strong); }
.gm-graph-control:disabled, .gm-graph-reset:disabled { cursor: not-allowed; opacity: .45; }
.gm-zoom-label { min-width: 32px; color: var(--gm-muted); font-size: 8px; text-align: center; }
.gm-graph-reset { min-width: 22px; color: var(--gm-accent); font-size: 9px; }
.gm-graph-viewport { height: 330px; overflow: auto; overscroll-behavior: contain; border-bottom: 1px solid var(--gm-border); cursor: grab; touch-action: none; user-select: none; }
.gm-graph-viewport.is-panning { cursor: grabbing; }
.gm-graph { display: block; max-width: none; height: auto; }
.gm-edge-line { fill: none; stroke: var(--gm-border); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
.gm-edge-arrow { fill: var(--gm-muted); }
.gm-svg-node { cursor: pointer; outline: none; }
.gm-node-label-bg { fill: var(--gm-bg); stroke: var(--gm-border); stroke-width: 1; vector-effect: non-scaling-stroke; }
.gm-svg-node:hover .gm-node-label-bg, .gm-svg-node:focus .gm-node-label-bg, .gm-svg-node.is-selected .gm-node-label-bg { stroke: color-mix(in srgb, var(--gm-accent) 72%, var(--gm-border)); }
.gm-svg-node circle { stroke: var(--gm-bg); stroke-width: 2; vector-effect: non-scaling-stroke; }
.gm-svg-node text { fill: var(--gm-text); font-size: 12px; font-weight: 600; pointer-events: none; }
.gm-svg-node.gm-node-task circle { fill: var(--gm-task); }
.gm-svg-node.gm-node-skill circle { fill: var(--gm-skill); }
.gm-svg-node.gm-node-event circle { fill: var(--gm-event); }
.gm-svg-node:hover circle, .gm-svg-node:focus circle, .gm-svg-node.is-selected circle { stroke: var(--gm-text); stroke-width: 2.5; }
.gm-svg-node.is-selected text { fill: var(--gm-text); font-weight: 700; }
.gm-graph-legend { display: flex; gap: 9px; padding: 4px 8px 7px; color: var(--gm-muted); font-size: 10px; }
.gm-graph-legend span { display: inline-flex; align-items: center; gap: 4px; }
.gm-graph-empty, .gm-list-placeholder, .gm-detail-placeholder { display: flex; min-height: 150px; align-items: center; justify-content: center; color: var(--gm-muted); }
.gm-graph-empty { min-height: 190px; }
.gm-hint { margin: 5px 0 0; color: var(--gm-muted); font-size: 10px; line-height: 1.4; }
.gm-node-list { display: grid; gap: 6px; max-height: 365px; overflow: auto; }
.gm-node-row { width: 100%; padding: 9px; border: 1px solid transparent; border-radius: 8px; background: var(--gm-surface); color: var(--gm-text); cursor: pointer; text-align: left; font: inherit; }
.gm-node-row:hover, .gm-node-row.is-selected { border-color: color-mix(in srgb, var(--gm-accent) 50%, transparent); background: var(--gm-surface-strong); }
.gm-node-row-main { display: flex; align-items: center; justify-content: space-between; gap: 7px; }
.gm-node-row-title { min-width: 0; overflow: hidden; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.gm-node-badge { display: inline-block; flex: 0 0 auto; padding: 2px 5px; border-radius: 4px; font-size: 9px; font-weight: 700; line-height: 1.1; }
.gm-node-badge.gm-node-task { background: rgba(82, 127, 232, .13); color: var(--gm-task); }
.gm-node-badge.gm-node-skill { background: rgba(28, 167, 140, .13); color: var(--gm-skill); }
.gm-node-badge.gm-node-event { background: rgba(216, 152, 57, .15); color: var(--gm-event); }
.gm-node-row-description { display: -webkit-box; overflow: hidden; margin-top: 5px; color: var(--gm-muted); font-size: 10px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.gm-node-row-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 7px; color: var(--gm-muted); font-size: 9px; }
.gm-quiet-button { padding: 5px 8px; }
.gm-detail-card { padding: 10px; border-radius: 8px; background: var(--gm-surface); }
.gm-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.gm-detail-header h3 { margin: 5px 0 0; font-size: 14px; line-height: 1.3; overflow-wrap: anywhere; }
.gm-detail-description { margin: 9px 0; color: var(--gm-muted); line-height: 1.45; }
.gm-detail-facts { display: flex; flex-wrap: wrap; gap: 5px 9px; margin-bottom: 9px; color: var(--gm-muted); font-size: 10px; }
.gm-detail-content { max-height: 260px; overflow: auto; margin: 0; padding: 9px; border-radius: 6px; background: rgba(0, 0, 0, .07); color: var(--gm-text); font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.gm-detail-placeholder { flex-direction: column; gap: 6px; min-height: 150px; text-align: center; }
.gm-detail-placeholder-icon { font-size: 26px; opacity: .55; }
.gm-detail-placeholder strong { color: var(--gm-text); }
.gm-footer { display: flex; flex-direction: column; gap: 3px; padding: 1px 2px 8px; color: var(--gm-muted); font-size: 9px; line-height: 1.4; }
.gm-status { margin-bottom: 12px; padding: 10px 11px; border: 1px solid var(--gm-border); border-radius: 10px; background: color-mix(in srgb, var(--gm-bg) 88%, var(--gm-surface)); }
.gm-status-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
.gm-status-heading > div { display: flex; align-items: baseline; gap: 7px; min-width: 0; }
.gm-status-heading h3 { margin: 0; font-size: 13px; }
.gm-status-heading span { min-width: 0; overflow: hidden; color: var(--gm-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.gm-status-chips { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; }
.gm-health-chip { padding: 3px 7px; border-radius: 99px; font-size: 9px; font-weight: 700; }
.gm-health-chip.is-ok { background: rgba(28, 167, 140, .14); color: var(--gm-skill); }
.gm-health-chip.is-warn { background: rgba(216, 152, 57, .15); color: var(--gm-event); }
.gm-health-chip.is-bad { background: rgba(179, 59, 59, .13); color: var(--gm-error); }
.gm-health-chip.is-idle { background: var(--gm-surface-strong); color: var(--gm-muted); }
.gm-status-updated { color: var(--gm-muted) !important; }
.gm-status-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.gm-status-card { min-width: 0; padding: 9px; border: 1px solid var(--gm-border); border-radius: 8px; background: var(--gm-surface); }
.gm-status-card-title { margin-bottom: 7px; color: var(--gm-accent); font-size: 10px; font-weight: 800; }
.gm-status-metric { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; padding: 2px 0; }
.gm-status-metric-label { flex: 0 0 auto; color: var(--gm-muted); font-size: 10px; }
.gm-status-metric-value { min-width: 0; overflow: hidden; color: var(--gm-text); font-size: 10px; font-weight: 600; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.gm-status-queue { display: flex; flex-wrap: wrap; gap: 4px; }
.gm-queue-pill { padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 700; }
.gm-queue-pill.is-pending { background: rgba(82, 127, 232, .13); color: var(--gm-task); }
.gm-queue-pill.is-done { background: rgba(28, 167, 140, .13); color: var(--gm-skill); }
.gm-queue-pill.is-quarantine { background: rgba(216, 152, 57, .15); color: var(--gm-event); }
.gm-progress { height: 6px; margin-top: 8px; overflow: hidden; border-radius: 99px; background: var(--gm-surface-strong); }
.gm-progress > i { display: block; height: 100%; border-radius: 99px; background: var(--gm-skill); transition: width .5s ease; }
.gm-progress-caption { margin-top: 6px; color: var(--gm-muted); font-size: 9px; }
.gm-status-errors { display: grid; gap: 3px; margin-top: 6px; }
.gm-status-error { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
.gm-status-error-kind { min-width: 0; overflow: hidden; color: var(--gm-error); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.gm-status-error-count { flex: 0 0 auto; color: var(--gm-muted); font-size: 9px; }
.gm-status-offline { padding: 9px; border-radius: 8px; background: var(--gm-surface); color: var(--gm-muted); font-size: 10px; }
@media (max-width: 330px) {
  .gm-shell { padding: 11px; }
  .gm-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gm-search { flex-wrap: wrap; }
  .gm-search-box { flex-basis: 100%; }
  .gm-status-grid { grid-template-columns: 1fr; }
}
`;
function installStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.getElementById(STYLE_ID);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.dataset.dshPlugin = "graph-memory-dashboard";
  style.textContent = CSS;
  document.head.appendChild(style);
  return () => style.remove();
}

// dashboard/client.ts
var name = "graph-memory-dashboard";
var inject = ["betterSidebar"];
function apply(ctx) {
  ctx.effect(() => {
    const sidebar = ctx.betterSidebar;
    if (!sidebar) {
      ctx.logger?.warn?.(
        "[graph-memory] better-sidebar \u672A\u5B89\u88C5\uFF0C\u9875\u7B7E\u672A\u6CE8\u518C\uFF1B\u72EC\u7ACB\u770B\u677F\u4ECD\u53EF\u8BBF\u95EE /graph-memory/app"
      );
      return;
    }
    const removeStyles = installStyles();
    const dispose = sidebar.registerTab({
      id: "graph-memory:graph",
      title: () => "\u8BB0\u5FC6\u56FE\u8C31",
      order: 56,
      single: true,
      icon: () => "\u2301",
      component: ({ visible }) => (0, import_react2.createElement)(GraphMemoryApp, { visible })
    });
    return () => {
      dispose();
      removeStyles();
    };
  }, "graph-memory: register dashboard tab");
}

return module.exports;
}});
//# sourceMappingURL=client.js.map
