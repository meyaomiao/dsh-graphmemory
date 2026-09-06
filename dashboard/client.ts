/**
 * Client half: registers the 记忆图谱 tab on better-sidebar.
 *
 * Module-level inject MUST be the Cordis *service* name `betterSidebar`
 * (not the package id `dsh-better-sidebar`). Accessing ctx.betterSidebar
 * without that declaration throws `cannot get property "betterSidebar"
 * without inject` and the tab never registers. When the platform plugin
 * is absent the property is undefined and apply() degrades to a no-op;
 * the standalone page at /graph-memory/app still works. Graph data is
 * fetched from this plugin's loopback-only host API (/graph-memory/api);
 * the browser never reads SQLite directly.
 */
import { createElement } from "react";
import type { ClientContext } from "./types.ts";
import { GraphMemoryApp } from "./ui/app.tsx";
import { installStyles } from "./ui/styles.ts";

const name = "graph-memory-dashboard";

const inject = ["betterSidebar"];

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const sidebar = ctx.betterSidebar;
    if (!sidebar) {
      ctx.logger?.warn?.(
        "[graph-memory] better-sidebar 未安装，页签未注册；独立看板仍可访问 /graph-memory/app",
      );
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

export { inject, name };
