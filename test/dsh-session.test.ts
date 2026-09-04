import { describe, expect, it } from "vitest";

import {
  canReadSessionEvents,
  eventAtSeq,
  snapshotSessionEvents,
} from "../src/format/dsh-session.ts";

function user(seq: number, kind = "user") {
  return { type: "user/message", seq, data: { source: { kind } } };
}

describe("DSH session dual-read helpers", () => {
  it("reads a sparse 0.1.1 events array by seq and skips holes in snapshots", () => {
    const events: any[] = [];
    events[20] = user(20, "plugin");
    events[4] = user(4);
    events[5] = { type: "assistant/message", seq: 5 };

    expect(canReadSessionEvents({ events })).toBe(true);
    expect(eventAtSeq({ events }, 4)).toEqual(user(4));
    expect(eventAtSeq({ events }, 20)?.data?.source?.kind).toBe("plugin");
    expect(eventAtSeq({ events }, 99)).toBeUndefined();
    expect(snapshotSessionEvents({ events })).toEqual([
      user(4),
      { type: "assistant/message", seq: 5 },
      user(20, "plugin"),
    ]);
  });

  it("prefers eventAt and snapshotEvents on a 0.1.2 session without events", () => {
    const log = new Map<number, any>([
      [4, user(4)],
      [5, { type: "assistant/message", seq: 5 }],
      [9, user(9)],
    ]);
    const session = {
      eventAt(seq: unknown) {
        return log.get(Number(seq));
      },
      snapshotEvents() {
        return [...log.values()];
      },
    };

    expect(canReadSessionEvents(session)).toBe(true);
    expect(Array.isArray((session as { events?: unknown }).events)).toBe(false);
    expect(eventAtSeq(session, 9)).toEqual(user(9));
    expect(snapshotSessionEvents(session)).toHaveLength(3);
  });

  it("matches dense snapshotEvents by .seq when eventAt is absent", () => {
    const session = {
      snapshotEvents() {
        return [user(20, "plugin"), user(4), { type: "assistant/message", seq: 5 }];
      },
    };

    expect(eventAtSeq(session, 20)?.data?.source?.kind).toBe("plugin");
    expect(eventAtSeq(session, 4)).toEqual(user(4));
    expect(eventAtSeq(session, 7)).toBeUndefined();
  });

  it("returns undefined when the session has no readable log", () => {
    expect(canReadSessionEvents({})).toBe(false);
    expect(snapshotSessionEvents({})).toBeUndefined();
    expect(snapshotSessionEvents(undefined)).toBeUndefined();
    expect(eventAtSeq({}, 1)).toBeUndefined();
  });
});
