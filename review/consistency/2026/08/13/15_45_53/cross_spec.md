# Cross-Spec 일관성 검토 — spec-draft-eia-notification-payload-contract

## 검토 방법

target(`plan/in-progress/spec-draft-eia-notification-payload-contract.md`)이 실제로 손대려는
4개 파일(EIA §6, WS §4.1, `chat-channel-adapter.md` §1.2, `3-workflow-editor/3-execution.md`
§8.1)의 **현재 spec 본문**을 직접 읽고, 이어서 `finalNodeId`/`finalPort`/`nodeCount`/
`failedNodeId`/`durationMs`/`cancelledBy`/`execution.completed|failed|cancelled` 를 `spec/`
전체에서 grep 해 target 의 `spec_impact` 4파일 **밖에** 같은 개념을 다르게 서술하는 5번째 파일이
있는지 확인했다(1차 draft 가 바로 이 실수로 두 차례 반려된 이력이 있어 — `15_15_08`/`15_28_10`
— 이번 라운드의 핵심 점검 축으로 삼음). 아울러 실제 emit 코드(`execution-engine.service.ts`,
`retry-turn.service.ts`, `notification-fanout.service.ts`)를 직접 읽어 target 이 인용한 라인·
payload shape 주장이 정확한지 대조했다.

## 발견사항

### 전역 grep 결과 — 영향 범위 재확인 (정보성, 결함 아님)

`finalNodeId`/`finalPort` 는 `spec/5-system/14-external-interaction-api.md` 와
`spec/conventions/chat-channel-adapter.md` 2곳에만 존재 — target 의 `spec_impact` 안에 이미
포함됨. `cancelledBy`/`execution.completed|failed|cancelled` 를 언급하는 나머지 파일
(`4-nodes/7-trigger/providers/{discord,slack,telegram}.md`, `5-system/15-chat-channel.md`,
`5-system/3-error-handling.md`, `5-system/4-execution-engine.md`,
`7-channel-web-chat/{1-widget-app,2-sdk}.md`, `conventions/{error-codes,node-cancellation}.md`,
`data-flow/{3-execution,15-external-interaction}.md`)는 전부 `error.code`/`cancelledBy` 값
또는 이벤트 **이름**만 참조하고 target 이 삭제·optional 화하려는 필드 shape 자체를 재서술하지
않는다 — target 의 결정과 충돌하지 않는다. `2-navigation/14-execution-history.md` 의
`totalNodeCount`/`completedNodeCount`/`failedNodeCount`(목록 API 배치 집계 컬럼)과
`durationMs`(Execution 엔티티 필드, `1-data-model.md` L469 `duration_ms` 와 동일 계열)는 이름은
겹치지만 **다른 데이터 소스**(REST 목록 DTO, 엔티티 컬럼)이지 종결 이벤트 payload 가 아니므로
동일 개념 충돌이 아니다 — 오히려 target 이 신규 표기로 채택한 `durationMs` 가 이 기존 엔티티
필드명과 일치해 정합성이 있다.

target 이 회귀 재발을 막기 위해 부여한 spec_impact 4파일 범위는 이번 grep 기준으로 완전하다.
새로 추가할 5번째 파일은 발견되지 않았다.

### 실측 대조 — target 의 코드 인용 정확도 (정보성)

아래 3곳을 직접 읽어 target 의 payload 주장과 대조했다. 전부 일치한다:

- `execution-engine.service.ts:2371` — `{ status: ExecutionStatus.COMPLETED }` (target §1 과 일치)
- `execution-engine.service.ts:1080-1088` (`emitCancellationEvent`) —
  `{ status: CANCELLED, result: { cancelledBy }, ...(error ? {error} : {}) }` (target §3 과 일치)
- `retry-turn.service.ts:956-965` (`failRetryExecution`) —
  `{ status: finalStatus, ...(!isCancelled ? {error} : {}) }` — **`result` 키 자체가 없음**
  (target 의 "cancelledBy 미emit" 캐비엇과 일치. 단, 정밀하게는 `result.cancelledBy` 가
  "optional 필드" 인 게 아니라 이 경로에서는 `result` 객체 자체가 통째로 없다 — target §5 의
  "`result.cancelledBy` 도 optional" 표현과 실제 결함 형태가 정확히는 다르다. 타입을
  `result?: {...}` 로 선언하면 두 경우 모두 커버되므로 실무 영향은 없지만, 표현을 다듬을 여지는
  있다.)

- **[INFO]** `chat-channel-adapter.md` §5 캐비엇 문구 정밀도
  - target 위치: `## 무엇을 쓸 것인가` §5 (`chat-channel-adapter.md` §1.2 갱신 지시)
  - 충돌 대상: 실제 코드 `retry-turn.service.ts:956-965`
  - 상세: target 은 "`cancelled` 의 `result.cancelledBy` 도 optional (§3 캐비엇과 같은 이유)"
    이라고 쓰는데, 실측하면 `failRetryExecution` 경로는 `result` **필드 자체를 emit 하지 않는다**
    (`cancelledBy` 만 빠진 게 아니라 `result` 객체 통째로 부재). `result?: { cancelledBy: ... }`
    로 선언하면 결과적으로 동일하게 옵셔널 처리되므로 실무 영향은 없으나, 표현이 결함의 실제
    형태(필드 누락이 아니라 객체 자체 누락)와 다르다.
  - 제안: `chat-channel-adapter.md` §1.2 갱신 시 `result?: { cancelledBy: ... }` (result 전체
    optional)로 적어 실제 emit 형태와 정확히 맞춘다. spec 원문(반영 전) 문제이므로 후속 developer
    작업에는 영향 없음.

### `3-workflow-editor/3-execution.md` §8.1 — 기존에도 WS §4.1 과 이미 어긋나 있었다 (정보성 — target 결정이 이를 적절히 해소)

- target 위치: `## 무엇을 쓸 것인가` §6
- 충돌 대상: `spec/3-workflow-editor/3-execution.md` §8.1 (현재본) vs `spec/5-system/6-websocket-protocol.md` §4.1 (현재본)
- 상세: 현재 `3-execution.md` §8.1 표는 `execution.completed | executionId, status, duration`,
    `execution.failed | executionId, error`, `execution.cancelled | executionId` 로 적혀 있고,
    WS §4.1 은 `{executionId, status, duration, nodeCount}` / `{executionId, error, failedNodeId,
    duration}` / `{executionId, cancelledBy, duration, error?}` 로 적혀 있다 — **이미 필드 개수부터
    서로 다르다**(target 이 손대기 전부터 두 문서가 독립적으로 drift 해 있었다). target 의 결정
    ("이 표는 계약 SoT 가 아니라 요약 — 상단에 'SoT 는 WS §4.1 / EIA §6' 명시")은 필드별 동기화를
    포기하고 참조로 대체하는 방식이라 이 기존 drift 를 재발 방지 구조로 해소한다 — 적절한 처리다.
  - 결론: 이 항목은 결함이 아니라 target 결정의 타당성을 뒷받침하는 확인 사항으로 기록한다.

### `retry-turn-terminal-guard.md` W1(api_contract) 과의 정합 확인 (정보성)

- target 은 `failRetryExecution` 의 `cancelledBy` 누락을 "선재 결함" 이라 명시하고, 실제 수정은
  `plan/in-progress/retry-turn-terminal-guard.md` W1 로 위임한다(체크리스트 마지막 항목).
  해당 plan 을 확인하면 이 항목은 "5R W1", 통합표 `#2` 로 이미 등재돼 있고 **아직 미완료(P2)**
  상태다 — target 의 "선재 결함" 서술과 위임처가 정확히 일치한다. 이중 트래킹이나 상충하는 결정은
  없다.

## 요약

target(EIA/WS 종결 이벤트 payload 계약 정합화 spec draft)이 명시한 `spec_impact` 4파일은 전역
grep 기준으로 완전하다 — 동일 필드(`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`/
`durationMs`/`cancelledBy`)를 서술하는 5번째 파일은 발견되지 않았고, 이전 두 라운드에서 반려됐던
"영향 범위 절반" 패턴은 이번 grep 재확인으로 해소가 확인된다. target 이 인용한 실제 emit 코드
라인(`execution-engine.service.ts:2371,1080-1088`, `retry-turn.service.ts:956-965`)도 실측과
정확히 일치한다. `3-workflow-editor/3-execution.md` §8.1 을 비-authoritative 요약으로 재정의하는
결정은, 이 표가 WS §4.1 과 이미 (target 과 무관하게) 필드 개수부터 어긋나 있던 기존 drift 를
구조적으로 해소하는 적절한 처리다. 유일하게 남는 것은 `chat-channel-adapter.md` §5 캐비엇 문구의
정밀도(INFO) — "`result.cancelledBy` optional" 이 아니라 정확히는 "`result` 객체 자체가
optional"이며, 타입 선언 시 `result?: {...}` 로 쓰면 실무 영향은 없다. Cross-spec 관점에서
CRITICAL/WARNING 급 충돌은 발견되지 않았다.

## 위험도

LOW
