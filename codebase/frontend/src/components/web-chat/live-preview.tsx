"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getWebhookBaseUrl } from "@/lib/utils/webhook-url";
import { buildBootConfig } from "@/lib/web-chat/snippet";
import { getWidgetAppUrl, getWidgetOrigin } from "@/lib/web-chat/widget-base";
import { draftToBootInput } from "./snippet-input";
import type { WebChatDraft } from "./use-appearance-draft";

interface Props {
  endpointPath: string;
  draft: WebChatDraft;
}

/** 위젯이 `wc:ready` 를 보내지 않으면(번들 미동봉·로드 실패) 안내로 전환하는 시간. */
const READY_TIMEOUT_MS = 8000;

/**
 * 라이브 미리보기 — same-origin 동봉 위젯을 contained iframe 으로 띄우고 `wc:boot` postMessage
 * 로 외형/콘텐츠를 전달한다 (spec 5-admin-console §6·§6.1, 2-sdk §3 프로토콜).
 *
 * - iframe `src` = `<widgetBase>/web-chat/v1/app/?apiBase=&trigger=&locale=` (query 1차 부트스트랩)
 * - iframe 의 `wc:ready` 수신 → 전체 boot config 를 `wc:boot` 로 전달
 * - 외형 폼만 바뀌면 boot 재전송(재마운트 없음); 인스턴스/locale 변경 시 iframe key 재마운트
 * - 번들 미동봉이면 `wc:ready` 가 안 와 타임아웃 → 안내(증분 1 placeholder 와 동일 메시지)
 */
export function LivePreview({ endpointPath, draft }: Props) {
  const t = useT();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  const apiBase = getWebhookBaseUrl();
  const widgetOrigin = getWidgetOrigin();

  const bootConfig = useMemo(
    () => buildBootConfig(draftToBootInput(draft, { apiBase, triggerEndpointPath: endpointPath })),
    [draft, apiBase, endpointPath],
  );
  const bootConfigRef = useRef(bootConfig);
  bootConfigRef.current = bootConfig;

  // 인스턴스/apiBase/locale 변경 시에만 iframe 재마운트(외형은 boot 재전송으로 처리).
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({ apiBase, trigger: endpointPath });
    if (draft.locale) params.set("locale", draft.locale);
    return `${getWidgetAppUrl()}/?${params.toString()}`;
  }, [apiBase, endpointPath, draft.locale]);

  function postBoot() {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "wc:boot", payload: bootConfigRef.current },
      widgetOrigin || "*",
    );
  }

  // wc:ready 수신 → status ready. 타임아웃 시 unavailable. (boot 전송은 아래 effect 가 일원 담당)
  useEffect(() => {
    setStatus("loading");
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (widgetOrigin && e.origin !== widgetOrigin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === "wc:ready") setStatus("ready");
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === "loading" ? "unavailable" : s));
    }, READY_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
    // iframeSrc 변경 = 재마운트 → ready 재대기. widgetOrigin 은 안정적.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeSrc, widgetOrigin]);

  // ready 진입 시(초기 boot) + 외형 폼 변경 시(재마운트 없이 갱신) wc:boot 전송 — 단일 경로.
  useEffect(() => {
    if (status === "ready") postBoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootConfig, status]);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("webChat.preview.title")}</h3>
      <div className="relative min-h-[320px] overflow-hidden rounded-md border border-[hsl(var(--border))]">
        <iframe
          key={iframeSrc}
          ref={iframeRef}
          src={iframeSrc}
          title={t("webChat.preview.title")}
          className="h-[320px] w-full border-0 bg-[hsl(var(--background))]"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
        {status === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[hsl(var(--card))] p-6 text-center">
            <MessageCircle className="mb-3 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
            <p className="max-w-sm text-sm text-[hsl(var(--muted-foreground))]">
              {t("webChat.preview.unavailable")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
