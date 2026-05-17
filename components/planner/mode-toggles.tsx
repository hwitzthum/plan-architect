"use client";

import { Button } from "@/components/ui/button";
import type { BriefMode } from "@/lib/ai/planner-schema";

type ModeTogglesProps = {
  mode: BriefMode;
  disabled?: boolean;
  onModeChange: (mode: BriefMode) => void;
};

export function ModeToggles({
  mode,
  disabled = false,
  onModeChange,
}: ModeTogglesProps) {
  const active = mode === "specKit";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-1 border border-border bg-muted px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="micro-label">Spec-kit mode</span>
          <Button
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            disabled={disabled}
            onClick={() => onModeChange(active ? "plain" : "specKit")}
            className="micro-label px-3"
          >
            {active ? "On" : "Off"}
          </Button>
        </div>
        <span className="text-xs leading-5 text-muted-foreground">
          FR-### / SC-### / Given-When-Then
        </span>
      </div>
    </div>
  );
}
