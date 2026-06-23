"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n";
import { useWorkflowOptions, useCreateWebChat, extractCreatedId } from "./use-web-chat";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CreateWebChatDialog({ open, onOpenChange, onCreated }: Props) {
  const t = useT();
  const workflows = useWorkflowOptions();
  const createWebChatMutation = useCreateWebChat();
  const [workflowId, setWorkflowId] = useState("");
  const [name, setName] = useState("");

  const noWorkflows = workflows.data !== undefined && workflows.data.length === 0;
  const canSubmit =
    Boolean(workflowId) && name.trim().length > 0 && !createWebChatMutation.isPending;

  async function submit() {
    if (!canSubmit) return;
    try {
      const created = await createWebChatMutation.mutateAsync({ workflowId, name: name.trim() });
      toast.success(t("webChat.createDialog.success"));
      onOpenChange(false);
      setWorkflowId("");
      setName("");
      const id = extractCreatedId(created);
      if (id) onCreated?.(id);
    } catch {
      toast.error(t("webChat.createDialog.error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("webChat.createDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wc-create-workflow">
              {t("webChat.createDialog.workflowLabel")}
            </Label>
            <NativeSelect
              id="wc-create-workflow"
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
            >
              <option value="" disabled>
                {t("webChat.createDialog.workflowPlaceholder")}
              </option>
              {(workflows.data ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </NativeSelect>
            {noWorkflows && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("webChat.createDialog.noWorkflows")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wc-create-name">{t("webChat.createDialog.nameLabel")}</Label>
            <Input
              id="wc-create-name"
              value={name}
              placeholder={t("webChat.createDialog.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("webChat.createDialog.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {t("webChat.createDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
