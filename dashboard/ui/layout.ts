import type { GraphSnapshotNode } from '../types.ts';

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphBox {
  width: number;
  height: number;
}

const MAX_LABEL_LENGTH = 16;
const MIN_BOX_WIDTH = 76;
const MAX_BOX_WIDTH = 118;
const BOX_HEIGHT = 44;
const HORIZONTAL_GAP = 18;
const VERTICAL_GAP = 24;

function labelLength(node: GraphSnapshotNode): number {
  return Math.min(node.name.length, MAX_LABEL_LENGTH);
}

/** The visual footprint reserved for each node label during layout. */
export function nodeBox(node: GraphSnapshotNode): GraphBox {
  return {
    width: Math.min(MAX_BOX_WIDTH, Math.max(MIN_BOX_WIDTH, labelLength(node) * 6.2 + 26)),
    height: BOX_HEIGHT,
  };
}

/**
 * Deterministic, dependency-free layout for the bounded SVG graph.
 *
 * The old layout packed 48 labels into a 360x250 viewBox. This layout gives
 * every label a real box, uses a five-column board when possible, and leaves
 * enough breathing room for panning the canvas.
 */
export function layoutNodes(
  nodes: readonly GraphSnapshotNode[],
  width = 720,
  height = 610,
): Map<string, GraphPoint> {
  const points = new Map<string, GraphPoint>();
  if (nodes.length === 0) return points;
  if (nodes.length === 1) {
    points.set(nodes[0].id, { x: width / 2, y: height / 2 });
    return points;
  }

  const maxColumns = Math.max(3, Math.min(5, Math.floor((width - 40) / (MAX_BOX_WIDTH + HORIZONTAL_GAP))));
  const columns = Math.min(maxColumns, nodes.length);
  const rows = Math.ceil(nodes.length / columns);
  const cellWidth = (width - 40) / columns;
  const cellHeight = Math.max(BOX_HEIGHT + VERTICAL_GAP, (height - 40) / rows);

  nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    points.set(node.id, {
      x: 20 + cellWidth * (column + 0.5),
      y: 20 + cellHeight * (row + 0.5),
    });
  });
  return points;
}
