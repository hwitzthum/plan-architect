"use client";

import { ArrowRightIcon, SkipForwardIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  ClarifierAnswers,
  ClarifierQuestion,
} from "@/lib/ai/clarifier-schema";

type ClarifierDialogProps = {
  questions: ClarifierQuestion[];
  isSubmitting: boolean;
  onSubmit: (answers: ClarifierAnswers) => void;
  onSkip: () => void;
};

const FREE_TEXT_SENTINEL = "__free_text__";

export function ClarifierDialog({
  questions,
  isSubmitting,
  onSubmit,
  onSkip,
}: ClarifierDialogProps) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState<Record<string, string>>({});

  function handleOption(questionId: string, value: string) {
    setPicks((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleFreeText(questionId: string, value: string) {
    setFreeText((prev) => ({ ...prev, [questionId]: value }));
  }

  function buildAnswers(): ClarifierAnswers {
    const answers: ClarifierAnswers = {};
    for (const question of questions) {
      const pick = picks[question.id];
      if (pick === FREE_TEXT_SENTINEL) {
        const text = freeText[question.id]?.trim();
        if (text) answers[question.id] = text;
      } else if (pick) {
        answers[question.id] = pick;
      }
    }
    return answers;
  }

  function handleSubmit() {
    onSubmit(buildAnswers());
  }

  return (
    <Card className="paper-card">
      <CardHeader className="flex flex-col gap-2 p-8 pb-0">
        <span className="micro-label">Clarifier</span>
        <h2 className="font-display text-3xl leading-tight tracking-[-0.02em]">
          Answer a few quick questions so the plan fits the actual idea.
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Skip if your idea already specifies these. Each question moves the
          plan in a meaningful way.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-8 p-8">
        {questions.map((question, index) => (
          <div key={question.id} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="micro-label mt-1 shrink-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-base leading-7">{question.question}</p>
            </div>
            <div className="flex flex-wrap gap-2 pl-10">
              {question.options.map((option) => {
                const active = picks[question.id] === option;
                return (
                  <Button
                    key={option}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleOption(question.id, option)}
                    className="px-3 text-sm"
                  >
                    {option}
                  </Button>
                );
              })}
              {question.allowFreeText ? (
                <Button
                  type="button"
                  variant={
                    picks[question.id] === FREE_TEXT_SENTINEL
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => handleOption(question.id, FREE_TEXT_SENTINEL)}
                  className="px-3 text-sm"
                >
                  Other…
                </Button>
              ) : null}
            </div>
            {picks[question.id] === FREE_TEXT_SENTINEL ? (
              <div className="pl-10">
                <Textarea
                  value={freeText[question.id] ?? ""}
                  onChange={(event) =>
                    handleFreeText(question.id, event.target.value)
                  }
                  placeholder="Describe your answer…"
                  className="min-h-20 bg-muted text-sm leading-6"
                />
              </div>
            ) : null}
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={onSkip}
            disabled={isSubmitting}
          >
            <SkipForwardIcon data-icon="inline-start" />
            Skip questions
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            <ArrowRightIcon data-icon="inline-start" />
            {isSubmitting ? "Generating" : "Generate brief"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
