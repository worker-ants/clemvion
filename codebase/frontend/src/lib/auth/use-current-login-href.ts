"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  buildLoginHref,
  resolvePostLoginRedirect,
} from "@/lib/auth/post-login-redirect";

// 근거:
//   - [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION#로그인-뒤-이동)
//   - [오류 화면과 빈 상태 「감지 규칙」](CLE-UI-ERRORS#감지-규칙)

/**
 * 지금 화면으로 돌아오는 로그인 화면 경로(`/login?redirect=…`). 경로와 쿼리를 합쳐 복귀 경로로 담는다.
 * 안전한 같은 출처 경로가 아니면 `/dashboard` 를 담는다(판정은 `resolvePostLoginRedirect`).
 * 세션 만료 오류 화면(`(main)/error.tsx` 의 이동과 `ErrorPage` 의 «다시 로그인» 링크)이 쓴다.
 */
export function useCurrentLoginHref(): string {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const target = `${pathname ?? ""}${search ? `?${search}` : ""}`;
  return buildLoginHref(resolvePostLoginRedirect(target));
}
