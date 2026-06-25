import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { TFunction } from "@/lib/i18n";

interface OAuthCallbackPayload {
  type: "oauth_callback";
  status: "success" | "error";
  mode?: "new" | "reauthorize" | "request_scopes";
  provider?: string;
  integrationId?: string | null;
  previewToken?: string | null;
  error?: string | null;
}

function openOAuthPopup(url: string): Window | null {
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(
    url,
    "integration-oauth",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
  );
}

// 팝업 미복귀 시 대기 상한(이후 자동 종료). spec §3.5 OAuth 팝업 흐름.
const OAUTH_POPUP_TIMEOUT_MS = 5 * 60 * 1000;
// popup.closed 관측 후 성공 postMessage 가 끼어들 여지를 주는 deferred 대기.
const POPUP_CLOSED_BAIL_DELAY_MS = 1500;
// popup.closed 폴링 주기.
const POPUP_CLOSED_POLL_INTERVAL_MS = 500;

/**
 * OAuth 팝업 복귀 상태 기계 — `new/page.tsx` 인증 단계에서 OAuth 팝업을 열고,
 * 팝업이 postMessage 로 보내는 `oauth_callback` 을 수신해 previewToken 을 확보한다.
 * spec/2-navigation/4-integration.md §3.5(팝업 postMessage)·§3.6(이탈·복원).
 *
 * 회귀 민감: message handler 는 mount-only(`[]`), popup.closed 폴링은
 * `[oauthWaiting]` 의존이며, 성공 postMessage 가 popup.closed 관측과 deferred
 * 체크 사이에 끼어들 수 있어 oauthWaiting/previewToken 을 ref 로 읽어 stale-read·
 * 이중 에러 토스트를 막는다. (refactor 03 m-3 — page.tsx 에서 무변경 추출.)
 *
 * @param t i18n 함수.
 * @param onAuthorized previewToken 확보(성공) 시 호출 — 호출자가 다음 step 으로 이동.
 */
export function useOauthPopupReturn({
  t,
  onAuthorized,
}: {
  t: TFunction;
  onAuthorized: () => void;
}) {
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOAuthTimeout = () => {
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const handler = (event: MessageEvent<OAuthCallbackPayload>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth_callback") return;
      clearOAuthTimeout();
      setOauthWaiting(false);
      if (event.data.status === "error") {
        const msg = event.data.error ?? t("integrations.oauthFailedShort");
        setOauthError(msg);
        toast.error(msg);
        return;
      }
      if (event.data.previewToken) {
        setPreviewToken(event.data.previewToken);
        setOauthError(null);
        toast.success(t("integrations.oauthCompletedToast"));
        onAuthorized();
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      clearOAuthTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Public-flow safety net: if the popup is closed (manually or after our
  // callback HTML's delayed close) without ever firing the message handler
  // — e.g. the user cancelled at the provider, blocked popups, or origin
  // mismatch silently dropped postMessage — we'd otherwise sit in
  // `oauthWaiting` until the 5-minute timeout. Poll popup.closed and bail
  // out within 5s of close.
  //
  // Refs (not state) feed the closure to avoid stale reads: the success
  // postMessage handler can fire BETWEEN our popup.closed observation and
  // the deferred check, flipping oauthWaiting → false; we must see that
  // latest value or we'd double-fire the error toast.
  const oauthWaitingRef = useRef(oauthWaiting);
  const previewTokenRef = useRef(previewToken);
  useEffect(() => {
    oauthWaitingRef.current = oauthWaiting;
  }, [oauthWaiting]);
  useEffect(() => {
    previewTokenRef.current = previewToken;
  }, [previewToken]);

  useEffect(() => {
    if (!oauthWaiting) return;
    let bailTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      const popup = popupRef.current;
      if (popup && popup.closed) {
        bailTimer = setTimeout(() => {
          if (!oauthWaitingRef.current) return; // success handler already won
          clearOAuthTimeout();
          setOauthWaiting(false);
          if (!previewTokenRef.current) {
            setOauthError(t("integrations.oauthPopupClosedNoResult"));
            toast.error(t("integrations.oauthPopupClosedNoResult"));
          }
        }, POPUP_CLOSED_BAIL_DELAY_MS);
        clearInterval(interval);
      }
    }, POPUP_CLOSED_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (bailTimer) clearTimeout(bailTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthWaiting]);

  /**
   * OAuth 팝업을 열고 대기 상태 + 5분 타임아웃을 건다. oauthBegin 성공 시
   * authUrl 분기에서 호출한다.
   */
  const startPopup = (authUrl: string) => {
    popupRef.current = openOAuthPopup(authUrl);
    setOauthError(null);
    setOauthWaiting(true);
    clearOAuthTimeout();
    oauthTimeoutRef.current = setTimeout(() => {
      setOauthWaiting(false);
      setOauthError(t("integrations.oauthTimedOutShort"));
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      toast.error(t("integrations.oauthTimedOutMessage"));
    }, OAUTH_POPUP_TIMEOUT_MS);
    toast.message(t("integrations.oauthContinueInPopup"));
  };

  return {
    oauthWaiting,
    oauthError,
    previewToken,
    setPreviewToken,
    startPopup,
  };
}
