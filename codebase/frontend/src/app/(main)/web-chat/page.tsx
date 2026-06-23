"use client";

import { useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RoleGate } from "@/components/auth/role-gate";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n";
import {
  useWebChatInstances,
  type WebChatInstance,
} from "@/components/web-chat/use-web-chat";
import { useAppearanceDraft } from "@/components/web-chat/use-appearance-draft";
import { AppearanceBuilder } from "@/components/web-chat/appearance-builder";
import { InstallSnippetBox } from "@/components/web-chat/install-snippet-box";
import { LivePreview } from "@/components/web-chat/live-preview";
import { CreateWebChatDialog } from "@/components/web-chat/create-web-chat-dialog";

export default function WebChatPage() {
  const t = useT();
  const { instances, isLoading, isError } = useWebChatInstances();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // selectedId 는 사용자 override 일 뿐, 유효한 선택은 렌더 중 파생한다(effect 없음):
  // null/무효(삭제·미선택)면 첫 인스턴스로 폴백.
  const selected =
    instances.find((i) => i.id === selectedId) ?? instances[0] ?? null;

  const createButton = (
    <RoleGate minRole="editor">
      <Button onClick={() => setCreateOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        {t("webChat.create")}
      </Button>
    </RoleGate>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("webChat.title")}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t("webChat.description")}
          </p>
        </div>
        {createButton}
      </header>

      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          {t("webChat.list.loadError")}
        </p>
      )}

      {!isLoading && !isError && instances.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={t("webChat.empty.title")}
          description={t("webChat.empty.description")}
          action={createButton}
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
                  "flex w-full flex-col rounded-md border border-[hsl(var(--border))] p-3 text-left transition-colors hover:bg-[hsl(var(--accent))]",
                  inst.id === selected?.id &&
                    "border-[hsl(var(--primary))] bg-[hsl(var(--accent))]",
                )}
              >
                <span className="font-medium">{inst.name}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t("webChat.list.workflowLabel")}: {inst.workflowName}
                </span>
              </button>
            ))}
          </nav>

          {selected && <WebChatDetail key={selected.id} instance={selected} />}
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

function WebChatDetail({ instance }: { instance: WebChatInstance }) {
  const { draft, setDraft } = useAppearanceDraft(instance.id);
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <AppearanceBuilder draft={draft} onChange={setDraft} />
      </Card>
      <Card className="p-6">
        <InstallSnippetBox endpointPath={instance.endpointPath} draft={draft} />
      </Card>
      <Card className="p-6">
        <LivePreview />
      </Card>
    </div>
  );
}
