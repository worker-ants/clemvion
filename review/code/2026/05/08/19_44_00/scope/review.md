## 발견사항

- **[INFO]** Loop `count` 필드의 undefined 처리 동작 변경
  - 위치: `execution-engine.service.ts` — `runContainerInner`, Loop 분기
  - 상세: 기존 `Number(resolvedConfig.count ?? 0)` 는 `count` 미설정 시 0회(silent) 처리했으나, 변경 후 `coerceContainerNumber(engineResolvedConfig.count, 'count', 'loop')` 는 `undefined` 입력 시 throw. Parallel의 `branchCount ?? 2` 패턴처럼 기본값을 전달(`engineResolvedConfig.count ?? 0`)하거나 `coerceContainerNumberOptional`을 사용하지 않으면 count 미설정 워크플로우에서 런타임 에러 발생 가능.
  - 제안: `coerceContainerNumber(engineResolvedConfig.count ?? 0, 'count', 'loop')` 로 기존 동작(미설정 시 0회 실행) 보존 여부를 의식적으로 결정할 것. 계획 문서에는 0/음수 입력은 "schema validate 에서 잡힌다"고 기술되어 있어 실운영 경로에서는 안전할 수 있으나, 동작 변화임.

- **[INFO]** `setEngineResolvedConfig` 내 방어 가드 중복
  - 위치: `execution-context.service.ts:56-58`
  - 상세: `createContext`에서 이미 `engineResolvedConfigCache: {}` 로 초기화하므로 메서드 내부의 `if (!context.engineResolvedConfigCache) { ... }` 분기는 도달 불가. 기능적 문제는 없으나 `setStructuredOutput` 패턴을 그대로 복사하며 발생한 dead code.
  - 제안: 가드 제거 또는 주석으로 이유 명시. 단, `structuredOutputCache`가 동일 패턴을 유지 중이므로 일관성 명목으로 존재시킬 수도 있음.

- **[INFO]** Parallel e2e 테스트의 handler mock이 `context.rawConfig` 를 참조
  - 위치: `execution-engine.service.spec.ts` — `engine-config-bug — uses evaluated branchCount` 테스트
  - 상세: mock parallelHandler가 `context.rawConfig ?? config` 로 echo config를 구성하며 실제 ParallelHandler의 Phase 3 raw-echo 패턴을 시뮬레이션. 이는 의도된 설계이나, 실제 `ParallelHandler` 핸들러가 이미 등록된 `handlerRegistry.register('parallel', parallelHandler)` 호출이 이전 핸들러를 덮어쓰는 부분이 명시적이지 않음. 기능에는 영향 없음.

---

## 요약

변경 범위는 plan 문서(`expression-config-bug.md`)에 명시된 PR-1~4 구현 의도와 정확히 일치한다. 7개 소스 파일 모두 `engineResolvedConfigCache` 도입·활용·문서화라는 단일 목적에 집중되어 있으며, 관련 없는 리팩토링·기능 추가·포맷팅 변경은 발견되지 않았다. 코드 주석 밀도가 높지만 아키텍처 의사결정(echo 채널 vs 엔진 동작 채널 분리)의 근거를 보존하는 용도로 허용 가능하다. 단 Loop `count` undefined 처리의 동작 변화(silent 0회 → throw)는 의도적인지 확인이 필요하다.

## 위험도

**LOW**