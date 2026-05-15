"use client";

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
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

export function DataModelFlow({ dataModel }: DataModelFlowProps) {
  const nodes: Node[] = dataModel.entities.map((entity, index) => ({
    id: entity.id,
    position: { x: (index % 2) * 310, y: Math.floor(index / 2) * 190 },
    data: {
      label: (
        <div className="flex min-w-52 flex-col gap-2 text-left">
          <div className="font-display text-base font-normal tracking-[-0.015em]">
            {entity.name}
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            {entity.description}
          </div>
          <div className="flex flex-wrap gap-1">
            {entity.fields.slice(0, 5).map((field) => (
              <Badge
                variant="secondary"
                className="font-mono text-[10px]"
                key={field}
              >
                {field}
              </Badge>
            ))}
          </div>
        </div>
      ),
    },
    style: {
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 0,
      color: "var(--card-foreground)",
      padding: 12,
      width: 250,
    },
  }));

  const entityIds = new Set(dataModel.entities.map((entity) => entity.id));
  const edges: Edge[] = dataModel.relationships
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
      style: { stroke: "var(--accent)", strokeWidth: 2 },
      labelStyle: { fill: "var(--foreground)", fontSize: 12, fontWeight: 500 },
    }));

  return (
    <Card className="paper-card overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-3">
          <span className="numeral-eyebrow">IV.</span>
          <span className="section-anchor">Entity map</span>
        </div>
        <CardTitle className="font-display text-2xl font-normal tracking-[-0.02em]">
          Data Model
        </CardTitle>
        <CardDescription className="leading-7">
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
