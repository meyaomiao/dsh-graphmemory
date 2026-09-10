/**
 * Client half: registers the 记忆图谱 tab — DSH 0.1.5 native right sidebar
 * first, better-sidebar as the legacy fallback.
 *
 * Module-level inject MUST list Cordis *service* names (`betterSidebar`,
 * `slots`), not the package id `dsh-better-sidebar`. Accessing ctx.betterSidebar
 * without that declaration throws `cannot get property "betterSidebar" without
 * inject` and the tab never registers. When both sidebars are absent apply()
 * degrades to a no-op; the standalone page at /graph-memory/app still works.
 * Graph data is fetched from this plugin's loopback-only host API
 * (/graph-memory/api); the browser never reads SQLite directly.
 *
 * Native form note (pattern follows better-sidebar 0.19 native/index.ts): the
 * seat declares `sidebar.right.pane.tab` BEFORE the host provides
 * `sidebarRightTabs`, so the wait must target the service itself via
 * ctx.inject([...]) — a declaration-triggered registration reads the service
 * as missing and never fires.
 */
import { createElement } from "react";
import type { ClientContext } from "./types.ts";
import { GraphMemoryApp } from "./ui/app.tsx";
import { installStyles } from "./ui/styles.ts";

const name = "graph-memory-dashboard";

const inject = ["betterSidebar", "slots"];

/** 官方原生右侧栏:本插件的实现 id(kind 的 openTab 名)。 */
const NATIVE_ID = "dsh-graphmemory";
const NATIVE_KIND = "graph-memory";

/** 原生座位的内容体:框架注入 sessionId;恒可见(仅活动 pane 渲染)。 */
function NativeBody(): React.ReactNode {
  return createElement(GraphMemoryApp, { visible: true });
}

/** 原生座位的标签标题:静态文案,忽略框架 props。 */
function NativeTitle(): React.ReactNode {
  return "记忆图谱";
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const removeStyles = installStyles();

    /** betterSidebar 页签拆卸句柄(native 迟到时用于收敛,防双入口)。 */
    let tabDispose: (() => void) | null = null;
    /** 官方座位回调成功注册过(服务已就绪时 ctx.inject 同步执行)。 */
    let nativeActive = false;

    // ---------- 形态〇:官方原生右侧栏(DSH 0.1.5+,最高优先) ----------
    let seatDispose: (() => void) | undefined;
    if (typeof ctx.inject === "function") {
      try {
        const seat = ctx.inject(["sidebarRightTabs"], (injected) => {
          const tabs = injected.get("sidebarRightTabs") as
            | {
              register(definition: {
                id: string;
                kind: string;
                priority?: "extension" | "builtin" | "fallback";
                title: (address: string) => string;
                guide?: readonly { order: number; title: () => string }[];
              }): () => void;
            }
            | undefined;
          if (tabs === undefined || typeof tabs.register !== "function") return;

          // 双入口仲裁:betterSidebar 页签已挂 → 收掉,切到原生。
          try { tabDispose?.(); tabDispose = null; } catch { /* 已清理 */ }

          const disposeType = tabs.register({
            id: NATIVE_ID,
            kind: NATIVE_KIND,
            priority: "extension",
            title: () => "记忆图谱",
            guide: [{ order: 56, title: () => "记忆图谱" }],
          });

          const slots = ctx.slots;
          const disposeSlots: (() => void)[] = [];
          if (slots !== undefined) {
            disposeSlots.push(
              slots.inject("sidebar.right.pane.tab", () => slots.register({
                name: "sidebar.right.pane.tab",
                key: NATIVE_ID,
                inject: (sessionId: string) => ({ sessionId }),
              }, NativeBody)),
              slots.inject("sidebar.right.pane.tab.title", () => slots.register({
                name: "sidebar.right.pane.tab.title",
                key: NATIVE_ID,
                inject: () => ({}),
              }, NativeTitle)),
            );
          } else {
            ctx.logger?.warn?.("[graph-memory] ctx.slots 不可用,原生内容体未注册");
          }

          nativeActive = true;
          return () => {
            for (const dispose of disposeSlots.reverse()) dispose();
            disposeType();
            nativeActive = false;
          };
        });
        seatDispose = typeof seat?.dispose === "function" ? () => seat.dispose?.() : undefined;
      } catch (error) {
        ctx.logger?.warn?.("[graph-memory] 原生右侧栏等待启动失败:", error);
      }
    }

    // ---------- 形态一:better-sidebar 页签(旧宿主回退) ----------
    // 官方座位已同步注册 ⇒ 本形态让位(native 迟到时上面的仲裁负责切换)。
    if (!nativeActive) {
      const sidebar = ctx.betterSidebar;
      if (!sidebar) {
        ctx.logger?.warn?.(
          "[graph-memory] 官方原生栏与 better-sidebar 均未就绪,页签未注册;独立看板仍可访问 /graph-memory/app",
        );
        return () => { removeStyles(); seatDispose?.(); };
      }
      try {
        tabDispose = sidebar.registerTab({
          id: "graph-memory:graph",
          title: () => "记忆图谱",
          order: 56,
          single: true,
          icon: () => "⌁",
          component: ({ visible }: { visible: boolean }) =>
            createElement(GraphMemoryApp, { visible }),
        }) ?? null;
      } catch (error) {
        ctx.logger?.warn?.("[graph-memory] registerTab 失败:", error);
        tabDispose = null;
      }
    }

    return () => {
      tabDispose?.();
      removeStyles();
      seatDispose?.();
    };
  }, "graph-memory: register dashboard tab");
}

export { inject, name };
