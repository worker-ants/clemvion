"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { axiosMessage } from "@/lib/api/errors";
import {
  USER_PROFILE_QUERY_KEY,
  type ServerTheme,
} from "@/lib/api/users";
import { useThemeStore } from "@/lib/stores/theme-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { isLocale, type Locale } from "@/lib/i18n/types";
import { useT } from "@/lib/i18n";
import { ConfirmDiffDialog, type DiffEntry } from "./confirm-diff-dialog";

interface ProfilePreferencesCardProps {
  user: { locale: Locale; theme: ServerTheme };
}

type PreferencesPatch = Partial<{ theme: ServerTheme; locale: Locale }>;

export function ProfilePreferencesCard({ user }: ProfilePreferencesCardProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const setThemeStore = useThemeStore((s) => s.setTheme);
  const setLocaleStore = useLocaleStore((s) => s.setLocale);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [tempTheme, setTempTheme] = useState<ServerTheme>(user.theme);
  const [tempLocale, setTempLocale] = useState<Locale>(user.locale);
  const [showDiff, setShowDiff] = useState(false);
  // diff 모달이 열린 시점의 payload 스냅샷. 모달 열린 사이 사용자가 추가 조작해도
  // 모달에 표시한 값과 PATCH 가 일치하도록 한다.
  const confirmedPatchRef = useRef<PreferencesPatch>({});

  // view 모드에서는 user.theme/locale 을 직접 표시하므로 tempTheme/Locale 이 stale
  // 해도 무방. edit 모드 진입 시 handleEdit() 가 user 값으로 동기화한다 (반대로,
  // edit 도중 외부 갱신으로 사용자의 임시 선택이 덮이는 일을 방지하기 위해 useEffect 동기화는 두지 않는다).

  const dirty = tempTheme !== user.theme || tempLocale !== user.locale;

  const mutation = useMutation({
    mutationFn: async (patch: PreferencesPatch) => {
      await apiClient.patch("/users/me", patch);
    },
    onSuccess: (_data, patch) => {
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_QUERY_KEY });
      if (patch.theme !== undefined) setThemeStore(patch.theme);
      if (patch.locale !== undefined) setLocaleStore(patch.locale);
      toast.success(t("profile.saved"));
      setShowDiff(false);
      setMode("view");
    },
    onError: (err) => {
      // 에러 시 diff 모달을 닫고 편집 모드를 유지해 사용자가 재시도하기 좋게 한다.
      setShowDiff(false);
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
    confirmedPatchRef.current = buildPatch();
    setShowDiff(true);
  }

  function handleDiffClose() {
    // spec §2.0: 모달 닫힘 시 라이브 프리뷰 원복 (사용자가 시각적으로 변경한
    // theme 가 모달 dismiss 만으로 사라지지 않으면 의도와 어긋난다).
    setThemeStore(user.theme);
    setShowDiff(false);
  }

  function buildPatch(): PreferencesPatch {
    const p: PreferencesPatch = {};
    if (tempTheme !== user.theme) p.theme = tempTheme;
    if (tempLocale !== user.locale) p.locale = tempLocale;
    return p;
  }

  const diff: DiffEntry[] = useMemo(() => {
    const themeLabel = (val: ServerTheme): string =>
      val === "dark" ? t("profile.themeDark") : t("profile.themeLight");
    const localeLabel = (val: Locale): string =>
      val === "ko" ? t("profile.languageKorean") : t("profile.languageEnglish");

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
  }, [tempTheme, tempLocale, user.theme, user.locale, t]);

  const themeReadonlyLabel =
    user.theme === "dark" ? t("profile.themeDark") : t("profile.themeLight");
  const localeReadonlyLabel =
    user.locale === "ko"
      ? t("profile.languageKorean")
      : t("profile.languageEnglish");

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
                {themeReadonlyLabel}
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
                {localeReadonlyLabel}
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
        onClose={handleDiffClose}
        onConfirm={async () => {
          await mutation.mutateAsync(confirmedPatchRef.current);
        }}
      />
    </>
  );
}
