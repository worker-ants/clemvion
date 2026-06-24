"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateWebChatMeta } from "@/components/web-chat/use-web-chat";

interface Props {
  instanceId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 웹채팅 인스턴스 이름 변경 다이얼로그 (콘솔 전용 경량 UI).
 *
 * `useUpdateWebChatMeta {name}` 단일 PATCH 경로로 이름만 수정한다 — interaction/외형은
 * 건드리지 않는다. 입력값을 현재 이름으로 초기화하기 위해 `(instanceId, open)` 조합을 key 로
 * 리마운트한다(다이얼로그를 다시 열 때마다 최신 이름으로 reset).
 */
export function WebChatRenameDialog(props: Props) {
  // open=false→true 전환 시에도 state 초기화를 위해 open 포함
  return <WebChatRenameDialogInner key={`${props.instanceId}:${String(props.open)}`} {...props} />;
}

function WebChatRenameDialogInner({ instanceId, currentName, open, onOpenChange }: Props) {
  const t = useT();
  const [name, setName] = useState(currentName);
  const updateMeta = useUpdateWebChatMeta();

  const trimmed = name.trim();
  const unchanged = trimmed === currentName.trim();
  const disabled = trimmed.length === 0 || unchanged || updateMeta.isPending;

  async function submit() {
    if (disabled) return;
    try {
      await updateMeta.mutateAsync({ instanceId, name: trimmed });
      toast.success(t("webChat.manage.renamed"));
      onOpenChange(false);
    } catch {
      toast.error(t("webChat.manage.renameError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("webChat.manage.renameTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="web-chat-rename-input">
            {t("webChat.manage.renameLabel")}
          </Label>
          <Input
            id="web-chat-rename-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMeta.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={disabled}
          >
            {updateMeta.isPending && (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            )}
            {t("webChat.manage.renameSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
