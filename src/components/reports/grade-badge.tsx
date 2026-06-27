import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Color mapping for both legacy single-letter grades AND new descriptive labels
// ---------------------------------------------------------------------------

/** Map a grade string to its color classes */
function getGradeColors(grade: string): string {
  // Legacy single-letter grades
  const letterColors: Record<string, string> = {
    A: "bg-green-100 text-green-800 border-green-200",
    B: "bg-blue-100 text-blue-800 border-blue-200",
    C: "bg-yellow-100 text-yellow-800 border-yellow-200",
    D: "bg-orange-100 text-orange-800 border-orange-200",
    F: "bg-red-100 text-red-800 border-red-200",
  };

  // Direct letter match
  if (letterColors[grade]) return letterColors[grade];

  // Context-aware label matching (from scoring.ts)
  const g = grade.toLowerCase();
  if (g.includes("strong") || g.includes("excellent") || g.includes("leading") || g.includes("leader")) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (g.includes("solid") || g.includes("good") || g.includes("well positioned") || g.includes("competitive")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (g.includes("developing") || g.includes("emerging") || g.includes("growing") || g.includes("building")) {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }
  if (g.includes("needs") || g.includes("attention") || g.includes("opportunity") || g.includes("lagging")) {
    return "bg-orange-100 text-orange-800 border-orange-200";
  }

  // Fallback: use score-based coloring if available, otherwise neutral
  return "bg-slate-100 text-slate-800 border-slate-200";
}

/** Check if grade is a single character (legacy A-F) */
function isLetterGrade(grade: string): boolean {
  return /^[A-F]$/i.test(grade.trim());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GradeBadgeProps {
  grade: string;
  score?: number;
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
}

export function GradeBadge({ grade, score, size = "md", showScore = true }: GradeBadgeProps) {
  const isLetter = isLetterGrade(grade);

  // For single-letter grades: square badge with large letter
  // For descriptive labels: wider rounded badge with text
  if (isLetter) {
    const sizeClasses = {
      sm: "h-8 w-8 text-sm",
      md: "h-12 w-12 text-xl",
      lg: "h-20 w-20 text-4xl",
    };

    return (
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex items-center justify-center rounded-lg border-2 font-bold flex-shrink-0",
            sizeClasses[size],
            getGradeColors(grade)
          )}
        >
          {grade}
        </div>
        {showScore && score !== undefined && (
          <span className="text-sm text-muted-foreground">{score}/100</span>
        )}
      </div>
    );
  }

  // Descriptive label badge (context-aware scoring)
  const labelSizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border-2 font-semibold whitespace-nowrap flex-shrink-0",
          labelSizeClasses[size],
          getGradeColors(grade)
        )}
      >
        {grade}
      </div>
      {showScore && score !== undefined && (
        <span className="text-sm text-muted-foreground">{score}/100</span>
      )}
    </div>
  );
}
