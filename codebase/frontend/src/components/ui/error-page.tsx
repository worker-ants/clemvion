"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Lock,
  Search,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import { useCurrentLoginHref } from "@/lib/auth/use-current-login-href";

const DASHBOARD_PATH = "/dashboard";

/** 전체화면 에러 페이지의 5종 ([오류 화면과 빈 상태 「에러 페이지 다섯 가지」](CLE-UI-ERRORS#에러-페이지-다섯-가지)). */
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

/** SSR 안전한 현재 페이지 새로고침 (network 폴백). */
function reloadPage(): void {
  if (typeof window !== "undefined") window.location.reload();
}

/**
 * 던져진 에러(주로 axios 에러)의 HTTP 상태를 에러 페이지 variant 로 매핑한다.
 * [오류 화면과 빈 상태 「감지 규칙」](CLE-UI-ERRORS#감지-규칙):
 *   401 → sessionExpired · 403 → forbidden · 404 → notFound · 5xx → server · no-response → network.
 * 미정의 4xx(400/405/429 등)와 분류 불가한 일반 throw 는 `server` 로 폴백한다.
 */
export function errorToVariant(error: unknown): ErrorVariant {
  // 런타임 덕타이핑: axios 에러(`response`/`request`/`code`)·커스텀 에러(`status`)·원시값 모두 허용.
  const err = error as
    | { response?: { status?: number }; request?: unknown; code?: string; status?: number }
    | undefined;
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

/** ErrorPage 컴포넌트 props. `variant` 는 ErrorVariant 5종 중 하나. */
interface ErrorPageProps {
  variant: ErrorVariant;
  /** 재시도 콜백 (server/network). error.tsx 는 Next.js error boundary 의 `reset` 콜백을 넘긴다. */
  onRetry?: () => void;
  /** 컨테이너 루트 div 에 병합되는 Tailwind 클래스 (cn 유틸리티 경유). */
  className?: string;
}

/**
 * 세션 만료 변형의 «다시 로그인» 링크. 지금 화면의 경로와 쿼리를 복귀 경로로 담는다.
 * 쿼리를 읽는 훅(`useSearchParams`)을 이 변형에서만 부르려고 따로 둔다. not-found 처럼 미리
 * 렌더하는 화면은 이 컴포넌트를 그리지 않는다.
 */
function SessionExpiredLoginCta() {
  const t = useT();
  const loginHref = useCurrentLoginHref();
  return (
    <Button asChild>
      <Link href={loginHref}>{t("errorPage.sessionExpired.cta")}</Link>
    </Button>
  );
}

/**
 * 전체화면 에러 페이지 (아이콘 + 제목 + 설명 + CTA). 5 variant 공통 레이아웃.
 * route 파일(not-found.tsx / error.tsx / global-error.tsx)이 공유한다.
 */
export function ErrorPage({ variant, onRetry, className }: ErrorPageProps) {
  const t = useT();
  const Icon = ICONS[variant];

  const title = t(`errorPage.${variant}.title` as TranslationKey);
  const description = t(`errorPage.${variant}.description` as TranslationKey);

  /** variant 별 CTA 버튼 목록 (t·onRetry 를 클로저로 캡처). */
  function buildActions(): React.ReactNode[] {
    const linkCta = (key: TranslationKey, href: string) => (
      <Button key={href} asChild>
        <Link href={href}>{t(key)}</Link>
      </Button>
    );
    switch (variant) {
      case "sessionExpired":
        return [<SessionExpiredLoginCta key="login" />];
      case "forbidden":
        return [linkCta("errorPage.forbidden.cta", DASHBOARD_PATH)];
      case "notFound":
        return [linkCta("errorPage.notFound.cta", DASHBOARD_PATH)];
      case "server":
        return [
          ...(onRetry
            ? [
                <Button key="retry" onClick={onRetry}>
                  {t("errorPage.server.retry")}
                </Button>,
              ]
            : []),
          <Button
            key="dashboard"
            variant={onRetry ? "outline" : "default"}
            asChild
          >
            <Link href={DASHBOARD_PATH}>{t("errorPage.server.dashboard")}</Link>
          </Button>,
        ];
      case "network":
        return [
          <Button key="retry" onClick={onRetry ?? reloadPage}>
            {t("errorPage.network.retry")}
          </Button>,
        ];
    }
  }

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
        {buildActions()}
      </div>
    </div>
  );
}
