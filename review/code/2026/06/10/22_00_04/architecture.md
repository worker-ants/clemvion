# Architecture Review

## 발견사항

### **[INFO]** deprecated alias `toEiaEvent` 완전 제거 — 단일 책임 원칙 이행
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (제거된 마지막 7줄)
- 상세: `toEiaEvent` 는 "EIA 전용 반환" 을 함수명으로 표방했으나 실제로는 chat-channel-internal variant 도 반환하는 범용 변환기였다. alias 유지 기간 동안 함수명-반환 의미 불일치(W3)가 아키텍처 표면에 노출돼 있었다. 이번 PR 에서 alias 를 삭제하고 `toChatChannelEvent` 로 일원화함으로써 모듈 공개 API 의 단일 책임이 복원됐다.
- 제안: 이미 올바른 방향. 후속에 `toChatChannelEvent` 반환 타입을 `EiaChatChannelEvent` 같은 sealed union 으로 명시하면 OCP(개방-폐쇄) 준수를 타입 레벨에서 강제할 수 있다.

### **[INFO]** `ContinuationBusService.on()` no-op stub 완전 제거 — 레이어 책임 명확화
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` (제거된 18줄)
- 상세: Phase 1 의 Redis pub/sub 라우팅 레이어가 Phase 2 에서 BullMQ Worker 로 대체된 이후에도 `on()` stub 이 서비스 인터페이스에 남아 "bus 가 listener 등록을 받는다" 는 잘못된 추상화 신호를 주고 있었다. 이번 제거로 `ContinuationBusService` 는 publisher 전용 단일 책임을 갖게 됐고, dispatch 책임은 `continuation-execution.processor.ts` 에만 위치한다. 레이어 책임 분리가 코드 표면에서도 일치한다.
- 제안: 현재 구조 양호. `ContinuationBusService` 인터페이스 계약을 `IContinuationPublisher` 인터페이스로 추출하면 의존성 역전(DIP) 강도를 높일 수 있으나 필수 조치는 아니다.

### **[INFO]** `ExecutionEngineService.registerContinuationHandlers()` 제거 — 의존성 역전 개선
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`onModuleInit` 에서 호출 제거, private stub 삭제)
- 상세: `onModuleInit` 이 자기 책임 범위 밖의 in-memory listener 등록(Phase 1 잔재)을 직접 수행하던 구조가 제거됐다. 이제 `onModuleInit` 은 `registerHandlers()` 만 호출하고, continuation 처리 라우팅은 BullMQ processor 레이어가 전담한다. 서비스 초기화 코드에서 외부 레이어 관심사가 분리됐다.
- 제안: 이상 없음. spec 테스트 hook 3곳(`registerContinuationHandlers` 직접 호출) 동반 제거로 테스트가 내부 구현 상세에 결합되지 않게 됐다 — 이는 테스트 결합도 감소로도 올바른 방향이다.

### **[INFO]** `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 모듈 수준 상수 제거 — 환경 변수 반응성 개선
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (제거된 5줄)
- 상세: 모듈 로드 시점에 `process.env` 를 읽어 상수로 freeze 하는 패턴은 NestJS DI 컨텍스트에서 테스트 격리(jest.resetModules 없이 env 변경 후 즉시 반영)와 런타임 반영을 막는다. getter 함수(`getFailedDegradedThreshold`, `getDelayedDegradedThreshold`)로의 완전 이행으로 이 문제가 해소됐다. 아키텍처적으로 환경 설정값의 "늦은 평가" 패턴이 일관되게 적용된다.
- 제안: 나머지 env 기반 상수들(`continuationConcurrency`, `executionRunConcurrency` 등)도 동일 getter 패턴으로 통일 여부를 검토할 수 있다. 현재는 INFO 수준.

### **[WARNING]** `freezeSharedCacheValues` — 환경 의존 동작 분기가 핵심 비즈니스 레이어에 삽입
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:558–577`
- 상세: `process.env.NODE_ENV !== 'production'` 조건이 모듈 최상단 상수(`FREEZE_BRANCH_CACHE`)로 분리됐고 주석이 충분히 상세하다. 그러나 `deepFreeze` / `freezeSharedCacheValues` 는 execution 런타임의 핵심 경로(`ParallelExecutor.execute`)에 인라인으로 위치한다. 이 패턴은 "dev/test 에서만 활성화되는 불변성 검사" 가 프로덕션 코드 경로에 영구적으로 존재하는 구조다. SOLID 관점에서 단일 책임(핵심 병렬화 오케스트레이터 vs. 불변성 가드 도구)이 섞인다. `FREEZE_BRANCH_CACHE=false` 인 production 경로에서 `freezeSharedCacheValues` 는 identity 함수이므로 JIT 최적화 후 실질 비용은 무시 가능하나, 아키텍처 표면에는 "인프라 관심사(환경 감지) + 비즈니스 로직(branch isolation)" 혼합이 발생한다.
- 제안: 현재 구현이 실용적 트레이드오프(deep clone 대신 dev-only freeze) 의 결과임을 주석이 충분히 설명하므로 즉시 수정 불필요. 장기적으로는 `ParallelBranchContextFactory` 같은 전략 객체로 분리해 환경별 context 생성 전략을 주입 가능하게 만들면 OCP 를 더 잘 준수한다. 현재 규모에서는 과도한 추상화가 될 수 있으므로 WARNING 보존.

### **[INFO]** `deepFreeze` 재귀 구현 — 순환 참조 부재 가정 의존
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:560–567`
- 상세: 주석이 "cache 값은 직렬화 가능한 output envelope 이라 순환 참조가 없으나, 방어적으로 이미 frozen 인 객체는 건너뛴다" 고 명시한다. `Object.isFrozen` 체크는 재귀를 조기 종료하지만, 순환 참조가 있다면 스택 오버플로가 발생한다. 현재 `nodeOutputCache` 는 직렬화 가능 값이라는 전제가 성립하면 문제없다. 아키텍처 수준에서는 이 전제가 인터페이스(`ExecutionContext.nodeOutputCache` 타입)에 명시적으로 표현되지 않는 점이 약점이다.
- 제안: `nodeOutputCache` 의 값 타입을 `JsonValue` 또는 `Serializable` 계약으로 타입 시스템에서 표현하면 이 전제를 컴파일 타임에 강제할 수 있다. 현재는 INFO.

### **[INFO]** `continuation-bus.service.spec.ts` — `on()` 테스트 블록 제거로 테스트 결합도 감소
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts` (제거된 6줄)
- 상세: `on()` stub 이 no-op 이었으므로 그 테스트는 구현 상세를 직접 검증하는 결합도 높은 테스트였다. 제거가 올바른 방향이며 남은 테스트 그룹(publish → BullMQ enqueue, 분산 lock, seq TTL)이 실제 계약(observable behavior)을 검증한다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 크게 세 가지 아키텍처 개선을 포함한다. 첫째, Phase 1 Redis pub/sub 잔재(`toEiaEvent` alias, `ContinuationBusService.on()`, `ExecutionEngineService.registerContinuationHandlers()`)를 완전히 제거해 레이어 책임(publisher vs. worker/dispatcher) 경계가 코드 표면에서도 일치하게 됐다. 둘째, 모듈 수준 env 상수를 getter 함수로 완전 이행해 NestJS DI 컨텍스트에서의 테스트 격리와 런타임 반영 문제를 해소했다. 셋째, `ParallelExecutor` 의 branch context isolation 에 dev/test 한정 deep freeze guard(M-5)를 추가해 "값 내부 mutate 금지" invariant 를 기계적으로 검증하는 안전망을 구축했다. M-5 freeze 가 핵심 비즈니스 레이어(`ParallelExecutor.execute`) 에 직접 삽입되는 구조는 단일 책임 원칙 관점에서 약한 경계를 만들지만, 현재 설계 결정(deep clone 비용 회피)의 실용적 트레이드오프로서 주석이 충분히 설명하고 있으며 production 경로에 실질 비용이 없다. 전체적으로 dead code 제거 방향이 일관되고 모듈 경계가 개선됐으며, 테스트도 내부 구현 상세 결합에서 계약 검증으로 이동했다.

---

## 위험도

LOW
