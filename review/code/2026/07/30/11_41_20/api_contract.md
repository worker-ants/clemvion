# API Contract Review — retry_last_turn 2차 claim 삽입 위치 결함 수정 (414550a1d)

## 스코프 확인

프롬프트는 2 파일(`retry-turn.service.ts` 전체 컨텍스트, `retry-turn.service.spec.ts` 일부)을
제공했으나, `git show`/`git log`로 실제 diff 범위를 대조했다. 현재 HEAD(`414550a1d`, 커밋
메시지 "retry_last_turn 2차 claim의 삽입 위치 결함 2건 — 살아있는 delivery 오판·jsonb 부활
차단")가 origin/main(`71ce6c12b`) 대비 얹은 두 커밋(`b351731f0`, `414550a1d`) 중, 이번
리뷰 라운드의 실질 diff는 이전에 이미 리뷰된 `b351731f0`(원자 claim 최초 도입, `review/code/
2026/07/28/20_32_57/api_contract.md` 에서 이미 NONE 판정)이 아니라 그 위에 얹힌
`414550a1d` 한 건이다. 이 커밋이 건드린 코드 파일은 `retry-turn.service.ts`
(+ `retry-turn.service.spec.ts`) 단 하나이며, 변경 내용은:

1. `RETRY_STATE_KEY = '_retryState'` 상수 추출 (L42) — raw SQL 문자열과 TS 프로퍼티 접근에
   흩어졌던 리터럴 통합.
2. `applyRetryLastTurn`(L281-511) 내부 순서 재배치: 원자 claim(`claimSpawnedRetryRow`)을
   기존 "`_retryState` 부재 → 무조건 FAILED" 판정보다 **앞**으로 이동하고, 그 판정 분기 자체를
   삭제 — claim 실패는 원인 구분 없이 항상 ack-and-discard(L337-348 은 이제 "이론상 도달
   불가능"한 방어 로그일 뿐, FAILED 마킹을 하지 않음).
3. claim 블록을 `claimSpawnedRetryRow` private 메서드로 추출(L520-534, JSDoc L470-519).
4. claim 성공 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]`(L356) 추가 — in-memory
   엔티티를 DB 와 동기화해 후속 `save(spawnedRow)` 가 stale jsonb 값을 부활시키지 않게 함.

`continuation-execution.processor.ts`, `websocket.gateway.ts` 등 외부 진입점 파일은 이번
커밋에서 **변경되지 않았다** — `git show 414550a1d --stat` 로 확인.

## 점검 관점별 확인

1. **하위 호환성** — `retryLastTurn(executionId, nodeExecutionId): Promise<{ spawnedNodeExecutionId: string }>`
   (L127-130) 과 `applyRetryLastTurn(executionId, spawnedNodeExecutionId): Promise<void>`
   (L281-284) 의 시그니처·반환 타입 모두 이번 커밋에서 불변. `websocket.gateway.ts:787`
   (`@SubscribeMessage('execution.retry_last_turn')`, 이번 diff 밖)이 유일한 동기 진입점이고
   `retryLastTurn` 만 직접 호출하는데, 그 메서드 내부는 `outputData._retryState` →
   `outputData[RETRY_STATE_KEY]` 리터럴 상수화(의미 동일, L160/L202/L210/L217)만 있어 breaking
   change 없음.
2. **버전 관리** — 해당 없음. 공개 API 버전 개념이 적용되는 대상이 아닌 internal worker 로직.
3. **응답 형식** — `retryLastTurn` 반환 스키마 불변. `applyRetryLastTurn` 은 여전히 `void` 이고
   BullMQ worker 컨텍스트(continuation-execution.processor.ts, 이번 diff 밖)에서만 실행돼
   클라이언트에 동기 응답을 만들지 않는다 — 결과는 `NODE_STARTED`/`EXECUTION_COMPLETED`/
   `EXECUTION_FAILED`/`EXECUTION_CANCELLED` WS push 로 전달되는데, 이번 커밋은 이 이벤트들의
   payload 구조·emit 조건을 바꾸지 않는다.
4. **에러 응답** — `retryLastTurn` 이 던지는 4종 에러 코드(`INVALID_EXECUTION_STATE`/
   `NODE_NOT_RETRYABLE`/`RETRY_STATE_NOT_FOUND`/`RETRY_TOO_EARLY`, spec §4.2 표)는 이번 diff
   범위 밖(그 메서드 자체는 검증 순서·에러 타입 불변). 이번 커밋이 바꾼 것은
   `applyRetryLastTurn`(클라이언트에 직접 에러를 반환하지 않는 비동기 경로) 내부의 "손상 판정"
   위치뿐이다 — 오히려 **기존 결함을 닫는 방향**이다: 이전 코드는 claim 보다 먼저 실행되던
   "`_retryState` 부재 → FAILED" 판정이 (다른 delivery 가 이미 claim 해 정상적으로 사라진)
   살아있는 row 를 FAILED 로 오판·영속화할 수 있었다(WS 이벤트 emit 은 없었지만 DB 상태 자체가
   REST 조회 시 관측 가능한 형태로 오염됨). 이번 수정은 그 오판 분기를 삭제해 claim 실패를
   항상 "원인 불문 discard"로 통일한다 — 에러 응답 표면 자체는 안 바뀌지만 상태 일관성은
   개선.
   - INFO 성격 참고(신규 결함 아님, 이미 코드/plan 에 추적됨): claim 성공 후 in-memory
     `retryState` 가 없는 이론상 도달 불가능한 경로(L337-348)와, claim 이 애초에 실패하는
     "진짜 corruption" 케이스는 이제 **FAILED 로도 마킹되지 않고 어떤 이벤트도 emit 하지
     않는다** — `claimSpawnedRetryRow` JSDoc(L502-513)이 스스로 명시하듯
     `recoverStuckExecutions` 백스톱이 이 케이스(Execution 이 이미 terminal)에 닿지 않아 spawn
     row 가 RUNNING 상태로 영구 잔류할 수 있다. REST 로 해당 NodeExecution 을 조회하는 클라이언트
     입장에서는 "완료도 실패도 아닌 채로 멈춘" 것처럼 보일 수 있다는 뜻인데, 이는 저자가 이미
     "살아있는 작업을 죽이는 것보다 이론적 orphan 이 낫다"는 의도된 트레이드오프로 문서화하고
     `plan/in-progress/retry-turn-terminal-guard.md` 에 후속으로 등재했다 — 재발견이 아니라
     참고로만 기록한다.
5. **요청 검증** — `retryLastTurn` 의 입력 검증 순서(lookup → FAILED 상태 → retryable →
   `_retryState`/TTL → `retryAfterSec`, §4.2 표)는 이번 diff 에서 미변경. 신규/변경된 claim 로직은
   외부 요청 바디가 아니라 이미 DB PK 인 `spawnedNodeExecutionId` 에 대한 조건부 UPDATE 일 뿐이라
   요청 검증 축과 무관.
6. **URL/경로 설계** — 해당 없음. REST 컨트롤러·라우트 파일이 이번 diff 에 없고, WS 커맨드명
   (`execution.retry_last_turn`)도 불변.
7. **페이지네이션** — 해당 없음. 목록 API 코드 없음.
8. **인증/인가** — 해당 없음. 인증/소유권 검증은 `websocket.gateway.ts` (이번 diff 밖)가
   전담하며, 이번에 변경된 `applyRetryLastTurn`/`claimSpawnedRetryRow` 는 이미 인가된 요청이
   spawn 한 row 에 대해서만 동작하는 후속 비동기 worker 단계라 인가 체크 대상이 아니다.

## 발견사항

없음 — 이번 라운드 diff(`414550a1d`)는 BullMQ continuation worker 내부 2차 claim의 삽입
위치·범위 결함(리뷰 CRITICAL #1/#2) 수정에 국한되며, REST/WS 요청·응답 스키마, 에러 코드,
URL 설계, 페이지네이션, 인증/인가 어느 축도 변경하지 않는다.

## 요약

이번 커밋(`414550a1d`)은 직전 라운드에서 API 계약상 이미 NONE 판정을 받은 원자 claim
메커니즘(`b351731f0`)의 **삽입 위치 결함 2건**을 고친 순수 내부 동시성/데이터 정합성 수정이다
— claim 을 손상 판정보다 앞으로 옮기고(살아있는 row 오판 FAILED 제거), claim 성공 후
in-memory 엔티티를 DB 와 동기화(stale jsonb 부활 방지)한다. `retryLastTurn`/
`applyRetryLastTurn` 의 시그니처·반환 스키마·에러 코드·WS 이벤트 payload 는 전혀 바뀌지
않고, 외부 진입점(`websocket.gateway.ts`, `continuation-execution.processor.ts`)도 이번
커밋에서 손대지 않았다. 오히려 동시 배달 경합 시 살아있는 실행을 FAILED 로 잘못 마킹하던
기존 결함을 제거해 상태 일관성 관점에서는 개선이다. API 계약 관점에서는 리뷰 대상 코드가
없다고 판단한다(해당 없음).

## 위험도

NONE
