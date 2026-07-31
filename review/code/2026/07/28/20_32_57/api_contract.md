# API Contract Review — retry_last_turn 원자 claim 교체 (b351731f0)

## 스코프 확인

리뷰 대상 3 파일 (`retry-turn.service.ts`, `retry-turn.service.spec.ts`,
`continuation-execution.processor.ts`) 은 프롬프트가 "전체 파일 컨텍스트" 로 제공했지만,
실제 이번 라운드의 변경분(커밋 `b351731f0`)은 `git show` 로 대조한 결과 다음으로 국한된다:

- `retry-turn.service.ts`: `applyRetryLastTurn` 내부에 **JSONB 조건부 UPDATE 원자 claim**
  (`status='running' AND jsonb_exists(input_data, '_retryState')`) 추가 + 인접 주석 정정.
- `continuation-execution.processor.ts`: 주석(rationale) 정정만 — 로직 변경 없음
  (`process()` 의 `type !== 'cancel' && type !== 'retry_last_turn'` 분기 자체는 그대로).
- `retry-turn.service.spec.ts`: 위 두 변경을 검증하는 유닛 테스트 추가.

이 변경은 **BullMQ continuation 워커 내부의 동시성(claim) 로직**이며, 다음 어떤 축도
건드리지 않는다.

## 점검 관점별 확인

1. **하위 호환성** — `retryLastTurn(executionId, nodeExecutionId): Promise<{ spawnedNodeExecutionId }>`
   와 `applyRetryLastTurn(executionId, spawnedNodeExecutionId): Promise<void>` 의 시그니처·반환
   타입 모두 이번 커밋에서 불변. WS 명령(`execution.retry_last_turn`, spec §4.2)의 클라이언트
   대면 계약(요청 payload, 성공 응답, 에러 코드)에 변경 없음.
2. **버전 관리** — 해당 없음 (internal worker 로직, 공개 API 버전 개념 대상 아님).
3. **응답 형식** — `retryLastTurn` 의 반환 스키마(`{ spawnedNodeExecutionId: string }`,
   `retry-turn.service.ts:120`) 는 그대로. `applyRetryLastTurn` 은 애초에 `void` 를 반환하며
   worker 컨텍스트에서만 실행돼 클라이언트에 직접 응답하지 않음 — 결과는 WS 이벤트
   (`NODE_STARTED`/`EXECUTION_COMPLETED`/`EXECUTION_FAILED`/`EXECUTION_CANCELLED`) 로 push 되는데,
   이번 diff 는 이 이벤트들의 payload 구조나 emit 조건을 바꾸지 않는다(claim 실패 시
   `applyRetryLastTurn` 은 여전히 조용히 discard, `retry-turn.service.ts:333-339` 참조).
4. **에러 응답** — `retryLastTurn` 이 던지는 에러 코드 4종
   (`INVALID_EXECUTION_STATE`/`NODE_NOT_RETRYABLE`/`RETRY_STATE_NOT_FOUND`/`RETRY_TOO_EARLY`,
   spec §4.2 표) 은 이번 diff 범위 밖 — 신규 claim 은 `applyRetryLastTurn`(worker 재진입, 클라이언트에
   직접 에러를 반환하지 않는 경로)에만 추가됐고, 실패 시 예외를 던지지 않고 로그 후 return 하는
   기존 "ack-and-discard" 패턴을 그대로 따른다(`retry-turn.service.ts:333-339`). 오히려 이전엔
   read-then-branch 경합으로 두 delivery 가 모두 통과해 `NODE_STARTED`/종결 이벤트가 중복
   emit 될 수 있었던 결함을, 원자 UPDATE 로 단일 delivery 만 진행하도록 닫는 수정이라 이벤트
   계약 일관성 관점에서는 오히려 개선이다.
5. **요청 검증** — `retryLastTurn` 의 입력 검증 순서(§4.2 표: lookup → FAILED 상태 →
   retryable → `_retryState`/TTL → `retryAfterSec`)는 이번 diff 에서 미변경. 신규 claim 은
   서비스 간 내부 파라미터(`spawnedNodeExecutionId`, 이미 DB PK)에 대한 조건부 UPDATE 일 뿐,
   외부 요청 바디/매개변수 검증과 무관.
6. **URL/경로 설계** — 해당 없음. REST 컨트롤러·라우트 파일이 diff 에 없음(WS 게이트웨이/HTTP
   컨트롤러 파일 자체가 이번 리뷰 대상 3파일에 포함되지 않음).
7. **페이지네이션** — 해당 없음. 목록 API 코드 없음.
8. **인증/인가** — 해당 없음. 이번 3 파일 중 어디에도 인가 체크 대상 endpoint 가 없음
   (WS 게이트웨이 레벨 인가는 별도 파일 소관이며 이번 diff 대상 아님).

## 종합

이번 라운드의 실질 변경은 `applyRetryLastTurn` 재진입 처리에서 read-then-branch 가드를
`status='running' AND jsonb_exists(...)` 조건부 UPDATE 원자 claim 으로 교체한 동시성 결함
수정과, 그에 딸린 주석 정정·테스트 보강이다. 공개 REST/WS 요청·응답 스키마, 에러 코드,
URL 설계, 페이지네이션, 인증/인가 어느 것도 변경하지 않으며, 기존 WS 프로토콜 계약
(spec §4.2)과의 정합도 그대로 유지된다. API 계약 관점에서는 리뷰 대상 코드가 없다.

## 발견사항

없음.

## 요약

리뷰 대상 diff (`retry-turn.service.ts` 의 원자 claim 추가, `continuation-execution.processor.ts` 주석
정정, 관련 스펙 테스트)는 BullMQ continuation 워커 내부 동시성 제어에 국한된 수정으로, 기존
`retryLastTurn`/`applyRetryLastTurn` 의 시그니처·반환 스키마·에러 코드·WS 이벤트 payload 를
전혀 변경하지 않는다. REST/WS 엔드포인트 설계, 버전 관리, 페이지네이션, 인증/인가 등 API 계약
축과 접점이 없어 해당 없음으로 판정한다.

## 위험도

NONE
