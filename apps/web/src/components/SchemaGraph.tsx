import type { Workspace } from "@ask-database/shared";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";

interface SchemaGraphProps {
  workspace: Workspace;
}

export function SchemaGraph({ workspace }: SchemaGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const angleStep = (Math.PI * 2) / Math.max(1, workspace.schema.tables.length);
    const generatedNodes: Node[] = workspace.schema.tables.map((table, index) => ({
      id: table.name,
      position: {
        x: 260 + Math.cos(index * angleStep) * 230,
        y: 190 + Math.sin(index * angleStep) * 150
      },
      data: {
        label: `${table.name} (${table.columns.length})`
      },
      style: {
        border: "1px solid #0284c7",
        borderRadius: 8,
        color: "#0f172a",
        fontWeight: 700,
        padding: 12,
        background: "#f0f9ff"
      }
    }));

    const generatedEdges: Edge[] = workspace.schema.relationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.fromTable,
      target: relationship.toTable,
      label: `${relationship.fromColumn} -> ${relationship.toColumn}`,
      animated: true,
      style: {
        stroke: "#0ea5e9"
      }
    }));

    return {
      nodes: generatedNodes,
      edges: generatedEdges
    };
  }, [workspace]);

  return (
    <div className="h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-white">
      <ReactFlow edges={edges} fitView nodes={nodes}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
