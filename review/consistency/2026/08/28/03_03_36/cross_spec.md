# Cross-Spec 일관성 검토 — system_error 배너 (spec/5-system/, --impl-done)

## 검토 범위 요약

본 diff 는 spec 변경 없이 `codebase/frontend/src/lib/websocket/use-execution-events.ts` +
그 테스트만 수정한다 (`git diff origin/main...HEAD -- spec/` 결과 0건 확인). 목적은
`execution.node.failed`/`execution.node.completed` 이벤트에서 구조화 에러를
`payload.output.output.error` (래퍼 한 겹 아래)에서 읽도록 정정하는 것이며, 이는
이미 병합된 `spec/5-system/6-websocket-protocol.md` §4.1-a (2026-08-24 실측 정정) 및
`spec/conventions/node-output.md` Principle 0 (wire envelope vs 도메인 값 구분, 2026-08-24 신설)
을 코드가 뒤늦게 따라잡는 작업이다. `spec/conventions/conversation-thread.md` §9.7 표
(569~570행)도 이미 `payload.output.output.error` 로 정정돼 있어, diff·§4.1-a·Principle 0·
§9.7 넷은 서로 정합한다. `wrapNodeHandlerOutput` 헬퍼(`{ output, config: {}, meta: {} }`)도
node-output.md Principle 0 의 5필드 계약과 어긋나지 않는다.

## 발견사항

- **[WARNING]** `6-websocket-protocol.md` §4.2 의 `retry_last_turn` 관련 3곳이 같은 문서
  §4.1-a 의 이중 래핑 정정과 표기가 어긋난다
  - target 위치: 코드 diff 자체가 아니라, 코드가 SoT 로 인용하는
    `spec/5-system/6-websocket-protocol.md` §4.2 — 278행(`execution.retry_last_turn` 명령
    설명), 435행(`NODE_NOT_RETRYABLE`), 436행(`RETRY_TOO_EARLY`)
  - 충돌 대상: 같은 파일의 §4.1-a(241~248행) 및 188~189행, 그리고
    `spec/conventions/node-output.md` Principle 0(2026-08-24 신설 — "wire envelope 은 래퍼를
    통째로 싣는다, 도메인 값은 한 겹 아래")
  - 상세: §4.1-a 는 `execution.node.failed`/`completed` 의 구조화 에러가 wire 레벨에서
    `output.output.error` (즉 `payload.output` = `NodeHandlerOutput` 래퍼, 그 안의
    `.output.error` 가 도메인 값)라고 명시적으로 정정했고, 188~189행도 이를 반영해
    `output.output.error` 로 쓴다. 그런데 30~150행 아래인 278/435/436행은 여전히
    구정정 이전 표기인 `output.error.details.retryable` / `output.error.details.retryAfterSec`
    (단일 nesting)를 쓴다. 이 정확한 표기 오차(한 겹 얕음)가 이번 PR 이 고친 프런트
    결함(`extractNodeErrorPayload` 가 `payload.error` 를 객체로 오인해 배너가 한 번도
    안 뜬 버그)의 근본 원인이었다 — 즉 문서가 아직 "그 결함을 낳았던 문구" 를 §4.2 에
    남겨 두고 있다. 실측: 백엔드 `retry-turn.service.ts:153-164` 는 이미
    `outputData.output.error.details.retryable` (올바른 이중 nesting)로 구현돼 있어
    **현재 동작 결함은 없다** — 이 항목은 순수 문서 표기 drift 다.
  - 제안: `spec/5-system/6-websocket-protocol.md` §4.2 의 278/435/436행을 §4.1-a 와 동일한
    표기로 통일한다 (예: `outputData.output.error.details.retryable` 또는
    `NodeExecution.outputData.output.error.details.retryable` 로 명시). 이 시리즈가
    node-output.md Principle 0 에서 "산문으로 5개 문서에 흩어져 4라운드 연쇄 정정을
    낳았다" 고 자인한 바로 그 패턴의 잔여 사본으로 보인다 — 정정 시 같은 문서 안의
    다른 잔여 사본(`grep -n "output\.error\.details" spec/5-system/6-websocket-protocol.md`)도
    함께 훑을 것을 권한다.

- **[INFO]** `3-execution.md`/`data-hydration-surfaces.md` 의 `execution.node.failed` 필드
  요약이 §4.1-a 만큼 정밀하지 않음
  - target 위치: (참조 대상 문서이며 이번 diff 의 직접 target 아님)
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md:305`
    (`| execution.node.failed | executionId, nodeId, error | 노드 실패 |`),
    `spec/conventions/data-hydration-surfaces.md:32`
  - 상세: 두 곳 다 `error` 필드의 정확한 shape(문자열 vs 구조화 객체 위치)를 명시하지
    않고 뭉뚱그려 적는다. 지금은 §9.7/§4.1-a 를 참조로 위임하는 형태라 명백한 모순은
    아니지만, `3-execution.md:305` 는 참조 링크 없이 `error` 를 단독 나열해 독자가
    과거(객체) shape 을 유추할 여지가 있다.
  - 제안: 급하지 않음. 다음에 `3-execution.md` §해당 표를 만질 일이 있으면
    `error`(string) / `output.output.error`(구조화, 조건부 동봉) 로 갈라 적거나
    §4.1-a 링크를 추가.

## 요약

이번 diff 는 spec 변경 없이 기존에 이미 정정된 `6-websocket-protocol.md §4.1-a` /
`node-output.md Principle 0` 을 코드가 뒤늦게 따라잡는 impl-done 작업이며,
`conversation-thread.md §9.7`·AI Agent §7.9 도메인 표기·백엔드 `retry-turn.service.ts` 구현과도
정합한다 — 직접적인 CRITICAL 데이터 모델·API 계약·상태 전이·RBAC 충돌은 발견되지 않았다.
다만 target 코드가 SoT 로 인용하는 `6-websocket-protocol.md` 자신의 §4.2(`retry_last_turn`
명령·에러 코드 표)가 같은 문서 §4.1-a 의 이중 래핑 정정을 반영하지 못한 채 이 PR 이 고친
버그와 정확히 같은 모양의 구표기(`output.error.details.retryable`, 한 겹 얕음)를 남겨 두고
있어 문서 내부 정합성 WARNING 1건으로 보고한다. 백엔드 구현은 이미 올바른 이중 nesting을
쓰므로 기능 회귀는 아니며, 향후 재발 방지 차원의 문서 동기화 권고다.

## 위험도

LOW
