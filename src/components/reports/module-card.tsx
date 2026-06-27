"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { repairMojibakeText } from "@/lib/text/repair";
import { GradeBadge } from "./grade-badge";

interface ModuleCardProps {
  title: string;
  icon: React.ReactNode;
  grade?: string;
  score?: number;
  findings: string[];
  recommendations: string[];
  children?: React.ReactNode;
  isEstimated?: boolean;
  defaultCollapsed?: boolean;
  collapsedNotice?: string;
  summary?: string;
  badgeLabel?: string;
}

export function ModuleCard({
  title,
  icon,
  grade,
  score,
  findings,
  recommendations,
  children,
  isEstimated = false,
  defaultCollapsed = false,
  collapsedNotice,
  summary,
  badgeLabel = "Evidence details",
}: ModuleCardProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const collapsedSummary = summary || collapsedNotice;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                isEstimated ? "bg-muted/60 text-muted-foreground" : "bg-primary/10 text-primary",
              )}
            >
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg">{repairMojibakeText(title)}</CardTitle>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-medium mt-0.5",
                  isEstimated ? "text-amber-600/80" : "text-violet-500",
                )}
              >
                {isEstimated ? (
                  <span className="h-1 w-1 rounded-full bg-amber-400 inline-block" />
                ) : (
                  <Sparkles className="h-2.5 w-2.5" />
                )}
                {badgeLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {grade && <GradeBadge grade={grade} score={score} size="sm" />}
            {defaultCollapsed && (
              <button
                onClick={() => setExpanded((value) => !value)}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        {!expanded && collapsedSummary && (
          <p
            className={cn(
              "mt-2 text-xs rounded-md px-3 py-1.5",
              isEstimated
                ? "text-amber-700/80 bg-amber-50 border border-amber-100"
                : "text-slate-600 bg-slate-50 border border-slate-200",
            )}
          >
            {repairMojibakeText(collapsedSummary)}
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {children}

          {findings.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Key Findings</h4>
              <ul className="space-y-1">
                {findings.map((finding, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                    {repairMojibakeText(finding)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {recommendations.slice(0, 3).map((recommendation, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                        index === 0 ? "bg-red-400" : index === 1 ? "bg-yellow-400" : "bg-blue-400",
                      )}
                    />
                    {repairMojibakeText(recommendation)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
