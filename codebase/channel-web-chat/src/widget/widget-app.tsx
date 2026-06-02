"use client";

import { useWidget } from "./use-widget";
import { Launcher } from "./components/launcher";
import { Panel } from "./components/panel";
import { widgetStyles } from "./styles";

// 위젯 SPA 진입 — useWidget(상태기계+EIA+bridge) 로 런처/패널 렌더.
// spec/7-channel-web-chat/1-widget-app.
export default function WidgetApp() {
  const { state, config, actions } = useWidget();

  // 임베드 allowlist soft 검증 실패 → 위젯을 전혀 렌더하지 않음(렌더 거부, 4-security §3-①).
  if (state.phase === "blocked") return null;

  // config 미수신(boot 대기) → 런처만 노출(추천질문 없음).
  const primaryColor = config?.appearance?.primaryColor ?? "#5B4FE9";
  const position = config?.appearance?.position ?? "bottom-right";
  const launcherSuggestions = config?.launcher?.suggestions ?? [];

  return (
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
  );
}
