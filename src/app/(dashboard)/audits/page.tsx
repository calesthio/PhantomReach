export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Calendar, ArrowRight, Activity, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth/server";
import type { AuditInput, ReportScores } from "@/lib/db/types";
import { GradeBadge } from "@/components/reports/grade-badge";
import { reportListActionLabel, reportStatusBadgeClass } from "@/lib/reports/report-list-display";

export default async function AuditsPage() {
  const user = await requireCurrentUser();

  // Fetch all reports for the user
  const reports = await db.getReportsByUser(user.id);
  const auditReports = reports.filter(r => r.type === "audit");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Audits</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your business intelligence reports.
          </p>
        </div>
        <Link href="/audits/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Audit
          </Button>
        </Link>
      </div>

      {auditReports.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No audits yet</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Run your first business audit to get a comprehensive intelligence report
              with AI-powered insights and recommendations.
            </p>
            <Link href="/audits/new" className="mt-6">
              <Button>Run Your First Audit</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        /* Audits List */
        <div className="grid gap-4">
          {auditReports.map((report) => {
            const input = report.input as AuditInput;
            const scores = report.scores as ReportScores | undefined;
            const isCompleted = report.status === "completed";
            const isFailed = report.status === "failed";

            return (
              <Card key={report.id} className="transition-all hover:bg-slate-50/50 hover:shadow-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex gap-6 items-center flex-1">
                      {scores ? (
                        <GradeBadge grade={scores.overall_grade} score={scores.overall_score} size="md" />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                          <Activity className="h-6 w-6 text-slate-400" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-slate-900">{input.businessName}</h3>
                          <Badge
                            variant={isCompleted || isFailed ? "default" : "secondary"}
                            className={reportStatusBadgeClass(report.status)}
                          >
                            {report.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {input.city ? `${input.city}, ${input.state}` : "Location N/A"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(report.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-auto flex justify-end">
                      {isCompleted ? (
                        <Link href={`/audits/${report.id}`}>
                          <Button variant="secondary" className="w-full md:w-auto">
                            View Report <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" disabled className="w-full md:w-auto bg-slate-50">
                          {reportListActionLabel(report.status)}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
