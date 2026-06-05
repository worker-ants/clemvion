# Code Review 통합 보고서

**대상**: exec-park-durable-resume PR-B1 (form/button park-release + slow-path 일원화)
**리뷰 일시**: 2026-06-05
**참여 reviewer**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract

---

## 전체 위험도

**MEDIUM** — 핵심 기능 구현은 spec §4.x Phase B 모델에 부합하나, `cancelParkedExecution`의 `NodeExecution` terminal 마킹 누락(DB 정합성 갭 + 동시성 경합 가능성), spec 문서 2곳 미갱신(SPEC-DRIFT), `cancelParkedExecution` 전용 단위 테스트 미비, `applyCancellation` async 전환 후 테스트 실질 검증력 손실이 복합적으로 존재한다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | `cancelParkedExecution`에서 `NodeExecution` terminal 마킹 누락 — `Execution`만 CANCELLED 마킹, `NodeExecution`은 `waiting_for_input`으로 DB 잔류. `resolveWaitingNodeExecutionId` 조건 매칭 위험 + UI 영구 WAITING 표시 문제 | `execution-engine.service.ts` `cancelParkedExecution` | `cancelParkedExecution`에서 동반 WAITING `NodeExecution` 행을 CANCELLED로 마킹하거나, spec §1.1에 취소 경로 NodeExecution 단말 처리 정책 명문화 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `applyCancellation` async 전환이 spec §7.4 Worker 동작 표에 미반영. 코드 동작은 옳고 의도적임 | `continuation-execution.processor.ts` + `execution-engine.service.ts` `applyCancellation` | 코드 유지 + `spec/5-system/4-execution-engine.md §7.4` Worker 동작 표에 `cancelParkedExecution await` 행위 명시 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `runNodeDispatchLoop` 반환형 `Promise<void>` → `Promise<{ parked: boolean }>` 변경이 spec에 미반영 | `execution-engine.service.ts` L1764–1767 | 코드 유지 + `spec/5-system/4-execution-engine.md §4.x` 또는 §Rationale에 반환 계약 명시 |
| 4 | DOCUMENTATION | `spec/data-flow/3-execution.md` 시퀀스 다이어그램의 `alt 로컬 pendingContinuations hit (fast-path)` 분기가 Phase B 이후에도 삭제되지 않음 — 구현과 spec 가시적 불일치 | `spec/data-flow/3-execution.md` L111 | Phase B PR(현재 또는 PR-B2) 범위에 fast-path `alt` 분기 제거 및 slow-path 단일 경로 기술 포함 |
| 5 | DOCUMENTATION | `spec/4-nodes/6-presentation/0-common.md` L413의 `pendingContinuations` 기반 invariant 서술이 Phase B 모델(slow-path 일원화)과 충돌 | `spec/4-nodes/6-presentation/0-common.md` L413 | Phase B PR 또는 별도 spec 갱신 PR에서 rehydration 모델 기준으로 재작성 |
| 6 | CONCURRENCY | `cancelParkedExecution`이 `Execution`만 CANCELLED 마킹하고 `NodeExecution`은 그대로 두므로, concurrency > 1 환경에서 resume worker가 `isNodeExecutionWaiting`(NodeExecution 기준) 체크를 통과해 CANCELLED execution을 재개 시도할 수 있는 TOCTOU 경합 가능성 | `execution-engine.service.ts` `applyCancellation` / `rehydrateAndResume` | `rehydrateAndResume` 진입 초기 `Execution.status === WAITING_FOR_INPUT` DB 재검증 추가 또는 `cancelParkedExecution`에서 `NodeExecution`도 CANCELLED 마킹 |
| 7 | SIDE_EFFECT | `applyCancellation`의 `void → async` 시그니처 전환 후 코드베이스 내 fire-and-forget 호출 사이트 잔존 여부 미확인 — unhandled rejection 위험 | `execution-engine.service.ts` `applyCancellation` 전체 호출자 | grep으로 전체 코드베이스 `applyCancellation` 호출 사이트 전수 확인, `await` 누락 사이트 수정 |
| 8 | SIDE_EFFECT | `runNodeDispatchLoop` 반환 타입 변경 후 기존 `mockResolvedValue(undefined)` mock 사이트가 남아 있으면 `dispatchResult.parked` 역참조 런타임 오류 | `execution-engine.service.spec.ts` 내 `runNodeDispatchLoop` mock 사이트 전체 | `grep -n "runNodeDispatchLoop.*mockResolvedValue(undefined)"` 로 누락된 mock 교체 확인 |
| 9 | SIDE_EFFECT | `cancelParkedExecution`에서 `finalizeRehydrationCleanup` 호출 시 멀티턴 AI in-memory 코루틴(PR-B2 전까지 잔존)의 `contextService` 살아있는 컨텍스트를 삭제할 수 있는 경합 시나리오 | `execution-engine.service.ts` `cancelParkedExecution` L1077 | PR-B1 범위에서는 form/button 전용이므로 실질 위험 낮음. 주석으로 위험 명시, PR-B2 완료 후 정리 |
| 10 | TESTING | `cancelParkedExecution` 전용 단위 테스트 부재 — `affected:1` emit 발생, `affected:0` 멱등, emit throw warn 3개 분기 미검증 | `execution-engine.service.spec.ts` `applyCancellation` describe 블록 | `describe('cancelParkedExecution — durable WAITING cancel')` 블록 추가, 3개 케이스 커버 |
| 11 | TESTING | `applyCancellation` 기존 단위 테스트가 async 전환 후 실질 검증력 손실 — Promise를 `await` 하지 않아 DB 분기 경로 미검증 | `execution-engine.service.spec.ts` L1233 | 테스트를 `async` 전환, `await service.applyCancellation(...)` + `createQueryBuilder` mock 준비 + 멱등 단언 보완 |
| 12 | TESTING | `applyCancellation`의 "in-memory 코루틴 있을 때 cancelParkedExecution 미호출" 분기 미검증 | `execution-engine.service.spec.ts` `applyCancellation` describe | `pendingContinuations` 항목 삽입 후 `applyCancellation` 호출 → `createQueryBuilder` 미호출 단언 추가 |
| 13 | TESTING | `flushResumeDrive(ms=40)` 실제 타이머 의존 — CI 고부하 환경에서 40ms 부족 시 sporadic false negative 위험 | `execution-engine.service.spec.ts` L82, L3143 외 다수 | scheduler 추상화 또는 `driveResumeDetached` completion hook 추가 검토; 단기적으로 대기 시간 확대(예: 200ms) |
| 14 | ARCHITECTURE | `ExecutionEngineService` God Object 경향 심화 — 8800+ 라인 클래스에 `cancelParkedExecution`, `PARK_RELEASED`, `ParkMode` 등 추가 누적 | `execution-engine.service.ts` 전체 | PR-B3 정리 phase에서 `cancelParkedExecution` 로직을 `ExecutionCancellationService` 또는 `DurableExecutionFinalizer`로 추출 |
| 15 | ARCHITECTURE | `waitForFormSubmission`/`waitForButtonInteraction`의 `ParkMode` 이원 시그니처 — 반환 타입 `Promise<void \| ParkSignal>` + `parkMode` 파라미터로 두 직교 행동 혼재, OCP 약화 | `execution-engine.service.ts` `waitForFormSubmission` L3581, `waitForButtonInteraction` L6173 | PR-B2에서 Strategy 패턴(ParkStrategy 인터페이스)으로 추출 또는 함수 분리 계획 명시; 당장은 JSDoc에 "B2 분리 예정" 주석 추가 |
| 16 | ARCHITECTURE | `cancelParkedExecution`의 emit 실패를 `warn` 로그로만 흡수 — DB 반영됐으나 클라이언트 알림 누락 시 운영 가시성 부족 | `execution-engine.service.ts` `cancelParkedExecution` emit catch 블록 | emit 실패를 `error` 레벨로 상향하거나 BullMQ dead-letter 패턴으로 재시도 큐에 기록 |
| 17 | MAINTAINABILITY | `cancelParkedExecution` 내부 이중 try-catch 중첩 — DB 실패 정책과 emit 실패 정책이 구조적으로 혼재 | `execution-engine.service.ts` L1060–L1101 | emit 전용 로직을 `emitCancellationEvent()` private 헬퍼로 분리하여 중첩 제거 |
| 18 | MAINTAINABILITY | `armSlowPathResume` 헬퍼 복잡한 타입 캐스팅 체인 + 50회 × 20ms 폴링 루프 매직 넘버 | `execution-engine.service.spec.ts` `armSlowPathResume`, 폴링 루프 | 로컬 변수 추출로 타입 캐스팅 최소화; 상수 추출 또는 `// 최대 50 * 20ms = 1000ms` 주석 추가 |
| 19 | PERFORMANCE | `rehydrateAndResume` 내 `firePayload` 250회 × 20ms setTimeout self-reschedule 폴링 — 동시 resume 증가 시 이벤트 루프 지연 누적 | `execution-engine.service.ts` L1801–1825 | Phase B2/B3에서 `pendingContinuations` 제거 시 함께 삭제 예정(임시 메커니즘) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `cancelParkedExecution` 에러 로그에 `executionId` 포함, 스택 트레이스 미노출 — 수용 가능한 수준 | `execution-engine.service.ts` logger | 현행 패턴 유지. 로그 집계 시스템에서 외부 API 응답 미포함 관리 |
| 2 | REQUIREMENT | `armSlowPathResume`에서 `waitingSave` undefined 시 silent fallback → `outputData: {}` 처리, 테스트 격리 약화 | `execution-engine.service.spec.ts` L587–595 | `expect(waitingSave).toBeDefined()` 단언 추가 |
| 3 | TESTING | `armSlowPathResume` 내 `mockNodeExecutionRepo.findOneBy` 전역 교체 — 이후 테스트 영향 가능성 | `execution-engine.service.spec.ts` L301 | `mockResolvedValueOnce` 사용 또는 `afterEach` mock 복원 |
| 4 | TESTING | e2e 테스트에 button park-release 시나리오 누락 (form 전용) | `execution-park-resume.e2e-spec.ts` | button park → resume → completed e2e 케이스 추가 또는 TODO 주석 |
| 5 | TESTING | `applyCancellation` 테스트 명칭 "silent skip"이 새 동작(DB write fallback)과 불일치 | `execution-engine.service.spec.ts` L1233 | 테스트 명칭을 동작 기준으로 갱신 |
| 6 | TESTING | e2e에 `cancelParkedExecution` 경로(park → cancel → CANCELLED) 시나리오 없음 | `execution-park-resume.e2e-spec.ts` | NodeExecution 단말 처리 정책 확정 후 e2e 케이스 추가 |
| 7 | DOCUMENTATION | `waitForFormSubmission`/`waitForButtonInteraction` JSDoc `@param parkMode`/`@returns` 갱신 미확인 | `execution-engine.service.ts` L3581, L6173 | `@param parkMode`, `@returns void \| ParkSignal` JSDoc 추가 |
| 8 | DOCUMENTATION | `cancelParkedExecution` JSDoc에 예외 전파 없음(best-effort cancel) 미기술 | `execution-engine.service.ts` `cancelParkedExecution` JSDoc | `@remarks DB 오류는 내부 흡수 — 호출자에 예외 전파 없음` 추가 |
| 9 | DOCUMENTATION | `runNodeDispatchLoop` JSDoc `@returns` 갱신 미확인 (`Promise<void>` → `Promise<{ parked: boolean }>`) | `execution-engine.service.ts` L1771 | `@returns` 를 `{ parked: boolean }` 의미 기술로 갱신 |
| 10 | DOCUMENTATION | `continuation-execution.processor.ts` 클래스 JSDoc 처리 흐름 목록에 cancel 새 동작 미언급 | `continuation-execution.processor.ts` L107–137 | 클래스 JSDoc에 cancel Phase B 동작(코루틴 유무 분기) 한 줄 추가 |
| 11 | DOCUMENTATION | plan 문서 "Phase B 선행 완료" 표기가 spec 두 파일(W1·W2) 미갱신과 불일치 | `plan/in-progress/exec-park-durable-resume.md` | 완료 표기에 "data-flow W1·0-common W2 는 Phase B PR에서 동기 갱신 예정" 단서 추가 |
| 12 | ARCHITECTURE | `forwardRef` 순환 의존 잔존 — `ContinuationExecutionProcessor` ↔ `ExecutionEngineService` | `continuation-execution.processor.ts` L147-150 | PR-B2 구조 정리 시 `IExecutionEngineProcessorFacade` 인터페이스로 DIP 적용, `forwardRef` 제거 |
| 13 | ARCHITECTURE | `runNodeDispatchLoop` 반환 타입 `{ parked: boolean }` — 향후 확장 시 `interface NodeDispatchResult` 추출 고려 | `execution-engine.service.ts` | 현 상태 유지, 향후 확장 시 인터페이스 추출 |
| 14 | DATABASE | `cancelParkedExecution` UPDATE에 `execution.status` 인덱스 유무 미확인 (PK 조회라 실질 성능 무관) | `execution-engine.service.ts` `cancelParkedExecution` | 마이그레이션에서 `execution.status` 인덱스 존재 확인 |
| 15 | PERFORMANCE | `cancelParkedExecution` `createQueryBuilder` per-call 객체 생성 — 단건 UPDATE라 GC 영향 미미 | `execution-engine.service.ts` L1063–1097 | 현행 유지 (멱등 확인 구조상 shorthand 전환 시 `affected` 처리 방식 조정 필요) |
| 16 | SCOPE | consistency-check 산출물이 PR-B1 코드 변경과 동일 커밋에 포함 — 프로젝트 규약 내 허용 범위 | `review/consistency/2026/06/05/13_59_30/` | 허용 범위. 이력 가독성 위해 별도 커밋 분리 고려 |
| 17 | CONCURRENCY | `PARK_RELEASED` Symbol 모듈 스코프 선언 — 단일 프로세스에서 안전, 마이크로서비스 분리 시 주의 | `execution-engine.service.ts` L270 | 현행 유지. 향후 서비스 분리 시 tagged union 방식 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션·스택 노출 없음, 수용 가능 수준 |
| performance | LOW | `firePayload` 250×20ms polling (B3 예정 제거), 메모리 누수 해소 확인 |
| architecture | MEDIUM | God Object 심화, ParkMode 이원 시그니처, emit 실패 warn 흡수 |
| requirement | MEDIUM | `cancelParkedExecution` NodeExecution terminal 누락, SPEC-DRIFT 2건 |
| scope | NONE | 변경 범위 plan 목표에 정확히 부합 |
| side_effect | MEDIUM | `applyCancellation` async 전환 후 호출 사이트 미확인, `runNodeDispatchLoop` mock 누락 위험 |
| maintainability | LOW | `armSlowPathResume` 복잡도, 폴링 매직 넘버, 이중 try-catch |
| testing | MEDIUM | `cancelParkedExecution` 분기 미검증, `applyCancellation` 테스트 실질 검증력 손실, flushResumeDrive flaky 위험 |
| documentation | MEDIUM | spec 2곳 구 모델 잔존, JSDoc `@param`/`@returns` 갱신 미확인 |
| database | LOW | `execution.status` 인덱스 미확인, emit-DB 정합성 gap (수용 가능) |
| concurrency | MEDIUM | TOCTOU 경합(NodeExecution 미마킹 + concurrency>1), `rehydrateAndResume` Execution 상태 재검증 필요 |
| api_contract | NONE | 외부 REST API 계약 변경 없음 |

---

## 발견 없는 에이전트

- **api_contract**: 외부 API 계약 변경 없음 — REST endpoint URL·요청 스키마·응답 구조·HTTP 상태 코드 모두 미변경
- **scope**: 불필요한 리팩토링·무관한 파일 수정·사용하지 않는 임포트 추가 등 범위 이탈 없음

---

## 권장 조치사항

1. **[즉시 — 동시성/요구사항 통합]** `cancelParkedExecution`에서 동반 WAITING `NodeExecution` 행을 CANCELLED로 마킹하거나, `rehydrateAndResume` 진입 초기에 `Execution.status === WAITING_FOR_INPUT` DB 재검증을 추가하여 TOCTOU 경합 차단. spec §1.1에 취소 경로 NodeExecution 정책 명문화.

2. **[즉시 — 부작용 안전망]** `applyCancellation` 전체 호출 사이트를 grep 전수 조사하여 `await` 누락 fire-and-forget 사이트 수정. `runNodeDispatchLoop` mock 사이트도 동일 점검.

3. **[즉시 — spec 갱신, SPEC-DRIFT 해소]** `spec/data-flow/3-execution.md` fast-path `alt` 분기 제거 + slow-path 단일 경로 기술. `spec/4-nodes/6-presentation/0-common.md` L413 rehydration 모델 재작성. `spec/5-system/4-execution-engine.md §7.4`에 `applyCancellation` async 전환 및 `runNodeDispatchLoop` 반환 계약 명시.

4. **[이번 PR 또는 즉시 — 테스트 강화]** `describe('cancelParkedExecution')` 전용 단위 테스트 추가 (affected:1 emit 발생, affected:0 멱등, emit throw warn). `applyCancellation` 기존 테스트 async 전환 + createQueryBuilder mock 준비.

5. **[이번 PR — 아키텍처 가시성]** `cancelParkedExecution` emit 실패 로그 레벨을 `warn` → `error`로 상향하여 운영 모니터링 가시성 확보.

6. **[PR-B2 계획에 포함]** `waitForFormSubmission`/`waitForButtonInteraction` ParkMode 이원 시그니처 분리 계획 plan 체크박스 등록. `forwardRef` 순환 의존 해소(`IExecutionEngineProcessorFacade` DIP). `firePayload` polling 메커니즘 제거.

7. **[PR-B3 계획에 포함]** `ExecutionEngineService` God Object 리팩토링 — `cancelParkedExecution` 로직 별도 서비스 추출. `PARK_RELEASED`/`ParkSignal` 선언 위치 재검토.

8. **[낮은 우선순위]** `armSlowPathResume` 헬퍼 타입 캐스팅 정리, 폴링 루프 상수화. `flushResumeDrive` 대기 시간 확대(200ms) 또는 completion hook 추가. button park e2e 케이스 추가. 각종 JSDoc `@param`/`@returns` 갱신.

---

## 라우터 결정

routing_status=done (router 가 선별):

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (13명)
- **제외**: dependency (1명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터에 의해 생략 (이유 미기재) |