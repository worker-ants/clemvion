## 발견사항

### WARNING 1: `loop.count` 미설정 시 동작 변경 (무음 처리 → throw)
- **위치:** `execution-engine.service.ts` `runContainerInner` 분기, `coerce-container-param.ts:46`
- **상세:** 구 코드는 `Number(resolvedConfig.count ?? 0)` — `count` 누락 시 0회 실행(무음 처리). 신 코드는 `coerceContainerNumber(engineResolvedConfig.count, 'count', 'loop')` — `count`가 `undefined`이면 `INVALID_CONTAINER_PARAM` 예외. Parallel의 `branchCount ?? 2` 패턴과 비대칭. 스키마 검증이 앞단에서 차단하더라도, `engineResolvedConfigCache` 캐시 미스 후 `containerNode.config`로 폴백한 경우(`{}`) 에도 동일하게 throw.
- **제안:** `coerceContainerNumber(engineResolvedConfig.count ?? 0, ...)` 또는 별도 `coerceContainerNumberWithDefault(value, default)` 오버로드 사용. 아니면 "count 미설정 → throw" 의도가 명확한 것이라면 통합 테스트(`buildLoopNodes(undefined)` / `buildLoopNodes({})`)를 추가해 의도된 변경임을 명시.

---

### WARNING 2: `engineResolvedConfigCache` 미노출(expression context 격리) 불변 조건을 검증하는 테스트 없음
- **위치:** `execution-engine.service.spec.ts` (전체), `spec/5-system/4-execution-engine.md` §6.1
- **상세:** 스펙과 plan 모두 "*`engineResolvedConfigCache` 는 expression context에 노출하지 않는다*"를 핵심 불변 조건으로 명시했다. 신규 테스트 30건 중 `$node["loop"].config.count` 가 raw echo인지 검증하는 케이스(`preserves raw echo`)는 있으나, `$node["loop"].engineResolvedConfigCache` 나 이와 동등한 경로로 평가된 값이 **expression resolver에서 접근 불가**인지 검증하는 테스트가 없다. `buildExpressionContext` 수정 실수 혹은 future regression 탐지 불가.
- **제안:** `expression-resolver.service.spec.ts` 또는 통합 테스트에 `$node["loop"].engineResolvedConfigCache` 접근 시 `undefined` 반환(또는 키 자체 없음)을 어설션하는 케이스 추가.

---

### WARNING 3: `engineResolvedConfigCache` 타입 — 스펙의 `Readonly` 의도 미반영
- **위치:** `node-handler.interface.ts:35`, plan §수정 대상 #2
- **상세:** plan은 `Readonly<Record<string, Record<string, unknown>>>` 로 노출하도록 명시했으나 실제 선언은 `Record<string, Record<string, unknown>>` (mutable). 핸들러가 `ctx.engineResolvedConfigCache['loop']['count'] = 99` 같은 변이를 시도해도 컴파일 에러가 발생하지 않는다. `structuredOutputCache`도 같은 패턴이지만, `engineResolvedConfig` 캐시는 "평가된 스냅샷을 엔진만 쓴다"는 소유권이 더 강하다.
- **제안:** `engineResolvedConfigCache?: Readonly<Record<string, Readonly<Record<string, unknown>>>>` 으로 선언. 또는 최소한 최상위 `Readonly` 적용.

---

### INFO 1: `preserves raw echo` 불변 조건 테스트가 리터럴 표현식(`{{3}}`)만 커버
- **위치:** `execution-engine.service.spec.ts` 라인 약 2940 (preserve raw echo 케이스)
- **상세:** plan의 검증 항목에는 `{{3}}`, `{{$var.n}}`, `{{$node["src"].output.n}}` 세 가지가 모두 포함됐으나, Principle 7 raw echo 불변 조건 테스트는 `{{3}}` 리터럴 전용. 노드 참조 표현식(`{{ $node["src"].output.n }}`)은 이터레이션 횟수 테스트만 존재하고 echo 값은 검증하지 않는다.
- **제안:** 기존 `iterates per upstream output when count references a node expression` 케이스에 `capturedEchoCount === '{{ $node["src"].output.n }}'` 어설션 추가.

---

### INFO 2: Parallel 통합 테스트가 실제 `ParallelHandler` 대신 mock handler 사용
- **위치:** `execution-engine.service.spec.ts` 약 3889–3900 (`engine-config-bug — uses evaluated branchCount`)
- **상세:** `parallelHandler` 를 `handlerRegistry.register('parallel', parallelHandler)` 로 교체해 실제 `ParallelHandler` 코드를 우회한다. 실제 핸들러의 raw echo 패턴(`rawConfig.branchCount` 사용)과 mock의 echo 로직이 다를 경우 버그 재현이 불완전할 수 있다.
- **제안:** 가능하면 실제 `ParallelHandler` 인스턴스를 주입하거나, 적어도 mock이 실제 핸들러의 echo 로직과 동일하게 `rawConfig.branchCount` 를 사용함을 주석으로 명시(현재 `Use a handler that echoes raw branchCount` 주석은 있으나 실 handler와의 동일성 보장 없음).

---

### INFO 3: `setEngineResolvedConfig` 내 방어 코드(`if (!context.engineResolvedConfigCache)`) 잉여
- **위치:** `execution-context.service.ts:54–56`
- **상세:** `createContext` 에서 `engineResolvedConfigCache: {}` 로 항상 초기화하므로 `setEngineResolvedConfig` 내 null-guard는 dead code. `setStructuredOutput` 에도 동일 패턴이 있어 일관성은 유지된다. 기능적 문제는 없음.

---

## 요약

요구사항 충족도는 전반적으로 높다. plan에 정의된 네 PR의 핵심 요구사항(engineResolvedConfigCache 분리, Loop/Parallel/ForEach 표현식 평가 채널 분리, coerce 헬퍼 도입)은 모두 구현됐으며 30건의 신규 테스트가 주요 경로를 커버한다. 다만 **loop.count 미설정 시 throw 변경**은 기존 `Number(... ?? 0)` 대비 명시되지 않은 동작 변경이고, **expression context 격리 불변 조건(Principle 7)에 대한 테스트 공백**은 장기적으로 regression을 놓칠 위험이 있다. `engineResolvedConfigCache` 타입이 스펙의 `Readonly` 의도를 반영하지 않은 점도 보완이 필요하다.

## 위험도

**MEDIUM** — 기능 정확성 자체는 확보됐으나, 미설정 count 동작 변경과 expression context 격리 불변 조건 미검증이 잠재적 runtime 오류 또는 future regression 경로를 열어둔다.