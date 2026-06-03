"use client";

// dev 전용 데모 호스트 — 운영에서 SDK(@workflow/web-chat)가 하는 "호스트 페이지" 역할을 로컬에서 흉내낸다.
// 좌측 설정 폼 → wc:boot 페이로드 조립 → 우측 iframe(위젯 SPA, src=/)에 postMessage 로 주입,
// 위젯이 보내는 wc:event/wc:resize 를 이벤트 로그로 표시. host↔iframe 프로토콜은 spec/7-channel-web-chat/2-sdk §3.
// 게이팅·prod 제외는 demo-config.isDemoEnabled / page.tsx 참조.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildBootConfig,
  defaultDemoForm,
  isBootReady,
  type DemoFormState,
} from "./demo-config";

// 데모는 wc:command 중 open/close/sendMessage 만 버튼으로 노출한다. show/hide/updateProfile 은
// 위젯 SPA(use-widget onCommand show/hide/updateProfile case)에 구현돼 있으나, 데모 시뮬레이션
// 단순화를 위해 버튼을 두지 않는다 (실제 SDK 에서는 동작).
type DemoCommand = "open" | "close" | "sendMessage";

interface LogEntry {
  id: number;
  time: string;
  dir: "→" | "←";
  type: string;
  detail: string;
}

// 위젯은 NEXT_PUBLIC_BASE_PATH 하위로 서빙될 수 있으므로 iframe src 도 동일 base 기준(0-architecture §4).
// W2(코드리뷰): 본 데모는 위젯을 같은 dev origin(src=/)에 임베드한다는 전제로 targetOrigin/수신 필터를
// window.location.origin 으로 고정한다. 위젯을 별도 CDN origin 에 띄우는 운영 경로는 SDK(@workflow/web-chat)
// 담당이며, 데모를 그렇게 확장할 땐 NEXT_PUBLIC_WIDGET_ORIGIN 으로 발신/수신 origin 을 단일 소스화한다.
const WIDGET_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`;
const MAX_LOG_ENTRIES = 60;
const PANEL_WIDTH = 380;

/** dev 전용 데모 호스트 컴포넌트 — 설정 폼으로 wc:boot 를 조립해 우측 iframe 위젯에 주입하고 wc:event 를 로깅한다. */
export default function DemoHost() {
  const [form, setForm] = useState<DemoFormState>(defaultDemoForm);
  const [sendText, setSendText] = useState("");
  const [booted, setBooted] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  // iframe 재마운트로 매 "부팅" 시 위젯을 초기 상태로 리셋.
  const [iframeKey, setIframeKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingBootRef = useRef<ReturnType<typeof buildBootConfig> | null>(null);
  const logSeqRef = useRef(0);

  const appendLog = useCallback((dir: "→" | "←", type: string, detail: unknown) => {
    const entry: LogEntry = {
      id: logSeqRef.current++,
      time: new Date().toLocaleTimeString(),
      dir,
      type,
      detail: detail === undefined ? "" : JSON.stringify(detail),
    };
    setLog((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, []);

  const postToWidget = useCallback(
    (type: string, payload?: unknown) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      // 데모는 same-origin(위젯 src=/) — targetOrigin 을 현재 origin 으로 고정.
      win.postMessage({ type, payload }, window.location.origin);
      appendLog("→", type, payload);
    },
    [appendLog],
  );

  // 위젯(iframe)→호스트 메시지 수신. I6: event.source(iframe)·origin 검증 후에만 처리.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; payload?: unknown } | null;
      if (!data || typeof data.type !== "string" || !data.type.startsWith("wc:")) return;

      if (data.type === "wc:ready") {
        appendLog("←", "wc:ready", undefined);
        // 핸드셰이크 완료 → 대기 중이던 boot 주입.
        if (pendingBootRef.current) {
          postToWidget("wc:boot", pendingBootRef.current);
          pendingBootRef.current = null;
          setBooted(true);
        }
        return;
      }
      // wc:event / wc:resize 등은 로그만(데모는 iframe 크기 고정 — wc:resize 는 forward-compat 표시용).
      appendLog("←", data.type, data.payload);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appendLog, postToWidget]);

  const handleBoot = useCallback(() => {
    if (!isBootReady(form)) return;
    pendingBootRef.current = buildBootConfig(form);
    setBooted(false);
    setLog([]);
    logSeqRef.current = 0;
    // iframe 재마운트 → 새 위젯이 wc:ready 를 보내면 위 리스너가 boot 주입.
    setIframeKey((k) => k + 1);
  }, [form]);

  const sendCommand = useCallback(
    (action: DemoCommand) => {
      if (action === "sendMessage") {
        if (!sendText.trim()) return;
        postToWidget("wc:command", { action, text: sendText.trim() });
        setSendText("");
        return;
      }
      postToWidget("wc:command", { action });
    },
    [postToWidget, sendText],
  );

  const update = useCallback(
    <K extends keyof DemoFormState>(key: K, value: DemoFormState[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  const ready = isBootReady(form);
  // 실제 데모 origin (CORS 안내용). SSR/prerender 시엔 기본 포트 fallback, 브라우저에선 실제 origin.
  const demoOrigin = typeof window === "undefined" ? "http://localhost:3013" : window.location.origin;

  return (
    <div style={S.root}>
      <aside style={S.panel}>
        <header style={S.header}>
          <h1 style={S.h1}>Web Chat 위젯 데모 (dev)</h1>
          <p style={S.sub}>
            아래 설정으로 우측 iframe 위젯에 <code>wc:boot</code> 을 보냅니다. 실제 대화는{" "}
            <strong>backend(API Host)</strong> 와 <strong>공개 webhook trigger</strong> 가 있어야 동작합니다.
          </p>
        </header>

        <Section title="연결 (필수)">
          <Field label="API Host (apiBase) — origin only, no /api">
            <input
              style={S.input}
              value={form.apiBase}
              onChange={(e) => update("apiBase", e.target.value)}
              placeholder="http://localhost:3011"
            />
          </Field>
          <Field label="Trigger endpoint path (공개 webhook UUID)">
            <input
              style={S.input}
              value={form.triggerEndpointPath}
              onChange={(e) => update("triggerEndpointPath", e.target.value)}
              placeholder="예: a1b2c3-...  (backend 트리거 화면에서 복사)"
            />
          </Field>
          {!ready && (
            <p style={S.hint}>
              apiBase 와 trigger 를 모두 채우면 부팅됩니다. trigger 는 backend 의 webhook 트리거를 만들어 그
              endpoint path(UUID)를 붙여넣으세요.
            </p>
          )}
          {/* CORS 주의는 ready 여부와 무관하게 항상 노출 — 부팅 전에 사전 안내해야 한다. */}
          <p style={S.hint}>
            ⚠️ <strong>스트림 응답</strong>을 받으려면 backend 가 이 데모 origin 을 <code>/api/external/*</code> CORS
            에 허용해야 합니다(SSE). 첫 메시지(webhook)는 무제한 CORS 로 전송되지만, AI 응답 SSE 는 워크스페이스
            allowlist 를 타기 때문입니다. 로컬은 backend <code>.env</code> 에{" "}
            <code>WEB_CHAT_WIDGET_ORIGINS={demoOrigin}</code> 설정(또는 워크스페이스{" "}
            <code>interactionAllowedOrigins</code> 에 추가) 후 backend 재시작.
          </p>
        </Section>

        <Section title="외형/콘텐츠 (선택)">
          <Row>
            <Field label="Locale">
              <select
                style={S.input}
                value={form.locale}
                onChange={(e) => update("locale", e.target.value as DemoFormState["locale"])}
              >
                <option value="ko">ko</option>
                <option value="en">en</option>
              </select>
            </Field>
            <Field label="Position">
              <select
                style={S.input}
                value={form.position}
                onChange={(e) => update("position", e.target.value as DemoFormState["position"])}
              >
                <option value="bottom-right">bottom-right</option>
                <option value="bottom-left">bottom-left</option>
              </select>
            </Field>
            <Field label="Primary color">
              <input
                style={{ ...S.input, padding: 2, height: 32 }}
                type="color"
                value={form.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
              />
            </Field>
          </Row>
          <Field label="Header title">
            <input
              style={S.input}
              value={form.headerTitle}
              onChange={(e) => update("headerTitle", e.target.value)}
            />
          </Field>
          <Field label="Welcome text">
            <input
              style={S.input}
              value={form.welcomeText}
              onChange={(e) => update("welcomeText", e.target.value)}
            />
          </Field>
          <Field label="Welcome suggestions (줄바꿈/콤마 구분)">
            <textarea
              style={{ ...S.input, height: 52, resize: "vertical" }}
              value={form.welcomeSuggestions}
              onChange={(e) => update("welcomeSuggestions", e.target.value)}
            />
          </Field>
          <Field label="Launcher suggestions (줄바꿈/콤마 구분)">
            <textarea
              style={{ ...S.input, height: 40, resize: "vertical" }}
              value={form.launcherSuggestions}
              onChange={(e) => update("launcherSuggestions", e.target.value)}
            />
          </Field>
          <Field label="Disclaimer">
            <input
              style={S.input}
              value={form.disclaimer}
              onChange={(e) => update("disclaimer", e.target.value)}
            />
          </Field>
        </Section>

        <button style={{ ...S.btn, opacity: ready ? 1 : 0.5 }} disabled={!ready} onClick={handleBoot}>
          {booted ? "재부팅 (설정 적용)" : "부팅 (wc:boot 전송)"}
        </button>

        <Section title="명령 (boot 후)">
          <Row>
            <button style={S.cmd} disabled={!booted} onClick={() => sendCommand("open")}>
              open
            </button>
            <button style={S.cmd} disabled={!booted} onClick={() => sendCommand("close")}>
              close
            </button>
          </Row>
          <Row>
            <input
              style={S.input}
              value={sendText}
              onChange={(e) => setSendText(e.target.value)}
              placeholder="sendMessage 텍스트"
              onKeyDown={(e) => e.key === "Enter" && sendCommand("sendMessage")}
            />
            <button
              style={S.cmd}
              disabled={!booted || !sendText.trim()}
              onClick={() => sendCommand("sendMessage")}
            >
              send
            </button>
          </Row>
          <p style={S.hint}>
            <code>show</code>/<code>hide</code>/<code>updateProfile</code> 은 위젯 SPA 에 구현돼 있으나(실제 SDK 에서 동작), 데모에서는 단순화를 위해 버튼을 두지 않습니다.
          </p>
        </Section>

        <Section title={`이벤트 로그 (${log.length})`}>
          <div style={S.log}>
            {log.length === 0 ? (
              <div style={S.logEmpty}>아직 메시지가 없습니다.</div>
            ) : (
              log.map((l) => (
                <div key={l.id} style={S.logRow}>
                  <span style={S.logTime}>{l.time}</span>
                  <span style={{ ...S.logDir, color: l.dir === "→" ? "#2563eb" : "#16a34a" }}>
                    {l.dir}
                  </span>
                  <span style={S.logType}>{l.type}</span>
                  <span style={S.logDetail}>{l.detail}</span>
                </div>
              ))
            )}
          </div>
        </Section>
      </aside>

      <main style={S.preview}>
        <div style={S.previewLabel}>
          미리보기 — iframe <code>{WIDGET_SRC}</code> (위젯 SPA)
        </div>
        <div style={S.iframeWrap}>
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={WIDGET_SRC}
            title="web-chat-widget"
            style={S.iframe}
          />
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={S.section}>
      <h2 style={S.h2}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={S.field}>
      <span style={S.label}>{label}</span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={S.row}>{children}</div>;
}

const S: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#111827",
  },
  panel: {
    width: PANEL_WIDTH,
    flex: `0 0 ${PANEL_WIDTH}px`,
    borderRight: "1px solid #e5e7eb",
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    background: "#fafafa",
  },
  header: { display: "flex", flexDirection: "column", gap: 4 },
  h1: { fontSize: 16, margin: 0 },
  sub: { fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  h2: { fontSize: 13, margin: 0, color: "#374151", borderBottom: "1px solid #eee", paddingBottom: 4 },
  field: { display: "flex", flexDirection: "column", gap: 3, flex: 1 },
  label: { fontSize: 11, color: "#6b7280" },
  input: {
    padding: "6px 8px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },
  row: { display: "flex", gap: 8, alignItems: "flex-end" },
  hint: { fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.5 },
  btn: {
    padding: "10px 14px",
    background: "#5B4FE9",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 600,
  },
  cmd: {
    padding: "6px 12px",
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
  },
  log: {
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#fff",
    maxHeight: 220,
    overflowY: "auto",
    fontSize: 11,
    fontFamily: "ui-monospace, monospace",
  },
  logEmpty: { padding: 10, color: "#9ca3af" },
  logRow: { display: "flex", gap: 6, padding: "3px 6px", borderBottom: "1px solid #f3f4f6" },
  logTime: { color: "#9ca3af", flex: "0 0 auto" },
  logDir: { fontWeight: 700, flex: "0 0 auto" },
  logType: { color: "#111827", flex: "0 0 auto", fontWeight: 600 },
  logDetail: { color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  preview: { flex: 1, display: "flex", flexDirection: "column", background: "#f3f4f6" },
  previewLabel: { padding: "8px 12px", fontSize: 12, color: "#6b7280", borderBottom: "1px solid #e5e7eb" },
  iframeWrap: { flex: 1, position: "relative", minHeight: 600 },
  iframe: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "transparent" },
};
