/**
 * Standalone entry: mounts the full dashboard when better-sidebar is absent.
 *
 * Served by the host at /graph-memory/app; the bundle at
 * /graph-memory/standalone.js is fully self-contained (react bundled in),
 * so the page works with zero platform plugins beyond this one.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { GraphMemoryApp } from "./ui/app.tsx";
import { installStyles } from "./ui/styles.ts";

const container = document.getElementById("root");
if (container) {
  installStyles();
  // 独立页是裸页面(无宿主设计令牌),保留自有底色;侧栏场景的透明根
  // 由官方原生面板提供背景。见 ui/styles.ts 的 .gm-standalone 规则。
  container.classList.add("gm-standalone");
  createRoot(container).render(createElement(GraphMemoryApp, { visible: true }));
}
