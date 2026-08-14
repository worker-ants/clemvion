---
title: EIA §6.2 waiting_for_input 예시가 실제 wire 와 전혀 다르다 — 실측 shape 으로 재작성
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-14
owner: project-planner
status: in-progress
priority: P1
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/1-data-model.md
---

## Overview

`--impl-prep` `07_44_12` 의 CRITICAL 로 발견. checker 는 "봉투(`payload` 래퍼) 누락" 을
지적했는데, **직접 실측하니 안쪽 구조가 통째로 실제와 다르다.**

이 이벤트는 **외부 통합자가 소비하는 표면**이다. 문서대로 파서를 짜면 동작하지 않는다.

## 실측 — waiting_for_input emit 4곳 전수 (소스 직접 읽음)

| emit | 파일 |
|---|---|
| buttons | `button-interaction.service.ts:400` |
| form | `form-interaction.service.ts:117` |
| AI turn1 | `ai-turn-orchestrator.service.ts:575` |
| AI re-park | `ai-turn-orchestrator.service.ts:990` |

**공통 8**: `status` · `waitingNodeId` · `waitingNodeType` · `waitingNodeLabel` ·
`nodeExecutionId` · `startedAt` · `interactionType` · `conversationThread`

**표면별**:
- buttons → `buttonConfig: { buttons, nodeOutput }`
- form → `nodeOutput`
- AI → `nodeOutput: { interactionType, config?, conversationConfig, meta }`,
  turn1 은 추가로 `turnDebug: { llmCalls, metadata }`

봉투는 `notification-fanout.service.ts:134` 이 `payload: event.payload` 로 **변환 없이** 감싼다.

### 현행 §6.2 와의 대조

| 문서가 그리는 것 | 실제 |
|---|---|
| `node: {id, type, interactionType}` | flat `waitingNodeId`·`waitingNodeType`·`interactionType` |
| `interaction: {submitUrl, streamUrl, statusUrl, cancelUrl, token, expiresAt, expectedCommands}` | **코드 전체 0건** |
| `context: {formConfig, buttonConfig, conversationConfig, conversationThread}` | flat `nodeOutput`·`buttonConfig`·`conversationThread` |
| (언급 없음) | `waitingNodeLabel`·`nodeExecutionId`·`startedAt`·`turnDebug` |
| `payload` 래퍼 없음 | 있음 (§6 도입부 normative 규칙대로) |

## 변경 제안

### (1) §6.2 예시를 실측 shape 으로 재작성

- §6.3/§6.4 와 동일하게 `payload:` 래퍼 + `// webhook 봉투 기준. SSE 는 payload 래퍼 없이
  안쪽 객체가 그대로 온다.` 주석
- 안쪽을 위 실측 키로 교체. 표면별 분기(`buttonConfig` / `nodeOutput`)를 주석으로 표시

### (2) `interaction` 블록 — 삭제하지 않고 **Planned** 로 표기

`#1166` 이 `durationMs`/`result.outputs` 에 쓴 방식 그대로. 설계 의도를 보존하되
"지금 오지 않는다" 를 명시한다. `expectedCommands` 는 같은 문서가 이미
"현재 미구현 문서 필드" 라 적고 있어 표기가 일관해진다.

URL 예시는 `2-api-convention.md §1`(버전은 URL 경로에 미포함) 위반이고 실재하지 않는
도메인(`api.clemvion.ai`)이므로, 구현 시점의 형태를 `§4.1 endpoints` 와 같은 **상대경로**로 적는다.

### (3) "SSE 필드명 매핑" blockquote 정정

현행은 `node.id → waitingNodeId` 처럼 **webhook↔SSE 필드명이 다르다**고 서술한다.
실제로는 fanout 이 이름을 바꾸지 않으므로 **두 채널의 필드명은 같고, 다른 것은 봉투뿐**이다.
→ 매핑 화살표를 걷어내고 "필드명은 채널 무관 동일, 봉투만 다르다(§채널별 봉투)" 로 정정.
참조 구현(`channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput`)이 `ev.waitingNodeId`
를 읽는 것과도 일치한다.

### (4) `error.code` 를 옵셔널로 (§6.4 + 필드 집합 표)

실측: 종결 `error` 를 싣는 4개 지점 중 `code` 를 실제로 갖는 것은 `finalizeFailedExecution`
의 sentinel 경로(`ErrorPortFallbackError`/`ExecutionTimeLimitError`)뿐이다.

일반 `catch` 에 fallback code 를 넣으면 **의미 없는 코드가 의미 있는 코드와 같은 자리에
섞여** 수신자가 분기할 수 없다. "코드 없음" 은 부재로 전달하는 편이 정직하다.

### (5) `1-data-model.md` §2.14 — `Execution.error` 구조에 nullable `nodeId`

EIA §6.4 는 이미 `"nodeId": "uuid" | null` 을 선언하는데 data-model 은 미반영.

### (6) 인용 오귀속 (L472·673)

"Conversation Thread §4.4.6" 이 실제로는 `6-websocket-protocol.md` 소속 헤딩을 가리킨다.
`conversation-thread.md` 에 대응 앵커가 없다 → WS 문서로 재지정 + §5.1 은 그대로 유지.

## 🔴 조사 중 발견 — `turnDebug.llmCalls` 가 외부 fanout 으로 새는 것으로 보인다

`--spec` `09_38_17` CRITICAL 3(`turnDebug` 이름 충돌)을 확인하다 **그보다 큰 것**이 나왔다.
이 draft 의 범위를 넘고 심각도가 높아 **별건으로 분리**한다.

### 정적 증거 (실측)

| # | 사실 | 위치 |
|---|---|---|
| 1 | 외부 fanout 은 `stripExternalOnlyFields(wireEnvelope)` 를 거친다 | `websocket.service.ts:479` |
| 2 | 그 목록은 `['llmCalls']` **하나**이고 삭제는 **최상위 전용(depth-1 shallow)** — 주석이 *"중첩 객체 내부의 동명 필드는 strip 되지 않는다"* 고 명시 | `:310`, `:303-305` |
| 3 | AI turn1 waiting emit 은 `turnDebug: { llmCalls: turnDebugHistory[0], metadata }` 로 **중첩**시킨다 | `ai-turn-orchestrator.service.ts:615-617` |
| 4 | `turnDebugHistory[i]` 는 `{turnIndex, llmCalls, …}` 이고 `llmCalls` 는 `requestPayload?`/`responsePayload?` 를 갖는다 | `ai-turn-executor.ts:2336-2349`, `llm-tracing/llm-call-record.ts:19-20` |
| 5 | WS spec 은 `llmCalls` 가 **모든 외부 수신자**(EIA SSE·notification webhook·chat-channel)에서 strip 된다고 선언 | `6-websocket-protocol.md:519` |

→ 외부 wire 에 `payload.turnDebug.llmCalls.llmCalls[].requestPayload` 가 실린다.
**시스템 프롬프트·대화 이력·사용자 입력**이 여기 들어갈 수 있다.

### ✅ 실증 완료 — 누출 확정, 그리고 **경로가 둘이다**

`websocket.service.spec.ts` 에 실 emit shape 그대로 프로브를 넣어 **외부 fanout envelope** 을
관측했다. 두 마커가 모두 wire 에 그대로 실렸다:

| 경로 | wire 위치 | 출처 |
|---|---|---|
| 1 | `payload.turnDebug.llmCalls.llmCalls[].requestPayload` | `ai-turn-orchestrator.service.ts:615` (turn1 스냅샷) |
| 2 | `payload.nodeOutput.meta.turnDebug[].llmCalls[].requestPayload` | `ai-conversation-helpers.ts:97` — `turnDebug: state.turnDebugHistory` **전체 히스토리** |

**경로 2 가 더 나쁘다** — 단발 스냅샷이 아니라 턴 누적 전체이고, WS §4.4:449 가 정의한
**정본 필드**다(`llmCalls` 는 "debug 탭 전용" 이라고 그 표가 직접 적고 있다).

기존 strip 테스트는 **최상위 `llmCalls`** 만, 그것도 `AI_MESSAGE` 에서만 봤다. 이 경로는
아무도 보지 않았고, 그래서 `EXTERNAL_STRIPPED_FIELDS` 가 "보호한다" 는 주장이 참인
표면보다 넓게 읽혀 왔다.

> 처음엔 경로 1만 보고 프로브를 쓸 뻔했다. WS 표가 `meta.turnDebug` 항목 shape 에 `llmCalls?`
> 를 적어 둔 것을 보고 자매를 세어 둘 다 넣었다 — **한쪽만 막으면 나머지가 남는다.**

### 다음 (별건)

- [ ] 실증 테스트: AI turn1 waiting 이벤트의 **외부 fanout payload** 에
      `turnDebug.llmCalls` 가 남는지 단언. 남으면 그것이 결함의 증거이자 회귀 가드
- [ ] 처방 후보: (a) `stripExternalOnlyFields` 를 깊이 우선으로 (b) waiting emit 이
      `turnDebug` 를 외부용에서 빼기 (c) 최상위 필드명을 strip 목록에 추가.
      **(a) 는 비용이 크고 (c) 는 이름 충돌을 고착**시키므로 (b) 가 유력
- [ ] 이름 충돌(`turnDebug` top-level vs `nodeOutput.meta.turnDebug`)은 이 처방과 함께 정리

## Rationale

**왜 삭제가 아니라 Planned 인가**: `finalNodeId`/`finalPort` 는 "엔진에 개념 자체가 없다"
(emit 로직 0건 + 계산 근거 없음)라 되살릴 것이 없었다. `interaction` URL 블록은 다르다 —
REST 엔드포인트(§5)가 실재하므로 **만들 수 있는 것을 아직 안 만든 것**이다. 두 경우를
같게 처리하면 "삭제된 약속" 의 의미가 흐려진다.

**왜 예시를 실측으로 맞추나(문서에 코드를 맞추지 않고)**: 이 필드명들은 이미 프론트엔드·
위젯·참조 구현이 소비 중이다. 문서 쪽 이름으로 바꾸면 **동작하는 외부 계약을 깨는** 변경이
되고, 그건 문서 오류를 고치는 비용보다 훨씬 크다.

## 체크리스트

- [x] 실측 (4개 emit 직접 읽기 + fanout 변환 여부 + 참조 구현 소비 키)
- [ ] `/consistency-check --spec` BLOCK: NO
- [ ] spec 반영 (6항목)
- [ ] `eia-terminal-payload.md` 차단 해제 후 `--impl-prep` 재실행
