import type { GraphSnapshotEdge, GraphSnapshotNode } from '../types.ts';
import { nodeBox, type GraphPoint } from './layout.ts';

export interface LayeredTreeEdge {
  edge: GraphSnapshotEdge;
  parentId: string;
  childId: string;
}

export interface LayeredTree {
  rootId: string;
  nodes: GraphSnapshotNode[];
  edges: LayeredTreeEdge[];
  depthById: Map<string, number>;
  points: Map<string, GraphPoint>;
  width: number;
  height: number;
  hiddenEdgeCount: number;
}

const GRAPH_PADDING_X = 80;
const GRAPH_PADDING_Y = 40;
const TREE_ROW_GAP = 72;
const MIN_TREE_HEIGHT = 300;

interface Neighbor {
  id: string;
  edge: GraphSnapshotEdge;
}

/**
 * Build a bounded, rooted spanning tree from the snapshot.
 *
 * Graph Memory can contain cycles and multiple edges between the same nodes.
 * The relationship view intentionally draws one discovery edge per node: a
 * rooted tree has an unambiguous hierarchy and can be laid out without edge
 * crossings. Extra in-scope edges are reported to the UI instead of being
 * drawn on top of the tree.
 */
export function layoutLayeredTree(
  nodes: readonly GraphSnapshotNode[],
  edges: readonly GraphSnapshotEdge[],
  rootId: string,
  maxDepth: number,
  width = 960,
): LayeredTree {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const root = nodeById.get(rootId) ?? nodes[0];
  if (!root) {
    return {
      rootId,
      nodes: [],
      edges: [],
      depthById: new Map(),
      points: new Map(),
      width,
      height: MIN_TREE_HEIGHT,
      hiddenEdgeCount: 0,
    };
  }

  const boundedDepth = Math.max(0, Math.min(5, Math.floor(maxDepth)));
  const adjacency = new Map<string, Neighbor[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    if (!nodeById.has(edge.fromId) || !nodeById.has(edge.toId) || edge.fromId === edge.toId) continue;
    adjacency.get(edge.fromId)?.push({ id: edge.toId, edge });
    adjacency.get(edge.toId)?.push({ id: edge.fromId, edge });
  }

  const depthById = new Map<string, number>([[root.id, 0]]);
  const parentById = new Map<string, string>();
  const parentEdgeById = new Map<string, GraphSnapshotEdge>();
  const queue = [root.id];
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    const currentDepth = depthById.get(currentId) ?? 0;
    if (currentDepth >= boundedDepth) continue;
    for (const neighbor of adjacency.get(currentId) ?? []) {
      if (depthById.has(neighbor.id)) continue;
      depthById.set(neighbor.id, currentDepth + 1);
      parentById.set(neighbor.id, currentId);
      parentEdgeById.set(neighbor.id, neighbor.edge);
      queue.push(neighbor.id);
    }
  }

  const treeNodes = nodes.filter((node) => depthById.has(node.id));
  const treeNodeIds = new Set(treeNodes.map((node) => node.id));
  const treeEdges: LayeredTreeEdge[] = [];
  for (const node of treeNodes) {
    const parentId = parentById.get(node.id);
    const edge = parentEdgeById.get(node.id);
    if (parentId && edge) treeEdges.push({ edge, parentId, childId: node.id });
  }
  const treeEdgeIds = new Set(treeEdges.map(({ edge }) => edge.id));
  const hiddenEdgeCount = edges.filter(
    (edge) => treeNodeIds.has(edge.fromId) && treeNodeIds.has(edge.toId) && !treeEdgeIds.has(edge.id),
  ).length;

  const children = new Map<string, string[]>();
  for (const node of treeNodes) children.set(node.id, []);
  for (const { parentId, childId } of treeEdges) children.get(parentId)?.push(childId);

  const maxTreeDepth = Math.max(...depthById.values());
  const columnGap = maxTreeDepth > 0
    ? (width - GRAPH_PADDING_X * 2) / maxTreeDepth
    : 0;
  const points = new Map<string, GraphPoint>();
  let leafIndex = 0;
  const assignVerticalPositions = (id: string): number => {
    const childIds = children.get(id) ?? [];
    if (childIds.length === 0) {
      const y = GRAPH_PADDING_Y + leafIndex * TREE_ROW_GAP;
      leafIndex += 1;
      const depth = depthById.get(id) ?? 0;
      points.set(id, {
        x: maxTreeDepth > 0 ? GRAPH_PADDING_X + depth * columnGap : width / 2,
        y,
      });
      return y;
    }
    const childY = childIds.map(assignVerticalPositions);
    const y = (childY[0] + childY[childY.length - 1]) / 2;
    const depth = depthById.get(id) ?? 0;
    points.set(id, {
      x: maxTreeDepth > 0 ? GRAPH_PADDING_X + depth * columnGap : width / 2,
      y,
    });
    return y;
  };
  assignVerticalPositions(root.id);

  const height = Math.max(
    MIN_TREE_HEIGHT,
    GRAPH_PADDING_Y * 2 + Math.max(1, leafIndex - 1) * TREE_ROW_GAP,
  );
  return {
    rootId: root.id,
    nodes: treeNodes,
    edges: treeEdges,
    depthById,
    points,
    width,
    height,
    hiddenEdgeCount,
  };
}

/** Check the reserved label boxes, useful for regression tests and diagnostics. */
export function treeHasOverlappingLabels(tree: LayeredTree): boolean {
  for (let left = 0; left < tree.nodes.length; left += 1) {
    const leftNode = tree.nodes[left];
    const leftPoint = tree.points.get(leftNode.id);
    if (!leftPoint) continue;
    const leftBox = nodeBox(leftNode);
    for (let right = left + 1; right < tree.nodes.length; right += 1) {
      const rightNode = tree.nodes[right];
      const rightPoint = tree.points.get(rightNode.id);
      if (!rightPoint) continue;
      const rightBox = nodeBox(rightNode);
      if (
        Math.abs(leftPoint.x - rightPoint.x) < (leftBox.width + rightBox.width) / 2 + 18
        && Math.abs(leftPoint.y - rightPoint.y) < (leftBox.height + rightBox.height) / 2 + 12
      ) return true;
    }
  }
  return false;
}
