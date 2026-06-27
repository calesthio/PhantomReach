"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building, FileText, TrendingUp, Users, MapPin, Briefcase, Calendar, Zap,
  Sparkles,
} from "lucide-react";
import type { BusinessIntelligenceResult, BusinessIntelligenceSignal } from "@/lib/db/types";
import { repairMojibakeText } from "@/lib/text/repair";

const iconMap: Record<BusinessIntelligenceSignal["icon_hint"], typeof Building> = {
  building: Building,
  "file-text": FileText,
  "trending-up": TrendingUp,
  users: Users,
  "map-pin": MapPin,
  briefcase: Briefcase,
  calendar: Calendar,
  zap: Zap,
};

const confidenceColors: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

interface IntelligenceCardProps {
  data: BusinessIntelligenceResult;
}

export function IntelligenceCard({ data }: IntelligenceCardProps) {
  if (data.signal_count === 0) return null;

  return (
    <Card className="relative overflow-hidden border-amber-200/60 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30">
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-bl from-amber-200/30 to-transparent rounded-bl-full" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Important Facts Uncovered</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.signal_count} intelligence signal{data.signal_count !== 1 ? "s" : ""} detected
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
            {data.signal_count} signal{data.signal_count !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Revealed signals */}
        {data.signals.map((signal, idx) => {
          const Icon = iconMap[signal.icon_hint] || Zap;
          return (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/80 border border-amber-100/80 shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100/80 text-amber-700 flex-shrink-0 mt-0.5">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{repairMojibakeText(signal.headline)}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${confidenceColors[signal.confidence]}`}
                  >
                    {signal.confidence}
                  </Badge>
                  {signal.pattern_name && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {repairMojibakeText(signal.pattern_name)}
                    </Badge>
                  )}
                  {signal.severity_score != null && signal.severity_score > 0 && (
                    <span className="text-[10px] text-muted-foreground" title="Severity score">
                      {signal.severity_score}/10
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {repairMojibakeText(signal.detail)}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {signal.signal_category && (
                    <span className="text-[10px] text-amber-600/80 capitalize">
                      {signal.signal_category.replace(/_/g, " ")}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/70">
                    Source: {repairMojibakeText(signal.source)}
                  </span>
                  {signal.date && (
                    <span className="text-[10px] text-muted-foreground/70">
                      · {new Date(signal.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      </CardContent>
    </Card>
  );
}
