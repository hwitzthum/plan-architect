"use client";

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { memo, useMemo } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProjectBrief } from "@/lib/ai/planner-schema";

type DataModelFlowProps = {
  dataModel: ProjectBrief["dataModel"];
};

const NODE_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  color: "var(--card-foreground)",
  padding: 0,
  width: 250,
} as const;

const EDGE_STYLE = { stroke: "var(--accent)", strokeWidth: 2 } as const;
const EDGE_LABEL_STYLE = {
  fill: "var(--foreground)",
  fontSize: 12,
  fontWeight: 500,
} as const;

function EntityNodeLabel({
  name,
  description,
  fields,
}: {
  name: string;
  description: string;
  fields: string[];
}) {
  return (
    <div className="flex min-w-52 flex-col text-left">
      <div className="border-b border-border px-3 py-2">
        <span className="micro-label">{name}</span>
      </div>
      {description ? (
        <p className="px-3 pt-2 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <ul className="flex flex-col px-3 py-2 font-mono text-[11px] leading-5 text-foreground/85">
        {fields.slice(0, 5).map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
    </div>
  );
}

function DataModelFlowImpl({ dataModel }: DataModelFlowProps) {
  const { nodes, edges } = useMemo(() => {
    const computedNodes: Node[] = dataModel.entities.map((entity, index) => ({
      id: entity.id,
      position: { x: (index % 2) * 310, y: Math.floor(index / 2) * 190 },
      data: {
        label: (
          <EntityNodeLabel
            name={entity.name}
            description={entity.description}
            fields={entity.fields}
          />
        ),
      },
      style: NODE_STYLE,
    }));

    const entityIds = new Set(dataModel.entities.map((entity) => entity.id));
    // Defensive guard: drop dangling relationships. Server-side
    // applySectionPatch performs the same filter — this is a render-time
    // safety net for ids edited inline before the section is regenerated.
    const computedEdges: Edge[] = dataModel.relationships
      .filter(
        (relationship) =>
          entityIds.has(relationship.sourceEntityId) &&
          entityIds.has(relationship.targetEntityId),
      )
      .map((relationship) => ({
        id: relationship.id,
        source: relationship.sourceEntityId,
        target: relationship.targetEntityId,
        label: relationship.label,
        animated: false,
        style: EDGE_STYLE,
        labelStyle: EDGE_LABEL_STYLE,
      }));

    return { nodes: computedNodes, edges: computedEdges };
  }, [dataModel.entities, dataModel.relationships]);

  return (
    <Card className="paper-card overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-3">
          <span className="numeral-eyebrow">IV.</span>
          <span className="section-anchor">Entity map</span>
        </div>
        <CardTitle>Data Model</CardTitle>
        <CardDescription>
          React Flow visualisation generated from the editable data model.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="memo-surface h-[460px] overflow-hidden border">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--border)" gap={28} />
            <Controls />
          </ReactFlow>
        </div>
        <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
          {edges.length ? (
            edges.map((edge) => (
              <p key={edge.id}>
                <span className="font-mono text-foreground">{edge.source}</span>{" "}
                {edge.label}{" "}
                <span className="font-mono text-foreground">{edge.target}</span>
              </p>
            ))
          ) : (
            <p>Add at least one relationship to draw edges between entities.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const DataModelFlow = memo(DataModelFlowImpl);
