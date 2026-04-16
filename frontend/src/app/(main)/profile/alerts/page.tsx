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

const TYPE_LABEL: Record<AlertRuleType, string> = {
  failure_rate: "실패율 (%)",
  duration: "평균 실행 시간 (ms)",
  llm_cost: "LLM 비용 (USD/일)",
};

export default function AlertsPage() {
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
      toast.success("알림 규칙을 만들었어요.");
      setThreshold("10");
      queryClient.invalidateQueries({ queryKey: ["alerts", "list"] });
    },
    onError: () => toast.error("규칙 생성 실패"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => alertsApi.remove(id),
    onSuccess: () => {
      toast.success("규칙을 삭제했어요.");
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
        <h1 className="text-3xl font-bold">알림 규칙</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          실패율·실행 시간·LLM 비용이 임계값을 넘으면 앱 내 알림을 받아요.
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">새 규칙</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!Number.isFinite(Number(threshold))) {
                  toast.error("임계값은 숫자여야 해요.");
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
                <option value="failure_rate">실패율 (%)</option>
                <option value="duration">평균 실행 시간 (ms)</option>
                <option value="llm_cost">LLM 비용 (USD/일)</option>
              </select>
              <Input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="임계값"
                className="sm:max-w-[140px]"
              />
              <Input
                value={windowSpec}
                onChange={(e) => setWindowSpec(e.target.value)}
                placeholder="윈도우 (ISO 8601, 예: PT1H)"
                className="sm:max-w-[180px]"
              />
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                만들기
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">규칙 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {rulesQuery.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : !rulesQuery.data?.length ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              아직 규칙이 없어요.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">유형</th>
                    <th className="py-2 pr-4 text-right font-medium text-[hsl(var(--muted-foreground))]">임계값</th>
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">윈도우</th>
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">상태</th>
                    <th className="py-2 text-right font-medium text-[hsl(var(--muted-foreground))]"></th>
                  </tr>
                </thead>
                <tbody>
                  {rulesQuery.data.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[hsl(var(--border))] last:border-b-0"
                    >
                      <td className="py-2 pr-4">{TYPE_LABEL[r.type]}</td>
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
                              {r.enabled ? "enabled" : "disabled"}
                            </Badge>
                          </button>
                        ) : (
                          <Badge variant="outline">
                            {r.enabled ? "enabled" : "disabled"}
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
                            title="삭제"
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
