"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
/** 미리보기 iframe 기본/최소 높이(px) — 위젯 collapsed(런처) 상태 기준. */
const PREVIEW_HEIGHT = 320;
/** wc:resize 로 늘어날 수 있는 미리보기 최대 높이(px) — expanded(패널) 도 콘솔에 담기게. */
const PREVIEW_MAX_HEIGHT = 640;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

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
  // 위젯이 보내는 wc:resize(collapsed↔expanded) 에 맞춰 미리보기 높이를 동적 조절(2-sdk §3).
  const [previewHeight, setPreviewHeight] = useState(PREVIEW_HEIGHT);

  const apiBase = getWebhookBaseUrl();
  const widgetOrigin = getWidgetOrigin();

  const bootConfig = useMemo(
    () => buildBootConfig(draftToBootInput(draft, { apiBase, triggerEndpointPath: endpointPath })),
    [draft, apiBase, endpointPath],
  );

  // 인스턴스/apiBase/locale 변경 시에만 iframe 재마운트(외형은 boot 재전송으로 처리).
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({ apiBase, trigger: endpointPath });
    if (draft.locale) params.set("locale", draft.locale);
    return `${getWidgetAppUrl()}/?${params.toString()}`;
  }, [apiBase, endpointPath, draft.locale]);

  // iframe 재마운트(iframeSrc 변경) 시 status 를 loading 으로 리셋 — effect 안 setState 회피를 위해
  // 렌더 중 처리(React 권장 "previous-render 정보 저장" 패턴).
  const [srcKey, setSrcKey] = useState(iframeSrc);
  if (srcKey !== iframeSrc) {
    setSrcKey(iframeSrc);
    setStatus("loading");
    setPreviewHeight(PREVIEW_HEIGHT);
  }

  // boot config 전송 — widgetOrigin 미확보 시 `"*"` 로 보내지 않고 전송 자체를 건너뛴다(보안).
  // bootConfig 에 직접 의존 → 외형 변경 시 postBoot 가 갱신돼 아래 effect 가 재전송한다.
  const postBoot = useCallback(() => {
    if (!widgetOrigin) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "wc:boot", payload: bootConfig },
      widgetOrigin,
    );
  }, [widgetOrigin, bootConfig]);

  // host→위젯 명령 — 세션 초기화 등(host-bridge `wc:command`). widgetOrigin 미확보 시 전송 생략(보안, postBoot 와 동형).
  const postCommand = useCallback(
    (action: string) => {
      if (!widgetOrigin) return;
      iframeRef.current?.contentWindow?.postMessage(
        { type: "wc:command", payload: { action } },
        widgetOrigin,
      );
    },
    [widgetOrigin],
  );

  // wc:ready 수신 → status ready. 타임아웃 시 unavailable. (boot 전송은 아래 effect 가 담당)
  // status 리셋은 위 렌더-중 처리. 여기서는 리스너·타임아웃만 등록.
  useEffect(() => {
    // widgetOrigin 미확보(SSR 엣지) 시에도 동봉 same-origin 으로 폴백 검증 — `*` 수용 금지.
    const expectedOrigin = widgetOrigin || window.location.origin;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.origin !== expectedOrigin) return;
      const data = e.data as { type?: string; payload?: { height?: number } } | null;
      if (data?.type === "wc:ready") setStatus("ready");
      else if (data?.type === "wc:resize" && typeof data.payload?.height === "number") {
        // 위젯 박스 높이에 맞춰 미리보기 iframe 을 늘리되, 콘솔 레이아웃을 위해 범위를 제한한다.
        setPreviewHeight(clamp(data.payload.height, PREVIEW_HEIGHT, PREVIEW_MAX_HEIGHT));
      }
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === "loading" ? "unavailable" : s));
    }, READY_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [iframeSrc, widgetOrigin]);

  // ready 진입 시(초기 boot) + 외형 폼 변경 시(postBoot 갱신, 재마운트 없이) wc:boot 전송 — 단일 경로.
  useEffect(() => {
    if (status === "ready") postBoot();
  }, [status, postBoot]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("webChat.preview.title")}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => postCommand("resetSession")}
          disabled={status !== "ready"}
          title={t("webChat.preview.resetHint")}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {t("webChat.preview.reset")}
        </Button>
      </div>
      <div
        className="relative overflow-hidden rounded-md border border-[hsl(var(--border))] transition-[min-height] duration-200"
        style={{ minHeight: previewHeight }}
      >
        {/* 동봉 위젯은 same-origin 우리 자산이라 EIA(localStorage/세션) 동작 위해 allow-same-origin 필요.
            allow-scripts 와 함께 두는 트레이드오프는 신뢰된 1st-party 위젯 한정으로 수용. */}
        <iframe
          key={iframeSrc}
          ref={iframeRef}
          src={iframeSrc}
          title={t("webChat.preview.title")}
          className="w-full border-0 bg-[hsl(var(--background))] transition-[height] duration-200"
          style={{ height: previewHeight }}
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
