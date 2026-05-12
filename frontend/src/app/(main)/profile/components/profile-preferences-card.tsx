"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useThemeStore } from "@/lib/stores/theme-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { isLocale, type Locale } from "@/lib/i18n/types";
import { useT } from "@/lib/i18n";
import { ConfirmDiffDialog, type DiffEntry } from "./confirm-diff-dialog";

type ServerTheme = "light" | "dark";

interface ProfilePreferencesCardProps {
  user: { locale: Locale; theme: ServerTheme };
}

function axiosMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function ProfilePreferencesCard({ user }: ProfilePreferencesCardProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const setThemeStore = useThemeStore((s) => s.setTheme);
  const setLocaleStore = useLocaleStore((s) => s.setLocale);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [tempTheme, setTempTheme] = useState<ServerTheme>(user.theme);
  const [tempLocale, setTempLocale] = useState<Locale>(user.locale);
  const [showDiff, setShowDiff] = useState(false);

  // user.theme/locale 이 외부 변경(다른 탭, refetch)으로 갱신되면 view 모드일 때만 동기화.
  // edit 모드 도중에는 사용자의 임시 선택을 덮어쓰지 않는다.
  useEffect(() => {
    if (mode === "view") {
      setTempTheme(user.theme);
      setTempLocale(user.locale);
    }
  }, [user.theme, user.locale, mode]);

  const dirty = tempTheme !== user.theme || tempLocale !== user.locale;

  const mutation = useMutation({
    mutationFn: async (patch: Partial<{ theme: ServerTheme; locale: Locale }>) => {
      await apiClient.patch("/users/me", patch);
    },
    onSuccess: (_data, patch) => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      if (patch.theme) setThemeStore(patch.theme);
      if (patch.locale) setLocaleStore(patch.locale);
      toast.success(t("profile.saved"));
      setShowDiff(false);
      setMode("view");
    },
    onError: (err) => {
      toast.error(axiosMessage(err, t("profile.saveFailed")));
    },
  });

  function handleEdit() {
    setTempTheme(user.theme);
    setTempLocale(user.locale);
    setMode("edit");
  }

  function handleCancel() {
    setTempTheme(user.theme);
    setTempLocale(user.locale);
    setThemeStore(user.theme); // 라이브 프리뷰 원복
    setMode("view");
  }

  function handleThemePreview(next: ServerTheme) {
    setTempTheme(next);
    setThemeStore(next); // 라이브 프리뷰
  }

  function handleSaveClick() {
    if (!dirty) {
      toast.info(t("profile.noChanges"));
      handleCancel();
      return;
    }
    setShowDiff(true);
  }

  const themeLabel = (val: ServerTheme): string =>
    val === "dark" ? t("profile.themeDark") : t("profile.themeLight");
  const localeLabel = (val: Locale): string =>
    val === "ko" ? t("profile.languageKorean") : t("profile.languageEnglish");

  const diff: DiffEntry[] = useMemo(() => {
    const entries: DiffEntry[] = [];
    if (tempTheme !== user.theme) {
      entries.push({
        label: t("profile.theme"),
        before: themeLabel(user.theme),
        after: themeLabel(tempTheme),
      });
    }
    if (tempLocale !== user.locale) {
      entries.push({
        label: t("profile.language"),
        before: localeLabel(user.locale),
        after: localeLabel(tempLocale),
      });
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempTheme, tempLocale, user.theme, user.locale, t]);

  const patchPayload = useMemo(() => {
    const p: Partial<{ theme: ServerTheme; locale: Locale }> = {};
    if (tempTheme !== user.theme) p.theme = tempTheme;
    if (tempLocale !== user.locale) p.locale = tempLocale;
    return p;
  }, [tempTheme, tempLocale, user.theme, user.locale]);

  const displayedTheme = mode === "edit" ? tempTheme : user.theme;
  const displayedLocale = mode === "edit" ? tempLocale : user.locale;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">{t("profile.preferences")}</CardTitle>
          {mode === "view" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              data-testid="profile-pref-edit"
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
                data-testid="profile-pref-cancel"
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveClick}
                disabled={mutation.isPending}
                data-testid="profile-pref-save"
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("profile.theme")}</Label>
            {mode === "view" ? (
              <p className="mt-1 text-sm" data-testid="pref-theme-readonly">
                {themeLabel(displayedTheme)}
              </p>
            ) : (
              <div className="mt-1 flex gap-2">
                <Button
                  variant={tempTheme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemePreview("light")}
                  data-testid="pref-theme-light"
                >
                  {t("profile.themeLight")}
                </Button>
                <Button
                  variant={tempTheme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemePreview("dark")}
                  data-testid="pref-theme-dark"
                >
                  {t("profile.themeDark")}
                </Button>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="language-select">{t("profile.language")}</Label>
            {mode === "view" ? (
              <p
                id="language-select"
                className="mt-1 text-sm"
                data-testid="pref-language-readonly"
              >
                {localeLabel(displayedLocale)}
              </p>
            ) : (
              <select
                id="language-select"
                className="flex h-10 w-full max-w-xs rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                value={tempLocale}
                onChange={(e) => {
                  const next = e.target.value;
                  if (isLocale(next)) setTempLocale(next);
                }}
                data-testid="pref-language-select"
              >
                <option value="ko">{t("profile.languageKorean")}</option>
                <option value="en">{t("profile.languageEnglish")}</option>
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDiffDialog
        open={showDiff}
        changes={diff}
        onClose={() => setShowDiff(false)}
        onConfirm={async () => {
          await mutation.mutateAsync(patchPayload);
        }}
      />
    </>
  );
}
