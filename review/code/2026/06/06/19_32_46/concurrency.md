# 동시성(Concurrency) 리뷰

## 발견사항

동시성과 직접 관련된 실질적 문제는 발견되지 않았다. 아래는 패턴별 검토 결과다.

### 1. `_resumeTurnRegistry` lazy-init (`??=`) — 경쟁 조건 없음 (INFO)

- **위치**: `execution-engine.service.ts` — `get resumeTurnRegistry()` getter
- **상세**: `this._resumeTurnRegistry ??= [...]` 패턴은 복수 요청이 동시에 getter 를 처음 호출하면 경쟁 조건처럼 보일 수 있다. 그러나 NestJS 는 Node.js 단일 스레드 이벤트 루프 위에서 동작하고, `??=` 연산은 `await` 경계가 없는 순수 동기 표현식이다. 두 번째 호출이 스케줄링되기 전에 첫 번째 호출이 완료되므로 실제 경쟁이 발생하지 않는다.
- **제안**: 현재 아키텍처(Node.js 단일 스레드, `await` 없는 동기 getter)에서는 문제 없음. 향후 Worker Threads 를 도입하거나 registry 초기화가 비동기화되면 재검토 필요.

### 2. `setNodeOutput` 호출 후 `processAiResumeTurn` 실행 순서 — 문제 없음 (INFO)

- **위치**: `execution-engine.service.ts` — `handleAiResumeTurn` 내 L1090~L1106
- **상세**: `contextService.setNodeOutput(...)` 은 await 없는 동기 호출이고, 곧바로 `return this.processAiResumeTurn(...)` 이 awaited 된다. 두 호출 사이에 이벤트 루프 양보(`await`)가 없으므로 setNodeOutput 이 processAiResumeTurn 에 항상 선행한다. 순서 보장됨.
- **제안**: 해당 없음.

### 3. `PARK_RELEASED` Symbol 이관 — 단일 인스턴스 보장 (INFO)

- **위치**: `process-turn-result.ts` (신규 파일)
- **상세**: 기존에 `execution-engine.service.ts` 의 파일-로컬 const 였던 `PARK_RELEASED = Symbol('park_released')` 가 공유 모듈로 이관됐다. Node.js 모듈 캐시가 동일 경로의 모듈 인스턴스를 단일 객체로 유지하므로 `=== PARK_RELEASED` 동등 비교는 크로스-모듈에서도 안전하다. ESM/CJS 혼용 환경에서 dual-bundle 시 두 번 로딩되면 Symbol 인스턴스가 달라질 수 있으나, NestJS 백엔드 단일 번들 환경에서는 해당 없음.
- **제안**: 해당 없음.

### 4. `dispatchResumeTurn` 에서의 동시 재개 요청 처리 — 외부 락으로 보호됨 (INFO)

- **위치**: `execution-engine.service.ts` — `dispatchResumeTurn`
- **상세**: 동일 executionId 에 대한 두 continuation 이 거의 동시에 도착해 `dispatchResumeTurn` 이 두 번 호출되는 경우를 검토했다. `driveResumeAwaited` / `driveResumeFrame` 를 호출하는 외부 경계(`resumeFromCheckpoint` → `applyContinuation`)가 이미 `ContinuationBusService.acquireLock(executionId)` / `releaseLock(executionId)` 로 실행 레벨 직렬화를 담당한다. 이 변경은 해당 락 구조를 변경하지 않으므로 새로운 경쟁 조건을 도입하지 않는다.
- **제안**: 해당 없음.

### 5. 테스트 — `afterEach` registry 리셋 + Jest 직렬 실행 (INFO)

- **위치**: `execution-engine.service.spec.ts` — `afterEach` 내 `_resumeTurnRegistry = undefined`
- **상세**: Jest 는 단일 worker 에서 동일 describe 블록을 직렬 실행하므로 병렬 테스트 간 상태 충돌이 없다. `beforeEach` 가 매 테스트마다 새 서비스 인스턴스를 생성하므로 registry 리셋은 방어적 관행으로 무해하다.
- **제안**: 해당 없음.

### 6. `flushResumeDrive(200ms)` 타이머 — 동시성 버그 아님 (INFO)

- **위치**: `execution-engine.service.spec.ts` L381~383
- **상세**: 비동기 emit 정착을 위한 200ms 실시간 타이머로, 이 변경에서 새로 도입된 것이 아니다. CI 고부하 환경에서의 sporadic false negative 를 피하기 위한 안전 마진이며 동시성 위험이 아니다.
- **제안**: 해당 없음.

---

## 요약

이번 변경은 `driveResumeAwaited` / `driveResumeFrame` 양쪽에 중복 하드코딩된 form/buttons/AI if-else 분기를 `resumeTurnRegistry` ordered registry 패턴으로 추출하는 리팩토링이다. 새로운 공유 가변 상태를 도입하지 않으며, 유일한 쓰기 가능 필드인 `_resumeTurnRegistry` 는 Node.js 단일 스레드 + await 없는 동기 getter 특성으로 경쟁 조건이 없다. `PARK_RELEASED` Symbol 의 공유 모듈 이관도 Node.js 모듈 캐시 보장으로 안전하다. 동시 continuation 요청에 대한 executionId-level 락은 이 변경과 무관하게 외부에서 이미 보장된다. 동시성 관점의 실질적 위험은 없다.

## 위험도

NONE
