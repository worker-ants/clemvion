# Code Review 통합 보고서

대상: C-1 step4 — RetryTurnService 추출 (engine-split)
커밋: `01e45f80f087a6a9f2ed82d365d6df709ab39445`
생성일: 2026-06-18

## 전체 위험도

**MEDIUM** — 기능 버그는 없으나 `applyRetryLastTurn` 경비 분기·`failRetryExecution` ExecutionCancelledError 분기·`resumeGraphAfterRetry` defensive fallback 에 대한 단위 테스트 커버리지 갭이 존재하며, EngineDriver 인터페이스 응집도 저하와 `completeRetryExecution`의 guarded 전이 우회가 경고 수준의 아키텍처 위험을 형성한다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 아키텍처 | `EngineDriver` 인터페이스가 고수준 라이프사이클(상태 전이·체크포인트)과 저수준 그래프 실행 capability(5개 신규 메서드) 를 단일 인터페이스에 혼재 — ISP 위반 및 소비자 의존 범위 확대 | `engine-driver.interface.ts` 전체 | 장기적으로 라이프사이클 seam과 graph capability seam을 별도 토큰으로 분리 검토. 단기에는 인터페이스 내 섹션 주석 경계 유지 |
| W-2 | 아키텍처 | `private` → `public` 승격된 5개 메서드(`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `clearLlmDefaultConfigCache`, `findActivatedBackEdge`)가 `ExecutionEngineService` 직접 참조 경로를 통해 모듈 외부 소비자에게 노출 가능 | `execution-engine.service.ts` | `/** @internal — EngineDriver 계약을 통해서만 호출. 직접 참조 금지. */` JSDoc 추가 또는 별도 `EngineGraphExecutor` 클래스로 추출해 delegation |
| W-3 | 아키텍처 | `RetryTurnService` ↔ `ExecutionEngineService` ↔ `AiTurnOrchestrator` 3-way 순환 DI — forwardRef 체인이 3단계로 확장됨. 초기화 순서 버그 및 테스트 격리 비용 증가 위험 | `execution-engine.module.ts`, `retry-turn.service.ts` 생성자 | RetryEntrypoint 파사드 추출로 엔진이 RetryTurnService를 직접 알지 않도록 리팩토링 (다음 God-class 분해 사이클 plan에 기록 권장) |
| W-4 | 아키텍처 | `completeRetryExecution`이 `execution.status`·`finishedAt`·`durationMs`를 직접 mutate 후 저장 — `updateExecutionStatus`(M-3 guarded UPDATE)를 우회해 동시 cancel/park와 경쟁 조건 가능성 | `retry-turn.service.ts` L432–446 | `this.driver.updateExecutionStatus(execution, ExecutionStatus.COMPLETED)` 경유로 교체 |
| W-5 | 테스트 | `applyRetryLastTurn` 경비 조기 반환 5개 분기(spawnedRow not found, status not RUNNING, `_retryState` missing, execution not found, node not found)가 RetryTurnService spec에도 엔진 spec에도 직접 단위 검증되지 않음 | `retry-turn.service.spec.ts` 부재, `execution-engine.service.spec.ts` 통합 커버 한계 | `retry-turn.service.spec.ts`에 `applyRetryLastTurn (early-exit guards)` describe 추가 |
| W-6 | 테스트 | `failRetryExecution`의 `ExecutionCancelledError` 분기(CANCELLED emit 경로)가 양쪽 spec 파일 모두에서 커버되지 않음 | `retry-turn.service.ts` L627–653 | 엔진 spec 또는 RetryTurnService spec에 `ExecutionCancelledError` throw 시 `EXECUTION_CANCELLED` 이벤트 emit 케이스 추가 |
| W-7 | 테스트 | `resumeGraphAfterRetry` defensive fallback 분기 2개(`nodes.length === 0`, `sortedIndexMap.get(completedNode.id) === undefined` → `completeRetryExecution` 직접 호출)가 RetryTurnService 이관 후 어느 spec에서도 검증 안 됨 | `retry-turn.service.ts` L505–521 | `retry-turn.service.spec.ts`에 `driver.loadAndBuildGraph` mock이 `{ nodes: [] }` 반환하는 격리 테스트 추가 |
| W-8 | 유지보수성 | `completeRetryExecution`과 `failRetryExecution`의 호출 경로·상태 변이 책임이 메서드 서명으로는 파악 불가. `failRetryExecution`에 `@internal` 표기 누락 | `retry-turn.service.ts` L414–446, L620–653 | `failRetryExecution` JSDoc에 `@internal — applyRetryLastTurn 의 catch 블록에서만 호출된다` 추가 및 호출 제약 주석 통일 포맷 적용 |
| W-9 | 유지보수성 | `resumeGraphAfterRetry`의 단일 메서드 7단계 순차 처리(~80줄) + `resumeFromCheckpoint`와 중복 로직 존재. 한쪽만 수정 시 silent regression 씨앗 | `retry-turn.service.ts` `resumeGraphAfterRetry` 전체 | 단기 현 구조 유지, 후속 plan에 `setupReachabilityFromCompleted`, `finalizeExecutionCompleted` helper 추출 명시적 트래킹 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | 보안 | 에러 메시지에 내부 ID(`nodeExecutionId`, `executionId` 등) 포함 — gateway 레이어 필터링에 의존. 새 취약점 아님 | `retry-turn.service.ts` L121–233 | 상위 WS gateway에서 에러 code+사용자용 메시지로 변환 확인 또는 `message` 필드 generic 유지 |
| I-2 | 보안 | `_retryState`(사용자·LLM 메시지 내역) JSONB 평문 영속 — 기존 동일 동작, 이번 PR 신규 위험 아님 | `retry-turn.service.ts` L186–288 | 장기적 암호화 저장 또는 TTL 기반 별도 저장소 검토 (이번 PR 범위 외) |
| I-3 | 보안 | `clearLlmDefaultConfigCache` 등 5개 메서드 `public` 승격 — DI 경계 내에서만 소비, 외부 HTTP 표면 미노출 | `engine-driver.interface.ts` L119–123 | NestJS Module exports 제한 또는 ESLint/아키텍처 테스트로 직접 호출 억제 고려 |
| I-4 | 아키텍처 | `ExecutionGraphState` / `NodeDispatchLoopParams`가 서비스 파일에서 직접 export — 다른 모듈이 서비스 구현체를 암묵적으로 의존할 경로 생성 | `execution-engine.service.ts` L870–882 | `engine-driver.interface.ts` 또는 별도 `execution-engine.types.ts` leaf 파일로 이동 |
| I-5 | 아키텍처 | `dataSource` 직접 접근 — 비즈니스/인프라 레이어 혼재. 기존 동일 패턴이나 구조화 가능 | `retry-turn.service.ts` `@InjectDataSource()` | `NodeExecutionRepository`에 `atomicConsumeRetryState` 커스텀 메서드 추출 장기 계획 |
| I-6 | 요구사항 | PARK_RELEASED 시 `finally`의 `contextService.deleteContext` 호출로 in-memory context 소거 — spec 재hydration 경로가 항시 동작하므로 기능 결함 아님. 성능 경로 손상 | `retry-turn.service.ts` try/finally | verbatim 이전된 기존 행위. PARK_RELEASED 분기 context 보존 필요 여부 후속 이슈 추적 |
| I-7 | SPEC-DRIFT | [SPEC-DRIFT] `ExecutionCancelledError` god-class 인라인 정의 → `workflow-errors.ts` leaf 이동. spec 은 클래스 위치를 명시하지 않으므로 spec 위반 아님. spec 침묵 영역 | `workflow-errors.ts` | spec 반영 불필요 (spec이 구현 파일 수준 class 위치를 정의하지 않음) |
| I-8 | 테스트 | `dataSource` per-test override 패턴 `(service as unknown as { dataSource: unknown }).dataSource = ...` — 필드명 변경 시 런타임 silent 실패 | `retry-turn.service.spec.ts` L1666 | `mockDataSource`를 외부 변수로 꺼내 생성자에 넘기는 방식으로 교체 또는 `'dataSource' in service` assertion 추가 |
| I-9 | 테스트 | `retryAfterSec` `_retryState` 폴백 경로 테스트 없음 — `output.error.details.retryAfterSec` 없을 때 `retryState.retryAfterSec`로 RETRY_TOO_EARLY 발생 케이스 미커버 | `retry-turn.service.ts` L166–170 | `_retryState.retryAfterSec` 폴백으로 RETRY_TOO_EARLY 케이스 추가 |
| I-10 | 동시성 | `retryAfterSec` 경계 시점 동시 요청 시 한 요청이 `RETRY_TOO_EARLY` 대신 `RETRY_STATE_NOT_FOUND`로 반환되는 에러 코드 의미론 불일치 — 중복 spawn은 발생 안 함 | `retry-turn.service.ts` L116–220 | 허용 가능 edge case. 에러 메시지가 상황 설명. 엄격 의미론 필요 시 `SELECT ... FOR UPDATE` 내부화 (현 spec 요건 초과) |
| I-11 | 유지보수성 | `applyRetryLastTurn` 내 zombie row 방지 패턴 3중 중복(`!retryState`, `!execution`, `!node` 각 분기에서 동일 set·save 반복) | `retry-turn.service.ts` early-return 분기 | `markSpawnedRowFailed(row, message)` private helper 추출 |
| I-12 | 유지보수성 | `retryLastTurn`의 `spawned` 변수 closure 캡처 패턴 — `null` 좁히기 실패로 이중 타입 단언 필요 | `retry-turn.service.ts` L2318, L2356 | 트랜잭션 콜백 반환값 직접 사용 패턴으로 교체 |
| I-13 | 유지보수성 | `workflow-errors.ts`에 `import` 문이 파일 중간에 위치 — ESLint `import/first` 규칙 잠재 위반 | `workflow-errors.ts` L3026 | 파일 상단 import 섹션으로 이동 |
| I-14 | 문서화 | `EngineDriver` 인터페이스 JSDoc이 step2 맥락에 고정 — step4 소비자(`RetryTurnService`) 누락 | `engine-driver.interface.ts` L147–159, L271–276 | JSDoc에 RetryTurnService 소비자 및 추가 표면 설명 한 문장 보완 |
| I-15 | 문서화 | thin delegator `retryLastTurn` / `applyRetryLastTurn`의 JSDoc 완전 제거 — IDE hover 시 참조 위치 미노출 | `execution-engine.service.ts` delegator 영역 | `@see RetryTurnService.retryLastTurn` / `@see RetryTurnService.applyRetryLastTurn` 축약 JSDoc 추가 |
| I-16 | 문서화 | `retry-turn.service.spec.ts` 상단 주석에 엔진 spec 내 교차 참조 `describe` 블록 명시 누락 | `retry-turn.service.spec.ts` L1539–1557 | "execution-engine.service.spec.ts의 describe('applyRetryLastTurn...')" 형태 교차 참조 한 줄 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | MEDIUM | EngineDriver ISP 위반(W-1), private→public 캡슐화 약화(W-2), 3-way 순환 DI(W-3), completeRetryExecution guarded 전이 우회(W-4) |
| testing | MEDIUM | applyRetryLastTurn 경비 분기 5개 미커버(W-5), ExecutionCancelledError 분기 미커버(W-6), defensive fallback 미커버(W-7) |
| maintainability | LOW | zombie row 3중 중복(I-11), resumeGraphAfterRetry 중복 로직(W-9), workflow-errors.ts mid-file import(I-13) |
| requirement | LOW | PARK_RELEASED finally deleteContext 성능 경로 손상(I-6) — 기능 결함 아님 |
| documentation | LOW | EngineDriver JSDoc step2 고정(I-14), delegator JSDoc 완전 제거(I-15) |
| concurrency | LOW | retryAfterSec 경계 시점 에러 코드 불일치(I-10) — 중복 spawn 없음 |
| security | NONE | 에러 메시지 내부 ID 노출 가능성(I-1) — gateway 레이어 의존, 신규 위험 아님 |
| scope | NONE | 모든 변경이 커밋 선언 범위 내, 불필요 변경 없음 |
| side_effect | NONE | 의도하지 않은 부작용 없음, 기존 동일 패턴 verbatim 이전 확인 |

---

## 발견 없는 에이전트

없음 (전 에이전트 발견사항 보고).

---

## 권장 조치사항

1. **(W-5, W-6, W-7 — 테스트 커버리지 갭)** `retry-turn.service.spec.ts`에 `applyRetryLastTurn` 경비 조기 반환 5개 분기, `ExecutionCancelledError` → CANCELLED emit 분기, `resumeGraphAfterRetry` defensive fallback 2개 분기 단위 테스트 추가. 현존 beforeEach mock 하니스를 재사용 가능해 추가 비용 낮음.
2. **(W-4 — guarded 전이 우회)** `completeRetryExecution`을 `this.driver.updateExecutionStatus(execution, ExecutionStatus.COMPLETED)` 경유로 교체해 M-3 guard 보장.
3. **(W-8 — @internal 누락)** `failRetryExecution` JSDoc에 `@internal — applyRetryLastTurn catch 블록 전용` 추가. `completeRetryExecution`과 주석 포맷 통일.
4. **(W-2, I-3 — 의도적 public 노출 명시)** public 승격된 5개 메서드에 `/** @internal — EngineDriver 계약을 통해서만 호출. 직접 참조 금지. */` JSDoc 추가.
5. **(I-13 — ESLint 위반 가능)** `workflow-errors.ts` 중간 `import` 문을 파일 상단으로 이동.
6. **(I-9 — 테스트 폴백 경로)** `retryAfterSec` `_retryState` 폴백 경로 RETRY_TOO_EARLY 케이스 단위 테스트 추가.
7. **(I-11 — 중복 제거)** `markSpawnedRowFailed(row, message)` private helper 추출로 zombie row 방지 패턴 3중 중복 제거.
8. **(I-14, I-15 — 문서화)** `EngineDriver` JSDoc에 RetryTurnService 소비자 보완, thin delegator에 `@see` JSDoc 추가.
9. **(W-1, W-3, I-4 — 아키텍처 후속 plan)** EngineDriver 인터페이스 분리, 순환 DI 파사드 추출, ExecutionGraphState 타입 leaf 이동을 다음 God-class 분해 사이클 plan 항목으로 명시 기록.

---

## 라우터 결정

라우터 사용됨 (`routing_status=done`).

- **실행** (9명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`
- **강제 포함 (router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (6명)
- **제외** (5명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 순수 구조 리팩토링으로 성능 특성 변경 없음 |
| dependency | 신규 외부 의존성 추가 없음 |
| database | DB 스키마·마이그레이션 변경 없음 |
| api_contract | 외부 API 계약 변경 없음 (internal 리팩토링) |
| user_guide_sync | 사용자 가이드 관련 변경 없음 |