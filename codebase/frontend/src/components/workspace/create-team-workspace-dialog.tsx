"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspacesApi } from "@/lib/api/workspaces";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTeamWorkspaceDialog({ open, onOpenChange }: Props) {
  const t = useT();
  const queryClient = useQueryClient();
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: (value: string) => workspacesApi.createTeam(value),
    onSuccess: async (created) => {
      setName("");
      const list = await workspacesApi.list();
      setWorkspaces(list);
      queryClient.invalidateQueries({ queryKey: ["workspaces", "list"] });
      // switchWorkspace triggers the global `workspace.switched` toast in
      // providers.tsx; skip a redundant "created" toast to avoid stacking two.
      switchWorkspace(created.id);
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : t("workspace.createGenericFailed");
      toast.error(msg);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error(t("workspace.nameTooShort"));
      return;
    }
    mutation.mutate(trimmed);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setName("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
              <Users className="h-4 w-4" />
            </span>
            <DialogTitle>{t("workspace.createDialogTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("workspace.createDialogDesc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-workspace-name">
              {t("workspace.overviewName")}
            </Label>
            <Input
              id="team-workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workspace.createPlaceholder")}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("workspace.createBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
