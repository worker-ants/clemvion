"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  History,
  Loader2,
  MessageCircle,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleGate } from "@/components/auth/role-gate";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/date";
import { useT } from "@/lib/i18n";
import {
  useWebChatInstances,
  useUpdateWebChatAppearance,
  useUpdateWebChatMeta,
  WEB_CHAT_INSTANCES_KEY,
  type WebChatInstance,
} from "@/components/web-chat/use-web-chat";
import { useAppearanceDraft } from "@/components/web-chat/use-appearance-draft";
import { AppearanceBuilder } from "@/components/web-chat/appearance-builder";
import { InstallSnippetBox } from "@/components/web-chat/install-snippet-box";
import { LivePreview } from "@/components/web-chat/live-preview";
import { CreateWebChatDialog } from "@/components/web-chat/create-web-chat-dialog";
import { WebChatRenameDialog } from "@/components/web-chat/web-chat-rename-dialog";
import {
  TriggerDeleteDialog,
  type TriggerDeleteTarget,
} from "@/components/triggers/trigger-delete-dialog";
import { TriggerHistoryDialog } from "@/components/triggers/trigger-history-dialog";

/** "웹채팅 만들기" 버튼 — 헤더·빈 상태 양쪽에서 재사용(editor+ 만 노출). */
function CreateWebChatButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <RoleGate minRole="editor">
      <Button onClick={onClick}>
        <Plus className="mr-1 h-4 w-4" />
        {t("webChat.create")}
      </Button>
    </RoleGate>
  );
}

export default function WebChatPage() {
  const t = useT();
  const { instances, isLoading, isError } = useWebChatInstances();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // selectedId 는 사용자 override 일 뿐, 유효한 선택은 렌더 중 파생한다(effect 없음):
  // null/무효(삭제·미선택)면 첫 인스턴스로 폴백.
  const selected =
    instances.find((i) => i.id === selectedId) ?? instances[0] ?? null;

  const openCreate = () => setCreateOpen(true);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("webChat.title")}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t("webChat.description")}
          </p>
        </div>
        <CreateWebChatButton onClick={openCreate} />
      </header>

      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          {t("webChat.list.loadError")}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      ) : !isError && instances.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={t("webChat.empty.title")}
          description={t("webChat.empty.description")}
          action={<CreateWebChatButton onClick={openCreate} />}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <nav className="space-y-1" aria-label={t("webChat.title")}>
            {instances.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => setSelectedId(inst.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-md border border-[hsl(var(--border))] p-3 text-left transition-colors hover:bg-[hsl(var(--accent))]",
                  inst.id === selected?.id &&
                    "border-[hsl(var(--primary))] bg-[hsl(var(--accent))]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{inst.name}</span>
                  {!inst.isActive && (
                    <Badge variant="outline" className="shrink-0">
                      {t("webChat.list.inactive")}
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t("webChat.list.workflowLabel")}: {inst.workflowName}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {inst.lastTriggeredAt
                    ? t("webChat.list.lastTriggered", {
                        when: timeAgo(inst.lastTriggeredAt),
                      })
                    : t("webChat.list.neverTriggered")}
                </span>
              </button>
            ))}
          </nav>

          {selected && (
            <WebChatDetail
              key={selected.id}
              instance={selected}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </div>
      )}

      <CreateWebChatDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}

function WebChatDetail({
  instance,
  onDeleted,
}: {
  instance: WebChatInstance;
  onDeleted: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const { draft, setDraft, isDirty, markSaved } = useAppearanceDraft(
    instance.id,
    instance.appearance,
  );
  const updateAppearance = useUpdateWebChatAppearance();
  const updateMeta = useUpdateWebChatMeta();

  const [renameOpen, setRenameOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TriggerDeleteTarget | null>(
    null,
  );

  // P2 — 미저장 외형(isDirty) 상태에서 새로고침/탭 닫기 시 손실 경고.
  // localStorage draft 로 복구는 되지만, 사용자가 의도치 않게 떠나는 것을 한 번 잡아준다.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  async function save() {
    try {
      await updateAppearance.mutateAsync({
        instanceId: instance.id,
        appearance: draft,
        tokenStrategy: instance.tokenStrategy,
      });
      markSaved();
      toast.success(t("webChat.appearance.saved"));
    } catch {
      toast.error(t("webChat.appearance.saveError"));
    }
  }

  async function toggleActive() {
    const next = !instance.isActive;
    try {
      await updateMeta.mutateAsync({ instanceId: instance.id, isActive: next });
      toast.success(
        next
          ? t("webChat.manage.activated")
          : t("webChat.manage.deactivated"),
      );
    } catch {
      toast.error(t("webChat.manage.toggleError"));
    }
  }

  // 외형이 서버에 한 번도 저장되지 않은 인스턴스 = 갓 만든 상태 → 다음 단계 안내(온보딩).
  // 저장하면 instance.appearance 가 채워지며 안내가 자연히 사라진다(파생 상태, 별도 플래그 불필요).
  const needsOnboarding = !instance.appearance;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-semibold">{instance.name}</h2>
          <Badge variant={instance.isActive ? "success" : "outline"}>
            {instance.isActive
              ? t("webChat.manage.active")
              : t("webChat.manage.inactive")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="mr-1 h-4 w-4" />
            {t("webChat.manage.history")}
          </Button>
          <RoleGate minRole="editor">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t("webChat.manage.menu")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  {t("webChat.manage.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={updateMeta.isPending}
                  onClick={() => void toggleActive()}
                >
                  <Power className="h-4 w-4" />
                  {instance.isActive
                    ? t("webChat.manage.deactivate")
                    : t("webChat.manage.activate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    setDeleteTarget({
                      id: instance.id,
                      name: instance.name,
                      type: "webhook",
                      workflowName: instance.workflowName,
                      webhookUrl: instance.endpointPath,
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  {t("webChat.manage.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </RoleGate>
        </div>
      </div>

      {needsOnboarding && (
        <div className="rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.4] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
          {t("webChat.onboarding.hint")}
        </div>
      )}

      <Card className="space-y-4 p-6">
        <AppearanceBuilder draft={draft} onChange={setDraft} />
        <RoleGate minRole="editor">
          <div className="flex items-center justify-end gap-3 border-t border-[hsl(var(--border))] pt-4">
            {isDirty && (
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("webChat.appearance.unsaved")}
              </span>
            )}
            <Button
              onClick={() => void save()}
              disabled={!isDirty || updateAppearance.isPending}
            >
              {updateAppearance.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {t("webChat.appearance.save")}
            </Button>
          </div>
        </RoleGate>
      </Card>
      <Card className="p-6">
        <InstallSnippetBox endpointPath={instance.endpointPath} draft={draft} />
      </Card>
      <Card className="p-6">
        <LivePreview endpointPath={instance.endpointPath} draft={draft} />
      </Card>

      <WebChatRenameDialog
        instanceId={instance.id}
        currentName={instance.name}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
      <TriggerHistoryDialog
        triggerId={historyOpen ? instance.id : null}
        triggerName={instance.name}
        workflowId={instance.workflowId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      <TriggerDeleteDialog
        trigger={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          // 웹채팅 콘솔은 별도 캐시 키·선택 상태를 가지므로 여기서 추가 무효화·리셋한다
          // (다이얼로그는 ["triggers"] 만 무효화). 부모는 selectedId 를 비워 첫 인스턴스로 폴백.
          queryClient.invalidateQueries({ queryKey: WEB_CHAT_INSTANCES_KEY });
          onDeleted();
        }}
      />
    </div>
  );
}
