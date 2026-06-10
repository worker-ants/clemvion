# Architecture Review

## 발견사항

### **[INFO]** `FREEZE_BRANCH_CACHE` export — 모듈 표면 확대 최소화 원칙
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` 34행
- 상세: 이전 라운드(22_00_04)에서 테스트 전제 단언(`expect(FREEZE_BRANCH_CACHE).toBe(true)`)을 위해 `export const` 로 승격되었다. 해당 상수는 dev/test 전용 인프라 관심사이므로 모듈 공개 표면에 등장하는 것이 다소 어색하다. 실질적 오용 위험은 낮고(production 에서는 `false` 고정), 이번 변경 동기(테스트 전제 검증)가 타당하다.
- 제안: 현재 규모에서 허용 가능한 트레이드오프. 장기적으로 이 상수를 테스트 전용 패키지로 분리하거나 `testEnvironmentSetup` 에서 환경 체크를 수행하면 모듈 표면을 줄일 수 있으나, 현재 단계에서는 과도한 추상화.

### **[INFO]** `FREEZE_BRANCH_CACHE` allowlist 판별 — 음성 조건 → 양성 조건 이행 완료
- 위치: `parallel-executor.ts` 34-35행
- 상세: 이전 `!== 'production'` (음성 판별) 에서 `=== 'development' || === 'test'` (양성 allowlist) 로 개선됐다. 이는 미정의 환경을 production 으로 안전하게 fallback 시키는 방어적 아키텍처 결정으로 올바른 방향이다. OCP 관점에서 향후 `'staging'` 같은 환경이 추가될 경우 이 상수 한 줄만 수정하면 되므로 변경 범위가 명확하게 제한된다.
- 제안: 이상 없음.

### **[WARNING]** `freezeSharedCacheValues` 의 side effect — 핵심 실행 경로에 환경 의존 상태 변이 삽입
- 위치: `parallel-executor.ts` `freezeSharedCacheValues` 함수 + 호출부 (`execute` 내 branch context 생성 지점)
- 상세: 이 발견은 이전 라운드(22_00_04)에서도 W1 로 확인되었으며, 이번 변경(JSDoc 보강)으로 부분 완화되었다. 아키텍처 관점에서 재확인: `ParallelExecutor.execute()` 는 병렬화 오케스트레이션의 핵심 비즈니스 경로다. 그 내부에 `NODE_ENV` 분기 기반 불변성 가드가 직접 삽입되어 있어 단일 책임 원칙(병렬화 오케스트레이션 vs. 런타임 invariant 검사)의 경계가 흐릿하다. `FREEZE_BRANCH_CACHE=false` 인 production 경로에서는 `freezeSharedCacheValues` 가 identity 함수이므로 실질 성능 비용은 없으나, 코드 독자가 실행 흐름을 추적할 때 인프라 관심사(환경 감지) 분기를 비즈니스 로직 내부에서 만나게 된다.
- 제안: JSDoc 이 이번 변경으로 충분히 설명되어 현재 수준에서 즉시 수정 불필요. 장기 관점: `ParallelBranchContextFactory` 전략 인터페이스를 도입해 `execute` 가 context 생성 책임을 위임하면 freeze 로직이 분리되고 DI 를 통해 환경별 전략을 주입할 수 있다(OCP + DIP 준수). 현재 규모에서는 과도한 추상화.

### **[INFO]** 테스트에서 `FREEZE_BRANCH_CACHE` 직접 단언 — 구현 상세 결합 수준 최소화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` 44-46행
- 상세: `expect(FREEZE_BRANCH_CACHE).toBe(true)` 는 테스트가 구현 상세(모듈 레벨 상수)를 직접 참조하는 구조다. 그러나 이 단언의 목적이 "테스트 전제 환경 보증" 이라는 점에서 정당하다 — 이는 계약(observable behavior) 검증이 아닌 테스트 전제 조건 명시이므로 통상적인 "구현 상세 결합" 문제와 다르다. `FREEZE_BRANCH_CACHE` 를 export 한 것도 이 패턴을 가능하게 하기 위한 의도적 설계 결정이다.
- 제안: 이상 없음. 전제 단언 패턴은 테스트 자체의 신뢰성을 높이는 올바른 관행.

### **[INFO]** `deepFreeze` — 배열 타입 처리 암묵적 위임
- 위치: `parallel-executor.ts` 37-44행
- 상세: `typeof value !== 'object'` 가 배열을 포함하고, `Object.values(array)` 는 인덱스 기반 요소를 반환하므로 배열 요소도 재귀 대상이 된다. 이는 의도한 범위이나 코드에 명시되지 않았다. 아키텍처 표면에서 `nodeOutputCache` 값 타입 계약(`JsonValue`/`Serializable`)이 인터페이스 레벨에서 명시되지 않아 `deepFreeze` 가 암묵적으로 이 전제에 의존한다.
- 제안: `ExecutionContext.nodeOutputCache` 의 값 타입을 `JsonValue` 계약으로 타입 시스템에서 표현하면 컴파일 타임에 직렬화 가능성을 강제할 수 있다. 현재는 INFO 수준.

### **[INFO]** `toEiaEvent` alias 제거 + `ContinuationBusService.on()` 제거 — 레이어 책임 명확화 완료
- 위치: 이전 라운드(22_00_04) 에서 확인된 개선 사항으로 이번 변경 세트에 포함
- 상세: Phase 1 Redis pub/sub 잔재 제거로 `ContinuationBusService` 가 publisher 전용 단일 책임을 갖게 됐고, `ExecutionEngineService.onModuleInit` 이 외부 레이어 관심사(in-memory listener 등록)에서 해방됐다. 모듈 경계(publisher vs. BullMQ worker dispatcher)가 코드 표면에서도 일치한다.
- 제안: 이상 없음. `IContinuationPublisher` 인터페이스 추출로 DIP 강도를 높일 수 있으나 현재 규모에서는 선택적.

---

## 요약

이번 변경 세트는 이전 코드 리뷰(22_00_04)의 WARNING 조치 결과물이다. `FREEZE_BRANCH_CACHE` 의 음성 판별(`!== 'production'`)을 양성 allowlist(`=== 'development' || === 'test'`)로 교체해 미정의 환경의 production fallback 보장이 이루어졌고(W2 해소), JSDoc 에 공유 참조 freeze 부작용과 비용 집중 특성이 명시됐으며(W1 완화), 테스트의 `try/catch` 구조가 `expect(mutator).toThrow(TypeError)` 로 교체되고 전제 단언(`FREEZE_BRANCH_CACHE === true`)이 추가됐다(W3 해소). 아키텍처 관점에서 가장 주목할 점은 `freezeSharedCacheValues` 가 핵심 병렬화 경로에 환경 의존 상태 변이를 삽입하는 구조(단일 책임 원칙 경계 약화)가 여전히 존재하나, JSDoc 이 충분히 설명하고 production 에 실질 비용이 없어 현재 트레이드오프로 수용 가능하다. Phase 1 잔재(`on()`, `registerContinuationHandlers`, deprecated 상수) 제거로 모듈 경계와 레이어 책임 분리가 실질적으로 개선된 변경이다.

---

## 위험도

LOW
