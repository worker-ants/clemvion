---
id: web-chat-widget-app
status: partial
code:
  - codebase/channel-web-chat/**
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md
  - plan/in-progress/webchat-eager-start.md
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
텍스트는 워크플로우 첫 `awaiting_user_message` 도달 시 `submit_message` 로 전송(eager-start §R6 — open 직후 booting
이라 위젯이 텍스트를 큐에 담아 flush). 단, 첫 표면이 `buttons`/`form` 이면 자유 텍스트 제출 비대상 표면이므로 큐된
텍스트는 전송하지 않고 **폐기**한다(§R6). first message payload 미사용. 런처(위젯) 자체의 표시/숨김은 host `show`/`hide`
로 제어한다(가시성 축 — §3.2).

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
| 입력창 | — | 엔터/전송 → `submit_message`. **활성 조건**: `awaiting_user_message` + `ai_conversation` 표면일 때만 자유 텍스트 입력 활성 — booting/streaming 중이거나 현재 표면이 `buttons`/`form` 이면 비활성(사용자는 선택/제출로 응답) |
| 첨부·이모지 | — | v1 비활성/숨김 (Form file upload 연동 시 활성) |
| AI 면책 푸터 | boot `disclaimer` (정적) | 표시 전용 |

## 3. 상태기계 (conversation lifecycle)

> 아래 다이어그램은 **패널 전개 축**(collapsed↔panel). 위젯 **가시성 축(show/hide)** 과 정책 **차단(`blocked`)** 은
> 이와 직교한다 — §3.2 참조.

```
[collapsed] ──open──▶ [panel](transient)──eager start──▶ [booting] ──webhook 202──▶ [streaming] ──waiting_for_input──▶ [awaiting_user_message]
   ▲          (welcome 즉시 렌더)                                                     │ 첫 표면: 입력창 / 캐러셀·버튼 / 폼
   │ close(유지, 재open 시 복원)                                                       │ submit_message·click_button·submit_form ↔ ai_message
   └──────────────────────────────────────────────────────────────────────────────  ▼
                                                                                  [ended] ──new chat──▶ [booting]
```
- 워크플로우 시작 시점: **패널 open 시**(런처 클릭으로 패널을 처음 전개할 때). 정적 welcome/추천질문은 open 즉시 렌더하면서
  **동시에 execution 을 시작**(`POST /api/hooks/:path { profile }`)하고, 첫 `waiting_for_input` 의 `interactionType` 에 따라
  **첫 표면을 그대로 렌더**한다 — `ai_conversation` → 입력창(+welcome), `buttons`/carousel → 선택지 즉시 표시, `form` → 폼.
  이로써 **첫 노드가 AI 가 아닌 워크플로우(예: 카테고리 선택 캐러셀)도 open 직후 그 표면이 바로 보인다** — 위젯은 시작 전
  첫 노드 타입을 알 수 없으므로 표면을 보여주려면 execution 시작이 선행되어야 한다(§R6).
- **토큰 낭비 없음**: AI Agent `multi_turn` 은 첫 사용자 메시지 전엔 LLM 을 호출하지 않고 즉시 `waiting_for_input` 으로
  진입하므로([AI Agent §6.2](../4-nodes/3-ai/1-ai-agent.md)), open 만으로 생기는 비용은 대기 상태 execution row 뿐(LLM 토큰 0).
- **`firstMessage` 미사용**: webhook payload 는 `profile` 만 싣는다. 첫 사용자 텍스트도 일반 `submit_message` 로 전송되어
  AI 첫 턴이 된다(multi_turn 은 trigger 입력을 첫 턴으로 소비하지 않음 — [AI Agent §6.2](../4-nodes/3-ai/1-ai-agent.md)). 근거 §R6.
- **재open**: close 후 재open 은 새 execution 을 시작하지 않고 §3.1 의 세션 복원(`executionId`+토큰)으로 기존 대화를 잇는다.

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
- **`updateProfile(profile)`**: boot `profile` 에 **shallow merge** 되어 **다음 워크플로우 시작(패널 open/새 대화)
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

### R6. 워크플로우 시작 — 패널 open 시(eager) (vs 첫 입력 시 lazy)
**초기 결정(기각)**: "패널 open 만으로는 미시작, 첫 사용자 텍스트 입력 시 시작 + webhook `firstMessage` 동봉" — 빈 패널만
열고 떠나는 사용자에 대한 execution 낭비를 피하려는 lazy 모델이었다. 그러나 이 모델은 **AI-텍스트-first 워크플로우만**
전제했고 두 결함이 드러났다:
1. **AI 가 아닌 첫 노드(캐러셀·버튼·폼)를 표시 불가** — 첫 표면을 렌더하려면 execution 을 시작해 첫 `waiting_for_input`
   을 받아야 하는데, 위젯은 시작 전 첫 노드 타입을 알 수 없다. lazy 로는 "카테고리 선택 캐러셀을 open 직후 보여주기"가
   구조적으로 불가능하다.
2. **`firstMessage` 유실** — AI Agent `multi_turn` 은 설계상 trigger/webhook 입력을 첫 턴으로 소비하지 않고 첫 사용자
   채팅 입력만 첫 턴으로 삼는다([AI Agent §6.2](../4-nodes/3-ai/1-ai-agent.md)). 따라서 webhook 에만 실린 `firstMessage`
   는 어느 노드에도 닿지 못해 사용자의 첫 메시지가 증발했다.

**전환 결정(채택, 사용자 2026-06-06)**: 패널 open 시 즉시 execution 시작(eager). 첫 `waiting_for_input` 타입대로 첫 표면을
렌더하고, 첫 사용자 텍스트도 일반 `submit_message` 로 보낸다. `firstMessage` 메커니즘은 폐기한다. 기각했던 lazy 의
유일한 이점("낭비 방지")은 **재평가 결과 비용이 작다** — multi_turn 은 입력 전 LLM 을 호출하지 않으므로 open 당 비용은
**대기 execution row 한 개(LLM 토큰 0)** 이고, 패널 open 은 사실상 대화 의도이며, 방치 세션은 토큰 TTL/idle 만료로 정리된다.
반면 eager 는 (1)(2)를 동시에 해소하고 모든 first-node 타입을 균일하게 지원한다. 대부분의 임베드형 챗 위젯도 open 시
세션을 시작한다. 정적 welcome 은 그대로 open 즉시 렌더되어 AI-first 인사 UX 도 유지된다.

eager 전환의 따름 규칙(큐 게이팅): 런처 버블로 큐된 텍스트는 첫 `awaiting_user_message` 의 표면이 `ai_conversation`
일 때만 flush 한다 — 첫 표면이 `buttons`/`form` 이면 자유 텍스트가 제출 비대상이므로 큐를 **폐기**해 잘못된 표면으로의
오제출을 막고, 입력창(Composer)도 같은 조건으로 비활성화한다(§2 입력창 행).
