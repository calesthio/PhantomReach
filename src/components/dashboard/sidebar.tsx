"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileSearch,
  HardDrive,
  Settings,
  Zap,
} from "lucide-react";

interface SidebarProps {
  user: {
    name?: string;
    email: string;
  };
}

const navigation = [
  { name: "Audits", href: "/audits", icon: FileSearch },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Zap className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-foreground">Phantom Reach</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-4">
          Local Workspace
        </div>
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <button
              key={item.name}
              onClick={() => {
                router.push(item.href);
                router.refresh();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 text-left",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-lg bg-secondary/30 p-3 border border-border/50">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground font-medium">Runtime</span>
            <HardDrive className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Database</span>
              <span className="font-semibold text-foreground">SQLite</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Runs</span>
              <span className="font-semibold text-foreground">Local</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border/50">
            <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
              Unlimited local use
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">L</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.name || "Local Workspace"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
