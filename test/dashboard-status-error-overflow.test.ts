import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../dashboard/ui/styles.ts", import.meta.url), "utf8");

function rule(selector: string): string {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]+)\\}`));
  expect(match, `missing CSS rule ${selector}`).toBeTruthy();
  return match![1].replace(/\s+/g, " ");
}

describe("实时情况错误行不得撑破卡片", () => {
  it("grid/flex 链路上都有 min-width:0，kind 可收缩并 ellipsis", () => {
    expect(rule(".gm-status-errors")).toContain("min-width: 0");
    expect(rule(".gm-status-error")).toContain("min-width: 0");
    expect(rule(".gm-status-error")).toContain("overflow: hidden");
    const kind = rule(".gm-status-error-kind");
    expect(kind).toContain("flex: 1 1 0");
    expect(kind).toContain("min-width: 0");
    expect(kind).toContain("text-overflow: ellipsis");
    expect(kind).toContain("white-space: nowrap");
    expect(rule(".gm-status-error-count")).toContain("flex: 0 0 auto");
  });
});
