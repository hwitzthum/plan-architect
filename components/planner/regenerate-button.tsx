"use client";

import { LoaderCircleIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RegenerateButtonProps = {
  label?: string;
  onRegenerate: (constraint: string | undefined) => Promise<void>;
};

export function RegenerateButton({
  label = "Regenerate",
  onRegenerate,
}: RegenerateButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [constraint, setConstraint] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(withConstraint: boolean) {
    setBusy(true);
    try {
      await onRegenerate(
        withConstraint && constraint.trim() ? constraint.trim() : undefined,
      );
      setExpanded(false);
      setConstraint("");
    } finally {
      setBusy(false);
    }
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setExpanded(true)}
        disabled={busy}
      >
        {busy ? (
          <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
        ) : (
          <RefreshCwIcon data-icon="inline-start" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2 sm:w-80">
      <Input
        value={constraint}
        onChange={(event) => setConstraint(event.target.value)}
        placeholder="Optional constraint…"
        disabled={busy}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit(true);
          }
          if (event.key === "Escape") {
            setExpanded(false);
            setConstraint("");
          }
        }}
        className="h-9 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => submit(true)}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircleIcon
              data-icon="inline-start"
              className="animate-spin"
            />
          ) : (
            <RefreshCwIcon data-icon="inline-start" />
          )}
          {busy ? "Generating" : "Run"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpanded(false);
            setConstraint("");
          }}
          disabled={busy}
        >
          <XIcon data-icon="inline-start" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
