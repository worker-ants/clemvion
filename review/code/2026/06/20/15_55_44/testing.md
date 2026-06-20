# Testing Review — test-gaps-signal-paralleldepth

## 발견사항

### [INFO] parallel-p2-integration.spec.ts: 커버리지 재분배는 명확히 문서화됨
- 위치: `codebase/backend/src/modules/execution-engine/__test__/parallel-p2-integration.spec.ts` 헤더 JSDoc
- 상세: nested-depth `PARALLEL_NESTED_DEPTH_EXCEEDED` 런타임 가드가 `execution-engine.service.spec.ts` 로 이전되었고, 정적 save-time 규칙은 `parallel.schema.spec.ts` 가 커버한다는 사실이 명시적으로 문서화되어 있다. 커버리지 공백이 아니라 의도적 재배치로, spec 파일 간 테스트 책임이 명확히 구분된다.
- 제안: 현행 유지. 다만 세 파일(parallel-p2-integration, execution-engine.service.spec, parallel.schema.spec) 간 책임 분할이 장기적으로 새 기여자에게 불투명할 수 있으므로, `parallel-p2-integration.spec.ts` JSDoc 의 현행 설명 수준을 유지할 것.

### [INFO] concurrency clamp: 경계값(floor → 1) 케이스 미검증
- 위치: `parallel-p2-integration.spec.ts` 167-208행, `nested Parallel concurrency cap silent clamp` 블록
- 상세: `parentEffective=32, intended=8` 케이스(floor(32/32)=1, clamp to 1)가 없다. 현재 두 케이스는 clamp 발생(parentEffective=16→actual=2)과 no-clamp(8×4=32)만 검증한다. floor 계산이 0이 되는 극단값(parentEffective=33 → floor(32/33)=0, 최소 1로 clamp)도 미검증.
- 제안: 비차단. `parentEffective=32` 케이스를 별도 `it` 로 추가하면 하한 경계(최소 1 브랜치 실행)를 명시적으로 검증할 수 있다.

### [INFO] cancel-others-on-fail: 이미-abort 상태 signal 처리 경로 미검증
- 위치: `parallel-p2-integration.spec.ts` 90-135행
- 상세: 현재 테스트는 `signal.addEventListener('abort', ...)` 경로를 검증한다. `if (signal.aborted)` 즉시-abort 경로도 코드에 존재하며(`fetchAbortObserved` 를 호출한다) 이 경로의 케이스가 없다. 하지만 실제 실행 순서상 branch_0이 throw하기 전에 signal이 aborted 상태가 될 가능성이 낮으므로, 의도적 생략으로 볼 수 있다.
- 제안: 비차단. signal이 이미 aborted인 상태를 시뮬레이션하는 케이스(controller.abort() 후 execute 호출)를 추가하면 양방향 경로를 완전히 커버할 수 있다.

### [INFO] waitAll=false 경로 전혀 미검증
- 위치: `parallel-p2-integration.spec.ts` 전체
- 상세: 모든 테스트가 `waitAll: true`만 사용. `waitAll: false`(fire-and-forget 병렬 실행) 에서의 에러 전파 동작, concurrency clamp 적용 여부가 미검증. 이전 SUMMARY#6에서도 언급된 기존 갭.
- 제안: 비차단. 별도 이슈로 추적 권장.

### [INFO] planParallelBody 타입 캐스팅: 컴파일 보호 없음
- 위치: `execution-engine.service.spec.ts` 254-265행
- 상세: `planParallelBody` private 메서드를 `as unknown as { planParallelBody: (...) => ... }` 로 직접 접근. TypeScript 컴파일러가 시그니처 변경을 감지하지 못해 프로덕션 메서드가 변경되어도 이 캐스트는 통과된다. 실제 호출 동작 변경 시에는 기능적으로 실패하므로 회귀 보호는 존재한다. 이전 RESOLUTION에서 "표준 private-method 테스트 패턴"으로 현행 유지 결정됨.
- 제안: 비차단. `protected`로 승격하면 타입 안전성이 향상되나, 현행 유지 결정(RESOLUTION W2)을 존중한다.

### [INFO] handlerRegistry.register 격리: 등록 정리 부재
- 위치: `execution-engine.service.spec.ts` 235-239행
- 상세: `handlerRegistry.register('parallel_depthtest', ...)` 가 `beforeEach` 내 모듈 재생성 사이클 밖에서 호출됨. `beforeEach` 가 `TestingModule` 을 매번 새로 생성하므로 실제 오염은 없으나, 테스트 파일 내에서 `afterEach(() => handlerRegistry.unregister('parallel_depthtest'))` 형태의 정리 코드가 없어 의도가 불투명하다.
- 제안: 비차단. 주석 한 줄로 "beforeEach 모듈 재생성으로 격리 보장"을 명시하면 충분하다.

### [INFO] IE single-turn abortSignal: LLM throw 시 signal 전파 경로 미검증
- 위치: `information-extractor.handler.spec.ts` 870-899행
- 상세: 추가된 테스트는 정상 완료 경로에서 signal이 전달되는지만 검증한다. LLM이 `AbortError`로 reject하거나 signal이 abort된 상태에서 실행이 시작됐을 때의 에러 경로(error port 라우팅, `LLM_CALL_FAILED` 코드) 는 미검증.
- 제안: 비차단. 신규 gap보다는 기존 단일 경로 검증으로도 signal wiring이 충분히 검증됨.

### [INFO] text-classifier abortSignal: 3번째 인자 LlmCallContext 검증 생략
- 위치: `text-classifier.handler.spec.ts` 2141-2156행
- 상세: IE 패턴(W4/W5)은 3번째 인자를 `expect.objectContaining({ executionId })` 로 검증하나, text-classifier 의 새 테스트는 3번째 인자를 `expect.anything()` 으로 생략한다. 두 핸들러가 동일한 `traceChat` 헬퍼를 경유한다면 일관성 있게 `executionId` 포함 단언을 추가할 수 있다.
- 제안: 비차단. 현재 signal wiring 자체는 검증되므로 기능적 갭 없음. 일관성 보강 권장.

## 요약

이번 변경은 전량 테스트 파일만 건드리며, 세 가지 기존 갭(text-classifier signal 전파, IE single-turn signal 전파, planParallelBody 런타임 depth 가드)을 채우는 회귀 테스트를 추가한다. 이전 리뷰(15_43_17) 에서 제기된 W1(depth=1 위상 모호성)·W3(signal 검증 패턴) 은 RESOLUTION에 따라 조치 완료되었고, 현재 diff에는 그 수정 결과인 `allBodyNodeIds.has('p3')` 단언과 `toHaveBeenCalledWith(objectContaining)` 패턴이 반영되어 있다. 커버리지 분배(depth guard → service.spec, static rule → schema.spec)는 명시적으로 문서화되어 의도적 재배치임이 분명하다. 남은 갭(concurrency clamp 하한 경계, waitAll=false, already-abort 경로, text-classifier 3번째 인자)은 모두 비차단 INFO 수준으로, 별도 이슈 추적이 적절하다.

## 위험도
LOW

STATUS: SUCCESS
