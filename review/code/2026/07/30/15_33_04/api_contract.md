# API 계약(API Contract) Review

## 검토 범위 요약

리뷰 대상 5개 파일(`state-machine.ts`, `execution-engine.service.ts`,
`ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`,
`retry-turn.service.ts`)과 실제 diff(`git diff origin/main..HEAD`, 최신 커밋
`2ca44b769` "retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함")를 대조 확인했다.
변경은 전부 `execution-engine` 모듈 **내부** 상태머신(`canTransition`/`assertTransition`)과
DB 트랜잭션 가드(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/
`updateExecutionStatus`/`claimSpawnedRetryRow`)에 국한된다. REST Controller, DTO,
OpenAPI/Swagger 데코레이터, 라우트 경로, 페이지네이션, 인증/인가 가드는 이번 변경 어디에도
없다. `execution.retry_last_turn` WS 명령의 유일한 진입점(`websocket.gateway.ts`
`@SubscribeMessage('execution.retry_last_turn')`)과 에러 코드 매핑(`workflow-errors.ts`,
`ws-error-codes.ts`)도 이번 diff 에 포함되지 않아 **요청/ack payload 계약 자체는 완전히
불변**이다. 모든 시그니처 변경(`tryLockActiveExecutionAndSaveNodeExec`/
`reparkAiResumeTurn`/`lockNonTerminalExecutionRow`/`updateExecutionStatus` 의 신규
`opts?` 파라미터)은 끝에 추가된 optional parameter라 기존 호출부·목(mock)과 하위 호환된다.

## 발견사항

- **[INFO]** retry 재진입 spawn row 의 `NODE_STARTED` WS 이벤트 payload에서 내부 전용
  `_retryState` 키가 제거됨 — 의도된 변경, 이미 회귀 테스트로 고정됨 (조치 불요)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:369`
    (`delete spawnedRow.inputData[RETRY_STATE_KEY];`), `:447`
    (`emitNode(NodeEventType.NODE_STARTED, { ..., input: spawnedRow.inputData, ... })`)
  - 상세: `applyRetryLastTurn` 이 2차 원자 claim(`claimSpawnedRetryRow`) 직후
    in-memory `spawnedRow.inputData` 에서 `_retryState` 키를 삭제한다. 그 직후
    호출되는 `emitNode(NODE_STARTED, ...)` 가 클라이언트로 내보내는 `input` 필드에는
    이 내부 북키핑 키가 더 이상 담기지 않는다. 이 변경 자체는 이번 diff의 핵심(DB
    가드 원자성)과는 독립적인 부수 효과이며, `spec/5-system/6-websocket-protocol.md`
    가 문서화한 `execution.node.started` 최소 스키마(`{executionId, nodeId,
    nodeExecutionId, nodeName, nodeType}`, 동 spec §4.1 표)는 애초에 `input`/
    `_retryState` 를 계약 필드로 명시하지 않았고, 프런트엔드 코드에서도 이벤트
    payload 의 `_retryState` 값을 직접 소비하는 지점은 없음을 확인했다(`grep` 전수
    확인, `conversation-utils.ts` 의 참조는 `NodeExecution.id` 에 대한 docstring
    설명일 뿐 `_retryState` 필드 자체를 읽지 않음). 즉 하위 호환성을 깨는 응답 스키마
    변경이 아니라, "internal 필드 비노출" 원칙에 맞춰 이미 느슨하게 문서화된 필드
    집합을 의도적으로 좁힌 것이며 코드 주석(W6, ai-review 7R)에 그 의도와 회귀
    테스트 존재가 명시돼 있다.
  - 제안: 조치 불필요. 다만 향후 `node.started`/`node.completed` 등 WS 이벤트의
    실제 방출 필드 전체(현재 spec 표는 최소 부분집합만 나열)를 spec 에 정식
    스키마화할 기회가 있다면, 이번처럼 "내부 전용이라 의도적으로 제외되는 필드"를
    각주로 남겨 다음 리뷰에서 동일 항목이 매번 재조사되지 않도록 한다.

그 외 8개 점검 관점(하위 호환성 / 버전 관리 / 응답 형식 / 에러 응답 / 요청 검증 /
URL·경로 설계 / 페이지네이션 / 인증·인가)에 해당하는 코드 변경은 없다:

- **하위 호환성**: `Execution.status` 가 `waiting_for_input`/`running` 으로 정상
  전이되도록 만드는 버그 수정이다 — 이 전이들은 이미 spec(§1.3, §7.9)과
  WS 프로토콜 문서(§4.2)가 약속한 값이었고, 이번 커밋 이전에는 구조적 결함으로
  DB 가드가 항상 0행이라 실제로는 결코 persist 되지 않았다(FAILED→CANCELLED 오분류
  또는 동기 throw → EXECUTION_FAILED 로 대체). 즉 새 계약을 추가하는 게 아니라
  기존에 문서화됐으나 깨져 있던 계약을 복구하는 변경이라 기존 클라이언트 입장에서는
  "일부 케이스에서 원래 보장됐어야 할 상태로 정상 전이된다"는 개선만 있다.
- **버전 관리 / URL·경로 설계 / 페이지네이션 / 인증·인가**: 해당 코드 없음(컨트롤러·
  라우트·가드 미변경).
- **에러 응답**: `RetryLastTurnError`/`InvalidExecutionStateError`/
  `ExecutionCancelledError` 타입과 이들의 WS ack `error.code` 매핑은 이번 diff에서
  손대지 않았다.
- **요청 검증**: 신규/변경된 요청 DTO·파라미터 없음.

## 요약

이번 변경은 `execution.retry_last_turn` 재진입이 의존하는 FAILED→RUNNING/
FAILED→WAITING_FOR_INPUT 짝 전이가 상태머신(`allowRetryReentry` opt-in)은 통과하고도
DB 가드(`lockNonTerminalExecutionRow` 등 3곳)에서 FAILED 를 무조건 배제해 항상 0행으로
막히던 구조적 결함을 고치는 백엔드 내부 엔진 수정으로, REST/GraphQL 컨트롤러·DTO·라우트·
페이지네이션·인증 가드 등 외부에 노출되는 API 표면은 전혀 변경하지 않는다. 유일한 WS
진입점(`execution.retry_last_turn` 명령의 요청/ack 스키마, 에러 코드)도 이번 diff 밖이라
완전히 불변이며, 신규 `opts?` 파라미터들은 전부 후행 optional 이라 하위 호환이 보장된다.
`NODE_STARTED` 이벤트 payload 에서 내부 `_retryState` 키가 빠지는 부수 효과 하나만
확인했으나 문서화된 계약 필드가 아니고 소비하는 클라이언트 코드도 없어 INFO 로 기록한다.
API 계약 관점에서 차단 사유 없음.

## 위험도

NONE
