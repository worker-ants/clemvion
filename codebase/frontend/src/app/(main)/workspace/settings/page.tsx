"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  UserPlus,
  User as UserIcon,
  Users,
  LogOut,
  AlertTriangle,
  ArrowRightLeft,
  Plus,
  Globe,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleLegend } from "@/components/workspace/role-legend";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";
import { RoleGate, useHasRole } from "@/components/auth/role-gate";
import {
  workspacesApi,
  type WorkspaceInvitationSummary,
  type WorkspaceMemberSummary,
} from "@/lib/api/workspaces";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import { roleLabelKey } from "@/lib/utils/workspace";

const ROLE_OPTIONS: WorkspaceRole[] = ["admin", "editor", "viewer"];

/** Parse Nest-style error envelope: err.response.data.{code,message} | .error.{code,message}. */
function parseApiError(err: unknown): { code?: string; message?: string } {
  const e = err as {
    response?: {
      data?: {
        code?: string;
        message?: string;
        error?: { code?: string; message?: string };
      };
    };
  };
  const data = e?.response?.data;
  return {
    code: data?.code ?? data?.error?.code,
    message: data?.message ?? data?.error?.message,
  };
}

export default function WorkspaceSettingsPage() {
  const t = useT();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const queryClient = useQueryClient();

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const isTeam = currentWorkspace?.type === "team";

  const refreshWorkspaces = async () => {
    const list = await workspacesApi.list();
    setWorkspaces(list);
    queryClient.invalidateQueries({ queryKey: ["workspaces", "list"] });
  };

  if (!currentWorkspace) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("workspace.pageTitle")}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t("workspace.noCurrentWorkspace")}
          </p>
        </div>
      </div>
    );
  }

  const TypeIcon = isTeam ? Users : UserIcon;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
          <TypeIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            {currentWorkspace.name}
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {isTeam
              ? t("workspace.typeDescriptionTeam")
              : t("workspace.typeDescriptionPersonal")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            {t("workspace.tabOverview")}
          </TabsTrigger>
          {isTeam && (
            <TabsTrigger value="members">
              {t("workspace.tabMembers")}
            </TabsTrigger>
          )}
          <TabsTrigger value="danger">{t("workspace.tabDanger")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            <OverviewTab
              key={currentWorkspace.id}
              workspace={currentWorkspace}
              onRenamed={refreshWorkspaces}
            />
            <EmbedOriginsCard
              key={`embed-${currentWorkspace.id}`}
              workspaceId={currentWorkspace.id}
            />
            <WorkspaceTimezoneCard
              key={`tz-${currentWorkspace.id}`}
              workspaceId={currentWorkspace.id}
            />
          </div>
        </TabsContent>

        {isTeam && (
          <TabsContent value="members">
            <MembersTab workspaceId={currentWorkspace.id} />
          </TabsContent>
        )}

        <TabsContent value="danger">
          <DangerZoneTab
            workspaceId={currentWorkspace.id}
            workspaceName={currentWorkspace.name}
            isTeam={isTeam}
            onAfterMutation={async (opts) => {
              await refreshWorkspaces();
              if (opts.switchAway) {
                const list = await workspacesApi.list();
                const first = list[0];
                if (first) switchWorkspace(first.id);
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface OverviewTabProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    type: "personal" | "team";
    role: WorkspaceRole;
  };
  onRenamed: () => Promise<void>;
}

function OverviewTab({ workspace, onRenamed }: OverviewTabProps) {
  const t = useT();
  const [name, setName] = useState(workspace.name);
  const canEdit = useHasRole("admin");

  const renameMutation = useMutation({
    mutationFn: (value: string) =>
      workspacesApi.update(workspace.id, { name: value }),
    onSuccess: async () => {
      toast.success(t("workspace.renamed"));
      await onRenamed();
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      toast.error(parsed.message ?? t("workspace.renameFailed"));
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error(t("workspace.nameTooShort"));
      return;
    }
    if (trimmed === workspace.name) return;
    renameMutation.mutate(trimmed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {t("workspace.overviewCardTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">{t("workspace.overviewName")}</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("workspace.overviewSlug")}</Label>
              <Input value={workspace.slug} disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>{t("workspace.overviewType")}</Label>
              <div>
                <Badge variant="outline">
                  {workspace.type === "team"
                    ? t("workspace.team")
                    : t("workspace.personal")}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("workspace.overviewRole")}</Label>
              <div>
                <Badge variant="outline">
                  {t(roleLabelKey(workspace.role))}
                </Badge>
              </div>
            </div>
          </div>
          <RoleGate minRole="admin">
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  renameMutation.isPending ||
                  name.trim() === workspace.name ||
                  name.trim().length < 2
                }
              >
                {renameMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("workspace.saveNameBtn")}
              </Button>
            </div>
          </RoleGate>
        </form>
      </CardContent>
    </Card>
  );
}

/** scheme://host[:port] — 경로/쿼리/프래그먼트 없음. */
// scheme://host[:port] — path/query/fragment 불가, 후행 슬래시는 허용(서버에서 정규화).
const ORIGIN_PATTERN = /^https?:\/\/[^/\s?#]+\/?$/i;

interface EmbedOriginsCardProps {
  workspaceId: string;
}

/**
 * 웹채팅 위젯 임베드 허용 도메인(`interactionAllowedOrigins`) 편집 카드.
 *
 * `GET /workspaces/:id/settings` 로 현재 값을 로드(멤버 read)해 editor 초기 state 를 시드하고,
 * 저장은 `PATCH /workspaces/:id/settings`(Admin+)로 origin 목록 전체를 교체한다. 편집은
 * owner/admin 만(`useHasRole("admin")`), 그 외 멤버는 read-only 로 조회한다.
 */
function EmbedOriginsCard({ workspaceId }: EmbedOriginsCardProps) {
  // GET 으로 현재 origin 목록을 로드한 뒤, key 기반 remount 로 editor 의 초기 state 를 시드한다
  // (effect 내 setState 회피 — react-hooks/set-state-in-effect). 빈 목록에서 시작해 덮어쓰는 파괴를 방지.
  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspaceId],
    queryFn: () => workspacesApi.getSettings(workspaceId),
  });
  return (
    <EmbedOriginsEditor
      key={`${workspaceId}:${settingsQuery.isSuccess ? "loaded" : "pending"}`}
      workspaceId={workspaceId}
      initialOrigins={settingsQuery.data?.interactionAllowedOrigins ?? []}
      isLoading={settingsQuery.isLoading}
    />
  );
}

interface EmbedOriginsEditorProps {
  workspaceId: string;
  initialOrigins: string[];
  isLoading: boolean;
}

function EmbedOriginsEditor({
  workspaceId,
  initialOrigins,
  isLoading,
}: EmbedOriginsEditorProps) {
  const t = useT();
  const canEdit = useHasRole("admin");
  const queryClient = useQueryClient();
  const [origins, setOrigins] = useState<string[]>(initialOrigins);
  const [draft, setDraft] = useState("");

  const saveMutation = useMutation({
    mutationFn: (next: string[]) =>
      workspacesApi.updateSettings(workspaceId, {
        interactionAllowedOrigins: next,
      }),
    onSuccess: async () => {
      toast.success(t("workspace.settingsSaved"));
      await queryClient.invalidateQueries({
        queryKey: ["workspace-settings", workspaceId],
      });
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      toast.error(parsed.message ?? t("workspace.settingsSaveFailed"));
    },
  });

  const addOrigin = () => {
    const value = draft.trim();
    if (!value) return;
    if (!ORIGIN_PATTERN.test(value)) {
      toast.error(t("workspace.originInvalid"));
      return;
    }
    if (origins.includes(value)) {
      toast.error(t("workspace.originDuplicate"));
      return;
    }
    setOrigins((prev) => [...prev, value]);
    setDraft("");
  };

  const removeOrigin = (value: string) => {
    setOrigins((prev) => prev.filter((o) => o !== value));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Globe className="h-4 w-4" />
          {t("workspace.embedOriginsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("workspace.embedOriginsDesc")}
          </p>

          {canEdit && (
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                addOrigin();
              }}
            >
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="embed-origin">
                  {t("workspace.embedOriginsLabel")}
                </Label>
                <Input
                  id="embed-origin"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("workspace.embedOriginsPlaceholder")}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                {t("workspace.addOrigin")}
              </Button>
            </form>
          )}

          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
          ) : origins.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("workspace.embedOriginsEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
              {origins.map((origin) => (
                <li
                  key={origin}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="truncate font-mono">{origin}</span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOrigin(origin)}
                    >
                      {t("workspace.removeOrigin")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("workspace.embedOriginsCacheNote")}
          </p>

          {canEdit && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => saveMutation.mutate(origins)}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("workspace.saveSettings")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface WorkspaceTimezoneCardProps {
  workspaceId: string;
}

/**
 * 워크스페이스 기본 시간대(`settings.timezone`) 편집 카드.
 *
 * 타임존을 명시하지 않은 스케줄이 이 값으로 fallback 한다
 * (`schedules.service.resolveTimezone`: 명시값 > workspace settings.timezone > 'Asia/Seoul').
 * `GET /workspaces/:id/settings` 로 현재 값을 시드(멤버 read), 저장은
 * `PATCH /workspaces/:id/settings`(Admin+) — 다른 settings 키는 백엔드가 보존한다.
 * IANA 유효성은 서버(`UpdateWorkspaceSettingsDto.timezone`)가 검증하고, 빈 문자열은 값을 지운다.
 */
function WorkspaceTimezoneCard({ workspaceId }: WorkspaceTimezoneCardProps) {
  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspaceId],
    queryFn: () => workspacesApi.getSettings(workspaceId),
  });
  return (
    <WorkspaceTimezoneEditor
      key={`tz-${workspaceId}:${settingsQuery.isSuccess ? "loaded" : "pending"}`}
      workspaceId={workspaceId}
      initialTimezone={settingsQuery.data?.timezone ?? ""}
      isLoading={settingsQuery.isLoading}
    />
  );
}

interface WorkspaceTimezoneEditorProps {
  workspaceId: string;
  initialTimezone: string;
  isLoading: boolean;
}

function WorkspaceTimezoneEditor({
  workspaceId,
  initialTimezone,
  isLoading,
}: WorkspaceTimezoneEditorProps) {
  const t = useT();
  const canEdit = useHasRole("admin");
  const queryClient = useQueryClient();
  const [timezone, setTimezone] = useState(initialTimezone);

  const saveMutation = useMutation({
    mutationFn: (next: string) =>
      workspacesApi.updateSettings(workspaceId, { timezone: next }),
    onSuccess: async () => {
      toast.success(t("workspace.settingsSaved"));
      await queryClient.invalidateQueries({
        queryKey: ["workspace-settings", workspaceId],
      });
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      toast.error(parsed.message ?? t("workspace.settingsSaveFailed"));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4" />
          {t("workspace.timezoneTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("workspace.timezoneDesc")}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="ws-timezone">{t("workspace.timezoneLabel")}</Label>
            <Input
              id="ws-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder={t("workspace.timezonePlaceholder")}
              disabled={!canEdit || isLoading}
              autoComplete="off"
            />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => saveMutation.mutate(timezone.trim())}
                disabled={saveMutation.isPending || isLoading}
              >
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("workspace.saveSettings")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface MembersTabProps {
  workspaceId: string;
}

function MembersTab({ workspaceId }: MembersTabProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const adminMode = useHasRole("admin");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("editor");

  const membersQuery = useQuery<WorkspaceMemberSummary[]>({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId),
  });

  const invitationsQuery = useQuery<WorkspaceInvitationSummary[]>({
    queryKey: ["workspaces", "invitations", workspaceId],
    queryFn: () => workspacesApi.listInvitations(workspaceId),
    enabled: adminMode,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      workspacesApi.invite(
        workspaceId,
        inviteEmail,
        inviteRole as Exclude<WorkspaceRole, "owner">,
      ),
    onSuccess: () => {
      toast.success(t("workspace.memberInvited"));
      setInviteEmail("");
      setInviteRole("editor");
      queryClient.invalidateQueries({
        queryKey: ["workspaces", "invitations", workspaceId],
      });
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      toast.error(parsed.message ?? t("workspace.inviteFailed"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      workspacesApi.revokeInvitation(workspaceId, invitationId),
    onSuccess: () => {
      toast.success(t("workspace.inviteCancelled"));
      queryClient.invalidateQueries({
        queryKey: ["workspaces", "invitations", workspaceId],
      });
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      toast.error(parsed.message ?? t("workspace.cancelInviteFailed"));
    },
  });

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) =>
      workspacesApi.resendInvitation(workspaceId, invitationId),
    onSuccess: () => {
      toast.success(t("workspace.inviteResent"));
      queryClient.invalidateQueries({
        queryKey: ["workspaces", "invitations", workspaceId],
      });
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      toast.error(parsed.message ?? t("workspace.resendInviteFailed"));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: WorkspaceRole;
    }) => workspacesApi.updateMemberRole(workspaceId, memberId, role),
    onSuccess: () => {
      toast.success(t("workspace.roleUpdated"));
      queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : t("workspace.roleUpdateFailedShort");
      toast.error(msg);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      workspacesApi.removeMember(workspaceId, memberId),
    onSuccess: () => {
      toast.success(t("workspace.memberRemoved"));
      queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : t("workspace.removeFailedShort");
      toast.error(msg);
    },
  });

  return (
    <div className="space-y-4">
      <RoleLegend />

      <RoleGate minRole="admin">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("workspace.invite")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteEmail.trim()) return;
                inviteMutation.mutate();
              }}
            >
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">
                  {t("workspace.inviteEmail")}
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t("workspace.memberEmailPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">{t("workspace.inviteRole")}</Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as WorkspaceRole)
                  }
                  className="h-9 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(roleLabelKey(r))}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {t("workspace.inviteButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </RoleGate>

      <RoleGate minRole="admin">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("workspace.invitePending")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitationsQuery.isLoading ? (
              <div className="flex h-16 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            ) : !invitationsQuery.data?.length ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("workspace.noPendingInvites")}
              </p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--border))]">
                {invitationsQuery.data.map((inv) => {
                  // Date.now() 는 매 렌더마다 달라져 결과가 불안정하므로
                  // React Query 의 dataUpdatedAt(쿼리 fetch 시점)을 기준으로
                  // 만료를 판정한다. invalidate 후 재페치되면 자연스럽게 최신
                  // 시점으로 비교된다.
                  const expired =
                    new Date(inv.expiresAt).getTime() <
                    invitationsQuery.dataUpdatedAt;
                  const itemBusy =
                    (resendMutation.isPending &&
                      resendMutation.variables === inv.id) ||
                    (revokeMutation.isPending &&
                      revokeMutation.variables === inv.id);
                  return (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {inv.email}
                        </span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          <Badge variant="outline" className="mr-2">
                            {t(roleLabelKey(inv.role))}
                          </Badge>
                          {expired ? (
                            <span className="text-[hsl(var(--destructive))]">
                              {t("workspace.inviteExpired", {
                                date: formatDate(inv.expiresAt, "datetime"),
                              })}
                            </span>
                          ) : (
                            t("workspace.inviteExpiresAt", {
                              date: formatDate(inv.expiresAt, "datetime"),
                            })
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={itemBusy}
                          onClick={() => resendMutation.mutate(inv.id)}
                        >
                          {t("workspace.inviteResend")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={itemBusy}
                          onClick={() => revokeMutation.mutate(inv.id)}
                        >
                          {t("workspace.inviteRevoke")}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </RoleGate>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {t("workspace.acceptedMembersTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membersQuery.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : !membersQuery.data?.length ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("workspace.noMembers")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">
                      {t("workspace.columnName")}
                    </th>
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">
                      {t("workspace.columnEmail")}
                    </th>
                    <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">
                      {t("workspace.columnRole")}
                    </th>
                    <th className="py-2 text-right font-medium text-[hsl(var(--muted-foreground))]"></th>
                  </tr>
                </thead>
                <tbody>
                  {membersQuery.data.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-[hsl(var(--border))] last:border-b-0"
                    >
                      <td className="py-2 pr-4">{m.name}</td>
                      <td className="py-2 pr-4 text-[hsl(var(--muted-foreground))]">
                        {m.email}
                      </td>
                      <td className="py-2 pr-4">
                        {adminMode && m.role !== "owner" ? (
                          <select
                            value={m.role}
                            onChange={(e) =>
                              updateRoleMutation.mutate({
                                memberId: m.id,
                                role: e.target.value as WorkspaceRole,
                              })
                            }
                            className="h-8 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {t(roleLabelKey(r))}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="outline">
                            {t(roleLabelKey(m.role))}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {adminMode && m.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              removeMemberMutation.mutate(m.id)
                            }
                            title={t("workspace.removeTooltip")}
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

interface DangerZoneTabProps {
  workspaceId: string;
  workspaceName: string;
  isTeam: boolean;
  onAfterMutation: (opts: { switchAway: boolean }) => Promise<void>;
}

function DangerZoneTab({
  workspaceId,
  workspaceName,
  isTeam,
  onAfterMutation,
}: DangerZoneTabProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const isOwner = useHasRole("owner");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferEmailInput, setTransferEmailInput] = useState("");

  // owner 만 owner 이양을 수행할 수 있고, 대상 후보 (비-owner 멤버) 가 필요해
  // 이 카드가 노출되는 경우에만 멤버 목록을 가져온다.
  const transferEligible = isTeam && isOwner;
  const membersQuery = useQuery<WorkspaceMemberSummary[]>({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId),
    enabled: transferEligible,
  });
  const candidates = (membersQuery.data ?? []).filter((m) => m.role !== "owner");
  const transferTarget = candidates.find((m) => m.id === transferTargetId);

  const leaveMutation = useMutation({
    mutationFn: () => workspacesApi.leave(workspaceId),
    onSuccess: async () => {
      toast.success(t("workspace.left"));
      setLeaveDialogOpen(false);
      await onAfterMutation({ switchAway: true });
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      if (parsed.code === "SOLE_OWNER_CANNOT_LEAVE") {
        toast.error(t("workspace.dangerLeaveOnlyOwner"));
        return;
      }
      toast.error(parsed.message ?? t("workspace.leaveFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => workspacesApi.delete(workspaceId),
    onSuccess: async () => {
      toast.success(t("workspace.deleted"));
      setDeleteDialogOpen(false);
      setConfirmInput("");
      await onAfterMutation({ switchAway: true });
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      toast.error(parsed.message ?? t("workspace.deleteFailed"));
    },
  });

  function resetTransferDialog() {
    setTransferDialogOpen(false);
    setTransferTargetId("");
    setTransferEmailInput("");
  }

  const transferMutation = useMutation({
    mutationFn: (memberId: string) =>
      workspacesApi.transferOwnership(workspaceId, memberId),
    onSuccess: async () => {
      toast.success(t("workspace.transferOwnerSuccess"));
      resetTransferDialog();
      // 멤버 목록 캐시 무효화 (역할 변경 반영) + 워크스페이스 목록 새로고침으로
      // 현재 사용자 역할이 admin 으로 강등된 상태가 RBAC UI 에 즉시 반영된다.
      queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
      await onAfterMutation({ switchAway: false });
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err);
      const code = parsed.code;
      if (code === "OWNER_REQUIRED") {
        toast.error(t("workspace.transferOwnerOnlyOwner"));
      } else if (code === "TARGET_IS_SELF") {
        toast.error(t("workspace.transferOwnerSelfRejected"));
      } else if (code === "TARGET_ALREADY_OWNER") {
        toast.error(t("workspace.transferOwnerAlreadyOwner"));
      } else if (code === "MEMBER_NOT_FOUND") {
        toast.error(t("workspace.transferOwnerMemberNotFound"));
      } else {
        toast.error(parsed.message ?? t("workspace.transferOwnerFailed"));
      }
    },
  });

  const canLeave = isTeam && !isOwner;

  return (
    <div className="space-y-4">
      {canLeave && (
        <Card className="border-[hsl(var(--border))]">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <LogOut className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <div>
                <p className="font-semibold">
                  {t("workspace.dangerLeaveTitle")}
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("workspace.dangerLeaveDesc")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setLeaveDialogOpen(true)}
              className="shrink-0"
            >
              {t("workspace.dangerLeaveBtn")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isTeam && (
        <RoleGate minRole="owner">
          <Card className="border-[hsl(var(--border))]">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ArrowRightLeft className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                <div>
                  <p className="font-semibold">
                    {t("workspace.transferOwnerTitle")}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {t("workspace.transferOwnerDesc")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setTransferDialogOpen(true)}
                className="shrink-0"
              >
                {t("workspace.transferOwnerBtn")}
              </Button>
            </CardContent>
          </Card>
        </RoleGate>
      )}

      {isTeam && (
        <RoleGate minRole="owner">
          <Card className="border-[hsl(var(--destructive))]/40">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--destructive))]" />
                <div>
                  <p className="font-semibold">
                    {t("workspace.dangerDeleteTitle")}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {t("workspace.dangerDeleteDesc")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                className="shrink-0 border-[hsl(var(--destructive))]/40 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
              >
                {t("workspace.dangerDeleteBtn")}
              </Button>
            </CardContent>
          </Card>
        </RoleGate>
      )}

      {!isTeam && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("workspace.typeDescriptionPersonal")}
        </p>
      )}

      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.dangerLeaveTitle")}</DialogTitle>
            <DialogDescription>{t("workspace.leaveConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeaveDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
            >
              {leaveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("workspace.dangerLeaveBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setConfirmInput("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.dangerDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspace.dangerDeleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">
              {t("workspace.deleteConfirmPromptLabel", {
                name: workspaceName,
              })}
            </Label>
            <Input
              id="delete-confirm"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (confirmInput !== workspaceName) {
                  toast.error(t("workspace.confirmMismatch"));
                  return;
                }
                deleteMutation.mutate();
              }}
              disabled={
                deleteMutation.isPending || confirmInput !== workspaceName
              }
              className="border-[hsl(var(--destructive))]/40 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("workspace.dangerDeleteBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetTransferDialog();
          else setTransferDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.transferOwnerTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspace.transferOwnerDesc")}
            </DialogDescription>
          </DialogHeader>

          {candidates.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("workspace.transferOwnerNoCandidates")}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="transfer-target">
                  {t("workspace.transferOwnerSelectLabel")}
                </Label>
                <select
                  id="transfer-target"
                  value={transferTargetId}
                  onChange={(e) => {
                    setTransferTargetId(e.target.value);
                    setTransferEmailInput("");
                  }}
                  className="h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm"
                >
                  <option value="">
                    {t("workspace.transferOwnerSelectPlaceholder")}
                  </option>
                  {candidates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email}) — {t(roleLabelKey(m.role))}
                    </option>
                  ))}
                </select>
              </div>
              {transferTarget && (
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-email">
                    {t("workspace.transferOwnerConfirmLabel", {
                      email: transferTarget.email,
                    })}
                  </Label>
                  <Input
                    id="transfer-email"
                    type="email"
                    value={transferEmailInput}
                    onChange={(e) => setTransferEmailInput(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetTransferDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!transferTarget) return;
                if (transferEmailInput !== transferTarget.email) {
                  toast.error(t("workspace.transferOwnerEmailMismatch"));
                  return;
                }
                transferMutation.mutate(transferTarget.id);
              }}
              disabled={
                transferMutation.isPending ||
                !transferTarget ||
                transferEmailInput !== transferTarget?.email
              }
            >
              {transferMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("workspace.transferOwnerBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
