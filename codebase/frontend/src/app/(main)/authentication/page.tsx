"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SlideDrawer } from "@/components/ui/slide-drawer";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Inbox,
  Trash2,
  X,
  RefreshCw,
  Copy,
  Eye,
  Pencil,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useT, type TranslationKey } from "@/lib/i18n";
import { useHasRole } from "@/components/auth/role-gate";
import {
  buildAuthConfigPayload,
  buildAuthConfigUpdatePayload,
} from "./auth-config-form";
import {
  type AuthConfig,
  type AuthConfigUsage,
  AUTH_TYPES,
  pickPlaintextSecret,
} from "./auth-config-types";
import { useAuthConfigForm } from "./use-auth-config-form";
import { AuthConfigCreateForm } from "./auth-config-create-form";
import { AuthConfigEditDialog } from "./auth-config-edit-dialog";

/** 1회 노출된 평문 비밀값을 자동으로 비우기까지의 시간(ms). reveal·create/regenerate 공통. */
const SECRET_AUTOCLEAR_MS = 30_000;

// 목록 type 배지 라벨 — AUTH_TYPES 단일 SoT 에서 파생(중복 정의 방지).
const TYPE_LABEL_KEYS = Object.fromEntries(
  AUTH_TYPES.map((opt) => [opt.value, opt.labelKey]),
) as Record<string, TranslationKey>;

// usage 호출 이력 status → Badge variant. 미등록 status 는 사용처에서 "outline" 폴백.
// (page 전용 — lib/utils/execution-status.ts 의 동명 상수와 값 집합이 달라 export 하지 않는다.)
const STATUS_BADGE_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "outline"
> = {
  completed: "success",
  running: "warning",
  failed: "destructive",
  pending: "outline",
};

export default function AuthenticationPage() {
  const t = useT();
  const queryClient = useQueryClient();
  // AuthConfig mutation/reveal 은 Admin+ 만 (spec/5-system/1-auth.md §3.2 RBAC:
  // Editor/Viewer = R). 백엔드가 @Roles('admin') 로 강제하나, UI 에서도 가려
  // 비-admin 의 403 혼란을 막는다. Reveal·Edit 진입 버튼에 동일 적용.
  const isAdmin = useHasRole("admin");
  // 생성/편집 폼 상태·검증·다이얼로그 제어는 전용 훅으로 통합 (useState 11개 + dialogMode 분기).
  const form = useAuthConfigForm();
  // generatedKey 자동 클리어 effect 가 안정적 deps 를 갖도록 primitive·setter 만 구조분해.
  const { generatedKey, setGeneratedKey } = form;
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<string | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  // Reveal 흐름.
  const [revealTarget, setRevealTarget] = useState<string | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  // 1회 노출되는 평문(create/regenerate 의 generatedKey, reveal 의 revealedSecret)은
  // 30초 후 자동으로 비운다 — 화면 방치 시 평문 노출 시간을 제한 (단일 정책,
  // spec/2-navigation/6-config.md §A.4). 언마운트·값 변경 시 타이머를 정리해
  // 누수·stale clear 를 막는다 (useEffect cleanup).
  // generatedKey 는 useAuthConfigForm 훅이 보유한다 — 자동 클리어 타이머만 여기서 건다.
  useEffect(() => {
    if (!generatedKey) return;
    const timer = window.setTimeout(
      () => setGeneratedKey(null),
      SECRET_AUTOCLEAR_MS,
    );
    return () => window.clearTimeout(timer);
  }, [generatedKey, setGeneratedKey]);

  useEffect(() => {
    if (!revealedSecret) return;
    const timer = window.setTimeout(
      () => setRevealedSecret(null),
      SECRET_AUTOCLEAR_MS,
    );
    return () => window.clearTimeout(timer);
  }, [revealedSecret]);

  const { data: configs = [], isLoading, isError } = useQuery<AuthConfig[]>({
    queryKey: ["auth-configs"],
    queryFn: async () => {
      const res = await apiClient.get("/auth-configs");
      return res.data.data ?? res.data;
    },
  });

  const selectedConfig = configs.find((c) => c.id === selectedConfigId) ?? null;

  const {
    data: usageData,
    isLoading: isUsageLoading,
    isError: isUsageError,
  } = useQuery<AuthConfigUsage>({
    queryKey: ["auth-config-usage", selectedConfigId],
    queryFn: async () => {
      const res = await apiClient.get(`/auth-configs/${selectedConfigId}/usage`);
      return res.data.data ?? res.data;
    },
    enabled: !!selectedConfigId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // 페이로드 조립은 순수 함수로 위임 (auth-config-form.ts) — 단위 테스트 대상.
      const payload = buildAuthConfigPayload(form.collectFormState());
      const res = await apiClient.post("/auth-configs", payload);
      return (res.data.data ?? res.data) as AuthConfig;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.configCreated"));
      // 자동 발급된 평문(api_key/bearer/hmac)을 1회 표시. basic_auth 는 사용자 입력이라 없음.
      const secret = pickPlaintextSecret(data?.config);
      form.setGeneratedKey(secret);
      if (!secret) {
        form.close();
      }
    },
    onError: () => {
      toast.error(t("authentication.configCreateFailed"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      // type·비밀값은 불변 — non-secret config(headerName 등) + IP 만 PATCH.
      // 백엔드가 config 를 shallow-merge 하므로 암호화 비밀값은 보존된다.
      const payload = buildAuthConfigUpdatePayload(form.collectFormState());
      await apiClient.patch(`/auth-configs/${form.editTargetId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.configUpdated"));
      form.close();
    },
    onError: () => {
      toast.error(t("authentication.configUpdateFailed"));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiClient.patch(`/auth-configs/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.configUpdated"));
    },
    onError: () => {
      toast.error(t("authentication.configUpdateFailed"));
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/auth-configs/${id}/regenerate`);
      return (res.data.data ?? res.data) as AuthConfig;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.keyRegenerated"));
      const secret = pickPlaintextSecret(data?.config);
      if (secret) form.setGeneratedKey(secret);
      setRegenerateTarget(null);
    },
    onError: () => {
      toast.error(t("authentication.keyRegenerateFailed"));
      setRegenerateTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/auth-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.configDeleted"));
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error(t("authentication.configDeleteFailed"));
    },
  });

  const revealMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const res = await apiClient.post(`/auth-configs/${id}/reveal`, {
        password,
      });
      return (res.data.data ?? res.data) as { config: Record<string, unknown> };
    },
    onSuccess: (data) => {
      const secret = pickPlaintextSecret(data?.config);
      setRevealedSecret(secret);
      setRevealTarget(null);
      setRevealPassword("");
      // 30초 자동 hide 는 revealedSecret useEffect 가 처리 (언마운트 cleanup 포함).
    },
    onError: () => {
      toast.error(t("authentication.revealFailed"));
    },
  });

  function handleUpdate() {
    form.validateAndProceed(() => updateMutation.mutate());
  }

  function handleCreate() {
    form.validateAndProceed(() => createMutation.mutate(), {
      requireType: true,
      requirePassword: true,
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(t("authentication.copiedClipboard")),
      () => toast.error(t("authentication.copyFailed")),
    );
  }

  function handleRowClick(configId: string) {
    setSelectedConfigId(configId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("authentication.title")}</h1>
        <Button onClick={form.openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("authentication.addConfig")}
        </Button>
      </div>

      {/* Create / Edit — 단일-목적 컴포넌트로 분리 (이전 dialogMode 분기 다이얼로그). */}
      {form.mode === "create" && (
        <AuthConfigCreateForm
          form={form}
          isPending={createMutation.isPending}
          onCreate={handleCreate}
          onCopy={copyToClipboard}
        />
      )}
      {form.mode === "edit" && (
        <AuthConfigEditDialog
          form={form}
          isPending={updateMutation.isPending}
          onUpdate={handleUpdate}
        />
      )}

      {/* Regenerate Confirmation */}
      {regenerateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">
              {t("authentication.regenerateTitle")}
            </h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("authentication.regenerateMessage")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRegenerateTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={regenerateMutation.isPending}
                onClick={() => regenerateMutation.mutate(regenerateTarget)}
              >
                {regenerateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("authentication.regenerateButton")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reveal Password Confirmation */}
      {revealTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">
              {t("authentication.revealTitle")}
            </h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("authentication.revealPasswordPrompt")}
            </p>
            <Input
              type="password"
              value={revealPassword}
              onChange={(e) => setRevealPassword(e.target.value)}
              placeholder={t("authentication.revealPasswordPlaceholder")}
              autoComplete="current-password"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRevealTarget(null);
                  setRevealPassword("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                disabled={revealMutation.isPending || !revealPassword}
                onClick={() =>
                  revealMutation.mutate({
                    id: revealTarget,
                    password: revealPassword,
                  })
                }
              >
                {revealMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("authentication.revealButton")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revealed Secret Display */}
      {revealedSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("authentication.revealShownTitle")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRevealedSecret(null)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
              {t("authentication.revealAutoHide")}
            </p>
            <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] p-3">
              <code className="flex-1 break-all text-sm">{revealedSecret}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => copyToClipboard(revealedSecret)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">
              {t("authentication.deleteTitleConfig")}
            </h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("authentication.deleteMessageConfig")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          {t("authentication.loadFailed")}
        </p>
      )}

      {!isLoading && !isError && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">{t("authentication.noConfigsFound")}</p>
        </div>
      )}

      {!isLoading && !isError && configs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {t("common.name")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("common.type")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("common.status")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("authentication.lastUsed")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {configs.map((config) => (
                <tr
                  key={config.id}
                  className="cursor-pointer transition-colors hover:bg-[hsl(var(--muted)/0.5)]"
                  onClick={() => handleRowClick(config.id)}
                >
                  <td className="px-4 py-3 font-medium">{config.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-medium">
                      {TYPE_LABEL_KEYS[config.type]
                        ? t(TYPE_LABEL_KEYS[config.type])
                        : config.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          config.isActive ? "bg-green-500" : "bg-gray-400",
                        )}
                      />
                      {config.isActive
                        ? t("common.active")
                        : t("common.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {config.lastUsedAt
                      ? formatDate(config.lastUsedAt, "datetime")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            id: config.id,
                            isActive: !config.isActive,
                          })
                        }
                      >
                        {config.isActive
                          ? t("workflows.actions.deactivate")
                          : t("workflows.actions.activate")}
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t("authentication.revealButton")}
                          onClick={() => setRevealTarget(config.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t("authentication.editButton")}
                          onClick={() => form.openEdit(config)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t("authentication.regenerateButton")}
                        onClick={() => setRegenerateTarget(config.id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[hsl(var(--destructive))]"
                        aria-label={t("common.delete")}
                        onClick={() => setDeleteTarget(config.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage Detail Drawer */}
      <SlideDrawer
        open={!!selectedConfigId}
        onClose={() => setSelectedConfigId(null)}
        title={
          selectedConfig
            ? `${t("authentication.usageTitlePrefix")} ${selectedConfig.name}`
            : t("authentication.usageTitle")
        }
      >
        {isUsageLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        )}

        {isUsageError && (
          <p className="text-sm text-[hsl(var(--destructive))]">
            {t("authentication.loadUsageFailed")}
          </p>
        )}

        {!isUsageLoading && !isUsageError && usageData && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[hsl(var(--border))] p-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("authentication.totalCalls")}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {usageData.totalCalls.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] p-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("authentication.lastUsedLabel")}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {usageData.lastUsedAt
                    ? formatDate(usageData.lastUsedAt, "datetime")
                    : t("authentication.never")}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">
                {t("authentication.periodCounts")}
              </h3>
              <div className="h-48 rounded-lg border border-[hsl(var(--border))] p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        label: t("authentication.period24h"),
                        count: usageData.periodCounts.last24h,
                      },
                      {
                        label: t("authentication.period7d"),
                        count: usageData.periodCounts.last7d,
                      },
                      {
                        label: t("authentication.period30d"),
                        count: usageData.periodCounts.last30d,
                      },
                    ]}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.375rem",
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar
                      dataKey="count"
                      name={t("authentication.callCount")}
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">
                {t("authentication.recentCalls")}
              </h3>
              {usageData.recentCalls.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("authentication.noRecentCalls")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
                  <table className="w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("authentication.trigger")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("common.status")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("authentication.sourceIp")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("authentication.responseCode")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("authentication.startedAt")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {usageData.recentCalls.map((call) => (
                        <tr key={call.id}>
                          <td className="px-3 py-2 font-medium">
                            {call.triggerName}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                STATUS_BADGE_VARIANT[call.status] ?? "outline"
                              }
                            >
                              {call.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                            {call.sourceIp ?? "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                            {call.responseCode}
                          </td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                            {formatDate(call.startedAt, "datetime")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
