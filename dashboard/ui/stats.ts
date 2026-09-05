import type { GraphSnapshot, NodeType } from '../types.ts';

export interface GraphStats {
  nodes: number;
  edges: number;
  communities: number;
  byType: Record<NodeType, number>;
  approximate: boolean;
}

export function deriveStats(snapshot: GraphSnapshot): GraphStats {
  const byType: Record<NodeType, number> = { TASK: 0, SKILL: 0, EVENT: 0 };
  const communities = new Set<string>();
  for (const node of snapshot.nodes) {
    byType[node.type] += 1;
    if (node.communityId) communities.add(node.communityId);
  }
  return {
    nodes: snapshot.totals.nodes,
    edges: snapshot.totals.edges,
    communities: communities.size,
    byType,
    approximate: snapshot.truncated.nodes,
  };
}
