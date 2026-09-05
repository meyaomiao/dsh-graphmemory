/**
 * Client half: registers the 记忆图谱 tab on better-sidebar.
 *
 * betterSidebar is an OPTIONAL peer (inject-declared; undefined when the
 * platform plugin is absent) — the memory engine must keep working without
 * the UI, so apply() degrades to a no-op instead of failing. Graph data is
 * fetched from this plugin's loopback-only host API (/graph-memory/api);
 * the browser never reads SQLite directly.
 */
import { createElement } from "react";
import type { ClientContext } from "./types.ts";
import { GraphMemoryApp } from "./ui/app.tsx";
import { installStyles } from "./ui/styles.ts";

export const name = "graph-memory-dashboard";

const inject = ["dsh-better-sidebar"];

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const sidebar = ctx.betterSidebar;
    if (!sidebar) {
      ctx.logger?.warn?.("[graph-memory] better-sidebar 未安装，记忆图谱页签未注册");
      return;
    }
    const removeStyles = installStyles();
    const dispose = sidebar.registerTab({
      id: "graph-memory:graph",
      title: () => "记忆图谱",
      order: 56,
      single: true,
      icon: () => "⌁",
      component: ({ visible }) => createElement(GraphMemoryApp, { visible }),
    });
    return () => {
      dispose();
      removeStyles();
    };
  }, "graph-memory: register dashboard tab");
}
