const STYLE_ID = 'graph-memory-dashboard-styles';

const CSS = `
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
  /* 透明根:官方原生面板自带底色(0.1.5 新调色板),侧栏场景不遮住宿主;
     独立页由 .gm-standalone 修饰类保留自有背景(裸页面无宿主令牌)。 */
  background: transparent;
  color: var(--gm-text);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 12px;
}
.gm-standalone .gm-shell {
  background: var(--gm-bg);
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

export function installStyles(): () => void {
  if (typeof document === 'undefined') return () => {};
  const existing = document.getElementById(STYLE_ID);
  if (existing) return () => {};
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.dataset.dshPlugin = 'graph-memory-dashboard';
  style.textContent = CSS;
  document.head.appendChild(style);
  return () => style.remove();
}
