/**
 * Dual-read helpers for DSH session event logs.
 *
 * DSH 0.1.1-rc.2 exposes a sparse `Session.events` array keyed by seq.
 * DSH 0.1.2-rc.1 replaces that property with on-demand `snapshotEvents()` and
 * `eventAt(seq)`. Graph Memory must keep working on both hosts: live ingest
 * still uses `session/event`, but restart backfill and rolling compaction
 * select prefixes from the current log.
 */

export interface DshSurfaceEvent {
  type?: string;
  seq?: unknown;
  data?: {
    source?: { kind?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DshSessionLike {
  events?: Array<DshSurfaceEvent | undefined>;
  snapshotEvents?: (fromSeq?: unknown) => unknown;
  eventAt?: (seq: unknown) => unknown;
  surface?: { nodes?: unknown[] };
}

function asEvent(value: unknown): DshSurfaceEvent | undefined {
  if (value == null || typeof value !== "object") return undefined;
  return value as DshSurfaceEvent;
}

function numericSeq(seq: unknown): number | undefined {
  const value = typeof seq === "number" ? seq : Number(seq);
  return Number.isFinite(value) ? value : undefined;
}

/** True when this session object can yield a historical event log. */
export function canReadSessionEvents(session: DshSessionLike | null | undefined): boolean {
  if (session == null || typeof session !== "object") return false;
  return typeof session.eventAt === "function"
    || typeof session.snapshotEvents === "function"
    || Array.isArray(session.events);
}

/**
 * Read one event by durable seq.
 *
 * Preference: `eventAt(seq)` (0.1.2) → dense `snapshotEvents()` match on
 * `.seq` → legacy sparse `events[seq]` (0.1.1).
 */
export function eventAtSeq(
  session: DshSessionLike | null | undefined,
  seq: unknown,
): DshSurfaceEvent | undefined {
  if (session == null || typeof session !== "object" || seq == null) return undefined;

  if (typeof session.eventAt === "function") {
    try {
      const direct = asEvent(session.eventAt(seq));
      if (direct) return direct;
    } catch {
      // Branded SessionSeq callers may reject a plain number; try numeric.
    }
    const numeric = numericSeq(seq);
    if (numeric !== undefined) {
      try {
        const viaNumber = asEvent(session.eventAt(numeric));
        if (viaNumber) return viaNumber;
      } catch {
        // Fall through to snapshot / legacy array.
      }
    }
  }

  if (typeof session.snapshotEvents === "function") {
    try {
      const snap = session.snapshotEvents();
      if (Array.isArray(snap)) {
        const matched = snap.find((entry) => {
          const event = asEvent(entry);
          return event != null && numericSeq(event.seq) !== undefined
            && numericSeq(event.seq) === numericSeq(seq);
        });
        if (matched) return asEvent(matched);
      }
    } catch {
      // Fall through to legacy array.
    }
  }

  const index = numericSeq(seq);
  if (index === undefined || !Array.isArray(session.events)) return undefined;
  return asEvent(session.events[index]);
}

/**
 * Snapshot the readable event log.
 *
 * Returns `undefined` when the session has neither 0.1.2 readers nor a
 * legacy `events` array, so callers can skip backfill instead of treating
 * a missing log as an empty log.
 */
export function snapshotSessionEvents(
  session: DshSessionLike | null | undefined,
): readonly DshSurfaceEvent[] | undefined {
  if (session == null || typeof session !== "object") return undefined;

  if (typeof session.snapshotEvents === "function") {
    try {
      const snap = session.snapshotEvents();
      if (Array.isArray(snap)) {
        return snap.filter((entry): entry is DshSurfaceEvent => asEvent(entry) != null);
      }
    } catch {
      // Fall through to legacy array.
    }
  }

  if (Array.isArray(session.events)) return session.events.filter(
    (entry): entry is DshSurfaceEvent => asEvent(entry) != null,
  );
  return undefined;
}
