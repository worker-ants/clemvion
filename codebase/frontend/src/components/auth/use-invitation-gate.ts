"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { invitationsApi, type InvitationMeta } from "@/lib/api/invitations";
import { extractApiMessage, type ApiErrorBody } from "@/lib/api/errors";
import { useT } from "@/lib/i18n";
import {
  buildInvitationLoginHref,
  invitationAcceptPath,
} from "@/lib/auth/post-login-redirect";
import { isRegisteredEmail } from "@/lib/auth/registered-email";
import { hasSessionHint } from "@/lib/auth/session-hint";

export type InvitationState =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ready"; meta: InvitationMeta }
  /** 토큰의 이메일이 이미 가입돼 있다. 로그인 화면으로 보냈다. */
  | { kind: "existingAccount" }
  | {
      kind: "error";
      /** HTTP status (410=만료/사용됨, 404=없음). 다른 경우 undefined. */
      status?: number;
      /** 서버가 내려준 raw message (없으면 status 별 i18n key 로 폴백). */
      message?: string;
    };

/**
 * 초대 가입 화면의 진입 판정(CLE-ACCT-WS 「초대 가입 화면」). 토큰마다 한 번 아래 순서로 정한다.
 *
 * 1. 로그인 힌트가 있으면 이미 로그인한 사용자다. 메타를 묻지 않고 초대 수락 페이지로 보낸다.
 * 2. 토큰 메타를 조회한다. 실패하면 `error` 다.
 * 3. 메타 조회가 성공한 뒤에만 토큰 이메일의 가입 여부를 묻는다. 가입돼 있으면 로그인 화면으로 보낸다.
 *    근거는 같은 문서 Rationale 「로그인하지 않은 기존 가입자는 로그인 뒤 수락 페이지로 보낸다」 다.
 * 4. 나머지는 `ready` 로 가입 폼을 연다.
 *
 * 가입 여부를 확인하지 못해 폼을 연 기존 가입자는 제출이 이메일 중복으로 끝난다. 그때 호출자가
 * `sendExistingAccountToLogin` 을 불러 3단계와 같은 안내와 경로로 보낸다.
 */
export function useInvitationGate(invitationToken: string | undefined): {
  state: InvitationState;
  sendExistingAccountToLogin: () => void;
} {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<InvitationState>(
    invitationToken ? { kind: "loading" } : { kind: "none" },
  );

  function goToLogin(token: string) {
    setState({ kind: "existingAccount" });
    toast.info(t("auth.register.invitationExistingAccount"));
    router.replace(buildInvitationLoginHref(token));
  }

  // 판정 effect 는 토큰에만 묶는다. `router` · `t` 가 새 참조로 와도 다시 돌지 않게 effect event 로 읽는다.
  // locale 이 바뀌면 `key={locale}` 로 폼이 새로 마운트되므로 판정도 새로 한다.
  const goToAcceptPage = useEffectEvent((token: string) => {
    router.replace(invitationAcceptPath(token));
  });
  const onExistingAccount = useEffectEvent(goToLogin);

  useEffect(() => {
    if (!invitationToken) return;
    // `(auth)` 라우트 그룹에는 AuthProvider 가 없어 store 로는 기존 로그인을 알 수 없다. proxy 와 같은
    // 로그인 힌트 쿠키로 본다. 힌트가 stale(쿠키만 남고 refresh 만료)이면 수락 페이지의 AuthProvider 가
    // 수락 페이지로 돌아오는 `/login?redirect=…` 로 보낸다.
    if (hasSessionHint()) {
      goToAcceptPage(invitationToken);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const meta = await invitationsApi.getByToken(invitationToken);
        if (cancelled) return;
        const registered = await isRegisteredEmail(meta.email);
        if (cancelled) return;
        if (registered) onExistingAccount(invitationToken);
        else setState({ kind: "ready", meta });
      } catch (err) {
        if (cancelled) return;
        const error = err as AxiosError<ApiErrorBody>;
        setState({
          kind: "error",
          status: error.response?.status,
          message: extractApiMessage(error),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invitationToken]);

  function sendExistingAccountToLogin() {
    // 가입 폼은 `ready` 에서만 제출할 수 있다. 그 밖의 상태에서 온 호출은 무시한다.
    if (!invitationToken || state.kind !== "ready") return;
    goToLogin(invitationToken);
  }

  return { state, sendExistingAccountToLogin };
}
