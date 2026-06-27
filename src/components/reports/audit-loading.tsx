"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MapPin, Star, Globe, Cpu, Users, BookOpen, Trophy, DollarSign,
  Brain, Lightbulb, FileText, CheckCircle2, Loader2, Radar, Rocket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Report } from "@/lib/db/types";

/* ------------------------------------------------------------------ */
/*  Step definitions — roughly mirror the audit pipeline phases        */
/* ------------------------------------------------------------------ */

type StepStatus = "waiting" | "active" | "done";

interface AnalysisStep {
  id: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Simulated duration in ms before moving to next step */
  duration: number;
}

const STEPS: AnalysisStep[] = [
  { id: "init", label: "Initializing audit", detail: "Setting up analysis pipeline and validating inputs", icon: Rocket, duration: 5000 },
  { id: "locate", label: "Locating business", detail: "Searching Google Maps for profile and coordinates", icon: MapPin, duration: 8000 },
  { id: "understand", label: "Understanding the business", detail: "AI building deep expertise about this business category", icon: Brain, duration: 25000 },
  { id: "gbp", label: "Analyzing GBP profile", detail: "Checking hours, photos, attributes, and completeness", icon: MapPin, duration: 12000 },
  { id: "reviews", label: "Scanning customer reviews", detail: "Reading review themes, sentiment, and response patterns", icon: Star, duration: 15000 },
  { id: "website", label: "Testing website speed", detail: "Running Lighthouse audit on Core Web Vitals and SEO", icon: Globe, duration: 18000 },
  { id: "tech", label: "Detecting tech stack", detail: "Identifying CMS, analytics, booking, and payment tools", icon: Cpu, duration: 10000 },
  { id: "social", label: "Checking social presence", detail: "Probing Facebook, Instagram, LinkedIn, and more", icon: Users, duration: 12000 },
  { id: "citations", label: "Verifying directory listings", detail: "Checking NAP consistency across 20+ directories", icon: BookOpen, duration: 10000 },
  { id: "competitors", label: "Mapping real competitors", detail: "AI searching for real competitors in the same vertical", icon: Trophy, duration: 15000 },
  { id: "revenue", label: "Calculating business impact", detail: "Estimating impact signals from identified gaps", icon: DollarSign, duration: 10000 },
  { id: "intel", label: "Uncovering business intel", detail: "Cross-referencing corporate filings and growth signals", icon: Lightbulb, duration: 12000 },
  { id: "ai", label: "AI deep analysis", detail: "Frontier model synthesizing all data with industry expertise", icon: Brain, duration: 60000 },
  { id: "narrative", label: "Writing executive summary", detail: "Crafting consultant-grade narrative from analysis", icon: FileText, duration: 45000 },
  { id: "assemble", label: "Assembling final report", detail: "Scoring, ranking recommendations, and packaging", icon: CheckCircle2, duration: 8000 },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface AuditLoadingProps {
  /** Optional — can be undefined while the API call to create the report is still in-flight */
  reportId?: string;
  businessName: string;
  city?: string;
  onComplete: (report: Report) => void;
  /** Optional — called if the API creation itself fails (only relevant from loading page) */
  onError?: (message: string) => void;
}

export function AuditLoading({ reportId, businessName, city, onComplete }: AuditLoadingProps) {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    STEPS.map((_, i) => (i === 0 ? "active" : "waiting"))
  );
  const [elapsed, setElapsed] = useState(0);
  const [reportReady, setReportReady] = useState(false);
  const startTime = useRef(Date.now());
  const activeStepRef = useRef(0);

  // ── Simulated step progression ────────────────────────────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function advanceStep() {
      const current = activeStepRef.current;
      if (current >= STEPS.length - 1) return; // stay on last step until report is ready

      setStepStatuses((prev) => {
        const next = [...prev];
        next[current] = "done";
        next[current + 1] = "active";
        return next;
      });
      activeStepRef.current = current + 1;

      // Schedule next step
      if (current + 1 < STEPS.length - 1) {
        timeout = setTimeout(advanceStep, STEPS[current + 1].duration);
      }
    }

    timeout = setTimeout(advanceStep, STEPS[0].duration);
    return () => clearTimeout(timeout);
  }, []);

  // ── Elapsed timer ─────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Poll for completion (only when reportId is available) ─────────
  const poll = useCallback(async () => {
    if (!reportId) return; // can't poll yet — API hasn't returned reportId

    try {
      const res = await fetch(`/api/report/${reportId}`, {
        cache: "no-store",
        next: { revalidate: 0 },
      });
      if (!res.ok) return;
      const data: Report = await res.json();

      if (data.status === "completed" || data.status === "failed") {
        // Mark all steps done
        setStepStatuses(STEPS.map(() => "done"));
        setReportReady(true);

        // Brief pause for the "complete" animation, then hand off
        setTimeout(() => onComplete(data), 1200);
      }
    } catch {
      // silent — will retry on next interval
    }
  }, [reportId, onComplete]);

  useEffect(() => {
    if (!reportId) return; // don't start polling until we have a reportId

    const interval = setInterval(poll, 3000);
    // Also poll immediately
    poll();
    return () => clearInterval(interval);
  }, [poll, reportId]);

  // ── Helpers ───────────────────────────────────────────────────────
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const doneCount = stepStatuses.filter((s) => s === "done").length;
  const progress = Math.round((doneCount / STEPS.length) * 100);

  return (
    <div className="mx-auto max-w-2xl py-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="relative inline-flex items-center justify-center mb-4">
          <div className="absolute h-16 w-16 rounded-full bg-primary/20 animate-ping" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Radar className="h-8 w-8 text-primary animate-spin" style={{ animationDuration: "3s" }} />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Analyzing {businessName}
        </h2>
        {city && (
          <p className="text-muted-foreground mt-1">{city}</p>
        )}
        <div className="flex items-center justify-center gap-4 mt-3">
          <Badge variant="secondary" className="tabular-nums">
            {formatTime(elapsed)} elapsed
          </Badge>
          {!reportReady && (
            <Badge variant="outline" className="tabular-nums">
              {progress}% complete
            </Badge>
          )}
          {reportReady && (
            <Badge className="bg-green-100 text-green-800">
              Report ready
            </Badge>
          )}
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────── */}
      <div className="h-1.5 rounded-full bg-secondary mb-8 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${reportReady ? 100 : progress}%` }}
        />
      </div>

      {/* ── Step timeline ──────────────────────────────────────────── */}
      <div className="space-y-1">
        {STEPS.map((step, i) => {
          const status = stepStatuses[i];
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-500 ${status === "active"
                  ? "bg-primary/5 border border-primary/20"
                  : status === "done"
                    ? "opacity-60"
                    : "opacity-30"
                }`}
            >
              {/* Icon */}
              <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 transition-colors duration-500 ${status === "active"
                  ? "bg-primary text-primary-foreground"
                  : status === "done"
                    ? "bg-green-100 text-green-700"
                    : "bg-secondary text-muted-foreground"
                }`}>
                {status === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status === "done" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${status === "active" ? "text-foreground" : "text-muted-foreground"
                  }`}>
                  {step.label}
                </p>
                {status === "active" && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {step.detail}
                  </p>
                )}
              </div>

              {/* Status indicator */}
              {status === "active" && (
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer tip ─────────────────────────────────────────────── */}
      {!reportReady && (
        <p className="text-center text-xs text-muted-foreground mt-8">
          Deep audits typically take 4&ndash;6 minutes. Our AI is researching your business, analyzing competitors, and writing a consultant-grade report. You can leave this page &mdash; we&apos;ll save the report.
        </p>
      )}
    </div>
  );
}
