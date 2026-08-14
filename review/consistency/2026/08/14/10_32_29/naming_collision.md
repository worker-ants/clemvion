## 검토 범위 확인 (전제)

`origin/main...HEAD` 실제 diff(`git diff origin/main...HEAD --stat`)를 절대경로 워크트리에서 직접 확인한 결과, 이번 라운드에서 `spec/5-system/*.md` 는 **한 글자도 변경되지 않았다**. 실제 코드 변경은 `codebase/backend/src/modules/websocket/websocket.service.ts`(+테스트) 하나뿐이며, 내용은 `stripExternalOnlyFields` 를 top-level(depth-1) 삭제에서 깊이 무관(recursive) 삭제로 바꾼 보안 하드닝(`stripDeep` 신설, 커밋 `81f2c60d6`)이다. 새로 도입된 식별자(`stripDeep`, 로컬 헬퍼)는 module-private 이고 코드베이스 어디에도 동명 충돌이 없어 그 자체로는 문제없다.

다만 이번 워크트리에는 아직 spec 에 반영되지 않은 두 개의 진행 중 plan(`plan/in-progress/eia-terminal-payload.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`)이 있고, 후자가 **정확히 "새 식별자 충돌" 스코프에 해당하는 미해결 항목을 자체적으로 이미 발견**해 두었다(§"🔴 조사 중 발견"). 이를 직접 소스로 재검증해 아래에 CRITICAL 로 등재한다 — 이 라운드의 diff 가 만든 문제는 아니지만, 다음 planner 턴이 EIA §6.2 를 실측 shape 로 재작성할 때 **그대로 베껴 넣으면 문서 차원의 정식 이름 충돌이 된다.**

## 발견사항

- **[CRITICAL]** `turnDebug` 필드명이 같은 `execution.waiting_for_input` payload 안에서 서로 다른 두 shape 를 가리킨다 — 다음 planner 턴이 이 이름 그대로 spec 에 박아 넣을 위험
  - target 신규 식별자(예정): `spec-draft-eia-62-waiting-payload.md` §"변경 제안 (1)" 이 EIA §6.2 예시를 실측 wire 로 재작성하며 명시적으로 넣기로 한 최상위 `turnDebug: { llmCalls, metadata }` (근거: 해당 plan 문서 "표면별" 항목 — "AI → `nodeOutput: {...}`, turn1 은 추가로 `turnDebug: { llmCalls, metadata }`")
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:449` (§4.4 표) — `nodeOutput.meta.turnDebug` 를 **"항목 shape: `{ turnIndex, ragSources[], ragDiagnostics?, llmCalls?, toolCalls?, totalDurationMs? }`" 인 배열**로 정본 정의. 같은 이름이 `spec/4-nodes/3-ai/0-common.md:105`, `spec/4-nodes/3-ai/1-ai-agent.md:562`, `spec/conventions/conversation-thread.md` 전역(10곳 이상)에서 일관되게 "턴별 트레이스 배열" 의미로 재사용된다.
  - 소스 실측 (절대경로 워크트리, HEAD 기준):
    - 최상위 `turnDebug` — `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:615-623` : `turnDebug: { llmCalls: turnDebugHistory[0] ?? undefined, metadata: { model, inputTokens, outputTokens } }` — **단일 객체**, `llmCalls` 는 (배열이 아니라) 한 개의 `LlmCallRecord`.
    - `nodeOutput.meta.turnDebug` — 같은 emit 안의 `nodeOutput.meta` 필드는 `buildConversationMetaFromResumeState(resumeState)`(`ai-conversation-helpers.ts:82-99`)가 채우며 그 안에 `turnDebug: state.turnDebugHistory ?? []`(:97) — **배열**, 각 원소가 `TurnDebugEntry`(`{turnIndex, llmCalls: LlmCallRecord[], ...}`).
    - 즉 하나의 이벤트 payload 안에 `payload.turnDebug`(object, `llmCalls` 단수)와 `payload.nodeOutput.meta.turnDebug`(array, `llmCalls` 는 각 원소 내부의 배열)가 **동시에 존재**하고 타입이 완전히 다르다.
  - 상세: 이 충돌은 이번 diff 가 새로 만든 게 아니라 기존 코드에 이미 있던 것이다(이번 diff 는 여기서 새는 secret 을 막는 `stripDeep` 패치만 했다 — 그 자체는 옳다). 문제는 **spec 이 이 최상위 `turnDebug` 를 지금까지 전혀 문서화하지 않았다는 점**(`spec/5-system/14-external-interaction-api.md` §6.2 의 현재 예시는 `node`/`interaction`/`context` 만 있고 `turnDebug` 언급이 0건 — 직접 확인)과, **다음에 그 공백을 메울 계획 문서가 이름을 바꾸지 않고 그대로 옮겨 적기로 이미 정해 둔 점**이다. `spec-draft-eia-62-waiting-payload.md` 자신도 이를 "이름 충돌" 로 명명하고 "이 처방과 함께 정리" 라고 적어 뒀지만, 실제 반영된 것은 secret leak 패치뿐이고 이름 충돌 자체의 처분(리네임 여부)은 **별건으로 미뤄진 채 미확정**이다. 이 상태로 planner 가 §6.2 를 실측대로 채워 넣으면, 같은 `14-external-interaction-api.md`/`6-websocket-protocol.md` 문서군 안에 "`turnDebug`" 라는 동일 키가 object-vs-array 로 정면 충돌하는 두 정의가 정식으로 등재된다 — 외부 통합자가 REST/SSE §6.2 예시만 보고 파서를 짜면 `nodeOutput.meta.turnDebug`(배열, References/LLM Usage 탭 근거) 처리 로직을 최상위 `turnDebug`(단일 객체)에 잘못 적용하기 쉽다.
  - 제안: planner 턴에서 §6.2 재작성 시 **최상위 필드를 다른 이름으로 리네임**(예: `turnDebugSnapshot`, `firstTurnDebug`, 혹은 아예 `nodeOutput.meta.turnDebug[0]` 과 값이 겹치므로 최상위 노출 자체를 걷어내고 `nodeOutput.meta.turnDebug` 하나로 단일화)하거나, 리네임이 외부 계약(위젯 참조 구현)을 깨 비용이 크다면 최소한 §6.2 예시 바로 옆에 **"이 최상위 `turnDebug` 는 `nodeOutput.meta.turnDebug`(§4.4, 배열)와 이름만 같고 타입이 다르다"** 는 명시적 disambiguation 문구를 §4.2 `resumed` 필드에 이미 쓰인 패턴(WS spec §4.2 : "이 ack boolean `resumed` 는 이름이 같은 `execution.resumed` 이벤트(§4.1)·NodeExecution status enum `"resumed"` 와 별개다")과 동일하게 부착할 것. 리네임이 가능하면 리네임이 근본적으로 낫다 — 코드가 이미 두 곳에서 다른 shape 를 쓰는 이상 문서만 라벨을 바꿔서 해결될 문제가 아니다.

- **[INFO]** 이번 라운드는 spec 식별자 신설이 없었다 (범위 확인용 기록)
  - target 신규 식별자: 없음 — `spec/5-system/*.md` 는 `origin/main` 대비 diff 0줄
  - 기존 사용처: 해당 없음
  - 상세: `--impl-done` 모드로 소집됐으나 실제 코드 변경은 `stripExternalOnlyFields`/`stripDeep`(순수 내부 헬퍼, non-export) 뿐이라 요구사항 ID·엔티티명·endpoint·이벤트명·ENV var·spec 파일 경로 어느 축에서도 신규 식별자 충돌이 발생하지 않는다. `EXTERNAL_STRIPPED_FIELDS` 배열 값(`'llmCalls'`)도 변경 전과 동일.
  - 제안: 없음 (기록용)

## 요약

이번 diff(`stripExternalOnlyFields` 를 depth-agnostic 으로 바꾼 보안 패치) 자체는 spec 신규 식별자를 도입하지 않아 이 체크 관점에서 문제가 없다. 그러나 같은 워크트리에 대기 중인 `spec-draft-eia-62-waiting-payload.md` plan 이 EIA §6.2 를 실측 wire 로 재작성하면서, 코드에 이미 존재하는 최상위 `turnDebug`(object)를 스펙이 이미 배열로 정본화해 둔 `nodeOutput.meta.turnDebug`(§WS 4.4)와 **같은 이름으로 나란히** spec 에 등재할 계획이라는 점을 실측으로 확인했다. plan 저자도 이를 "이름 충돌" 로 이미 인지했지만 처분은 미확정(별건 이월)이므로, 다음 planner 턴이 착수 전 반드시 리네임 또는 명시적 disambiguation 결정을 내려야 한다 — 그러지 않으면 이 라운드 이후 첫 spec 반영 커밋에서 문서 차원의 정식 이름 충돌이 생긴다.

## 위험도

MEDIUM
