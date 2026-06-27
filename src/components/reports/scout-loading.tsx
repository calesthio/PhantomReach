"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
    MapPin, Globe, Users, Trophy, DollarSign, Brain, Lightbulb, FileText,
    CheckCircle2, Loader2, Radar, Rocket, Search, BarChart3, Zap,
    TrendingUp, Camera, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Report } from "@/lib/db/types";

/* ------------------------------------------------------------------ */
/*  Step definitions — mirror the v3 scout pipeline phases             */
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
    { id: "init",       label: "Initializing market scan",     detail: "Setting up intelligence pipeline for market analysis",                         icon: Rocket,       duration: 2000 },
    { id: "search",     label: "Discovering businesses",       detail: "Searching Google Maps for businesses in this category",                        icon: Search,       duration: 4000 },
    { id: "enrich",     label: "Enriching business profiles",  detail: "Fetching websites, photos, and contact details via Place Details",             icon: Camera,       duration: 6000 },
    { id: "website",    label: "Probing digital presence",     detail: "Testing website speed, SEO basics, and security posture",                      icon: Globe,        duration: 5000 },
    { id: "intel",      label: "Gathering growth signals",     detail: "Checking corporate filings, SSL certs, and DNS records",                       icon: Lightbulb,    duration: 5000 },
    { id: "census",     label: "Analyzing market demographics", detail: "Pulling Census Bureau income data for service area",                          icon: MapPin,       duration: 3000 },
    { id: "crux",       label: "Measuring real-user performance", detail: "Querying Chrome UX Report for field data on each site",                     icon: ShieldCheck,  duration: 4000 },
    { id: "scores",     label: "Computing opportunity scores",  detail: "Calculating demand, execution risk, and arbitrage potential",                  icon: BarChart3,    duration: 3000 },
    { id: "snapshot",   label: "Building market snapshot",      detail: "Aggregating market-level metrics and heat index",                             icon: TrendingUp,   duration: 2000 },
    { id: "classify",   label: "Classifying opportunities",     detail: "Sorting businesses into strategic opportunity buckets",                       icon: Trophy,       duration: 2000 },
    { id: "ai",         label: "AI strategic analysis",         detail: "Frontier model writing hook lines and identifying warm leads",                 icon: Brain,        duration: 15000 },
    { id: "insights",   label: "Generating market intelligence", detail: "Synthesizing city-level insights and opportunity distribution",              icon: Zap,          duration: 5000 },
    { id: "assemble",   label: "Assembling scout report",       detail: "Packaging ranked opportunity cards and market summary",                       icon: FileText,     duration: 2000 },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ScoutLoadingProps {
    /** Optional — can be undefined while the API call to create the report is still in-flight */
    reportId?: string;
    city: string;
    category: string;
    onComplete: (report: Report) => void;
}

export function ScoutLoading({ reportId, city, category, onComplete }: ScoutLoadingProps) {
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
        if (!reportId) return;

        try {
            const res = await fetch(`/api/report/${reportId}`);
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
        if (!reportId) return;

        const interval = setInterval(poll, 3000);
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
        <div className="mx-auto max-w-2xl py-8 px-4">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="text-center mb-8">
                <div className="relative inline-flex items-center justify-center mb-4">
                    <div className="absolute h-16 w-16 rounded-full bg-blue-600/20 animate-ping" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10">
                        <Radar className="h-8 w-8 text-blue-600 animate-spin" style={{ animationDuration: "3s" }} />
                    </div>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                    Scanning {category}
                </h2>
                <p className="text-muted-foreground mt-1">in {city}</p>
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
                    className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
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
                                    ? "bg-blue-50 border border-blue-100"
                                    : status === "done"
                                        ? "opacity-60"
                                        : "opacity-30"
                                }`}
                        >
                            {/* Icon */}
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 transition-colors duration-500 ${status === "active"
                                    ? "bg-blue-600 text-white"
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
                                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Footer tip ─────────────────────────────────────────────── */}
            {!reportReady && (
                <p className="text-center text-xs text-muted-foreground mt-8">
                    Market intelligence scans typically take 1&ndash;2 minutes. Our AI is probing each business&apos;s
                    digital infrastructure, analyzing market demographics, and identifying warm lead opportunities.
                    You can leave this page &mdash; we&apos;ll save the report.
                </p>
            )}
        </div>
    );
}
