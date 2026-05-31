"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  Lock,
  Search,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

/** 전체화면 에러 페이지의 5종 (spec/2-navigation/11-error-empty-states.md §1.2). */
export type ErrorVariant =
  | "sessionExpired"
  | "forbidden"
  | "notFound"
  | "server"
  | "network";

const ICONS: Record<ErrorVariant, LucideIcon> = Object.freeze({
  sessionExpired: Lock,
  forbidden: Ban,
  notFound: Search,
  server: AlertTriangle,
  network: WifiOff,
});

/**
 * open-redirect 방지: 앱 내부 절대경로(`/foo`)만 redirect 대상으로 허용한다.
 * `//evil.com` 은 브라우저가 외부 도메인으로 해석할 수 있으므로 거부한다.
 */
export function isSafeRedirectPath(pathname: string | null): boolean {
  return (
    typeof pathname === "string" &&
    pathname.startsWith("/") &&
    !pathname.startsWith("//")
  );
}

/**
 * 던져진 에러(주로 axios 에러)의 HTTP 상태를 에러 페이지 variant 로 매핑한다.
 * spec/2-navigation/11-error-empty-states.md §1.3 의 감지 규칙:
 *   401 → sessionExpired · 403 → forbidden · 404 → notFound · 5xx → server · no-response → network.
 * 분류 불가한 일반 throw 는 `server` 로 폴백한다.
 */
export function errorToVariant(error: unknown): ErrorVariant {
  const err = error as
    | { response?: { status?: number }; request?: unknown; code?: string; status?: number }
    | undefined;
  // axios: err.response.status / 커스텀 에러: err.status
  const status = err?.response?.status ?? err?.status;
  if (status === 401) return "sessionExpired";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (typeof status === "number" && status >= 500) return "server";
  // 응답이 없고 요청만 있거나 네트워크 코드면 네트워크 오류
  if (
    (!err?.response && err?.request) ||
    err?.code === "ERR_NETWORK" ||
    err?.code === "ECONNABORTED"
  ) {
    return "network";
  }
  return "server";
}

interface ErrorPageProps {
  variant: ErrorVariant;
  /** 재시도 콜백 (server/network). error.tsx 는 Next.js error boundary 의 `reset` 콜백을 넘긴다. */
  onRetry?: () => void;
  /** 컨테이너 루트 div 에 병합되는 Tailwind 클래스 (cn 유틸리티 경유). */
  className?: string;
}

/** variant 별 CTA 버튼 목록을 구성한다 (렌더 책임과 분리). */
function buildActions(
  variant: ErrorVariant,
  t: TFunction,
  loginHref: string,
  onRetry?: () => void,
): React.ReactNode[] {
  const linkCta = (key: TranslationKey, href: string) => (
    <Button key={href} asChild>
      <Link href={href}>{t(key)}</Link>
    </Button>
  );

  switch (variant) {
    case "sessionExpired":
      return [linkCta("errorPage.sessionExpired.cta", loginHref)];
    case "forbidden":
      return [linkCta("errorPage.forbidden.cta", "/workspace/settings")];
    case "notFound":
      return [linkCta("errorPage.notFound.cta", "/dashboard")];
    case "server":
      return [
        ...(onRetry
          ? [
              <Button key="retry" onClick={onRetry}>
                {t("errorPage.server.retry")}
              </Button>,
            ]
          : []),
        <Button key="dashboard" variant={onRetry ? "outline" : "default"} asChild>
          <Link href="/dashboard">{t("errorPage.server.dashboard")}</Link>
        </Button>,
      ];
    case "network":
      return [
        <Button
          key="retry"
          onClick={onRetry ?? (() => window.location.reload())}
        >
          {t("errorPage.network.retry")}
        </Button>,
      ];
  }
}

/**
 * 전체화면 에러 페이지 (아이콘 + 제목 + 설명 + CTA). 5 variant 공통 레이아웃.
 * route 파일(not-found.tsx / error.tsx / global-error.tsx)이 공유한다.
 */
export function ErrorPage({ variant, onRetry, className }: ErrorPageProps) {
  const t = useT();
  const pathname = usePathname();
  const Icon = ICONS[variant];

  const title = t(`errorPage.${variant}.title` as TranslationKey);
  const description = t(`errorPage.${variant}.description` as TranslationKey);

  const redirectTarget = isSafeRedirectPath(pathname) ? pathname! : "/dashboard";
  const loginHref = `/login?redirect=${encodeURIComponent(redirectTarget)}`;

  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-[60vh] w-full flex-col items-center justify-center px-4 py-12 text-center",
        className,
      )}
    >
      <div className="mb-6 rounded-full bg-[hsl(var(--muted))] p-5">
        <Icon
          className="h-10 w-10 text-[hsl(var(--muted-foreground))]"
          aria-hidden="true"
        />
      </div>
      <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
      <p className="mb-6 max-w-md text-sm text-[hsl(var(--muted-foreground))]">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {buildActions(variant, t, loginHref, onRetry)}
      </div>
    </div>
  );
}
