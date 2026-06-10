# 동시성(Concurrency) 리뷰

## 발견사항

### [INFO] deepFreeze 가 공유 참조에 적용되는 구조 — 의도적 설계, 다중 branch 동시성 관점 확인

- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` — `freezeSharedCacheValues` + `FREEZE_BRANCH_CACHE`
- 상세: `nodeOutputCache` 는 branch context 생성 시 shallow copy 이므로 값 객체(value objects)는 원본과 동일 참조를 공유한다. 첫 번째 branch 가 `deepFreeze` 를 호출하면 이후 모든 branch 와 부모 context 는 frozen 된 동일 객체를 참조하게 된다. 복수 branch 가 Promise 비동기 스케줄링으로 순차 실행될 때, 두 번째 branch 의 `freezeSharedCacheValues` 호출은 `Object.isFrozen` 조기 반환(no-op) 으로 안전하게 처리된다 — Node.js 단일 이벤트 루프에서 실제 동시 실행이 없으므로 freeze 적용 경쟁 조건 없음. production 에서는 `FREEZE_BRANCH_CACHE === false` 로 `deepFreeze` 자체가 호출되지 않으므로 런타임 동시성 위험 없음. 변경된 JSDoc 에 이 의도가 명시되어 있어 적절하다.
- 제안: 현행 유지. `isFrozen` 조기 반환은 올바른 방어 처리다.

### [INFO] `FREEZE_BRANCH_CACHE` allowlist 판별 변경 — 환경 판별 경쟁 조건(환경변수 미정의) 수정

- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` L122
- 상세: `!== 'production'` 음성 판별은 `NODE_ENV` 가 undefined 일 때 freeze 가 활성화되어 production-like 환경에서 의도치 않게 freeze 가 켜질 수 있었다. `=== 'development' || === 'test'` allowlist 양성 판별로 변경함으로써 환경변수 미정의 시 freeze off 가 보장된다. 동시성 관점에서 이는 "freeze 를 켜야 할 환경" 판단의 결정론적 명확화이며 올바른 방향이다.
- 제안: 현행 유지.

### [INFO] 테스트 내 async branch 에서 mutator 캡처 후 외부 toThrow 실행 — race condition 없음

- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` L60-82
- 상세: `await executor.execute(...)` 완료 후 `mutator` 함수를 동기적으로 `expect(mutator!).toThrow(TypeError)` 로 실행한다. `mutator` 는 async branch callback 내부에서 캡처되나, `await` 완료 보장 후 외부에서 동기 실행하므로 테스트 내 race condition 없음. frozen 상태 확인 시점은 모든 branch 실행 완료 이후로 결정론적이다.
- 제안: 현행 유지.

## 요약

이번 변경은 `parallel-executor.ts` 의 dev/test 전용 deep freeze 가드(`FREEZE_BRANCH_CACHE` + `freezeSharedCacheValues`) 를 보강한 리팩터링이다. 동시성 관점에서 주요 위험 요소는 없다. `deepFreeze` 가 공유 참조에 적용되는 구조는 의도적 설계로 JSDoc 에 명시되었고, `isFrozen` 조기 반환이 복수 branch 의 중복 freeze 시도를 안전하게 처리한다. `FREEZE_BRANCH_CACHE` 의 allowlist 방식 변경은 환경변수 미정의 시 발생하던 판별 오류를 수정한 올바른 개선이다. production 에서는 freeze 가 비활성이므로 런타임 동시성 영향 없음. 전반적으로 동시성 관점 위험도는 NONE 에 해당한다.

## 위험도

NONE
