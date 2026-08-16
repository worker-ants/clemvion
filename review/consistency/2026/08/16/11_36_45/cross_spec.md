# Cross-Spec 일관성 검토 — target: `spec/5-system/` (--impl-done, diff-base=origin/main)

## 검토 방법 메모

프롬프트 번들이 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`·
`spec/5-system/6-websocket-protocol.md`·`<git diff>` 등 16개 파일 본문이 생략되어 있었다
(§"컨텍스트 예산 초과로 생략된 파일 16개"). 이를 "내용 없음"의 근거로 삼지 않고, 워크트리
절대경로로 직접 `Read`/`git grep`/`git diff` 해 실제 diff 와 spec 본문을 확인했다.

diff 실측: 이번 PR 은 `spec/**` 파일을 전혀 건드리지 않았다 (`git diff origin/main...HEAD --stat -- 'spec/**'`
결과 없음). 실제 코드 변경은 `codebase/backend/src/shared/utils/terminal-error-payload.ts` 에
`redactTerminalError`(`deepRedactSecrets` 를 `message`/`details` 에 적용) 를 신설하고
`codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` JSDoc 을 정정한 것,
그리고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 체크리스트 갱신이다.
따라서 본 cross-spec 검토는 "target=spec/5-system/ 그 자체가 이번에 변경된 코드와 여전히
정합한가, 그리고 spec/5-system/ 내부·타 영역과 충돌하지 않는가"를 확인하는 데 집중했다.

## 발견사항

- **[WARNING] `execution.failed` 의 신규 secret 마스킹이 EIA §6.4 정본 필드 표에 미반영**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 도입부(L563-569, "이 절이
    outbound 이벤트 계약의 SoT" · "이 표가 전부다") 및 §6.4 `execution.failed` 페이로드
    (L770-806, `error.message` = "사람-가독 메시지")
  - 충돌 대상: 같은 파일의 R17(L1371-1457) — `nodeOutput.conversationConfig`/
    `conversationThread`/`ai_message` 에 대한 `deepRedactSecrets` egress 마스킹을 상세히
    문서화한 선례 — 및 이 파일 자신이 명시한 관행(L836: "알려진 갭은 invariant 옆에
    적는다(R14·R17·§6.4 와 동형)")
  - 상세: 이번 PR 이 신설한 `redactTerminalError`(`terminal-error-payload.ts`)는
    `toTerminalErrorPayload` 의 유일한 반환 경로이고, 이 함수는 `EXECUTION_FAILED` emit
    4곳(`execution-engine.service.ts`, `retry-turn.service.ts`) + `chat-channel.dispatcher.ts`
    재정규화 1곳 등 5개 호출부 전부가 거치는 wire-형태 chokepoint 다. R10(L1262-1292)에
    따르면 이 payload 는 단일 sink(`WebsocketService.emitToExecution`)를 통해 내부 에디터
    WS·SSE·outbound webhook·Chat Channel 로 동시에 fan-out 된다. 즉 `execution.failed`
    의 `error.message`/`error.details` 는 이제 값-패턴 secret 마스킹을 거쳐 나간다.
    그런데 §6.4 의 정본 필드 표·jsonc 예시는 여전히 `message: "사람-가독 메시지"` 로만
    적혀 있고, §6 도입부가 스스로 "이 표가 전부다"라고 못박은 필드 집합 표(§571-582)에도
    이 마스킹에 대한 언급이 없다. 같은 파일의 R17 은 정확히 같은 클래스의 결정(어떤 필드가
    `redactSecrets` vs `deepRedactSecrets` 인지, 내부 WS 도 마스킹되는 "수용된 trade-off"라는
    점, 무엇을 못 잡는지)을 상세히 기록해 두었는데, 이번 변경은 코드 JSDoc 과
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에만 기록되고 SoT 인 §6.4
    는 갱신되지 않았다. 이 파일은 스스로 "같은 필드를 여러 문서에 나열하면 그 각각이
    두 번째 SoT 가 되고, 실제로 그렇게 됐다"(L568-569)며 SoT 일원화를 원칙으로 못박는데,
    정작 SoT 본문이 구현보다 뒤처진 채로 남아 자신의 관행(L836)과 어긋난다. 기능이 깨지는
    CRITICAL 은 아니지만(무엇도 작동 불능이 되지 않는다), §6.4 를 그대로 신뢰하는 통합
    개발자는 `error.message` 가 항상 원문이라고 오해할 수 있다.
  - 제안: §6.4(및 §6 필드 집합 표 L579 `error` 행)에 R17 과 대칭되는 caveat 추가 —
    "`message`/`details` 는 egress 시점 `deepRedactSecrets` 로 자격증명 패턴만 마스킹하며,
    자격증명 없는 연결 문자열·내부 호스트명·스택 프래그먼트는 통과한다(잔여 갭, 등재:
    `spec-sync-external-interaction-api-gaps.md`)". `project-planner` 턴에서 처리.

- **[INFO] 동일 `Execution.error` 필드가 내부 WS(마스킹됨)와 내부 실행 상세 REST(비마스킹)
  사이에서 값이 갈릴 수 있음 — 비대칭이 문서화되어 있지 않음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` R10(L1262-1292, 단일 sink
    정책) / R17(L1414-1457, 마스킹 trade-off 선례)
  - 충돌 대상: `codebase/backend/src/modules/executions/executions.service.ts:862`
    (`error: execution.error ?? null` — DB 원본을 그대로 반환, `toTerminalErrorPayload` 를
    거치지 않음) vs 이번 PR 로 마스킹이 걸린 WS `execution.failed`(동일 워크스페이스 인가
    경계, 동일 `Execution.error` 소스). 프론트엔드는 REST 값을 실행 상세 페이지에서
    `execution.error.message` 그대로 렌더한다
    (`codebase/frontend/.../executions/[executionId]/page.tsx:395`).
  - 상세: `GET /api/executions/:id`(에디터 내부 실행 상세, EIA 외부 API 와 별개 모듈)는
    `toTerminalErrorPayload` 를 경유하지 않아 마스킹 없이 DB 원본을 그대로 내려준다. 반면
    동일 execution 의 실시간 WS `execution.failed` 이벤트는 이번 PR 로 마스킹을 거친다.
    즉 같은 워크스페이스 인가 경계 안에서 같은 논리적 필드가 전달 경로(REST 재조회 vs 라이브
    WS)에 따라 원문/마스킹 값으로 서로 다르게 보일 수 있다. R17 이 이미 "에디터는
    external-only strip 되지 않는 `llmCalls` 디버그로 원문을 확인할 수 있다"는 동형의
    trade-off 를 명시적으로 인정한 선례가 있어 **의도된 설계일 가능성이 높지만**, §6.4/R17
    어디에도 이 REST↔WS 비대칭이 명시되어 있지 않다 — 다음 조사자가 "새로고침하면 마스킹된
    문자열이 원문으로 바뀐다"를 버그로 오인하고 처음부터 재조사할 위험이 있다. 기능 충돌은
    아니므로 CRITICAL/WARNING 이 아니라 INFO.
  - 제안: 의도된 trade-off 라면 R17 또는 §6.4 caveat 옆에 "내부 실행 상세 REST
    (`GET /api/executions/:id`)는 DB 원본을 그대로 반환하며 본 마스킹 적용 대상이 아니다"를
    한 줄 명시. 의도치 않았다면 `developer` 턴에서 `executions.service.ts` 응답도
    `redactTerminalError` 를 거치도록 재검토.

## 요약

이번 PR 은 `spec/**` 파일을 변경하지 않고 `toTerminalErrorPayload`(EIA 종결 3종 wire 형태의
단일 chokepoint)에 `deepRedactSecrets` 마스킹을 신설해, WS/SSE/webhook 으로 나가는
`execution.failed` 의 `error.message`/`details` 에 자격증명 패턴 마스킹을 추가했다. 코드
자체는 5개 emit 호출부 전부를 구조적으로 통과시켜 방어가 새지 않도록 설계되었고, chat-channel
CCH-ERR-03(원문 노출 금지)·R17(`conversationThread`/`ai_message` 마스킹 선례)과 상충하지
않으며 오히려 같은 방향(defense-in-depth)이다. 다만 정작 이 변경의 SoT 인 EIA §6.4 정본
필드 표는 갱신되지 않아, 같은 파일이 R17 에서 세운 "마스킹 결정은 invariant 옆에 상세히
문서화한다"는 스스로의 관행과 어긋나는 문서 지연(documentation lag)이 남았다(WARNING).
아울러 동일 필드가 내부 REST(비마스킹)와 내부 WS(마스킹) 사이에서 값이 갈릴 수 있다는 사실도
문서화되어 있지 않다(INFO). 두 건 모두 기능을 깨뜨리는 직접 모순은 아니며, 두 영역 중 하나가
작동 불가능해지는 CRITICAL 은 발견되지 않았다.

## 위험도

LOW
