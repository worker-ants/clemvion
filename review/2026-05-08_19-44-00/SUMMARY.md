파일 쓰기 권한이 필요합니다. 아래는 작성된 통합 보고서 전문입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 기능 동작은 올바르나, `loop.count` 미설정 동작 변경(silent → throw)과 expression context 격리 불변 조건 검증 공백이 잠재적 런타임 오류 및 future regression 경로를 열어 둔다.

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/스코프 | **`loop.count` 미설정 시 동작 파괴적 변경** — 기존 `Number(... ?? 0)` 은 0회 무음 처리였으나 `coerceContainerNumber(engineResolvedConfig.count, ...)` 는 `undefined` 시 throw. `branchCount ?? 2` 기본값 패턴과 비대칭이며 캐시 미스 + `{}` 폴백 경로에서도 throw | `execution-engine.service.ts` runContainerInner Loop 분기, `coerce-container-param.ts:46` | `coerceContainerNumber(engineResolvedConfig.count ?? 0, ...)` 로 기존 동작 보존 여부를 의식적으로 결정하거나, 의도적 변경이라면 `buildLoopNodes(undefined)` 통합 테스트로 명시 |
| 2 | 아키텍처/보안 | **`engineResolvedConfigCache`가 핸들러 공개 인터페이스에 노출 (ISP 위반 + Readonly 미적용)** — JSDoc은 "engine paths only"라고 명시하지만 타입 시스템이 핸들러의 직접 읽기·쓰기를 막지 않음. plan이 `Readonly` 적용을 명시했으나 미반영 | `node-handler.interface.ts:35–37` | `readonly engineResolvedConfigCache?: Readonly<Record<string, Readonly<Record<string, unknown>>>>` 로 변경 |
| 3 | 아키텍처/부작용 | **fallback 체인(`?? node.config ?? {}`) 두 곳 중복 — 캐시 미스 버그를 silent하게 은폐** — `runParallel`·`runContainerInner` 모두 동일 패턴 인라인. fallback이 실행되면 원래 버그(NaN 루프 등)가 재발하나 감지 불가 | `execution-engine.service.ts` runParallel/runContainerInner 진입부 | 폴백 진입 시 `logger.warn('engineResolvedConfigCache miss for node %s', nodeId)` 추가. 장기적으로 서비스 메서드로 중앙화 |
| 4 | 테스트 | **Loop 테스트의 `setTimeout(r, 200)` 타이밍 의존 — CI 플래키 위험** — 같은 PR의 Parallel 테스트는 `flushPromises()` 사용, Loop 테스트 5건은 고정 딜레이. 200ms × 다수 케이스 = 실행 시간 낭비 + CI 부하 시 간헐적 실패 | `execution-engine.service.spec.ts` Loop 신규 테스트 전체 | 파일 내 기존 `flushPromises()` 패턴으로 통일 |
| 5 | 테스트/요구사항 | **expression context 격리 불변 조건(`engineResolvedConfigCache` 미노출) 검증 테스트 없음** — 스펙·plan이 핵심 불변 조건으로 명시했으나 `buildExpressionContext` 실수 시 regression 감지 불가 | `expression-resolver.service.spec.ts` 부재 | `$node["x"].engineResolvedConfigCache` 접근 시 `undefined` 반환을 어설션하는 테스트 1건 추가 |
| 6 | 문서/프로세스 | **plan 문서가 완료 후에도 `in-progress/`에 잔류** — 문서 자체가 `git mv`로 이동을 잔여 항목으로 명시하고 있으나 미처리 | `plan/in-progress/expression-config-bug.md` | `git mv plan/in-progress/expression-config-bug.md plan/complete/expression-config-bug.md` 실행 |
| 7 | 유지보수성 | **매직 넘버 `2`, `16` 두 곳 반복** — `branchCount`·`maxConcurrency` 클램핑에 동일 경계값 리터럴 중복. 스펙 변경 시 한 곳 누락 위험 | `execution-engine.service.ts` runParallel 클램핑 구간 | `PARALLEL_BRANCH_COUNT_MIN = 2`, `PARALLEL_BRANCH_COUNT_MAX = 16` 명명 상수 추출 |
| 8 | 유지보수성 | **`INVALID_CONTAINER_PARAM:` 문자열 리터럴 5곳 반복** — 오타 발생 시 grep 추적 어렵고 일관성 깨짐 위험 | `coerce-container-param.ts` 에러 throw 구문 전체 | `const INVALID_PARAM_PREFIX = 'INVALID_CONTAINER_PARAM'` 상수 추출 |
| 9 | 문서 | **`// engine-config-bug —` 접두사 인라인 주석이 CLAUDE.md 지침 위반** — "현재 태스크·fix를 주석에 참조하지 말 것" 원칙과 충돌 | `execution-engine.service.ts` 변경된 주석 전체 | 접두사 제거, 설명 본문만 유지 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | **`setEngineResolvedConfig` 내 방어적 null 체크가 dead code** — `createContext`에서 항상 `{}` 초기화하므로 도달 불가. Redis 레거시 컨텍스트 역직렬화 시나리오가 있다면 오히려 유지 필요 | `execution-context.service.ts:52–55` | 레거시 복원 경로 없으면 제거. 있다면 `// for deserialized legacy contexts` 주석 추가 |
| 2 | 부작용 | **`resolvedConfig` 레퍼런스 공유 — 미래 코드 변경 시 캐시 오염 잠재 위험** — 복사 없이 전달하여 이후 변이 코드 추가 시 캐시 조용히 오염 가능 | `execution-context.service.ts` setEngineResolvedConfig | `{ ...resolvedConfig }` shallow copy 적용 권고 |
| 3 | 보안 | **에러 메시지에 사용자 입력값을 `JSON.stringify` 그대로 직렬화** — 향후 헬퍼 재사용 시 시크릿 평문 로그 노출 가능 | `coerce-container-param.ts:17–22` | `String(JSON.stringify(value)).slice(0, 100)` 등 truncate 적용 |
| 4 | 테스트 | **`fail()` 글로벌 사용 — Jest 27+ deprecation** — throw하지 않는 경우 `ReferenceError: fail is not defined` 혼동 오류 | `coerce-container-param.spec.ts:75` | `expect.assertions(N)` + `.toThrow(...)` 패턴으로 교체 |
| 5 | 테스트 | **`-Infinity` 케이스 누락** | `coerce-container-param.spec.ts` | `expect(() => coerceContainerNumber(-Infinity, 'count', 'loop')).toThrow(/not a finite number/)` 추가 |
| 6 | 테스트 | **ForEach `errorPolicy: 'continue'` 회귀 테스트 없음** — `skip`은 추가됐으나 `continue`·Map 노드 미검증 | `execution-engine.service.spec.ts` | `errorPolicy: 'continue'` 동일 시나리오 테스트 추가 |
| 7 | 테스트 | **`branchCount` 클램핑 경계값 표현식 테스트 없음** — `{{1}}` → 2, `{{20}}` → 16 경로 미검증 | `execution-engine.service.spec.ts` Parallel expression 테스트 | 경계값 케이스 추가 |
| 8 | 테스트 | **`coerceContainerBoolean` 대소문자 구분 계약 미문서화** — `"TRUE"` 등이 throw되는 의도이나 미명시 | `coerce-container-param.spec.ts` | `expect(() => coerceContainerBoolean('TRUE', ...)).toThrow(/not a boolean/)` 추가 |
| 9 | 테스트 | **`coerceContainerNumberOptional(0)` 명시적 테스트 없음** — `0`이 falsy라 잘못 처리될 위험 | `coerce-container-param.spec.ts` | `expect(coerceContainerNumberOptional(0, 'count', 'loop')).toBe(0)` 추가 |
| 10 | 테스트 | **Mock `parallelHandler`가 실제 `ParallelHandler` echo 패턴과 동일성 보장 없음** | `execution-engine.service.spec.ts` Parallel expression 테스트 | "엔진의 `engineResolvedConfigCache` 분기 검증 테스트" 주석 명시 |
| 11 | 문서 | **`UNRESOLVED_EXPRESSION_PATTERN` greedy `.*` 동작 미문서화** | `coerce-container-param.ts:12` | `// greedy — any string containing {{ }} anywhere is rejected as unresolved` 주석 추가 |
| 12 | 문서 | **`coerceContainerNumberOptional` JSDoc이 `null` 처리 누락** | `coerce-container-param.ts:65` | `undefined or null` 로 JSDoc 수정 |
| 13 | 문서 | **`engineResolvedConfigCache` 불변 조건 강제 위치 미명시** — `buildExpressionContext`에서 어떻게 배제되는지 독자가 직접 추적해야 함 | `node-handler.interface.ts` 필드 JSDoc | `@see ExpressionResolverService.buildExpressionContext` 추가 |
| 14 | 아키텍처 | **`echoConfig`/`engineResolvedConfig` 이중 추출 패턴 두 곳 중복** — 컨테이너 유형 증가 시 확산 위험 | `execution-engine.service.ts` runParallel, runContainerInner 진입부 | `resolveContainerConfigViews(context, node)` 헬퍼 추출 고려 (현 시점 필수 아님) |
| 15 | 의존성 | **`ContainerErrorPolicy` 타입이 engine-local 유틸에 선언됨** — 소비자 증가 시 이동 필요 | `coerce-container-param.ts:82` | 소비자 증가 시 `container-types.ts`로 이동 |
| 16 | API 계약 | **`INVALID_CONTAINER_PARAM` 에러 코드가 에러 처리 스펙에 미등록** | `spec/` 에러 처리 문서 | 에러 처리 스펙에 등록 |
| 17 | 보안/동시성 | **Redis 전환 시 역직렬화 호환성·원자성** — 구형 컨텍스트 역직렬화 시 필드 누락, 두 캐시 슬롯의 원자성 보장 필요 | `execution-context.service.ts` 전체 | Redis 전환 설계 시 MULTI/EXEC 또는 단일 해시 키로 묶기 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | loop.count 미설정 동작 변경 + expression context 격리 불변 조건 미검증 |
| architecture | LOW | engineResolvedConfigCache ISP 위반 + fallback 중복 |
| api_contract | LOW | 캐시 미스 시 hard throw 전환 가능성 + Readonly 미적용 |
| maintainability | LOW | setTimeout/flushPromises 혼용 + 매직 넘버 + 에러 코드 리터럴 반복 |
| performance | LOW | setTimeout 기반 테스트 타이밍 |
| scope | LOW | loop.count undefined 처리 동작 변경 |
| concurrency | LOW | setTimeout 타이밍 의존 + Redis 전환 시 원자성 |
| security | LOW | Readonly 미적용 + 캐시 미스 폴백 로그 누락 + 에러 메시지 직렬화 |
| documentation | LOW | engine-config-bug 접두사 주석 + plan in-progress 잔류 |
| side_effect | LOW | resolvedConfig 레퍼런스 공유 + expression context 노출 미검증 |
| testing | LOW | setTimeout vs flushPromises 혼용 + 경계값 테스트 누락 |
| database | NONE | in-memory 구현 범위, DB 스키마 변경 없음 |
| dependency | NONE | 신규 외부 패키지 없음, 순수 내부 리팩터링 |

---

## 발견 없는 에이전트

- **database** — 변경 범위가 in-memory 캐시에 국한, DB 스키마·마이그레이션·쿼리 영향 없음
- **dependency** — 신규 외부 패키지 0건, 순환 의존 없음

---

## 권장 조치사항

1. **[즉시 — 동작 변경 확인]** `loop.count` 미설정 시 throw가 의도인지 확인 → 의도 아니면 `?? 0` 추가, 의도라면 통합 테스트 명시
2. **[즉시 — 불변 조건 검증]** `$node["x"].engineResolvedConfigCache` 접근 시 undefined 반환을 검증하는 테스트 1건 추가
3. **[단기 — 타입 안전성]** `engineResolvedConfigCache` 필드에 `Readonly` 적용하여 핸들러 직접 변이 컴파일 타임 차단
4. **[단기 — 프로세스]** `git mv plan/in-progress/expression-config-bug.md plan/complete/expression-config-bug.md` 실행
5. **[단기 — 관찰성]** 캐시 미스 폴백 경로에 `logger.warn` 추가
6. **[단기 — 테스트 안정화]** Loop 테스트의 `setTimeout(r, 200)` → `flushPromises()` 교체
7. **[단기 — 문서]** `// engine-config-bug —` 접두사 주석 전체 제거 (CLAUDE.md 지침 준수)
8. **[개선 — 상수화]** 매직 넘버 `2`, `16` 및 `INVALID_CONTAINER_PARAM` 문자열 상수 추출
9. **[개선 — 테스트 보강]** `-Infinity`, `coerceContainerBoolean('TRUE')`, `branchCount` 클램핑 경계값, ForEach `errorPolicy: 'continue'`, `coerceContainerNumberOptional(0)` 케이스 추가
10. **[장기 — 아키텍처]** `EngineContext`와 `ExecutionContext` 분리 검토하여 엔진 내부 캐시가 핸들러 인터페이스에 직접 노출되지 않도록 경계 정리

---

SUMMARY.md를 `review/2026-05-08_19-44-00/` 에 저장하려 했으나 쓰기 권한이 없어 여기에 출력했습니다. 권한을 허용하시면 파일로 저장할 수 있습니다.