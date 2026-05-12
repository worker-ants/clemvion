"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { ConfirmDiffDialog, type DiffEntry } from "./confirm-diff-dialog";

interface ProfileInfoCardProps {
  user: { name: string; email: string };
}

function getInitials(name: string, email: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) {
    return trimmed
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email ?? "").charAt(0).toUpperCase() || "?";
}

function axiosMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function ProfileInfoCard({ user }: ProfileInfoCardProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [name, setName] = useState(user.name ?? "");
  const [showDiff, setShowDiff] = useState(false);

  const dirty = (name ?? "").trim() !== (user.name ?? "").trim();

  const mutation = useMutation({
    mutationFn: async (patch: { name: string }) => {
      await apiClient.patch("/users/me", patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success(t("profile.saved"));
      setShowDiff(false);
      setMode("view");
    },
    onError: (err) => {
      toast.error(axiosMessage(err, t("profile.saveFailed")));
    },
  });

  function handleEdit() {
    setName(user.name ?? "");
    setMode("edit");
  }

  function handleCancel() {
    setName(user.name ?? "");
    setMode("view");
  }

  function handleSaveClick() {
    if (!dirty) {
      toast.info(t("profile.noChanges"));
      setMode("view");
      return;
    }
    setShowDiff(true);
  }

  const diff: DiffEntry[] = useMemo(
    () =>
      dirty
        ? [{ label: t("profile.name"), before: user.name ?? "", after: name }]
        : [],
    [dirty, user.name, name, t],
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">
            {t("profile.userInformation")}
          </CardTitle>
          {mode === "view" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              data-testid="profile-info-edit"
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t("profile.edit")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={mutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveClick}
                disabled={mutation.isPending}
                data-testid="profile-info-save"
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-lg font-bold text-[hsl(var(--primary-foreground))]">
              {getInitials(mode === "edit" ? name : user.name, user.email)}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <Label htmlFor="profile-name">{t("profile.name")}</Label>
                {mode === "view" ? (
                  <p
                    id="profile-name"
                    className="mt-1 text-sm"
                    data-testid="profile-name-readonly"
                  >
                    {user.name || "—"}
                  </p>
                ) : (
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("profile.namePlaceholder")}
                    autoFocus
                  />
                )}
              </div>
              <div>
                <Label htmlFor="profile-email">{t("profile.email")}</Label>
                <p id="profile-email" className="mt-1 text-sm">
                  {user.email}
                </p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("profile.emailReadonlyHint")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDiffDialog
        open={showDiff}
        changes={diff}
        onClose={() => setShowDiff(false)}
        onConfirm={async () => {
          await mutation.mutateAsync({ name });
        }}
      />
    </>
  );
}
