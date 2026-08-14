STATUS=success naming_collision review complete — CRITICAL 1, WARNING 1
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec-draft-eia-62-waiting-payload.md`

## 발견사항

- **[CRITICAL]** `turnDebug` 명칭 충돌 — target 문서 자신이 인지한 handoff 가 실제 변경 제안 (1)~(7) 에서 처분되지 않고 열린 채로 남아 있다
  - target 신규 식별자(리스크 상태): `turnDebug` — target 문서 "실측" 표(§`## 실측`, "표면별" 항목: `AI → nodeOutput: {...}, turn1 은 추가로 turnDebug: { llmCalls, metadata }`)와 "현행 §6.2 와의 대조" 표의 "(언급 없음)" 행이 실측으로 확인한, `execution.waiting_for_input` 최상위(top-level)의 단일 object 필드. 출처: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:615-617` — `turnDebug: { llmCalls: turnDebugHistory[0], metadata }`.
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:449`(§4.4 표) — 같은 이벤트(`execution.waiting_for_input`)의 `nodeOutput.meta.turnDebug` 를 `{ turnIndex, ragSources[], ragDiagnostics?, llmCalls?, toolCalls?, totalDurationMs? }` shape 의 **배열**로 이미 정본 정의하고 있고, `spec/4-nodes/3-ai/0-common.md:105`·`spec/4-nodes/3-ai/1-ai-agent.md:562`·`spec/conventions/conversation-thread.md` 전역 10곳 이상에서 "턴별 트레이스 배열" 의미로 일관되게 재사용된다. 코드 쪽도 `ai-conversation-helpers.ts:97` (`turnDebug: state.turnDebugHistory` 전체 히스토리, 배열)로 이 정의를 따른다.
  - 상세: target 문서 자신의 `## 🔴 조사 중 발견` 절이 이미 이 충돌을 실증했다 — 같은 `execution.waiting_for_input` payload 안에 `payload.turnDebug`(object, `llmCalls` 단수)와 `payload.nodeOutput.meta.turnDebug`(array, WS §4.4 정본)가 **동시에 존재**하고 shape 이 완전히 다르다는 것을 `websocket.service.spec.ts` 프로브로 직접 관측했다(경로 1·2 표). 그리고 문서 자신의 체크리스트(`### 처분 (실제 상태)`)가 다음을 명시적으로 미해결(`[ ]`)로 남겨 두었다:
    > "이름 충돌은 이 커밋에 포함되지 않았다 — 별도 잔여. … → planner 인계: §6.2 재작성 시 top-level 을 리네임(`turnDebugSnapshot` 등)하거나 disambiguation 문구를 예시 옆에 부착. 그대로 옮겨 적으면 spec 에 정식 충돌로 고착된다 (`10_32_29` naming_collision CRITICAL 1)."

    문제는 이 handoff 가 가리키는 "§6.2 재작성" 이 바로 **이 target 문서 자신**이라는 점이다. 그런데 target 의 "변경 제안" (1)이 초판("안쪽을 실측 키로 교체")을 철회하고 "안쪽 JSON(`node`/`interaction`/`context`)은 그대로 둔다"로 방향을 바꾸면서, 위 handoff 항목이 (a) 이 방향 전환으로 **자동 해소**된 것인지("안쪽을 그대로 두므로 `turnDebug` 도 §6.2 JSON 에 안 들어간다"), 아니면 (b) (3)의 "논리 표기 ↔ 실제 wire 필드명" blockquote 정정이 이 gap 을 채우려는 순간 여전히 **재발할 수 있는 위험**인지가 문서 안에서 결론나지 않은 채 체크박스만 `[ ]` 로 남아 있다. 실제로 (3)이 요구하는 "논리 표기 ↔ 실제 wire 필드명" 매핑을 완전하게 만들려면, target 이 스스로 "언급 없음" 이라 표시한 gap(`waitingNodeLabel`·`nodeExecutionId`·`startedAt`·`turnDebug`) 중 `waitingNodeLabel`/`nodeExecutionId`/`startedAt` 은 이미 `6-websocket-protocol.md:394,975` 가 "WS 내부 부가 식별자 = §4.4 소유, EIA §6.2 는 외부소비 필드만" 이라는 기존 오너십 분리 컨벤션으로 커버하지만, **`turnDebug` 는 그 4-필드 오너십 목록에도 포함되어 있지 않다** — 즉 `turnDebug` 만 유일하게 "누구도 소유를 선언하지 않은" 상태로 남는다. 다음 라운드가 (3)을 집행하며 이 gap 을 메우려는 순간, 이름을 바꾸지 않고 그대로 적으면 (`10_32_29`가 예측한) 정식 spec 충돌이 그대로 재현된다.
  - 제안: 이번 라운드에서 이 checklist 항목을 명시적으로 닫을 것. 두 가지 중 택일해 target 문서 본문에 결론을 박아라 —
    1. **범위 확정형**: (1)의 결정("안쪽 JSON 은 그대로 둔다")이 `turnDebug` 를 §6.2 예시/blockquote 어디에도 적지 않는다는 뜻임을 명시하고, 체크리스트 191~197행 항목을 `[x]` 로 닫으면서 "§6.2 는 여전히 top-level `turnDebug` 를 문서화하지 않는다 — 이 문서 반영으로는 실측 gap 이 닫히지 않는다"는 주석을 남긴다(별도 후속 항목으로 재등재).
    2. **해소형**: (3)의 재작성 blockquote 에 실제로 `turnDebug` 행을 추가해야 한다면, `10_32_29` naming_collision 이 제안한 대로 리네임(`turnDebugSnapshot` 등) 또는 WS §4.2 `resumed` 필드에 이미 쓰인 disambiguation 패턴(`spec/5-system/6-websocket-protocol.md:268` — "이 ack boolean `resumed` 는 이름이 같은 `execution.resumed` 이벤트·NodeExecution status enum `"resumed"` 와 별개다")과 동형의 명시 문구를 그 행 옆에 부착한다.

    어느 쪽이든 "planner 인계: §6.2 재작성 시…" 문구가 **자기 자신을 가리키고 있다는 사실**을 인지하고 처분을 확정해야, 다음 세션이 이미 처리된 항목인 줄 모르고 중복 작업하거나 반대로 미해결인 줄 모르고 흘려보내는 두 실패 모드를 모두 막는다.

- **[WARNING]** "현행 §6.2 와의 대조" 표가 오너십이 다른 필드들을 한 행에 합쳐 놓아, (3) 집행 시 과대 스코프(WS 소유 필드까지 EIA §6.2 로 끌어옴)로 오독될 여지가 있다
  - target 신규 식별자: 없음(표 서술 이슈) — "(언급 없음)" 행이 `waitingNodeLabel`·`nodeExecutionId`·`startedAt`·`turnDebug` 4개를 동일 취급으로 나열
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:394,975` — `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt` 4개는 이미 "WS §4.4 소유, EIA §6.2 의도적 스코프 밖"으로 **문서화되어 있다**(오너십 분리, PR #945 계열 컨벤션). 반면 `turnDebug` 는 그 소유 선언 목록에 없다.
  - 상세: target 표는 이 4개를 "(언급 없음)" 한 행으로 묶어, 읽는 사람이 "§6.2 가 이 4개를 전부 다뤄야 하는 gap" 으로 오인하기 쉽다. 그러나 실제로는 3개(`waitingNodeLabel`/`nodeExecutionId`/`startedAt`)는 이미 WS §4.4 가 명시적으로 소유를 선언한 **의도된 비대칭**이고, `turnDebug` 하나만 소유 선언이 없는 **진짜 gap** 이다. 이 구분이 표에 없으면 (3) 집행자가 4개를 동일하게 §6.2 blockquote 에 채워 넣으려 시도할 수 있고, 그러면 기존 오너십 분리 컨벤션(`6-websocket-protocol.md:975` "EIA §6.2 를 전체 SoT 로 격상하지 않은 이유")과 충돌한다.
  - 제안: 대조표의 "(언급 없음)" 행을 둘로 쪼개 — "`waitingNodeLabel`·`nodeExecutionId`·`startedAt` (WS §4.4 가 이미 소유 — §6.2 범위 아님, 의도됨)" / "`turnDebug` (소유 미선언 — 위 CRITICAL 참조)"로 구분한다.

## 요약

target(`spec-draft-eia-62-waiting-payload.md`)은 §6.2 를 봉투만 고치고 안쪽 JSON 재작성은 철회하는 방향으로 스코프를 축소했지만, 그 축소가 문서 자신이 앞서 실증까지 마친 `turnDebug` 명칭 충돌(top-level object vs `nodeOutput.meta.turnDebug` 배열, WS §4.4:449 정본) 의 처분에 어떤 영향을 주는지 결론짓지 않았다. 체크리스트의 해당 항목은 `[ ]` 로 열려 있고 그 항목이 가리키는 "§6.2 재작성" 은 이 문서 자신이므로, 이번 반영 커밋에서 명시적으로 닫지 않으면 다음 라운드가 (3)의 blockquote 정정을 집행하며 이름을 바꾸지 않고 그대로 옮겨 적어 spec 에 정식 명칭 충돌을 고착시킬 위험이 남는다. 그 외 요구사항 ID·API endpoint·이벤트명·ENV var·spec 파일 경로 축에서는 target 이 새로 도입하는 식별자가 없고, 기존 endpoint(§5.1~5.5)·필드(`error.code`·nullable `nodeId`)와의 충돌도 발견되지 않았다.

## 위험도

HIGH
