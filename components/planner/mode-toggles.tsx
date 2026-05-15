"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BriefMode } from "@/lib/ai/planner-schema";

type ModeTogglesProps = {
  mode: BriefMode;
  tutorial: boolean;
  disabled?: boolean;
  onModeChange: (mode: BriefMode) => void;
  onTutorialChange: (tutorial: boolean) => void;
};

export function ModeToggles({
  mode,
  tutorial,
  disabled = false,
  onModeChange,
  onTutorialChange,
}: ModeTogglesProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleRow label="Spec-kit mode" hint="FR-### / SC-### / Given-When-Then">
        <ToggleButton
          active={mode === "specKit"}
          disabled={disabled}
          onClick={() => onModeChange(mode === "specKit" ? "plain" : "specKit")}
        >
          {mode === "specKit" ? "On" : "Off"}
        </ToggleButton>
      </ToggleRow>
      <ToggleRow
        label="Tutorial mode"
        hint="favours no auth, no DB, no payments"
      >
        <ToggleButton
          active={tutorial}
          disabled={disabled}
          onClick={() => onTutorialChange(!tutorial)}
        >
          {tutorial ? "On" : "Off"}
        </ToggleButton>
      </ToggleRow>
    </div>
  );
}

type ToggleRowProps = {
  label: string;
  hint: string;
  children: React.ReactNode;
};

function ToggleRow({ label, hint, children }: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-1 border border-border bg-muted px-4 py-3 shadow-inner">
      <div className="flex items-center justify-between gap-3">
        <span className="micro-label">{label}</span>
        {children}
      </div>
      <span className="text-xs leading-5 text-muted-foreground">{hint}</span>
    </div>
  );
}

type ToggleButtonProps = {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToggleButton({
  active,
  disabled,
  onClick,
  children,
}: ToggleButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "micro-label h-8 px-3",
        active ? "command-strip text-primary-foreground" : undefined,
      )}
    >
      {children}
    </Button>
  );
}
