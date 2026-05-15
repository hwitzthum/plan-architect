"use client";

import {
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { BriefSectionCard } from "./brief-section-card";

type StarterPromptCardProps = {
  value: string;
  onChange: (value: string) => void;
  onRegenerate: () => Promise<void>;
};

export function StarterPromptCard({
  value,
  onChange,
  onRegenerate,
}: StarterPromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <BriefSectionCard
      numeral="VII"
      anchor="Hand-off"
      title="Coding Agent Starter Prompt"
      description="LLM-distilled. Edit the prompt or regenerate it after changing other sections, then copy it into your coding agent."
    >
      <div className="flex flex-col gap-4">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-72 bg-muted font-mono text-sm leading-7 shadow-inner"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={copyPrompt}
            className="command-strip px-5 font-medium text-primary-foreground"
          >
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied ? "Copied" : "Copy prompt"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={regenerating}
            onClick={handleRegenerate}
          >
            {regenerating ? (
              <LoaderCircleIcon
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <SparklesIcon data-icon="inline-start" />
            )}
            {regenerating ? "Regenerating" : "Regenerate from brief"}
          </Button>
        </div>
      </div>
    </BriefSectionCard>
  );
}
