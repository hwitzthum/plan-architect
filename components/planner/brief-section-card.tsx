import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BriefSectionCardProps = {
  title: string;
  description: string;
  numeral?: string;
  anchor?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function BriefSectionCard({
  title,
  description,
  numeral,
  anchor,
  actions,
  children,
}: BriefSectionCardProps) {
  return (
    <Card className="paper-card section-card">
      <CardHeader className="gap-4 px-8 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-4">
            {(numeral || anchor) && (
              <div className="flex items-center gap-3">
                {numeral ? (
                  <span className="numeral-eyebrow">{numeral}.</span>
                ) : null}
                {anchor ? (
                  <span className="section-anchor">{anchor}</span>
                ) : null}
              </div>
            )}
            <CardTitle className="font-display text-2xl font-normal tracking-[-0.02em]">
              {title}
            </CardTitle>
            <CardDescription className="leading-7">
              {description}
            </CardDescription>
          </div>
          {actions ? <div className="flex shrink-0">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="px-8 pb-8">{children}</CardContent>
    </Card>
  );
}
