"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  alertsApi,
  type AlertRule,
  type AlertRuleType,
} from "@/lib/api/alerts";
import { useHasRole } from "@/components/auth/role-gate";
import { useT, type TranslationKey } from "@/lib/i18n";

const TYPE_LABEL_KEY: Record<AlertRuleType, TranslationKey> = {
  failure_rate: "profile.alerts.typeFailureRate",
  duration: "profile.alerts.typeDuration",
  llm_cost: "profile.alerts.typeLlmCost",
};

export default function AlertsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const isAdmin = useHasRole("admin");
  const [type, setType] = useState<AlertRuleType>("failure_rate");
  const [threshold, setThreshold] = useState("10");
  const [windowSpec, setWindowSpec] = useState("PT1H");

  const rulesQuery = useQuery<AlertRule[]>({
    queryKey: ["alerts", "list"],
    queryFn: () => alertsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      alertsApi.create({
        type,
        threshold: Number(threshold),
        window: windowSpec,
      }),
    onSuccess: () => {
      toast.success(t("profile.alerts.createdToast"));
      setThreshold("10");
      queryClient.invalidateQueries({ queryKey: ["alerts", "list"] });
    },
    onError: () => toast.error(t("profile.alerts.createFailedToast")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => alertsApi.remove(id),
    onSuccess: () => {
      toast.success(t("profile.alerts.deletedToast"));
      queryClient.invalidateQueries({ queryKey: ["alerts", "list"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      alertsApi.update(id, { enabled }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["alerts", "list"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("profile.alerts.pageTitle")}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t("profile.alerts.pageDescription")}
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("profile.alerts.newRule")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!Number.isFinite(Number(threshold))) {
                  toast.error(t("profile.alerts.thresholdMustBeNumber"));
                  return;
                }
                createMutation.mutate();
              }}
            >
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AlertRuleType)}
                className="h-9 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm"
              >
                <option value="failure_rate">{t("profile.alerts.typeFailureRate")}</option>
                <option value="duration">{t("profile.alerts.typeDuration")}</option>
                <option value="llm_cost">{t("profile.alerts.typeLlmCost")}</option>
              </select>
              <Input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder={t("profile.alerts.thresholdPlaceholderInput")}
                className="sm:max-w-[140px]"
              />
              <Input
                value={windowSpec}
                onChange={(e) => setWindowSpec(e.target.value)}
                placeholder={t("profile.alerts.windowPlaceholder")}
                className="sm:max-w-[180px]"
              />
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("profile.alerts.createBtn")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t("profile.alerts.rulesList")}</CardTitle>
        </CardHeader>
        <CardContent>
          {rulesQuery.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : !rulesQuery.data?.length ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("profile.alerts.noneYet")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">{t("profile.alerts.columnType")}</th>
                    <th className="py-2 pr-4 text-right font-medium text-[hsl(var(--muted-foreground))]">{t("profile.alerts.columnThreshold")}</th>
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">{t("profile.alerts.columnWindow")}</th>
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">{t("profile.alerts.columnStatus")}</th>
                    <th className="py-2 text-right font-medium text-[hsl(var(--muted-foreground))]"></th>
                  </tr>
                </thead>
                <tbody>
                  {rulesQuery.data.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[hsl(var(--border))] last:border-b-0"
                    >
                      <td className="py-2 pr-4">{t(TYPE_LABEL_KEY[r.type])}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.threshold}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{r.window}</td>
                      <td className="py-2 pr-4">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() =>
                              toggleMutation.mutate({
                                id: r.id,
                                enabled: !r.enabled,
                              })
                            }
                          >
                            <Badge variant={r.enabled ? "success" : "outline"}>
                              {r.enabled ? t("profile.alerts.statusEnabled") : t("profile.alerts.statusDisabled")}
                            </Badge>
                          </button>
                        ) : (
                          <Badge variant="outline">
                            {r.enabled ? t("profile.alerts.statusEnabled") : t("profile.alerts.statusDisabled")}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeMutation.mutate(r.id)}
                            title={t("profile.alerts.deleteTooltip")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
