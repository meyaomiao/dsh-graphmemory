import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface LoadedClient {
  id: string;
  factory: (require: (id: string) => unknown) => {
    inject: string[];
    name: string;
    apply(ctx: any): void;
  };
}

describe("dashboard client bundle (better-sidebar tab)", () => {
  it("registers 记忆图谱 with service inject betterSidebar", () => {
    let loaded: LoadedClient | undefined;
    runInNewContext(readFileSync(new URL("../dist/client.js", import.meta.url), "utf8"), {
      window: { __ModuleLoader__: { load: (entry: LoadedClient) => { loaded = entry; } } },
    });
    expect(loaded?.id).toBe("dsh-graphmemory");

    const react = {
      createElement: (...args: unknown[]) => ({ args }),
      Fragment: "fragment",
      jsx: (...args: unknown[]) => ({ args }),
      jsxs: (...args: unknown[]) => ({ args }),
    };
    const plugin = loaded!.factory((id) => {
      if (id === "react" || id === "react/jsx-runtime") return react;
      throw new Error(`unexpected client external ${id}`);
    });
    expect(plugin.inject).toEqual(["betterSidebar"]);
    expect(plugin.name).toBe("graph-memory-dashboard");

    const registered: any[] = [];
    const disposeTab = vi.fn();
    const ctx = {
      betterSidebar: {
        registerTab: (descriptor: unknown) => {
          registered.push(descriptor);
          return disposeTab;
        },
      },
      logger: { warn: vi.fn(), info: vi.fn() },
      effect: (factory: () => (() => void) | void) => {
        const cleanup = factory();
        return cleanup;
      },
    };

    plugin.apply(ctx);
    expect(registered).toHaveLength(1);
    expect(registered[0].id).toBe("graph-memory:graph");
    expect(registered[0].title()).toBe("记忆图谱");
    expect(registered[0].single).toBe(true);
  });

  it("degrades without betterSidebar instead of throwing", () => {
    let loaded: LoadedClient | undefined;
    runInNewContext(readFileSync(new URL("../dist/client.js", import.meta.url), "utf8"), {
      window: { __ModuleLoader__: { load: (entry: LoadedClient) => { loaded = entry; } } },
    });
    const plugin = loaded!.factory((id) => {
      if (id === "react" || id === "react/jsx-runtime") {
        return { createElement: () => null, jsx: () => null, jsxs: () => null, Fragment: "fragment" };
      }
      throw new Error(`unexpected client external ${id}`);
    });
    const warn = vi.fn();
    expect(() => plugin.apply({
      betterSidebar: undefined,
      logger: { warn, info: vi.fn() },
      effect: (factory: () => void) => factory(),
    })).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
