## 유지보수성 코드 리뷰

---

### 발견사항

**[WARNING]** `runParallel`의 `branchCount` 계산 중첩 깊이
- 위치: `execution-engine.service.ts` — `runParallel` 진입부 `branchCount` 계산
- 상세: `Math.max(2, Math.min(16, Math.floor(coerceContainerNumber(...))))` 3단 중첩이 한 표현식에 인라인되어 있어 상한/하한 의도를 한눈에 파악하기 어렵다.
- 제안:
  ```ts
  const raw = coerceContainerNumber(engineResolvedConfig.branchCount ?? 2, 'branchCount', 'parallel');
  const branchCount = Math.max(MIN_BRANCH_COUNT, Math.min(MAX_BRANCH_COUNT, Math.floor(raw)));
  ```

---

**[WARNING]** `2`, `16` 매직 넘버 반복 사용
- 위치: `execution-engine.service.ts` — `runParallel` branchCount/maxConcurrency 클램핑
- 상세: `Math.max(2, Math.min(16, ...))`, `Math.max(0, Math.min(16, ...))` 두 곳에 동일 경계값이 리터럴로 박혀 있다. 스펙 변경 시 한 곳을 빠뜨릴 위험이 있다.
- 제안: 파일 상단 혹은 `coerce-container-param.ts`에 `PARALLEL_BRANCH_COUNT_MIN = 2`, `PARALLEL_BRANCH_COUNT_MAX = 16` 등 명명 상수 추출.

---

**[WARNING]** echoConfig / engineResolvedConfig 이중 추출 패턴 중복
- 위치: `execution-engine.service.ts` — `runParallel` (~L3644) 및 `runContainerInner` (~L3879)
- 상세: 두 함수 모두 동일한 두 줄 패턴으로 config를 추출한다:
  ```ts
  const echoConfig = structured?.config ?? node.config ?? {};
  const engineResolvedConfig = context.engineResolvedConfigCache?.[node.id] ?? node.config ?? {};
  ```
  지금은 두 곳뿐이라 허용 범위이지만, 컨테이너 유형이 추가될 경우 같은 패턴이 3~4곳으로 확산된다.
- 제안: 소규모 헬퍼 `resolveContainerConfigViews(context, node)` 추출을 고려. 단, 현 시점 두 곳이므로 강제 사항은 아님.

---

**[WARNING]** `INVALID_CONTAINER_PARAM:` 문자열 리터럴 반복
- 위치: `coerce-container-param.ts` — `unresolvedExpressionError`, 빈 문자열 에러, NaN 에러, boolean 에러 등 5곳
- 상세: 에러 코드 문자열이 상수로 추출되지 않고 직접 리터럴로 반복된다. 오타 발생 시 `grep`으로 추적하기 어렵고, 이 에러 코드를 파싱하는 코드가 생기면 일관성 깨짐 위험이 있다.
- 제안:
  ```ts
  const INVALID_PARAM_PREFIX = 'INVALID_CONTAINER_PARAM';
  ```

---

**[WARNING]** 테스트 타이밍 불일치 — `setTimeout(r, 200)` vs `flushPromises()`
- 위치: `execution-engine.service.spec.ts` — `engine-config-bug` 테스트 블록 내 4곳
- 상세: 기존 테스트는 `await flushPromises()`를 사용하나, 신규 추가된 테스트들은 `await new Promise((r) => setTimeout(r, 200))`을 혼용한다. 타임 기반 대기는 CI 환경 부하에 따라 플래키 테스트를 유발할 수 있으며, 같은 파일 내 패턴이 이원화된다.
- 제안: 파일 내 기존 `flushPromises()` 패턴으로 통일.

---

**[INFO]** `setEngineResolvedConfig` 방어적 null 체크 불필요
- 위치: `execution-context.service.ts:52-54`
  ```ts
  if (!context.engineResolvedConfigCache) {
    context.engineResolvedConfigCache = {};
  }
  ```
- 상세: `createContext`에서 `engineResolvedConfigCache: {}`가 항상 초기화되므로 이 분기는 도달 불가다. 동일 패턴이 `setStructuredOutput`에도 있어 일관성은 유지되지만, 두 곳 모두 실질적으로 불필요하다.
- 제안: 현 상태 유지(패턴 일관성) 또는 두 메서드에서 모두 제거. 혼합 상태는 지양.

---

**[INFO]** ForEach errorPolicy 통합 테스트 케이스 길이
- 위치: `execution-engine.service.spec.ts` — `engine-config-bug — respects ForEach errorPolicy="skip"` (`it` 블록 약 147줄)
- 상세: 노드/엣지 정의가 전부 인라인으로 들어가 있어 실제 검증 의도(`skip` 정책 확인)를 찾기까지 스크롤이 많이 필요하다. 반면 동일 파일의 Loop 테스트는 `buildLoopNodes` 빌더 함수로 분리되어 더 읽기 좋다.
- 제안: `buildForEachNodes(errorPolicy)` 빌더 함수 추출로 Loop 테스트와 패턴 통일.

---

**[INFO]** `fail()` 사용 (Jest deprecated)
- 위치: `coerce-container-param.spec.ts:75`
  ```ts
  fail('expected to throw');
  ```
- 상세: Jest에서 `fail()`은 deprecated되었으며 일부 환경에서 `ReferenceError`를 유발한다.
- 제안: `expect.assertions(N)` + `expect(() => ...).toThrow(...)` 패턴으로 교체.

---

**[INFO]** `sinkHandler.execute` 재할당 후 재등록 패턴
- 위치: `execution-engine.service.spec.ts` — `preserves raw echo on $node["loop"].config` 테스트
- 상세: `beforeEach`에서 `sinkHandler`를 등록한 뒤 해당 `it` 블록 내에서 `sinkHandler.execute = jest.fn(...)`로 교체하고 `handlerRegistry.register('sink_node', sinkHandler)`를 다시 호출한다. 부작용 추적이 어렵다.
- 제안: 해당 `it` 블록 시작 시 별도 핸들러 변수를 생성하고 `handlerRegistry.register`를 그 자리에서 호출.

---

### 요약

전체적으로 이번 변경은 echo 채널과 엔진 동작 채널의 분리라는 핵심 설계 의도가 명확하게 코드에 반영되어 있고, `coerce-container-param.ts`의 헬퍼 함수들은 단일 책임 원칙을 잘 따르며 에러 메시지도 진단 친화적이다. 다만 `runParallel`의 branchCount 클램핑 표현식 중첩, 매직 넘버 2/16, 에러 코드 문자열 리터럴 반복 등 몇 가지 소규모 추출 작업이 남아 있으며, 테스트에서 `setTimeout` vs `flushPromises` 혼용은 파일 내 일관성을 해치고 플래키 위험을 만든다. 구조적 결함이나 심각한 복잡도 문제는 없으므로 전반적인 유지보수성은 양호하다.

### 위험도

**LOW**