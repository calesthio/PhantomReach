import { ExternalLink, SearchCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentResearchFinding, BusinessEnrichmentFact, BusinessEnrichmentResult } from "@/lib/db/types";
import { visibleCollectionNotes } from "@/lib/reports/enrichment-display";

function confidenceClass(confidence: "high" | "medium" | "low"): string {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "medium") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function SourceBadge({ source }: { source: { label: string; url?: string } }) {
  if (!source.url) {
    return <Badge variant="outline">{source.label}</Badge>;
  }

  return (
    <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex">
      <Badge variant="outline" className="gap-1 hover:bg-slate-50">
        {source.label}
        <ExternalLink className="h-3 w-3" />
      </Badge>
    </a>
  );
}

function FactRow({ fact }: { fact: BusinessEnrichmentFact }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{fact.label}</p>
          <p className="mt-1 text-base font-semibold text-slate-950">{fact.value}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SourceBadge source={fact.source} />
          <Badge variant="outline" className={confidenceClass(fact.confidence)}>
            {fact.confidence} confidence
          </Badge>
        </div>
      </div>
      {fact.detail && <p className="mt-2 text-sm leading-6 text-slate-600">{fact.detail}</p>}
      {fact.why_it_matters && <p className="mt-2 text-sm leading-6 text-slate-700">{fact.why_it_matters}</p>}
    </div>
  );
}

function ResearchRow({ finding }: { finding: AgentResearchFinding }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-sm font-medium text-slate-900">{finding.claim}</p>
        <div className="flex flex-wrap gap-2">
          <SourceBadge source={finding.source} />
          <Badge variant="outline" className={confidenceClass(finding.confidence)}>
            {finding.confidence} confidence
          </Badge>
          {finding.verified_status === "inferred" && <Badge variant="outline">inferred</Badge>}
        </div>
      </div>
      {finding.evidence_excerpt && (
        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
          {finding.evidence_excerpt}
        </p>
      )}
      <p className="mt-2 text-sm leading-6 text-slate-700">{finding.why_it_matters}</p>
    </div>
  );
}

export function BusinessContextCard({ enrichment }: { enrichment?: BusinessEnrichmentResult }) {
  if (!enrichment || (enrichment.facts.length === 0 && enrichment.research_findings.length === 0)) {
    return null;
  }

  const collectionNotes = visibleCollectionNotes(enrichment.warnings);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SearchCheck className="h-5 w-5 text-emerald-600" />
          Business & Market Context
        </CardTitle>
        <CardDescription>
          Public facts and cited research collected to sharpen this audit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrichment.facts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public Facts</p>
            <div className="grid gap-2 md:grid-cols-2">
              {enrichment.facts.slice(0, 8).map((fact) => (
                <FactRow key={fact.id} fact={fact} />
              ))}
            </div>
          </div>
        )}

        {enrichment.research_findings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cited Research</p>
            <div className="grid gap-2">
              {enrichment.research_findings.slice(0, 5).map((finding) => (
                <ResearchRow key={`${finding.source.url ?? finding.source.label}-${finding.claim}`} finding={finding} />
              ))}
            </div>
          </div>
        )}

        {collectionNotes.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collection Notes</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {collectionNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
