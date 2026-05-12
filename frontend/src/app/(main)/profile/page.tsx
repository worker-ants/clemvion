"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Loader2, ShieldCheck, History, KeyRound } from "lucide-react";
import { useThemeStore } from "@/lib/stores/theme-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useT } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/types";
import { ProfileInfoCard } from "./components/profile-info-card";
import { ProfilePreferencesCard } from "./components/profile-preferences-card";

type ServerTheme = "light" | "dark";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  locale: Locale;
  theme: ServerTheme;
}

export default function ProfilePage() {
  const t = useT();
  const setTheme = useThemeStore((s) => s.setTheme);
  const setLocaleStore = useLocaleStore((s) => s.setLocale);

  const { data: user, isLoading, isError } = useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await apiClient.get("/users/me");
      return res.data.data ?? res.data;
    },
  });

  // 첫 로드 시 server 값을 client store 에 동기화. 카드 안의 라이브 프리뷰는
  // 임시 state 로 격리되므로 본 effect 와 충돌하지 않는다.
  useEffect(() => {
    if (!user) return;
    if (isLocale(user.locale)) setLocaleStore(user.locale);
    if (user.theme === "light" || user.theme === "dark") setTheme(user.theme);
  }, [user, setTheme, setLocaleStore]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
        <p className="text-sm text-[hsl(var(--destructive))]">
          {t("profile.loadFailed")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("profile.title")}</h1>

      <ProfileInfoCard user={{ name: user.name, email: user.email }} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("profile.changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/profile/change-password"
            className="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--accent))]"
            data-testid="profile-change-password-link"
          >
            <KeyRound className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            <div className="flex-1">
              <p className="font-medium">
                {t("profile.changePasswordCardCta")}
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("profile.changePasswordCardHint")}
              </p>
            </div>
          </Link>
        </CardContent>
      </Card>

      <ProfilePreferencesCard
        user={{ locale: user.locale, theme: user.theme }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("profile.tabs.security")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/profile/security"
            className="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--accent))]"
          >
            <ShieldCheck className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            <div>
              <p className="font-medium">{t("profile.security.twoFactor")}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("profile.security.twoFactorDescription")}
              </p>
            </div>
          </Link>
          <Link
            href="/profile/sessions"
            className="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--accent))]"
          >
            <History className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            <div>
              <p className="font-medium">{t("profile.sessions.pageTitle")}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t("profile.sessions.pageDescription")}
              </p>
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
