"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";
import {
  workspacesApi,
  type WorkspaceMemberSummary,
} from "@/lib/api/workspaces";

const ROLE_OPTIONS: WorkspaceRole[] = ["admin", "editor", "viewer"];

function isAdmin(role: WorkspaceRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

export default function WorkspaceSettingsPage() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const queryClient = useQueryClient();

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const adminMode = isAdmin(currentWorkspace?.role);

  const [newTeamName, setNewTeamName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<WorkspaceRole>("editor");

  const membersQuery = useQuery<WorkspaceMemberSummary[]>({
    queryKey: ["workspace-members", currentWorkspaceId],
    queryFn: () => workspacesApi.listMembers(currentWorkspaceId!),
    enabled:
      !!currentWorkspaceId && currentWorkspace?.type === "team",
  });

  const refreshWorkspaces = async () => {
    const list = await workspacesApi.list();
    setWorkspaces(list);
    queryClient.invalidateQueries({ queryKey: ["workspaces", "list"] });
  };

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => workspacesApi.createTeam(name),
    onSuccess: async (created) => {
      toast.success(`팀 워크스페이스 '${created.name}'을(를) 만들었어요.`);
      setNewTeamName("");
      await refreshWorkspaces();
      switchWorkspace(created.id);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "생성 실패";
      toast.error(msg);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: () =>
      workspacesApi.addMember(currentWorkspaceId!, memberEmail, memberRole),
    onSuccess: () => {
      toast.success("멤버를 추가했어요.");
      setMemberEmail("");
      setMemberRole("editor");
      queryClient.invalidateQueries({
        queryKey: ["workspace-members", currentWorkspaceId],
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "멤버 추가 실패";
      toast.error(msg);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: WorkspaceRole;
    }) =>
      workspacesApi.updateMemberRole(currentWorkspaceId!, memberId, role),
    onSuccess: () => {
      toast.success("역할을 변경했어요.");
      queryClient.invalidateQueries({
        queryKey: ["workspace-members", currentWorkspaceId],
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "역할 변경 실패";
      toast.error(msg);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      workspacesApi.removeMember(currentWorkspaceId!, memberId),
    onSuccess: () => {
      toast.success("멤버를 제거했어요.");
      queryClient.invalidateQueries({
        queryKey: ["workspace-members", currentWorkspaceId],
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "멤버 제거 실패";
      toast.error(msg);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workspace</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          현재 워크스페이스 정보와 멤버를 관리해요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">현재 워크스페이스</CardTitle>
        </CardHeader>
        <CardContent>
          {currentWorkspace ? (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentWorkspace.name}</span>
                <Badge variant="outline">{currentWorkspace.type}</Badge>
                <Badge variant="outline">{currentWorkspace.role}</Badge>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                slug: {currentWorkspace.slug}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              선택된 워크스페이스가 없어요.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">팀 워크스페이스 만들기</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTeamName.trim().length < 2) {
                toast.error("이름은 2자 이상이어야 해요.");
                return;
              }
              createTeamMutation.mutate(newTeamName.trim());
            }}
          >
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="예: Marketing Team"
              className="sm:max-w-xs"
            />
            <Button type="submit" disabled={createTeamMutation.isPending}>
              {createTeamMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              만들기
            </Button>
          </form>
        </CardContent>
      </Card>

      {currentWorkspace?.type === "team" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">멤버</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {adminMode && (
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!memberEmail.trim()) return;
                  addMemberMutation.mutate();
                }}
              >
                <Input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="sm:max-w-xs"
                />
                <select
                  value={memberRole}
                  onChange={(e) =>
                    setMemberRole(e.target.value as WorkspaceRole)
                  }
                  className="h-9 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  variant="outline"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  추가
                </Button>
              </form>
            )}

            {membersQuery.isLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            ) : !membersQuery.data?.length ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                멤버가 없어요.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))]">
                      <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">이름</th>
                      <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">이메일</th>
                      <th className="py-2 pr-4 text-left font-medium text-[hsl(var(--muted-foreground))]">역할</th>
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
                                  {r}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant="outline">{m.role}</Badge>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {adminMode && m.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeMemberMutation.mutate(m.id)}
                              title="멤버 제거"
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
      )}
    </div>
  );
}
