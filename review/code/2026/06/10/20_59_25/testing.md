# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `resolveParallelEngineFlag` cold-state 테스트의 캐시 리셋 방식 — private 필드 직접 접근
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` lines 39-41 (새로 추가된 첫 번째 테스트 케이스)
- 상세: `(service as unknown as { parallelEngineFlagOnce: string | null }).parallelEngineFlagOnce = null` 로 private 인스턴스 필드를 강제 리셋한다. `as unknown as` 이중 캐스팅은 TypeScript 타입 안전성을 완전히 우회한다. 필드명 `parallelEngineFlagOnce` 가 리팩터(rename, 캐시 전략 변경)되는 경우 테스트가 컴파일 에러 없이 잘못 동작할 수 있다. 또한 동일 describe 블록의 다른 테스트가 warm 상태를 만들어 두면 이 `null` 리셋이 없을 경우 cold 테스트가 false positive 될 수 있는데, 현재는 리셋이 올바르게 수행되고 있다.
- 제안: 현재 codebase 관행(MAX_NODE_ITERATIONS 동일 패턴 준용)이므로 즉각 수정이 필요한 수준은 아니다. 중기적으로 `resetConfigCacheForTest()` 같은 테스트 전용 메서드를 서비스에 추가(테스트 환경에서만 활성화)하거나, `parallelEngineFlagOnce` 필드를 캐시 전담 값 객체로 추출하면 이 취약 결합이 제거된다.

### [INFO] cold 상태 테스트에서 `mockConfigService.get` 반환값 'v1' 의 출처가 불명확
- 위치: `execution-engine.service.spec.ts` line 46 — `expect(svc.resolveParallelEngineFlag()).toBe('v1')`
- 상세: `mockConfigService.get` 은 `beforeEach` 에서 `MAX_NODE_ITERATIONS` 키만 명시적 반환값을 설정하고 나머지는 `defaultValue` 를 반환한다. `PARALLEL_ENGINE` 키의 경우 `defaultValue` 인 `undefined` 또는 실제 mock 반환값이 'v1' 이 되는 이유가 테스트 코드만 읽어서는 명확하지 않다. 실제로 'v1' 을 반환하도록 mock 을 설정한 곳이 상위 describe 블록에 있을 가능성이 있지만, 이 테스트만 독립 실행했을 때 동일 결과를 보장하는지 검증이 필요하다.
- 제안: cold 테스트 내부에서 `mockConfigService.get.mockImplementationOnce((key: string) => key === 'PARALLEL_ENGINE' ? 'v1' : undefined)` 처럼 반환값을 명시하면 테스트의 자기-설명성과 격리성이 향상된다. 또는 테스트 상단에 "beforeEach mock 이 PARALLEL_ENGINE 에 대해 'v1' 을 반환하는 이유" 주석을 추가하는 것도 가독성 개선에 도움이 된다.

### [INFO] warm 캐시 테스트의 `async` 불필요 선언
- 위치: `execution-engine.service.spec.ts` line 55 — `it('...', async () => {`
- 상세: 두 번째 테스트(`warm 캐시 상태에서는 configService.get 재호출이 없다`)가 `async` 로 선언되어 있으나 내부에 `await` 나 비동기 처리가 없다. 첫 번째 테스트도 마찬가지(`async`). 테스트 실행에 영향은 없으나 불필요한 `async` 는 "이 테스트가 비동기 동작을 검증하는가?" 라는 독자의 오해를 유발할 수 있다.
- 제안: 두 케이스 모두 동기 함수이므로 `async` 제거. 사소한 가독성 개선이나 일관성 측면에서 권장한다.

### [INFO] `resolveParallelEngineFlag` 반환값 타입 캐스팅의 안전성
- 위치: `execution-engine.service.spec.ts` lines 44-45 — `type FlagSubject = { resolveParallelEngineFlag: () => string }; const svc = service as unknown as FlagSubject`
- 상세: `resolveParallelEngineFlag` 실제 시그니처가 `string | null | undefined` 를 반환하더라도 `FlagSubject` 타입 정의는 `() => string` 으로만 제한되어 있다. 타입 불일치가 있어도 컴파일 에러가 발생하지 않으므로 실제 구현부의 반환 타입 변경이 테스트에 반영되지 않는다. 두 테스트 케이스 모두 동일한 패턴을 사용하며, 첫 번째 cold 테스트에도 동일 `FlagSubject` 타입이 재선언된다.
- 제안: `FlagSubject` 타입을 두 테스트 케이스 상위 스코프로 끌어올려 중복 제거. 실제 서비스 타입을 더 좁게 cast 하거나, 테스트용 타입을 서비스 파일에서 export 하면 리팩터 내성이 높아진다.

### [INFO] `engine.service.ts` 주석 변경 — `sortByStartedAt` → `selectSortedNodeResults` (5곳)
- 위치: `execution-engine.service.ts` 4007, 4180, 5524, 5910, 6572 행 주석
- 상세: 함수명 변경에 따른 주석 동기화이며 기능 변경 없음. 테스트 커버리지에 영향을 주지 않는다. 이전 리뷰 SUMMARY INFO 1 의 이행으로 적절하다.

### [INFO] `use-execution-events.test.ts` 주석 변경 — 2곳
- 위치: `use-execution-events.test.ts` 294, 403행
- 상세: 테스트 설명 주석의 함수명 업데이트. 테스트 로직·단언은 변경 없음. 가독성 개선이 적절히 이루어졌다.

---

## 요약

이번 변경의 테스트 관련 핵심은 이전 리뷰 W1(resolveParallelEngineFlag read-once 캐시 회귀 가드 누락) 해소를 위한 두 신규 테스트 케이스 추가다. cold/warm 두 경로를 각각 독립 테스트로 분리해 의도가 명확하며, 기존 `MAX_NODE_ITERATIONS` 패턴을 일관성 있게 준용하고 있다. 다만 cold 테스트에서 private 필드를 `as unknown as` 이중 캐스팅으로 직접 조작하는 방식은 리팩터 내성이 낮고, `PARALLEL_ENGINE` mock 반환값 'v1' 의 출처가 테스트 코드 내에서 자명하지 않아 격리성·가독성 개선의 여지가 있다. 나머지 변경(주석 5+2곳 rename)은 순수 문서화 수준으로 테스트 커버리지에 영향을 주지 않는다. 전반적으로 기능 회귀 위험은 없고 Critical/Warning 수준의 테스트 결함은 발견되지 않는다.

---

## 위험도

LOW

STATUS: SUCCESS
