# Architecture Review

## 발견사항

### **[INFO]** `FREEZE_BRANCH_CACHE` + `deepFreeze`/`freezeSharedCacheValues` — 단일 책임 원칙(SRP) 경계 약화 (기존 발견 재확인, 이전 라운드 WARNING 보존)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:34–62`
- 상세: `ParallelExecutor.execute()` 는 병렬 branch 오케스트레이션의 핵심 비즈니스 경로다. 그 내부에 환경 감지(`NODE_ENV` allowlist) 기반 불변성 가드(`freezeSharedCacheValues`)가 직접 삽입되어 "병렬화 오케스트레이션" 과 "런타임 invariant 검사" 두 책임이 섞인다. 이번 변경에서 `FREEZE_BRANCH_CACHE` 가 양성 allowlist(`=== 'development' || === 'test'`)로 수정되고 JSDoc 이 크게 보강됐으므로 이전 라운드(22_00_04) W1 이 부분 완화되었다. production 경로에서 `FREEZE_BRANCH_CACHE === false` 이므로 `freezeSharedCacheValues` 는 identity 함수이며 JIT 상 실질 비용은 없다. 그러나 코드 독자가 `execute()` 흐름을 추적할 때 인프라 관심사(환경 분기)를 비즈니스 경로 내부에서 만나는 구조적 약점은 유지된다.
- 제안: 현재 JSDoc 이 충분히 설명하므로 즉시 수정 불필요. 장기적으로 `ParallelBranchContextFactory` 전략 인터페이스를 도입해 `execute` 가 context 생성 책임을 위임하면 OCP + DIP 를 준수하면서 freeze 로직을 분리할 수 있다. 현재 규모에서는 과추상.

### **[INFO]** `FREEZE_BRANCH_CACHE` — `export const` 승격으로 모듈 공개 API 표면 확대
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:34`
- 상세: 이번 변경에서 `const` → `export const` 로 가시성이 승격됐다. 목적은 테스트 파일의 전제 단언(`expect(FREEZE_BRANCH_CACHE).toBe(true)`) 지원으로, 의도적 설계 결정이다. `@internal — test-only export` JSDoc 이 추가돼 오용 가능성을 문서로 차단했다. 이 export 패턴은 인터페이스 분리(ISP) 관점에서 약한 신호를 준다 — 동일 모듈에서 `ParallelExecutor`, `ParallelConfig`, `BranchFailure` 같은 프로덕션 계약과 `FREEZE_BRANCH_CACHE` 같은 테스트 전용 심볼이 같은 네임스페이스에 노출된다. 현재 유일한 소비처가 동일 모듈 spec 파일이므로 실질 오염 위험은 낮다.
- 제안: 현재 규모에서 수용 가능한 트레이드오프. `@internal` JSDoc 이 이미 명시됐으므로 추가 조치 불필요. 장기적으로는 테스트 전용 심볼을 별도 `test-exports.ts` 배럴 파일로 분리하면 모듈 계약 순결성을 높일 수 있다.

### **[INFO]** `FREEZE_BRANCH_CACHE` allowlist 방식 전환 — 방어적 아키텍처 결정으로 올바른 방향
- 위치: `parallel-executor.ts:35–36`
- 상세: 이전 `!== 'production'` 음성 판별에서 `=== 'development' || === 'test'` 양성 allowlist 로 교체됐다. 미정의 환경(`NODE_ENV=undefined`, `NODE_ENV=staging` 등)이 production 으로 안전하게 fallback 된다. OCP 관점에서 향후 환경 추가 시 이 상수 한 줄만 수정하면 변경 범위가 명확히 제한된다. 이는 이전 라운드 아키텍처 검토에서 권고했던 방향이 이번 변경에서 구현된 것이다.
- 제안: 이상 없음.

### **[INFO]** `deepFreeze` — 타입 계약 미강제(암묵적 JsonValue 전제)
- 위치: `parallel-executor.ts:38–47`
- 상세: `deepFreeze` 는 "cache 값이 직렬화 가능한 output envelope 이라 순환 참조가 없다"는 전제에 의존한다. 이 전제가 `ExecutionContext.nodeOutputCache` 의 값 타입 인터페이스에 `JsonValue` 또는 `Serializable` 로 컴파일 타임 강제되지 않으면, 미래 핸들러가 순환 참조 포함 객체를 cache 에 넣을 경우 dev/test 에서만 스택 오버플로가 발생하고 production 에서는 탐지되지 않는다. 아키텍처 표면에서 이 계약이 인터페이스 레벨에 표현되지 않는 점이 약점이다.
- 제안: `nodeOutputCache` 및 `structuredOutputCache` 의 값 타입을 `JsonValue` 계약으로 타입 시스템에서 표현하면 컴파일 타임에 직렬화 가능성 전제를 강제할 수 있다. 현재는 INFO 수준이나 장기적으로 인터페이스 명세 강화 권장.

### **[INFO]** Phase 1 Redis pub/sub 잔재 완전 제거 — 레이어 책임 분리 완성
- 위치: 이전 라운드(22_00_04) 확인 사항, 이번 변경 세트에 포함된 완료 내용
- 상세: `ContinuationBusService.on()` no-op stub 과 `ExecutionEngineService.registerContinuationHandlers()` 제거로 `ContinuationBusService` 가 publisher 전용 단일 책임을 갖게 됐고, dispatch 책임이 `continuation-execution.processor.ts`(BullMQ Worker) 에만 집중됐다. 레이어 경계(publisher vs. worker/dispatcher)가 코드 표면에서 일치하며, `ExecutionEngineService.onModuleInit` 이 외부 레이어 관심사(in-memory listener 등록)에서 해방됐다. 이는 DIP 관점에서 고수준 모듈(`ExecutionEngineService`)이 저수준 구현 상세(Phase 1 Redis 라우팅)에 직접 의존하던 구조가 제거된 개선이다.
- 제안: `IContinuationPublisher` 인터페이스 추출로 DIP 강도를 더 높일 수 있으나 현재 규모에서는 선택적.

### **[INFO]** `freezeSharedCacheValues` — 공유 참조에 side-effect 적용, 진단 비대칭 의도적 설계
- 위치: `parallel-executor.ts:54–62`
- 상세: `freezeSharedCacheValues({ ...context.nodeOutputCache })` 는 shallow copy 의 값 객체(원본과 동일 참조)에 `deepFreeze` 를 적용하므로 부모 context 포함 freeze 가 적용된다. 이 side-effect 가 이번 변경에서 JSDoc 에 명시됐다("원본과 동일 참조를 공유 — 따라서 freeze 는 부모 context 의 값 객체에도 적용된다. 이는 의도다"). 진단 비대칭(dev/test TypeError, production silent mutate)은 spec invariant 조기 검출을 위한 의도적 설계다. JSDoc 이 설계 의도를 충분히 설명하므로 현재 상태로 수용 가능하다.
- 제안: 현행 유지. JSDoc 이 이미 부작용을 명시한다.

---

## 요약

이번 변경 세트(22_29_49 재리뷰 대상)는 두 라운드(22_00_04, 22_20_51)의 코드 리뷰 결과물과 그 WARNING 조치 결과를 포함한다. 아키텍처 관점에서 핵심 판단은 다음과 같다. 첫째, `FREEZE_BRANCH_CACHE` 의 음성 판별 → 양성 allowlist 전환은 방어적 아키텍처 원칙(fail-safe default)의 올바른 적용이며 이전 권고가 이행됐다. 둘째, `FREEZE_BRANCH_CACHE` 의 `export const` 승격은 ISP 관점에서 모듈 공개 표면에 테스트 전용 심볼을 혼재시키는 약한 경계를 만들지만, `@internal` JSDoc 명시와 소비처 한정으로 실질 오용 위험이 낮아 현재 수용 가능한 트레이드오프다. 셋째, `freezeSharedCacheValues` 가 핵심 병렬화 경로에 환경 의존 상태 변이를 삽입하는 SRP 경계 약화는 이전 라운드부터 일관되게 WARNING 으로 존재하며, JSDoc 보강으로 완화됐으나 구조적 개선(ParallelBranchContextFactory 전략 분리)은 장기 백로그에 위치한다. Phase 1 잔재 제거로 레이어 책임 분리가 실질적으로 개선된 것이 이번 변경 집합의 가장 중요한 아키텍처 기여다.

---

## 위험도

LOW

STATUS=success ISSUES=0
