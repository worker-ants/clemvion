"use client";

import { useEffect, useMemo } from "react";
import { useWidget } from "./use-widget";
import { Launcher } from "./components/launcher";
import { Panel } from "./components/panel";
import { widgetStyles } from "./styles";
import { I18nProvider, resolveLocale, currentNavigatorLang } from "@/lib/i18n";

// 위젯 박스 크기(px) — host(loader/미리보기)가 iframe 엘리먼트를 이 값에 맞춘다(wc:resize, 2-sdk §3).
// styles.ts 의 고정 치수에서 유도: 패널 360×540 + 16px 여백 = 392×572; 런처 버튼 56 + 추천 버블/여백 여유.
const PANEL_BOX = { width: 392, height: 572 } as const;
const LAUNCHER_BOX = { width: 392, height: 132 } as const;

// 위젯 SPA 진입 — useWidget(상태기계+EIA+bridge) 로 런처/패널 렌더.
// spec/7-channel-web-chat/1-widget-app.
export default function WidgetApp() {
  const { state, config, actions } = useWidget();

  // host 가 iframe 박스를 위젯 상태에 맞추도록 wc:resize 송신(2-sdk §3 필수). 렌더 분기(early return)
  // 이전에 effect 를 두어 hooks 순서를 보존한다. blocked/hidden → 박스 0(호스트 페이지 클릭 방해 제거),
  // 패널 open → expanded, 그 외 → launcher.
  const visible = state.phase !== "blocked" && !state.hidden;
  const expanded = visible && state.open && !!config;
  const { sendResize } = actions;
  // locale 은 boot 시 1회 해석해 위젯 전역에 고정(§4): 명시 config.locale → 브라우저 auto-detect → ko.
  // config 도착 전(런처만 렌더)에는 auto-detect 로 방문자 언어를 따른다. locale 변경은 iframe 재마운트로 반영.
  const locale = useMemo(
    () => resolveLocale(config?.locale, currentNavigatorLang()),
    [config?.locale],
  );
  useEffect(() => {
    if (!visible) {
      sendResize({ width: 0, height: 0, state: "collapsed" });
      return;
    }
    sendResize(
      expanded
        ? { ...PANEL_BOX, state: "expanded" }
        : { ...LAUNCHER_BOX, state: "collapsed" },
    );
  }, [visible, expanded, sendResize]);

  // 임베드 allowlist soft 검증 실패 → 위젯을 전혀 렌더하지 않음(렌더 거부, 4-security §3-①).
  if (state.phase === "blocked") return null;

  // host `hide` → 위젯(런처+패널) 전체 미렌더. open/close 와 직교한 가시성 축(§3.2). `show` 로 복귀.
  if (state.hidden) return null;

  // config 미수신(boot 대기) → 런처만 노출(추천질문 없음).
  const primaryColor = config?.appearance?.primaryColor ?? "#5B4FE9";
  const position = config?.appearance?.position ?? "bottom-right";
  const launcherSuggestions = config?.launcher?.suggestions ?? [];

  return (
    <I18nProvider locale={locale}>
      <div className="wc-root" data-position={position} data-testid="web-chat-widget" data-phase={state.phase}>
        <style>{widgetStyles}</style>
        {state.open && config ? (
          <Panel state={state} config={config} actions={actions} />
        ) : (
          <Launcher
            suggestions={state.messages.length === 0 ? launcherSuggestions : []}
            primaryColor={primaryColor}
            unread={state.unread}
            onOpen={actions.open}
            onSuggestion={(text) => {
              actions.open();
              actions.submitMessage(text);
            }}
          />
        )}
      </div>
    </I18nProvider>
  );
}
