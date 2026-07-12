---
id: web-chat-widget-app
status: implemented
code:
  - codebase/channel-web-chat/**
---

# Spec: Channel Web Chat — 위젯 SPA (`codebase/channel-web-chat`, Next.js CSR 전용)

> 관련: [아키텍처](./0-architecture.md) · [SDK](./2-sdk.md) · [인증/세션](./3-auth-session.md) ·
> [Convention Conversation Thread §9.4·§9.5](../conventions/conversation-thread.md).

---

## Overview

iframe 안에서 도는 **위젯 SPA**(Next.js CSR-only 정적 export, §1)의 UI·상태기계·라이프사이클을 정의한다 — 런처/패널
표면(§2), 상태 전이(collapsed→panel→booting→streaming↔awaiting_user_message→ended, §3)와 새로고침 복원·in-flight
unread, 그리고 eager 시작(패널 open 시 워크플로우 시작, §R6)·C1 보류 메시지 큐 게이팅을 다룬다. EIA 표면 매핑은
[아키텍처 §3](./0-architecture.md), 인증·세션은 [3-auth-session](./3-auth-session.md) 이 SoT.

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
| 헤더 (봇 이름, 세션 컨트롤, 닫기) | boot `headerTitle` (아바타·뒤로 버튼은 차기 phase) | **새 대화**·**대화 종료**·닫기(✕) 렌더. 닫기 → collapsed(대화 유지). 새 대화/대화 종료 동작·트리거는 §3.1 — 둘 다 인라인 **가벼운 확인**(2단계 confirm) 후 실행해 진행 중 대화·히스토리 유실 오조작을 막는다. **세션 컨트롤은 대화가 확립된(`streaming`/`awaiting_user_message`) 뒤에만 노출**한다 — `booting`(webhook POST in-flight, 세션 미persist)·시작 전(`collapsed`/`panel`)·`[ended]` 에서는 미노출. booting 노출 시 (a) 종료가 서버 취소 명령을 못 보내고(세션 미확립), (b) "새 대화" 재클릭이 in-flight 시작과 겹쳐 중복 webhook 을 발사할 수 있어, 세션 확립 후로 게이트한다 |
| 환영 메시지 | boot `welcome` (정적 config) | 패널 open 시 즉시 표시(워크플로우 시작 전 클라이언트 렌더) |
| 퀵 액션 버튼 | `waiting_for_input.buttonConfig` | 탭 → `click_button` |
| 추천 질문 | boot `welcome.suggestions`/`launcher.suggestions` (정적) | 탭 → `submit_message` |
| 메시지 리스트 | **1차 소스 = `waiting_for_input.conversationThread.turns` snapshot**(WS §4.4.5) + 로컬 라이브 dispatch. `ai_message.messages[]` raw 직접 노출 금지 | turn `source`([conversation-thread §1.1](../conventions/conversation-thread.md) 백엔드 5값)를 말풍선 role 로 축약 렌더 — `presentation_user`·`ai_user`→**user**, `ai_assistant`·`ai_tool`·`system`→**assistant**. `[user-input]…[/user-input]` strip([conversation-thread §9.5](../conventions/conversation-thread.md)). 새로고침 복원 시에도 이 매핑으로 과거 user/assistant 구분을 유지한다(복원 thread 는 EIA `getStatus` 가 durable 스냅샷으로 반환 — §3.1) |
| Form (다중 필드) | `waiting_for_input.formConfig` | 필드 렌더·검증 → `submit_form`. 실패 시 `error.details[{field,message,code}]` 표시·재제출 |
| presentation(carousel/table/chart/template) inline | `ai_message.presentations[]` / `execution.message` / 복원 thread `turn.presentations[]` | 전체 타입 inline 렌더(AI Agent §7.10). **렌더러는 두 shape 을 모두 수용**한다 — 표시-전용 presentation 노드의 위젯 envelope(`{config,output}`, [Presentation 공통 §10.6](../4-nodes/6-presentation/0-common.md#106-blocking-vs-display-only))과 AI `render_*` 의 `PresentationPayload`(`{type,toolCallId,renderedAt,payload}`, [AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반)). 후자는 명시 `type` 을 분류에 쓰고 `payload` 를 envelope 로 정규화한다. 따라서 **새로고침 복원 thread 의 `turn.presentations[]` 도 그대로 재현**된다. `PresentationPayload.truncation`(1MB tail-truncate 메타, [공통 §10.4](../4-nodes/6-presentation/0-common.md#104-1mb-cap))은 `output.{rowsTruncated\|itemsTruncated}` 와 동등하게 취급해 잘림 표시를 **총 개수(`{itemsTotalCount\|rowsTotalCount}`, 잘리기 전 총 개수)와 함께** 노출한다(메인 편집기 run-results 와 parity — `총 N개 중 일부만 표시돼요.`). *(table·carousel 대칭 — table 은 `rows*`, carousel 은 `items*` cap 키를 소비해 각각 잘림 배너를 렌더한다.)* **범위 제약**: durable thread 의 `turn.presentations[]` 는 `source: 'ai_assistant'` 한정이라 **AI `render_*` 표시물만 영속**된다 — 표시-전용 presentation *노드*의 표시물은 라이브 이벤트(`execution.message`)로만 오므로 새로고침 복원 대상이 아니다(SoT: [conversation-thread §2.1](../conventions/conversation-thread.md)) |
| 입력창 | — | 엔터/전송 → `submit_message`. **활성 조건**: `awaiting_user_message` + **텍스트 표면**일 때만 자유 텍스트 입력 활성. 텍스트 표면 = `ai_conversation` 또는 `pending=null`(ai_conversation 도달 전 과도 상태) — 즉 `buttons`/`form` 이 **아닌** 표면(판정 SoT `widget-state.isTextInputSurface`). booting/streaming 중이거나 현재 표면이 `buttons`/`form` 이면 비활성(사용자는 선택/제출로 응답). **비활성 외형**: idle(빈 입력·buttons/form) 전송 버튼은 중립 회색; **booting/streaming(AI 처리 중)** 에는 스피너 + `aria-busy=true` + `aria-label="AI 응답 중"` 로 '응답 중' 표시(흐린 반투명 비활성이 고장처럼 보이지 않게) |
| 첨부·이모지 | — | v1 비활성/숨김 (Form file upload 연동 시 활성) |
| AI 면책 푸터 | boot `disclaimer` (정적) | 표시 전용 |

> **chrome 문자열 i18n**: 위 표의 위젯 소유 UI 문자열(세션 컨트롤·"AI 응답 중"·확인 문구·잘림 배너 등)은 §4 의 위젯 로컬 i18n
> catalog 키를 경유해 `locale` 언어로 렌더된다(표는 ko 예시 표기). 운영자 제공 콘텐츠(`headerTitle`·`welcome`·`disclaimer`)는 비대상.

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
- **헤더 세션 컨트롤(§3.1)**: 대화가 확립된(streaming/awaiting_user_message) 뒤 사용자가 헤더의 **"대화 종료"** 로
  `[ended]` 전이, **"새 대화"** 로 현재 세션을 버리고 `[booting]` 재시작할 수 있다(둘 다 가벼운 확인 후). `booting`
  구간에는 컨트롤을 노출하지 않는다(§2 헤더 행 — 중복 webhook·미발사 cancel 방지). 다이어그램의 `new chat` 화살표는
  `[ended]` CTA 뿐 아니라 이 헤더 컨트롤(streaming/awaiting 발원)에서도 발생한다. **"대화 종료" 도 대칭 edge**
  (`[streaming]`/`[awaiting_user_message]` → `[ended]`)로, ASCII 다이어그램에는 미도시이며 §3.1 표가 SoT 다.

### 3.1 채팅 종료 / 새로 시작 / 세션 지속

| 동작 | 트리거 | EIA 처리 | 위젯 상태 |
|---|---|---|---|
| 닫기 (collapse) | 헤더 닫기 / 런처 토글 | execution `waiting_for_input` 유지, **SSE 연결도 유지** | 패널만 숨김. **닫힌 사이 도착한 in-flight 메시지(예: AI 응답)는 버퍼링 → unread 배지, 재open 시 렌더**. 재open 시 그대로 |
| 대화 종료 (end) | **헤더 "대화 종료"**(대화 확립 후=streaming/awaiting, 가벼운 확인) 또는 `completed` | 대기 중 AI 대화(`awaiting_user_message` + `ai_conversation`, waiting nodeId 확정)면 `end_conversation`(graceful — 워크플로우가 이어서 완료), 그 외(응답 대기 streaming, 또는 `buttons`/`form` 대기 표면, ai_conversation 이라도 nodeId 미확정)면 `cancel`(범용 종료) → execution 종료·토큰 invalidate. 위젯은 **SSE 를 먼저 닫고** optimistic 하게 세션 정리 + `[ended]` 전이한 뒤 종료 명령을 best-effort 로 발사한다(선차단으로 terminal 이벤트 중복 종료 경합 제거). 명령이 실패/거부(410 Gone·409 STATE_MISMATCH·네트워크)해도 로컬은 이미 종료 상태를 유지한다 — 사용자 의도(종료)를 우선한다. (컨트롤은 세션 확립 후에만 노출되므로 종료 시 세션·토큰이 항상 존재 — §2 헤더 행) | `[ended]` — transcript 읽기전용 + "새 대화 시작" CTA |
| 새 대화 (restart) | `[ended]` CTA · **헤더 "새 대화"**(가벼운 확인 후) · host `resetSession` | 저장 세션/스트림 정리 후 새 `POST /api/hooks/:path` → 새 executionId/token. **확립 세션(streaming/awaiting)발**이면 새 start 전에 이전 execution 을 **best-effort `cancel`**([EIA §5.4](../5-system/14-external-interaction-api.md))로 종료해 서버측 orphan 을 근원 제거한다(폐기이므로 graceful `end_conversation` 아닌 범용 `cancel`; optimistic — 실패/거부해도 로컬 재시작을 되돌리지 않음, §R9). **booting 중 host `resetSession`**은 in-flight `start()` 에 **coalesce**(2번째 `POST`·2번째 execution 미생성)되어 **중복 webhook·첫 노드 부작용 2회를 구조적으로 제거**한다 — single-flight 게이트가 옛 gen guard 의 client-상태-only 방어를 대체한다(옛 'Planned' host-API 드레인 제약 해소, §R9). 명시 cancel 을 못 보낸 잔존 이탈(탭 종료·"닫기")은 서버측 **idle-wait backstop**([EIA §3.4 EIA-RL-07](../5-system/14-external-interaction-api.md))이 공개 위젯 토큰 영구 만료 + grace 후 `cancelled`(`error.code=WEBCHAT_IDLE_TIMEOUT`)로 회수한다([4-execution-engine §7.4·§7.5](../5-system/4-execution-engine.md) 무기한 보존 불변식이 §1.1 에 예약한 '타임아웃' 사유의 구현). | transcript 초기화(구분선) 후 `[booting]` |
| 토큰 만료/서버 타임아웃 | per_execution 만료(재로드 시 refresh 실패)→`401`; idle-wait backstop 회수(EIA-RL-07) 후 재로드 상태조회→`200 status:cancelled`. `410 Gone` 은 *명령*(interact/cancel) 응답 전용이라 상태조회엔 안 나타남(EIA §5.3). 재로드 상태 분기 SoT=[3-auth-session §3.1](./3-auth-session.md) | — | `[ended]` + "대화 종료, 새로 시작" 안내 |
| 페이지 새로고침/이동 | 호스트 reload → iframe 재로드 | — | **(b) 복원**: `executionId`+단명 토큰을 iframe-origin **sessionStorage**(같은 탭 reload 는 유지·탭 종료 시 소거, [3-auth-session §R6](./3-auth-session.md)) 저장 → `GET /:id`(**`waiting_for_input` 상태면** durable `conversationThread` 동봉 — 그 경우 5분 SSE buffer 무관·서버 재시작 무관하게 전체 히스토리 복원, [EIA §5.3·§R17](../5-system/14-external-interaction-api.md); 단 thread 에 영속되지 않는 표시-전용 presentation *노드* 표시물은 예외 — §2) + SSE(`Last-Event-Id`) 재연결. 만료/410 이면 [ended] |

> **구현 상태**: 본 §3.1 표·§R6·§R7·§R9 가 참조하는 client 측 A(single-flight coalesce)·B-1(확립세션 best-effort cancel)과 서버측 **EIA-RL-07 백엔드 idle-wait reaper**(`WebChatIdleReaperService` — 익명 위젯 토큰 영구 만료 execution 회수, BullMQ repeatable 분 단위)가 **모두 구현됨**([EIA §3.4 EIA-RL-07](../5-system/14-external-interaction-api.md#34-신뢰성일관성)).

- proactive(봇 선발화)는 비목표. 단 진행 중 대화의 in-flight 이벤트는 위와 같이 캡처(unread).
- 다중 세션(유저당 여러 대화) 목록은 비목표 — 식별(추후) + 유저별 execution 목록 API 신설 전제.

**SSE 재연결(iframe suspend·일시 네트워크 단절 시):** 닫힘/백그라운드로 SSE 가 끊겨도 위젯은 마지막 수신
이벤트의 `Last-Event-Id` 로 재연결한다 — EIA 가 **5분 이벤트 버퍼**([EIA §5.2·**EIA-NF-03**](../5-system/14-external-interaction-api.md))로
`seq > Last-Event-Id` 누락분을 손실 없이 재전송하므로, 닫힌 사이 도착한 `ai_message` 도 복구돼 unread 배지·타임라인에
반영된다. **버퍼(5분) 만료** 후 재연결이면 누락분 재전송이 불가하므로 `GET /api/external/executions/:id`
snapshot(현재 `conversationThread`, [EIA §5.3](../5-system/14-external-interaction-api.md))으로 폴백해 재동기화한다.
EIA 의 버퍼 만료 신호(`execution.replay_unavailable`)는 **서버 emit 이 구현**됐고 위젯도 이벤트 리스너를 등록해 두었으나
(`eia-client.ts`), 소비 분기는 아직 미배선(no-op)이라 위젯은 여전히 버퍼 만료를 **로컬 시간 기준(>5분)** 으로 판단한다
(이벤트 기반 감지로의 교체는 클라이언트 측 후속 — EIA-NF-03 연계 TODO).

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

## 4. i18n (chrome 문자열 다국어화)

위젯 **chrome 문자열**(위젯 SPA 가 소유한 UI 프레임 문자열 — 세션 컨트롤·확인·입력창·상태/에러·presentation 잘림 배너·
aria-label 등)을 **ko/en 다국어화**한다. `BootConfig.locale`([2-sdk §4·§R6](./2-sdk.md#4-boot-config-스키마))을 활성화해 방문자 언어로 렌더한다.

**메커니즘 — 위젯 로컬 경량 catalog**:
- 위젯은 별도 정적 export 번들이라 메인 앱 `frontend/src/lib/i18n/dict` 를 import 할 수 없다 → **위젯 로컬 문자열
  catalog `{ ko, en }` + `t(key, params?)`** 를 신설한다. 파라미터 보간은 제품 전반과 통일해 `{{name}}` 이중 중괄호를 쓴다.
- **ko/en leaf key parity 필수** — 키 집합이 두 로케일에서 동일해야 한다(위젯 로컬 parity 테스트로 강제).
- 이는 메인 앱 dict 시스템(i18n-userguide Principle 1·2 의 *구체 기구*)과 **물리·개념적으로 분리**된 자체 catalog 다
  ([i18n-userguide 적용 범위](../conventions/i18n-userguide.md#적용-범위-scope)). 문체 Principle 6(해요체 ko / 정중·간결 en)은 공유.

**언어 해석(runtime, boot 1회 고정)** — 우선순위:
1. 명시 `BootConfig.locale` ∈ {`ko`,`en`} → 사용
2. 없으면 브라우저 `navigator.language`(Accept-Language) → `en*` 이면 `en`, 그 외 `ko`
3. 최종 fallback → `ko`(하위호환 — 기존 위젯은 항상 한국어)

boot 시 1회 해석해 위젯 전역에 고정한다(런타임 인-위젯 토글은 비목표). **locale 변경은 재전송이 아니라 iframe 재마운트로 반영**된다
([2-sdk §3 wc:boot](./2-sdk.md) · [5-admin-console §6.1](./5-admin-console.md)). 이 `locale` 은 위젯 UI 렌더 언어이며 Chat Channel 의
`languageLocale`(서버 발신 언어)와는 별개다.

**번역 대상 = 위젯 소유 chrome** (전수 인벤토리·키 표는 구현 plan 이 SoT):
- 세션 컨트롤("새 대화"/"대화 종료"/닫기/"새 대화 시작")·2단계 확인 문구·입력창 placeholder·전송/"AI 응답 중" aria-label·
  상태·에러(`GENERIC_ERROR_MESSAGE`)·form "선택"/"제출"·carousel prev/next·chart 범례·**table·carousel 잘림 배너**
  ("총 N개 중 일부만 표시돼요."·table 무개수 "일부 행만 표시돼요."·carousel 무개수 "일부 항목만 표시돼요.")·launcher "채팅 열기"/unread 배지.
- **경계 규칙**: (1) 위젯 하드코딩 *기본값*(예: `headerTitle` 미지정 시 fallback "AI 어시스턴트")은 chrome → 번역 대상.
  운영자가 *제공한* 값은 비대상. (2) 이미 영문인 chrome(chart aria-label `pie chart` 등)도 ko 키를 신설해 parity 를 맞춘다.

**비대상**: 운영자 제공 콘텐츠(`headerTitle`·`welcome`·`launcher.suggestions`·`disclaimer`)·backend 발행 payload
(presentation/form `label`)·AI 생성 본문 — 위젯은 입력 언어 그대로 렌더한다.

> **구현 상태**: 본 §4 는 spec·구현 모두 완료다 — 위젯 로컬 catalog(`src/lib/i18n/`)·`resolveLocale`·chrome 키 치환·
> ko/en parity 테스트가 구현됐다([_product-overview §2](./_product-overview.md#2-목표--비목표) 목표 승격). 근거·순번 R10.

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
**대기 execution row 한 개(LLM 토큰 0)** 이고, 패널 open 은 사실상 대화 의도이며, 방치 세션은 토큰 TTL/idle 만료로 정리된다(위젯 토큰뿐 아니라 **서버측 대기 execution row 자체**도 공개 위젯 idle-wait backstop [EIA §3.4 EIA-RL-07](../5-system/14-external-interaction-api.md)이 토큰 영구 만료 + grace 후 회수한다 — §R9·§3.1).
반면 eager 는 (1)(2)를 동시에 해소하고 모든 first-node 타입을 균일하게 지원한다. 대부분의 임베드형 챗 위젯도 open 시
세션을 시작한다. 정적 welcome 은 그대로 open 즉시 렌더되어 AI-first 인사 UX 도 유지된다.

eager 전환의 따름 규칙(큐 게이팅): 런처 버블로 큐된 텍스트는 첫 `awaiting_user_message` 의 표면이 `ai_conversation`
일 때만 flush 한다 — 첫 표면이 `buttons`/`form` 이면 자유 텍스트가 제출 비대상이므로 큐를 **폐기**해 잘못된 표면으로의
오제출을 막고, 입력창(Composer)도 같은 조건으로 비활성화한다(§2 입력창 행).

### R7. 헤더 세션 컨트롤 — booting 게이팅 + graceful/cancel 분기
헤더의 **"새 대화"/"대화 종료"** 컨트롤(§2 헤더 행·§3.1 표)에 대한 결정 근거를 모은다. 신규 결정이 아니라 §2·§3.1
산문에 흩어져 있던 근거의 Rationale 승격이다.

**booting 게이팅**: 컨트롤은 대화가 확립된(`streaming`/`awaiting_user_message`) 뒤에만 노출한다. `booting` 은 webhook
POST 가 in-flight 라 세션(executionId·토큰)이 아직 없고, 이 구간에 노출하면 (a) "대화 종료" 가 보낼 서버 취소 명령의
대상이 없어 **미발사**되고(로컬만 종료되어 서버엔 대기 execution 이 남음), (b) "새 대화" 재클릭이 in-flight `start()` 와
겹쳐 **중복 webhook** 을 발사한다. 시작 전(`collapsed`/`panel`)·`[ended]` 도 같은 이유로 비대상이다. 판정 SoT 는
`isActiveConversationPhase` (booting 제외). host `resetSession` 은 위젯 UI 를 거쳐 이 게이트를 통과하지 않으므로,
그 경로의 booting-중복은 **UI 게이팅이 아니라 single-flight coalesce**(§R9)로 닫는다 — booting 중 `resetSession` 은
in-flight `start()` 에 흡수되어 2번째 webhook 을 아예 발사하지 않는다(옛 §3.1 "Planned" 제약 해소).

**종료 명령의 graceful/cancel 분기**: `end_conversation` 과 `cancel` 은 위젯이 새로 도입한 구분이 아니라 EIA 가 이미
별개 명령으로 정의한 것이다([EIA-IN-02](../5-system/14-external-interaction-api.md) — `end_conversation` 은 특정
`nodeId` 의 AI multi-turn 대기를 정상 종료, `cancel` 은 execution 전체 중단). 위젯은 현재 대기 표면에 따라 이 기존 계약을
매핑할 뿐이다 — 대기 중 AI 대화(`awaiting_user_message` + `ai_conversation` + waiting nodeId 확정)면 `end_conversation`
으로 **워크플로우가 이어서 완료**되게 하고(후속 노드·집계가 정상 수행), 그 외(응답 대기 `streaming`, `buttons`/`form`
대기 표면, nodeId 미확정)는 `end_conversation` 이 적용 대상 노드를 갖지 못하므로 범용 `cancel` 로 execution 을 종료한다.

**로컬 우선(optimistic) 종료**: 위젯은 **SSE 를 먼저 닫고** 세션 정리 + `[ended]` 전이한 뒤 종료 명령을 best-effort 로
발사한다. 선차단은 terminal 이벤트가 종료 처리와 경합해 이중 전이하는 것을 제거하고, 명령이 실패/거부(410 Gone·409
STATE_MISMATCH·네트워크)해도 **사용자 의도(종료)를 우선**해 로컬 종료를 되돌리지 않는다. 서버 상태는 execution 무기한
보존 불변식([4-execution-engine §7.4·§7.5](../5-system/4-execution-engine.md))과 토큰 TTL/idle 만료로 수렴하며,
best-effort 종료 명령이 유실된 경우에도 공개 위젯의 잔존 대기 execution 은 idle-wait backstop
([EIA §3.4 EIA-RL-07](../5-system/14-external-interaction-api.md), §R9)이 토큰 영구 만료 + grace 후 회수한다.

### R8. presentation 렌더 — 두 shape 통일 수용 + 복원 범위의 실제 경계
위젯 렌더러는 표시-전용 presentation 노드의 `{config,output}` envelope 과 AI `render_*` 의
`PresentationPayload{type,toolCallId,renderedAt,payload,truncation?}` 를 **모두 수용**한다(§2). 후자는 명시 `type` 으로
분류하고 `payload` 를 envelope 로 정규화하므로, 새로고침 복원 thread 의 `turn.presentations[]` 도 라이브와 동일하게
재현된다. `truncation` 은 `payload` 바깥 top-level 이라 흡수하지 않으면 1MB cap 잘림 표시가 유실된다 —
[Presentation 공통 §10.4](../4-nodes/6-presentation/0-common.md#104-1mb-cap) 가 `output.{rowsTruncated|itemsTruncated}`
와 **동등한 메타**로 규정하므로 `output` 으로 흡수해 동일하게 취급한다. 같은 경로로 **총 개수
(`{itemsTotalCount|rowsTotalCount}`, 잘리기 전 총 개수)도 흡수**돼 잘림 배너에 함께 노출된다
(메인 편집기 run-results parity) — 흡수만 하고 소비하지 않으면 죽은 필드가 된다. **table·carousel 둘 다** 대칭으로
소비한다: table 은 `output.{rowsTruncated|rowsTotalCount}`, carousel 은 `output.{itemsTruncated|itemsTotalCount}` 를
각각 `truncated`/`totalCount` 로 투영해, `truncated=true` 시 총 개수가 있으면 "총 N개 중 일부만 표시돼요.",
없으면 무개수 폴백(table "일부 행만 표시돼요."·carousel "일부만 표시돼요.")을 렌더한다. `totalCount` 는
유한한 비음수 정수만 채택한다(신뢰 못 할 total 로 "총 NaN개…" 가 새지 않도록).

**한때 기록됐던 "복원 presentation 은 렌더러가 무시(빈 렌더)한다" 는 제약은 사실이 아니었다.** 렌더러는 이미 두 shape
을 수용하고 있었고(2026-07-10 실측 확인), 그 서술은 검증 없이 §2 에 기입된 것이다. 존재하지 않는 제약을 `Planned` 로
남기면 후속 작업자가 이미 있는 변환기를 중복 구현하고, 진짜 제약이 가려진다.

**진짜 범위 제약은 원인이 다르다** — durable thread 의 `turn.presentations[]` 는 `source: 'ai_assistant'` 한정이라
AI `render_*` 표시물만 영속된다([conversation-thread §2.1](../conventions/conversation-thread.md)). 표시-전용
presentation *노드*의 표시물은 SSE `execution.message` 로만 전달되므로 새로고침 복원 대상이 아니다. 이를 thread 에
싣는 확장은 backend 5-source enum 또는 turn 필드 확장을 요구해 v2 검토 사안이며, 비목표로
[`_product-overview §2`](./_product-overview.md) 에 등재했다.

### R9. 서버측 execution 잔존 2건 — single-flight coalesce(A) + "새 대화" cancel(B-1)
PR #874 파생으로 남았던 두 서버측 잔존 결함의 결정 근거다(§2 헤더 행·§3.1 "새 대화" 행·§R7 게이팅과 맞물린다).

**A. booting 중 host `resetSession` 중복 webhook — single-flight coalesce 로 해소(서버 멱등 아님).** 원인은
공유 webhook 표면의 멱등 부재가 아니라 **client 동시성 결함** — `resetSession` 이 in-flight `start()` 를 드레인하지
않고 무조건 새 `start()` 를 발사한다. 위젯은 **동시 in-flight `POST /api/hooks/:path` 를 최대 1개, live execution 을
최대 1개**로 두는 single-flight 게이트를 유지하며 모든 start 진입점(패널 open eager-start · `[ended]` CTA · 헤더
"새 대화" · host `resetSession`)이 이를 통과한다. booting 중 도착한 `resetSession` 은 2번째 POST 를 발사하지 않고
in-flight start 에 **흡수(coalesce)**된다 — booting 은 대화 미확립(메시지 0·세션 미persist)이라 "새 세션" 요구가
in-flight booting 으로 이미 충족되고, 흡수된 booting 세션이 그대로 세션이 된다. 이로써 중복 webhook·중복 execution·
첫 노드 부작용 2회가 구조적으로 0 이 된다. **기각 대안**: (a) 공유 `POST /api/hooks/:path` 에 Idempotency-Key —
reset 은 *새 세션 intent* 라 다른 키를 쓰게 되어 두 execution 이 그대로 생겨 이 race 를 원리적으로 못 막고, 전
webhook 통합이 쓰는 공유 표면을 넓게 바꾼다. (b) await→cancel→restart — booting execution 을 확립시킨 뒤 취소하므로
첫 노드 부작용 1회 추가 + 취소될 execution 을 만든다. coalesce 는 2번째 execution 자체를 안 만들어 부작용·orphan
모두 0 이며, host 는 executionId 를 관측하지 않으므로("항상 새 id" host 계약 없음) 관측 가능한 차이가 없다.

**B-1. "새 대화" 는 이전 execution 을 best-effort `cancel` 후 재시작.** 확립 세션(`streaming`/`awaiting_user_message`)
발 "새 대화"/`resetSession` 은 새 start 전에 이전 execution 을 best-effort [EIA §5.4](../5-system/14-external-interaction-api.md)
`cancel` 로 종료한다("대화 종료" 와 대칭; 폐기이므로 graceful `end_conversation` 아닌 범용 `cancel`). #874 당시의
optimistic-local 단순성 선택("명시 종료 미발신")이 낳던 서버 orphan 을 근원 제거한다. cancel 을 못 보낸 잔존 이탈
(탭 종료·"닫기")은 서버측 idle-wait backstop(B-2, [EIA §3.4 EIA-RL-07](../5-system/14-external-interaction-api.md))이
회수한다 — B-1(즉시)과 B-2(토큰 만료+grace)의 이중화. 서버측 idle-wait timeout 정책·불변식 정합의 SoT 는 EIA
EIA-RL-07 및 [4-execution-engine §7.4](../5-system/4-execution-engine.md)(§1.1 이 이미 예약한 `waiting_for_input →
cancelled` "타임아웃" 사유의 구현)다.

### R10. `locale` 활성 — chrome 다국어화 (chrome-only · 위젯 로컬 catalog)
v1 위젯은 Korean-only 로 `locale` 을 reserved 로 뒀고([2-sdk §R6](./2-sdk.md)), [webchat-i18n-scope](../../plan/complete/webchat-i18n-scope.md)
는 EN 착수(옵션 c)를 그 태스크의 "코드 변경 없음" 스코프상 **defer** 했다(merits 기각 아님). 사용자가 2026-07-12 코드 마일스톤을
승인해 그 **예약된 활성화**를 실행한다 — spec 이 명시 예약한 경로이므로 결정 번복이 아니다.
- **chrome-only (vs 콘텐츠 현지화)**: 운영자 콘텐츠 per-locale 현지화는 BootConfig 콘텐츠 필드를 per-locale map 으로 확장 =
  운영 콘솔·서버 저장 스키마 변경(큰 표면). 1차 가치("위젯이 방문자 언어로 말한다")는 chrome 만으로 확보되므로 분리한다.
- **explicit → auto-detect → ko (vs 인-위젯 토글)**: 명시 우선은 운영자 의도 존중(콘솔이 항상 명시), auto-detect 은 raw
  스니펫 방문자 경험, ko fallback 은 하위호환. 인-위젯 엔드유저 토글은 상태 저장·표면 추가라 이번 범위 밖.
- **위젯 로컬 catalog (vs 메인 앱 dict import)**: 별도 정적 번들 경계상 frontend dict 를 끌어올 수 없다. 경량 로컬 catalog 가
  번들 크기·iframe 격리를 유지하고, ko/en parity 는 위젯 로컬 테스트로 가드한다(메인 앱 dict 시스템과 물리·개념 분리).
