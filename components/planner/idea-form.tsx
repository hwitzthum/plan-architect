"use client";

import { LoaderCircleIcon, WandSparklesIcon } from "lucide-react";
import type { FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type IdeaFormProps = {
  idea: string;
  error: string | null;
  isLoading: boolean;
  model: string | null;
  onIdeaChange: (idea: string) => void;
  onSubmit: () => void;
};

export function IdeaForm({
  idea,
  error,
  isLoading,
  model,
  onIdeaChange,
  onSubmit,
}: IdeaFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Card className="hero-panel overflow-hidden">
      <CardHeader className="grid gap-8 p-8 md:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.78fr)] lg:p-10">
        <div className="flex flex-col justify-between gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="micro-label w-fit">
              AI Project Planner
            </Badge>
            {model ? (
              <Badge
                variant="outline"
                className="dark-meta-badge micro-label w-fit"
              >
                {model}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-col gap-6">
            <CardTitle className="font-display text-5xl font-normal leading-none tracking-[-0.04em] xl:text-6xl">
              Shape rough ideas into decisive project briefs.
            </CardTitle>
            <CardDescription className="body-copy-on-dark max-w-2xl text-base leading-8">
              Generate a focused plan with features, routes, phases, risks, and
              an editable data model without adding product noise.
            </CardDescription>
          </div>
        </div>

        <form
          className="form-surface flex flex-col gap-5 p-6 md:p-8"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-2">
            <span className="micro-label">Project idea</span>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep it intentionally rough. The planner will impose structure.
            </p>
          </div>
          <Textarea
            value={idea}
            onChange={(event) => onIdeaChange(event.target.value)}
            placeholder="Example: A decision log for small teams that captures decisions, owners, alternatives, and follow-up actions."
            className="min-h-36 bg-card text-base leading-7"
          />
          <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              One complete generation. No auth, database, or payments in scope.
            </p>
            <Button
              type="submit"
              size="command"
              disabled={isLoading || idea.trim().length < 10}
            >
              {isLoading ? (
                <LoaderCircleIcon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <WandSparklesIcon data-icon="inline-start" />
              )}
              {isLoading ? "Generating" : "Generate brief"}
            </Button>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Planner error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardHeader>
    </Card>
  );
}
