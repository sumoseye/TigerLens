/**
 * GraphCanvas — Interactive ReactFlow graph visualization.
 * Renders nodes with Ice Blue color and themed edges.
 */

import React, { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_TYPE_COLORS, EDGE_TYPE_COLORS, THEME } from "../lib/constants";
import type { GraphNode, GraphEdge } from "../lib/api";

// ─── Custom Node Component ─────────────────────────────

function GraphNodeComponent({ data }: NodeProps) {
  const nodeData = data as {
    label: string;
    nodeType: string;
    properties: Record<string, any>;
  };

  const bgColor = NODE_TYPE_COLORS[nodeData.nodeType] || THEME.nodeColor;

  return (
    <div
      className="px-3 py-2 rounded-lg border shadow-md cursor-pointer transition-transform hover:scale-105"
      style={{
        backgroundColor: `${bgColor}22`,
        borderColor: bgColor,
        minWidth: 100,
        maxWidth: 200,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: bgColor, width: 6, height: 6 }} />
      <div className="text-[10px] font-mono opacity-60" style={{ color: bgColor }}>
        {nodeData.nodeType}
      </div>
      <div
        className="text-xs font-semibold mt-0.5 truncate"
        style={{ color: THEME.textLight }}
        title={nodeData.label}
      >
        {nodeData.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: bgColor, width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  graphNode: GraphNodeComponent as any,
};

// ─── Props ──────────────────────────────────────────────

interface GraphCanvasProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
}

// ─── Layout Helper ──────────────────────────────────────

function layoutNodes(
  graphNodes: GraphNode[]
): Node[] {
  const typeGroups: Record<string, GraphNode[]> = {};
  for (const node of graphNodes) {
    const t = node.node_type;
    if (!typeGroups[t]) typeGroups[t] = [];
    typeGroups[t].push(node);
  }

  const rfNodes: Node[] = [];
  const groupKeys = Object.keys(typeGroups);
  const centerX = 400;
  const centerY = 300;
  const groupRadius = 250;

  groupKeys.forEach((groupType, gi) => {
    const groupAngle = (2 * Math.PI * gi) / Math.max(groupKeys.length, 1);
    const groupCenterX = centerX + Math.cos(groupAngle) * groupRadius;
    const groupCenterY = centerY + Math.sin(groupAngle) * groupRadius;

    const nodesInGroup = typeGroups[groupType];
    const innerRadius = Math.min(150, nodesInGroup.length * 25);

    nodesInGroup.forEach((node, ni) => {
      const angle = (2 * Math.PI * ni) / Math.max(nodesInGroup.length, 1);
      const x = groupCenterX + Math.cos(angle) * innerRadius;
      const y = groupCenterY + Math.sin(angle) * innerRadius;

      rfNodes.push({
        id: node.id,
        type: "graphNode",
        position: { x, y },
        data: {
          label: node.label,
          nodeType: node.node_type,
          properties: node.properties,
        },
      });
    });
  });

  return rfNodes;
}

function layoutEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.map((edge, i) => ({
    id: `e-${i}-${edge.source_id}-${edge.target_id}`,
    source: edge.source_id,
    target: edge.target_id,
    label: edge.edge_type,
    style: {
      stroke: EDGE_TYPE_COLORS[edge.edge_type] || THEME.nodeColor,
      strokeWidth: 1.5,
    },
    labelStyle: {
      fontSize: 8,
      fill: THEME.textLight,
    },
    animated: edge.edge_type === "CONNECTED_TO",
  }));
}

// ─── Component ──────────────────────────────────────────

export default function GraphCanvas({
  graphNodes,
  graphEdges,
  onNodeClick,
}: GraphCanvasProps) {
  const initialNodes = useMemo(() => layoutNodes(graphNodes), [graphNodes]);
  const initialEdges = useMemo(() => layoutEdges(graphEdges), [graphEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  // Re-layout when props change
  React.useEffect(() => {
    setNodes(layoutNodes(graphNodes));
    setEdges(layoutEdges(graphEdges));
  }, [graphNodes, graphEdges, setNodes, setEdges]);

  return (
    <div className="w-full h-full" style={{ backgroundColor: THEME.bgPrimary }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        style={{ backgroundColor: THEME.bgPrimary }}
      >
        <Background color={THEME.bgSecondary} gap={20} size={1} />
        <Controls
          style={{ backgroundColor: THEME.bgSecondary, borderColor: THEME.accentPrimary }}
        />
        <MiniMap
          nodeColor={(node) => {
            const nodeType = (node.data as any)?.nodeType || "Entity";
            return NODE_TYPE_COLORS[nodeType] || THEME.nodeColor;
          }}
          style={{ backgroundColor: THEME.bgSecondary }}
        />
      </ReactFlow>
    </div>
  );
}