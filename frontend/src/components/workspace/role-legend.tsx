"use client";

import { Crown, Shield, Pencil, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";
import { cn } from "@/lib/utils/cn";

interface Entry {
  role: WorkspaceRole;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  icon: LucideIcon;
  accent: string;
}

const ENTRIES: readonly Entry[] = [
  {
    role: "owner",
    labelKey: "workspace.roleOwner",
    descKey: "workspace.roleLegend.ownerDesc",
    icon: Crown,
    accent: "text-amber-500",
  },
  {
    role: "admin",
    labelKey: "workspace.roleAdmin",
    descKey: "workspace.roleLegend.adminDesc",
    icon: Shield,
    accent: "text-blue-500",
  },
  {
    role: "editor",
    labelKey: "workspace.roleMember",
    descKey: "workspace.roleLegend.editorDesc",
    icon: Pencil,
    accent: "text-emerald-500",
  },
  {
    role: "viewer",
    labelKey: "workspace.roleViewer",
    descKey: "workspace.roleLegend.viewerDesc",
    icon: Eye,
    accent: "text-[hsl(var(--muted-foreground))]",
  },
];

export function RoleLegend({ className }: { className?: string }) {
  const t = useT();
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3",
        className,
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {t("workspace.roleLegend.title")}
      </p>
      <ul className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
        {ENTRIES.map((e) => (
          <li key={e.role} className="flex items-start gap-2">
            <e.icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", e.accent)} />
            <span>
              <span className="font-medium">{t(e.labelKey)}</span>
              <span className="text-[hsl(var(--muted-foreground))]">
                {" "}
                — {t(e.descKey)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
