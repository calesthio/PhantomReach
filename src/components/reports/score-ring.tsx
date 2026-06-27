"use client";

import { useEffect, useState } from "react";

const gradeConfig: Record<string, { color: string; darkColor: string; trackColor: string; darkTrackColor: string; label: string }> = {
  // New context-aware grade labels
  Strong: { color: "#16a34a", darkColor: "#4ade80", trackColor: "#dcfce7", darkTrackColor: "rgba(255,255,255,0.15)", label: "Strong" },
  Solid: { color: "#2563eb", darkColor: "#60a5fa", trackColor: "#dbeafe", darkTrackColor: "rgba(255,255,255,0.15)", label: "Solid" },
  Developing: { color: "#ca8a04", darkColor: "#facc15", trackColor: "#fef9c3", darkTrackColor: "rgba(255,255,255,0.15)", label: "Developing" },
  "Needs Attention": { color: "#ea580c", darkColor: "#fb923c", trackColor: "#ffedd5", darkTrackColor: "rgba(255,255,255,0.15)", label: "Needs Attention" },
  // Legacy A-F grades (backward compat)
  A: { color: "#16a34a", darkColor: "#4ade80", trackColor: "#dcfce7", darkTrackColor: "rgba(255,255,255,0.15)", label: "Excellent" },
  B: { color: "#2563eb", darkColor: "#60a5fa", trackColor: "#dbeafe", darkTrackColor: "rgba(255,255,255,0.15)", label: "Good" },
  C: { color: "#ca8a04", darkColor: "#facc15", trackColor: "#fef9c3", darkTrackColor: "rgba(255,255,255,0.15)", label: "Fair" },
  D: { color: "#ea580c", darkColor: "#fb923c", trackColor: "#ffedd5", darkTrackColor: "rgba(255,255,255,0.15)", label: "Needs Work" },
  F: { color: "#dc2626", darkColor: "#f87171", trackColor: "#fee2e2", darkTrackColor: "rgba(255,255,255,0.15)", label: "Critical" },
};

interface ScoreRingProps {
  score: number;
  grade: string;
  size?: number;
  /** Use "dark" when rendering on a colored background (e.g. the purple hero). */
  variant?: "light" | "dark";
}

export function ScoreRing({ score, grade, size = 140, variant = "light" }: ScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const config = gradeConfig[grade] || gradeConfig.F;
  const isDark = variant === "dark";

  const strokeColor = isDark ? config.darkColor : config.color;
  const trackStroke = isDark ? config.darkTrackColor : config.trackColor;
  const numberColor = isDark ? "#ffffff" : config.color;

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    let frame: number;
    const duration = 1200;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-2 animate-score-appear">
      <div style={{ width: size, height: size }} className="relative">
        <svg viewBox="0 0 100 100" className="transform -rotate-90" width={size} height={size}>
          {/* Track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={trackStroke}
            strokeWidth="8"
          />
          {/* Progress */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tracking-tight" style={{ color: numberColor }}>
            {animatedScore}
          </span>
          <span className={`text-xs -mt-0.5 ${isDark ? "text-white/50" : "text-muted-foreground"}`}>/ 100</span>
        </div>
      </div>
      <div
        className="text-xs font-semibold px-3 py-1 rounded-full"
        style={isDark
          ? { color: config.darkColor, backgroundColor: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }
          : { color: config.color, backgroundColor: config.trackColor }
        }
      >
        {config.label}
      </div>
    </div>
  );
}
