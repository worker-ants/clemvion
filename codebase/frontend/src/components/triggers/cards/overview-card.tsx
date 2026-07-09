import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { triggersApi, type TriggerDetail } from "@/lib/api/triggers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n";
import { useWorkspaceSlug } from "@/lib/workspace/use-workspace-slug";
import { buildEditorHref } from "@/lib/workspace/href";
import { useHasRole } from "@/components/auth/role-gate";
import { Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useCardEditToggle } from "../hooks/use-card-edit-toggle";

const TYPE_BADGE_STYLES: Record<string, string> = {
  webhook: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  schedule: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manual: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function OverviewCard({
  trigger,
  onSaved,
}: {
  trigger: TriggerDetail;
  onSaved: () => void;
}) {
  const t = useT();
  const slug = useWorkspaceSlug();
  const canEdit = useHasRole("editor");
  const { editing, setEditing, cancelEdit } = useCardEditToggle();
  const [nameValue, setNameValue] = useState(trigger.name);

  const updateMutation = useMutation({
    mutationFn: async (name: string) => {
      await triggersApi.update(trigger.id, { name });
    },
    onSuccess: () => {
      toast.success(t("triggers.detail.saved"));
      setEditing(false);
      onSaved();
    },
    onError: () => {
      toast.error(t("triggers.detail.saveFailed"));
    },
  });

  function startEdit() {
    setNameValue(trigger.name);
    setEditing(true);
  }

  const saveDisabled =
    updateMutation.isPending ||
    nameValue.trim().length === 0 ||
    nameValue.trim() === trigger.name;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {t("triggers.detail.sectionOverview")}
        </CardTitle>
        {canEdit && !editing && (
          <Button size="sm" variant="ghost" onClick={startEdit} aria-label={t("triggers.detail.edit")}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {editing && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancelEdit(() => setNameValue(trigger.name))}
              disabled={updateMutation.isPending}
            >
              {t("triggers.detail.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate(nameValue.trim())}
              disabled={saveDisabled}
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {updateMutation.isPending
                ? t("triggers.detail.saving")
                : t("triggers.detail.save")}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.detail.nameLabel")}
            </dt>
            <dd className="font-medium">
              {editing ? (
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder={t("triggers.detail.namePlaceholder")}
                  className="h-8 w-56 text-right"
                  maxLength={255}
                />
              ) : (
                trigger.name
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.type")}
            </dt>
            <dd>
              <span
                className={cn(
                  "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TYPE_BADGE_STYLES[trigger.type],
                )}
              >
                {trigger.type === "webhook"
                  ? t("triggers.typeWebhook")
                  : trigger.type === "schedule"
                    ? t("triggers.typeSchedule")
                    : t("triggers.typeManual")}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.status")}
            </dt>
            <dd>
              <Badge variant={trigger.isActive ? "success" : "outline"}>
                {trigger.isActive
                  ? t("triggers.statusActive")
                  : t("triggers.statusInactive")}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.workflow")}
            </dt>
            <dd>
              <Link
                href={buildEditorHref(slug, trigger.workflowId)}
                className="text-[hsl(var(--primary))] hover:underline"
              >
                {trigger.workflowName}
              </Link>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
