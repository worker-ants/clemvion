---
id: web-chat-widget-app
status: partial
code:
  - codebase/channel-web-chat/**
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md
---

# Spec: Channel Web Chat — 위젯 SPA (`codebase/channel-web-chat`, Next.js CSR 전용)

> 관련: [아키텍처](./0-architecture.md) · [SDK](./2-sdk.md) · [인증/세션](./3-auth-session.md) ·
> [Convention Conversation Thread §9.4·§9.5](../conventions/conversation-thread.md).

---

## 1. Next.js CSR-only 구성

- `next.config.js`: `output: 'export'` (정적 export — Node 서버 런타임 없음, CDN 호스팅).
- **모든 UI 컴포넌트는 Client Component**(`'use client'`). 데이터 페칭/상태는 전부 브라우저 런타임.
- Server Component 데이터 페칭·Server Actions·Route Handlers **미사용**.
- 채팅 shell 은 `next/dynamic(() => import(...), { ssr: false })` 로 로드 → prerender 단계에서도 SSR 제외.
- (권장) `export const dynamic = 'force-static'`. 런타임 외부 입력은 URL 쿼리/postMessage 로만.
- 산출: `out/` 정적 번들 → 위젯 CDN. 근거·대안은 §R4.

## 2. 화면 구조

**런처(collapsed)**: 우하단 플로팅 런처 버튼 + 추천 질문 버블 N개(`launcher.suggestions`). 버블 탭 → 패널 open +
해당 텍스트를 first message 로 제출. 런처(위젯) 자체의 표시/숨김은 host `show`/`hide` 로 제어한다(가시성 축 — §3.2).

**패널(expanded)**:
| UI 요소 | 데이터 출처 | 동작 |
|---|---|---|
| 헤더 (봇 이름, 닫기) | boot `headerTitle` (아바타·뒤로 버튼은 차기 phase — 현재 닫기(✕)만 렌더) | 닫기 → collapsed (대화 유지) |
| 환영 메시지 | boot `welcome` (정적 config) | 패널 open 시 즉시 표시(워크플로우 시작 전 클라이언트 렌더) |
| 퀵 액션 버튼 | `waiting_for_input.buttonConfig` | 탭 → `click_button` |
| 추천 질문 | boot `welcome.suggestions`/`launcher.suggestions` (정적) | 탭 → `submit_message` |
| 메시지 리스트 | **1차 소스 = `waiting_for_input.conversationThread.turns` snapshot**(WS §4.4.5). `ai_message.messages[]` raw 직접 노출 금지 | source 마커(`live`/`injected`)별 렌더. `[user-input]…[/user-input]` strip(§4) |
| Form (다중 필드) | `waiting_for_input.formConfig` | 필드 렌더·검증 → `submit_form`. 실패 시 `fieldErrors` 표시·재제출 |
| presentation(carousel/table/chart/template) inline | `ai_message.presentations[]` / `waiting_for_input` | 전체 타입 inline 렌더(AI Agent §7.10) |
| 입력창 | — | 엔터/전송 → `submit_message` |
| 첨부·이모지 | — | v1 비활성/숨김 (Form file upload 연동 시 활성) |
| AI 면책 푸터 | boot `disclaimer` (정적) | 표시 전용 |

## 3. 상태기계 (conversation lifecycle)

> 아래 다이어그램은 **패널 전개 축**(collapsed↔panel). 위젯 **가시성 축(show/hide)** 과 정책 **차단(`blocked`)** 은
> 이와 직교한다 — §3.2 참조.

```
[collapsed] ──open──▶ [패널만 표시] ──첫 입력──▶ [booting] ──webhook 202──▶ [streaming]
   ▲                                                                          │ waiting_for_input
   │ close(유지)                                                               ▼
   └────────────────────────────────────────────────────────── [awaiting_user_message]
                                                                    │ submit_message ↔ ai_message
                                                                    │ completed / end_conversation
                                                                    ▼
                                                                [ended] ──new chat──▶ [booting]
```
- 워크플로우 시작 시점: **첫 사용자 입력 시**(입력 전송 또는 추천질문 탭). 패널 open 만으로는 미시작 — 환영/추천질문은
  boot 정적 config 로 선렌더되어 빈 대화에 execution 을 낭비하지 않는다. first webhook payload 에 profile + 첫 메시지 동봉.

### 3.1 채팅 종료 / 새로 시작 / 세션 지속

| 동작 | 트리거 | EIA 처리 | 위젯 상태 |
|---|---|---|---|
| 닫기 (collapse) | 헤더 닫기 / 런처 토글 | execution `waiting_for_input` 유지, **SSE 연결도 유지** | 패널만 숨김. **닫힌 사이 도착한 in-flight 메시지(예: AI 응답)는 버퍼링 → unread 배지, 재open 시 렌더**. 재open 시 그대로 |
| 대화 종료 (end) | 명시 "대화 종료" 또는 `completed` | `end_conversation` → execution 종료, 토큰 invalidate | `[ended]` — transcript 읽기전용 + "새 대화 시작" CTA |
| 새 대화 (restart) | `[ended]` CTA 또는 명시 리셋 | 새 `POST /api/hooks/:path` → 새 executionId/token | transcript 초기화(구분선) 후 `[booting]` |
| 토큰 만료/서버 타임아웃 | per_execution 만료(refresh 실패) 또는 idle → `410 Gone` | — | `[ended]` + "대화 종료, 새로 시작" 안내 |
| 페이지 새로고침/이동 | 호스트 reload → iframe 재로드 | — | **(b) 복원**: `executionId`+단명 토큰을 iframe-origin storage 저장 → `GET /:id`+SSE(`Last-Event-Id`) 재연결. 만료/410 이면 [ended] |

- proactive(봇 선발화)는 비목표. 단 진행 중 대화의 in-flight 이벤트는 위와 같이 캡처(unread).
- 다중 세션(유저당 여러 대화) 목록은 비목표 — 식별(추후) + 유저별 execution 목록 API 신설 전제.

**SSE 재연결(iframe suspend·일시 네트워크 단절 시):** 닫힘/백그라운드로 SSE 가 끊겨도 위젯은 마지막 수신
이벤트의 `Last-Event-Id` 로 재연결한다 — EIA 가 **5분 이벤트 버퍼**([EIA §5.2·**EIA-NF-03**](../5-system/14-external-interaction-api.md))로
`seq > Last-Event-Id` 누락분을 손실 없이 재전송하므로, 닫힌 사이 도착한 `ai_message` 도 복구돼 unread 배지·타임라인에
반영된다. **버퍼(5분) 만료** 후 재연결이면 누락분 재전송이 불가하므로 `GET /api/external/executions/:id`
snapshot(현재 `conversationThread`, [EIA §5.3](../5-system/14-external-interaction-api.md))으로 폴백해 재동기화한다.
EIA 의 버퍼 만료 신호(`replay_unavailable`)는 계획·미구현이라, 위젯은 버퍼 만료를 **로컬 시간 기준(>5분)** 으로
판단한다(EIA `replay_unavailable` 구현 시 이벤트 기반으로 교체 — EIA-NF-03 연계 TODO).

### 3.2 위젯 가시성(show/hide) · profile 갱신 · 차단(blocked)

host 제어 명령(`wc:command`, [2-sdk §3·§5](./2-sdk.md))에 대응하는 위젯 상태. 아래 셋은 **서로 다른 레이어**다 —
가시성·패널 전개는 **UI 상태**, `blocked` 는 **보안 정책 결과**(4-security §3-①), `updateProfile` 는 **다음 시작 payload
변이**. 그중 가시성/패널은 **두 직교 축**으로 분리한다 — 공개 계약 타입 SoT 는 [2-sdk §5 `ChatInstance`](./2-sdk.md):

| 축 | 상태 | host 명령 | 의미 |
|---|---|---|---|
| 위젯 가시성 | `visible`(기본) / `hidden` | `show` / `hide` | `hidden` = 런처+패널 모두 미렌더(페이지에서 위젯 자체 숨김). 대화·SSE 는 유지 |
| 패널 전개 | `collapsed` / `open` | `open` / `close` | 위 상태기계의 collapsed↔패널 축 |

- 두 축은 직교다. `hide` 후 `open` 은 **무효**(먼저 `show` 필요) — [2-sdk §1/R4](./2-sdk.md) 와 일치.
- **`blocked`**(임베드 불허, [4-security §3-①](./4-security.md))는 위 두 축과 **무관한 정책 거부 상태로 복구
  불가** — host `show` 로도 해제되지 않는다. `hidden` 은 host 제어(복구 가능)이라는 점에서 구분된다.
- **`updateProfile(profile)`**: boot `profile` 에 **shallow merge** 되어 **다음 워크플로우 시작(첫 메시지/새 대화)
  의 webhook payload `profile` 에 반영**된다. 진행 중 execution 의 기전송 profile 은 **소급 변경하지 않는다**
  (webhook payload 는 시작 시 1회 — EIA 재전송 표면 없음). 빈 세션(시작 전) 갱신은 그대로 첫 시작에 반영.

## Rationale

### R4. Next.js CSR 전용 (vs Vite SPA / SSR)
위젯은 iframe 안 SPA 라 SSR 이익(SEO·TTFB)이 무의미하고 정적 export 가 CDN 호스팅·iframe 임베드에 최적. CSR 강제는
static export + 전 컴포넌트 `'use client'` + 채팅 shell `dynamic(ssr:false)` + route handler/server action 미사용으로 달성.
Vite SPA 가 더 가벼우나 조직 표준(프론트가 Next.js)과 사용자 요구에 맞춰 Next.js 채택 — 정적 export 로 사실상 SPA 동등.

### R5. show/hide(가시성) vs open/close(패널) 직교 2축 + updateProfile 소급 불가
런처 가시성(`show`/`hide`)과 패널 전개(`open`/`close`)를 직교 2축으로 둔 건 [2-sdk §R4](./2-sdk.md)에서 이미 합의된
결정의 위젯측 반영이다(신규 결정 아님) — host 가 "위젯을 페이지에서 완전히 숨김"과 "런처는 두되 패널만 접음"을 독립
제어해야 하기 때문. `updateProfile` 을 "다음 시작에만 반영, 진행 중 execution 소급 불가"로 둔 건 webhook payload 가
시작 1회라는 EIA 표면 제약을 따른 것이다 — 진행 중 execution profile 패치는 EIA 표면 확장(신규 API)이 필요해 본 영역
밖으로 배제. `blocked`(임베드 정책 거부)는 두 축과 무관한 복구 불가 상태로 분리해 host 제어(`hidden`)와 혼동을 막았다.
