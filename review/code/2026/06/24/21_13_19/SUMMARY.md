# Code Review 통합 보고서

리뷰 대상: `refactor(execution-engine): C-1+M-7 — continuation publish 실패 fail-fast 통일 (06-concurrency)`
커밋: `fabdd47cd9b41c89ed7b7478a7f83fc5824e24ae`
생성일: 2026-06-24

---

## 전체 위험도

**LOW** — Critical 발견사항 없음. Warning 2건(에러코드 상수 미참조, spec 미기술 API 경로)은 모두 즉각 수정 또는 spec-sync PR 추적으로 해소 가능. 신규 보안 취약점·breaking change·기능 회귀 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `ServiceUnavailableException` throw 시 `ErrorCode` 상수 미참조 — `code` 필드에 문자열 리터럴 `'EXECUTION_ENQUEUE_FAILED'` 직접 사용. `error-codes.ts`에 `ErrorCode.EXECUTION_ENQUEUE_FAILED` 상수가 이미 등재되어 있음에도 불구하고 타입 안전성을 약화시키며, 향후 에러코드 값 리팩터링 시 이 위치가 누락될 위험. | `codebase/backend/src/modules/executions/executions.service.ts` — `stop()` WAITING 분기 throw 블록 | `code: ErrorCode.EXECUTION_ENQUEUE_FAILED` 로 수정하고 `ErrorCode` import 추가 |
| 2 | API 계약 | `POST /executions/:id/stop` WAITING 분기 신규 503 응답이 spec 미기술 상태에서 구현 선행. 기존 503 사용처는 shutdown 게이트(`§11.1 SERVER_SHUTTING_DOWN`)뿐이었으나 Redis 장애 경로가 추가됨. 클라이언트 입장에서 사전 공지 없이 계약 변경. commit 메시지에 "sibling spec-sync merge-gate" 로 인지됨. | `spec/5-system/4-execution-engine.md §7.4·§7.5`, `spec/5-system/3-execution.md §9` (기술 없음) | spec-sync PR에서 "WAITING 분기 publish 실패 시 503 `EXECUTION_ENQUEUE_FAILED` 반환"을 1줄 추가. merge-gate 체크리스트가 실제 추적되는지 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] REST `stop()` WAITING 분기 503 동작이 `spec/5-system/2-api-convention.md §6` 상태 코드 표에 미등재 (200/201/204/400/401/403/404/409/422/429/500만 열거, 503 없음). 코드 선택은 의미론적으로 합리적이나 spec 본문이 뒷받침하지 않음. | `spec/5-system/2-api-convention.md §6` | 코드 유지 + spec-sync PR에서 §6에 503(Service Unavailable — upstream 의존성 장애) 추가 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `EXECUTION_ENQUEUE_FAILED` 에러코드가 `spec/5-system/3-error-handling.md §1` 카탈로그에 미등재. `ErrorCode` enum 등재는 완료됨. | `spec/5-system/3-error-handling.md §1` | spec-sync PR에서 카탈로그에 `EXECUTION_ENQUEUE_FAILED` 등재 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `cancelWaitingExecution` async 전환이 `spec/5-system/4-execution-engine.md §7.5.2` "4종 continuation 핸들러" 목록에 미반영. §7.4 메시지 타입 목록에는 `cancel` 포함되어 상위 컨텍스트는 정합하나 §7.5.2 핸들러 열거가 낡음. | `spec/5-system/4-execution-engine.md §7.5.2` | spec-sync에서 §7.5.2 핸들러 목록에 `cancelWaitingExecution` 추가 또는 "4종 → 5종" 일반화 |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] M-7 INCR throw → publish null → `queued:false` 인과(fail-fast 계약)가 spec §7.4/§9.2에 미기술. §9.2 키 표는 sliding-window TTL 기술하나 INCR 실패 전파 경로 명시 없음. | `spec/5-system/4-execution-engine.md §7.4`, `spec/5-system/4-execution-engine.md §9.2` | spec-sync에서 §7.4 또는 §9.2에 "INCR 실패 → throw 전파 → publish outer catch → null(queued:false)" 1줄 기술 |
| 5 | 부작용 | `websocket.gateway.ts` 실제 구현 파일에서 `cancelWaitingExecution` 호출에 `await` 및 `queued:false` 처리 누락 여부 미확인. diff에는 `websocket.gateway.spec.ts`(테스트)만 포함됨. 구현 파일에 fire-and-forget 상태가 유지될 경우 WS 경로에서 에러 표면 무력화 위험. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` | `websocket.gateway.ts`에서 `cancelWaitingExecution` 호출 여부 확인 후 `await` + `queued:false` 결과 처리 추가 여부 검증 |
| 6 | 부작용 | INCR 실패 로그 레벨이 `warn` → `error` 로 상향됨(M-7 리팩터 후 `nextSeq` 내부 catch 제거 → `publish` outer catch의 `logger.error` 호출). 운영 알람/로그 필터가 `warn` 기준이면 기존에 조용히 넘어가던 Redis INCR 실패가 이제 `error` 알람 발생. | `continuation-bus.service.ts` — `publish` outer catch | 운영 알람 임계값 점검 또는 PR 설명에 로그 레벨 상향이 의도된 변경임을 명시 |
| 7 | 테스트 | INCR 실패 시 `queueAdd` 미호출 여부가 명시적으로 검증되지 않음 — "INCR 실패 → enqueue 생략" 경로가 묵시적으로만 보장됨. | `continuation-bus.service.spec.ts` 라인 238-257 | `expect(queueAdd).toHaveBeenCalledTimes(1)` (초기화 1회만) 추가로 명시 검증 |
| 8 | 테스트 | `cancelWaitingExecution` — `bus.publish` null 반환 시 `{ queued: false, jobId: null }` 반환 단위 케이스 누락. 성공 케이스만 검증됨. | `execution-engine.service.spec.ts` 라인 761-768 | `mockBus.publish.mockResolvedValueOnce(null)` 주입 후 `result.queued === false` 검증 테스트 추가 |
| 9 | 테스트 | `stop()` WAITING 분기 cancel 후 `findOne` null 폴백 경로(`return updated ?? execution`) 미테스트 — race condition 시 발생 가능한 경로. | `executions.service.spec.ts` 라인 920-937 | `executionRepo.findOne.mockResolvedValueOnce(null)` 케이스 추가 |
| 10 | 테스트 | `acquireLock` Redis 장애 시 `false` 반환(fail-closed) 단위 테스트 누락. `releaseLock` 장애 케이스는 검증되나 `acquireLock` 장애 미검증. | `continuation-bus.service.spec.ts` 분산 lock 섹션 | `fakeRedisInstances[0].set.mockRejectedValueOnce(new Error('Redis down'))` 주입 후 `acquireLock` 결과 `false` 검증 추가 |
| 11 | 동시성 | INCR+EXPIRE 비원자성 — INCR 성공 후 EXPIRE 실패 시 seq 키 TTL 없이 영구 잔류 가능. 의도적 swallow 처리이며 §9.2 설계와 일치하나, EXPIRE 연속 실패 장애 시나리오에서 키 영구 잔류 위험. | `continuation-bus.service.ts` 라인 635-646 | 즉각 수정 불필요. `SET key value EX ttl` 또는 Lua script로 INCR+EXPIRE 원자화 고려 가능 (선택사항) |
| 12 | 동시성 | Redis Cluster/Sentinel 페일오버 시 INCR 카운터 초기화 → 동일 executionId 중복 seq → BullMQ false dedup 위험. 현재 단일 인스턴스 가정 아키텍처에서는 허용 범위 내. | `continuation-bus.service.ts` `nextSeq()` | spec §9.2 seq 단조성 계약에 클러스터 페일오버 예외 문서화 수준으로 충분 |
| 13 | 보안 | 503 응답 메시지 "continuation bus unavailable" — 내부 인프라(Redis 의존성) 힌트 포함. 현재 수준은 클라이언트 재시도 유도 목적상 허용 범위 내. | `executions.service.ts` `stop()` WAITING 분기 503 메시지 | "Service temporarily unavailable. Please retry." 수준으로 일반화 고려 (선택 사항) |
| 14 | 유지보수성 | `nextSeq` JSDoc이 8줄 추가되어 구현보다 주석 분량이 많음 — 향후 구현 변경 시 주석 동기화 부담. | `continuation-bus.service.ts` `nextSeq` JSDoc | 핵심 1줄 수준으로 간결화. 상세 rationale는 spec으로 위임 |
| 15 | 유지보수성 | `stop()` WAITING 분기 인라인 주석 블록이 실제 로직(4행)보다 약 3배 긴 12행 주석. 코드와 주석 간 드리프트 위험. | `executions.service.ts` `stop()` WAITING 분기 | 핵심 1줄만 인라인에 남기고 상세 rationale는 메서드 JSDoc 또는 PR description으로 이동 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 개선 방향 확인. `Math.random()` fallback 제거, Lua 파라미터 바인딩 올바름, `sanitizeForLog` 일관 적용. 신규 취약점 없음 |
| requirement | LOW | 4개 [SPEC-DRIFT] — 코드 구현 완전, spec 본문이 아직 미반영. commit 메시지에 "sibling spec-sync merge-gate"로 인지됨 |
| scope | NONE | 변경 범위가 C-1+M-7 두 항목에 정확히 한정됨. 범위 외 수정 없음 |
| side_effect | LOW | `websocket.gateway.ts` 실제 구현 파일 `cancelWaitingExecution` await 처리 확인 필요. INCR 실패 로그 레벨 warn→error 상향 운영 영향 인지 필요 |
| maintainability | LOW | WARNING 1건: `ErrorCode` 상수 대신 문자열 리터럴 직접 사용. 주석 과다 INFO 2건 |
| testing | LOW | 핵심 경로 테스트 정확하나 경계값·보조 경로 INFO 5건(INCR 실패 enqueue 검증, queued=false 단위, findOne null 폴백, acquireLock 장애, releaseLock Lua 분기) |
| documentation | LOW | WARNING 1건: spec 문서 미갱신 — commit 메시지에 defer 선언됨. 코드 내 JSDoc 품질은 전반적으로 양호 |
| concurrency | LOW | INCR+EXPIRE 비원자성, 클러스터 페일오버 seq 초기화 시나리오 — 현재 아키텍처 전제 내 문서화된 tradeoff. 분산 lock Lua 원자성 올바름 |
| api_contract | LOW | WARNING 1건: `POST /executions/:id/stop` 신규 503 경로 spec 미기술. commit 메시지 merge-gate 인지됨. 기존 성공 경로 하위 호환 유지 |

---

## 발견 없는 에이전트

- **scope** — 변경 범위가 커밋 메시지 명세에 정확히 한정됨. 불필요한 수정, 포맷팅 변경, 범위 외 리팩터링 없음.
- **security** — 신규 취약점·보안 회귀 없음. M-7 random fallback 제거로 보안 개선.

---

## 권장 조치사항

1. **(즉각)** `executions.service.ts` `stop()` WAITING 분기: `code: 'EXECUTION_ENQUEUE_FAILED'` → `code: ErrorCode.EXECUTION_ENQUEUE_FAILED` 로 수정 + `ErrorCode` import 추가 (W-1)
2. **(즉각 확인)** `websocket.gateway.ts`에서 `cancelWaitingExecution` 호출 여부 확인 — 존재 시 `await` + `queued:false` 결과 처리 추가 (I-5)
3. **(spec-sync PR, merge-gate)** `spec/5-system/2-api-convention.md §6`에 503 상태 코드 추가 (I-1/W-2)
4. **(spec-sync PR, merge-gate)** `spec/5-system/4-execution-engine.md §7.4·§7.5·§7.5.2`에 cancel 핸들러 추가 및 WAITING 분기 503 + INCR fail-fast 계약 기술 (I-2, I-3, I-4)
5. **(spec-sync PR, merge-gate)** `spec/5-system/3-error-handling.md §1`에 `EXECUTION_ENQUEUE_FAILED` 카탈로그 등재 (I-2)
6. **(운영 인지)** INCR 실패 로그 레벨 warn→error 상향 인지. 운영 알람 임계값 점검 (I-6)
7. **(테스트 보강, non-blocking)** INCR 실패 시 queueAdd 미호출 명시 검증, cancelWaitingExecution queued=false 단위 케이스, findOne null 폴백, acquireLock Redis 장애 케이스 추가 (I-7~I-10)

---

## 라우터 결정

- **routing_status**: done (라우터 선별 실행)
- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract` (9명)
- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 5명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 판단: 이번 변경(fail-fast 통일, async 전환)은 성능 관점 검토 우선순위 낮음 |
| architecture | 라우터 판단: 기존 continuation bus 아키텍처 유지, 신규 아키텍처 결정 없음 |
| dependency | 라우터 판단: 신규 외부 의존성 추가 없음 |
| database | 라우터 판단: DB 스키마 변경 없음 |
| user_guide_sync | 라우터 판단: 내부 리팩터, 사용자 가이드 변경 불필요 |