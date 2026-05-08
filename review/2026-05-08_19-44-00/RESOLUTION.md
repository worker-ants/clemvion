# RESOLUTION — 2026-05-08_19-44-00 ai-review 조치

대상 범위: `474e25aa..HEAD` (PR-1~4 + spec/plan 갱신).

발견 분포: Critical 0 / Warning 9 / Info 17. **Warning 전건 + 핵심 Info 11건 즉시 조치.** 6건 Info 는 deferred (사유 명시).

## Warning 조치

### W1 — `loop.count` 미설정 시 동작 변경 (silent → throw)

**판단**: 의도적 동작 변경. 기존 `Number(undefined ?? 0)` 의 silent 0회 실행은 사용자 입장에서 "왜 안 도는지" 진단이 어려운 무음 실패였다. `coerceContainerNumber` 가 throw 하면 명시적 `INVALID_CONTAINER_PARAM` 에러로 즉시 surface. 또한 schema 의 `loop:no-count` warning 이 design-time 에 미설정을 catch 하므로 사용자는 이 throw 에 도달하기 어렵다.

**조치**: 의도적 변경임을 명시하는 통합 테스트 1건 추가 — `count: undefined` 인 워크플로우 실행 시 body 미실행 + execution 이 FAILED 상태로 마감되는지 확인. 코드 주석에 "Behavioural change vs. pre-fix engine" 명시.

위치: `execution-engine.service.spec.ts` Loop 신규 describe 마지막 case + 코멘트.

### W2 — `engineResolvedConfigCache` Readonly 미적용

**조치**: `node-handler.interface.ts` 의 필드를 `readonly engineResolvedConfigCache?: Readonly<Record<string, Readonly<Record<string, unknown>>>>` 로 강화. 핸들러는 컴파일 타임에 직접 변이 차단됨. 엔진 내부 setter 만이 캐시를 갱신할 수 있도록 `execution-context.service.ts` 에 `MutableExecutionContext` 내부 alias + 단일 캐스팅 지점을 두었다.

JSDoc 에도 "compile-time block in TS-strict; engine writes through the dedicated setter on `ExecutionContextService`" 명시 + `@see ExpressionResolverService.buildExpressionContext` 추가 (격리 강제 위치 안내).

### W3 — fallback 체인 두 곳 중복 + 캐시 미스 silent

**조치**: 중복된 fallback (`ctx.engineResolvedConfigCache?.[id] ?? node.config ?? {}`) 을 `ExecutionEngineService.readEngineResolvedConfig(context, node)` private 메서드로 중앙화. 캐시 미스 시 `logger.warn` 한 줄로 노드 라벨/타입/ID 가 함께 노출되어 회귀가 즉시 관찰 가능.

위치: `execution-engine.service.ts` runParallel + runContainerInner 각각 `this.readEngineResolvedConfig(...)` 호출로 단일화.

### W4 — Loop 테스트의 `setTimeout(r, 200)` 타이밍 의존

**조치**: PR-2/PR-4 가 추가한 신규 컨테이너 테스트 7건 모두 `flushPromises()` 로 통일 (Loop 5건 + Loop undefined 회귀 1건 + ForEach errorPolicy 'skip' 1건 + ForEach errorPolicy 'continue' 1건 + Parallel 클램프 1건). 모두 통과 확인.

기존부터 있던 동일 describe 블록의 사전 ForEach/Loop 테스트(2682, 2814) 의 `setTimeout(200)` 은 별도 PR 에서 일괄 정리 권장 — 본 조치 범위는 본 PR 가 추가한 신규 테스트만으로 한정 (기존 안정 패스 테스트의 의도치 않은 회귀 위험 회피).

### W5 — expression context 격리 invariant 검증 부재

**조치**: `expression-resolver.service.spec.ts` 의 `buildExpressionContext` describe 에 회귀 테스트 1건 추가 — `engineResolvedConfigCache` 가 채워진 ExecutionContext 로 `buildExpressionContext` 를 호출했을 때 `$node["X"].config` 는 raw 만 반환하고 `$node["X"].engineResolvedConfigCache` / `engineResolvedConfig` / `$engineResolvedConfig` 어떤 namespace 로도 노출되지 않는지 어설션.

미래에 `buildExpressionContext` 를 수정하여 실수로 캐시를 spread 하면 이 테스트가 즉시 깨진다.

### W6 — plan 문서가 `in-progress/` 잔류

**조치**: 본 RESOLUTION 작성 + 최종 커밋 직후 `git mv plan/in-progress/expression-config-bug.md plan/complete/expression-config-bug.md` 실행 (TEST WORKFLOW 재통과 후).

### W7 — 매직 넘버 `2`, `16` 두 곳 반복

**조치**: `execution-engine.service.ts` 모듈 상단에 `PARALLEL_BRANCH_COUNT_MIN/MAX`, `PARALLEL_MAX_CONCURRENCY_MIN/MAX` 4개 명명 상수 추출 + JSDoc 으로 각 경계의 의미 (단일 분기 무의미 / 사양 안전 한계 / 0 = unbounded) 설명.

### W8 — `INVALID_CONTAINER_PARAM:` 문자열 5곳 반복

**조치**: `coerce-container-param.ts` 모듈 상단에 `INVALID_PARAM_PREFIX` 상수 추출. 5개 throw 지점 모두 템플릿 리터럴이 상수를 참조하도록 수정.

### W9 — `// engine-config-bug —` 인라인 주석 (CLAUDE.md "현재 태스크 참조 금지" 위반)

**조치**: 변경된 파일 4곳의 `// engine-config-bug —` 접두어를 모두 제거. 설명 본문은 유지하되 "Phase 3 raw-echo 패턴 + Principle 7" 같은 배경 정보만 남김 (코드 자체에서 이해 가능한 형태).

위치: `execution-engine.service.ts` runParallel + runContainerInner + executeNode 의 setEngineResolvedConfig 호출 직전 주석.

---

## Info 조치

### I1 — `setEngineResolvedConfig` dead-code null 체크

**조치**: `createContext` 가 항상 `{}` 로 초기화하므로 `if (!cache)` 분기는 happy-path 에서 도달 불가. 하지만 향후 Redis 직렬화/복원 시점이나 새 setter 가 추가될 때를 대비한 cheap defensive guard 라고 판단해 유지 + 코멘트로 의도 명시 ("Cheap to keep; defends against future plumbing regressions.").

### I2 — `resolvedConfig` shallow copy 미적용

**조치**: `setEngineResolvedConfig` 진입 시 `{ ...resolvedConfig }` shallow copy 적용. 호출자가 이후 자기 로컬 객체를 변형해도 캐시는 격리.

### I3 — 에러 메시지의 `JSON.stringify` truncate

**조치**: `coerce-container-param.ts` 에 `previewValue(value)` 헬퍼 + `ERROR_VALUE_PREVIEW_LIMIT = 100` 상수. 모든 throw 지점이 raw `JSON.stringify` 대신 `previewValue` 를 사용하도록 변경. 시크릿/거대 객체가 에러 로그로 새는 위험 차단.

### I4 — `fail()` 글로벌 사용 (Jest 27+ deprecation)

**조치**: `coerce-container-param.spec.ts` 의 try/catch + `fail()` 패턴을 `expect.assertions(N) + .toThrow(/regex/)` 로 교체.

### I5 — `-Infinity` 케이스 누락

**조치**: `coerceContainerNumber` 의 NaN/Infinity 테스트에 `-Infinity` 케이스 추가.

### I6 — `errorPolicy: 'continue'` 미검증

**조치**: ForEach `errorPolicy: 'continue'` 회귀 테스트 1건 추가 — `'skip'` 동일 시나리오. 두 정책의 observable 차이가 향후 코드 변경에서 발생할 경우 즉시 catch.

### I7 — `branchCount` 클램핑 경계값 미검증

**조치**: Parallel `branchCount: '{{20}}'` 표현식 → 16 분기로 클램프되는 e2e 테스트 추가. 하한(`{{1}}` → 2) 은 기존 typeof 테스트가 default 2 fallback 로 커버하므로 별도 추가 안 함.

### I8 — `coerceContainerBoolean` 대소문자 계약 미문서화

**조치**: `'TRUE'` / `'False'` 가 throw 하는 동작을 명시하는 테스트 1건 추가 + JSDoc 에 "case-sensitive" 표기.

### I9 — `coerceContainerNumberOptional(0)` 미검증

**조치**: `0` 과 `'0'` 을 round-trip 으로 받는 테스트 1건 추가 + JSDoc 에 "literal 0 is a valid finite number and DOES round-trip through the helper" 명시.

### I11 — `UNRESOLVED_EXPRESSION_PATTERN` greedy 동작 미문서화

**조치**: 정규식 위에 JSDoc 으로 "any string containing the template marker pair anywhere is treated as an unresolved expression" 명시 + 의도("partially evaluated mixed string ... must surface an error rather than be silently coerced") 설명.

### I12 — `coerceContainerNumberOptional` JSDoc `null` 누락

**조치**: JSDoc 을 "value is `undefined` or `null`" 로 수정 + literal 0 round-trip 보충 설명.

### I13 — `engineResolvedConfigCache` 격리 강제 위치 미명시

**조치**: 필드 JSDoc 에 `@see ExpressionResolverService.buildExpressionContext` + "The omission is enforced inside `buildExpressionContext`" 한 줄 추가.

---

## Deferred (조치 보류)

| # | 사유 |
| --- | --- |
| I10 | Mock parallelHandler 의 echo 패턴 일치 명시 — 실 핸들러와의 동치는 다른 PR(parallel handler raw-echo 마이그레이션)에서 이미 검증됨. 별도 주석은 노이즈. |
| I14 | `resolveContainerConfigViews` 헬퍼 추출 — `readEngineResolvedConfig` 만으로 중복의 핵심 부분(폴백 + warn) 은 이미 중앙화. 변수 두 개 추출까지 묶는 헬퍼는 현 시점 ROI 낮음. |
| I15 | `ContainerErrorPolicy` 타입을 `container-types.ts` 로 이동 — 현재 소비자 1개. 분리 비용 > 이득. |
| I16 | `INVALID_CONTAINER_PARAM` 에러 코드 spec 등록 — 사용자/외부 호출자가 보는 에러는 아니고 엔진 내부 invariant violation 신호. 에러 처리 spec 의 등록 대상 외. |
| I17 | Redis 전환 시 직렬화/원자성 — 현재 in-memory 구현 범위 외. 전환 PR 시 함께 설계. |
| W4 (부분) | 기존 ForEach/Loop 테스트(2682, 2814)의 `setTimeout(200)` — 별도 정리 PR 권장. 본 PR 신규 테스트만 `flushPromises` 로 통일. |

---

## 검증 — TEST WORKFLOW 재통과

- lint: clean (eslint --fix 자동 적용)
- unit test: **170 suite / 2830 pass** (조치 전 2824 → +6 신규: -Infinity, 0 round-trip, TRUE/False 대소문자, expression context 격리, errorPolicy continue, branchCount 클램프 + Loop count undefined throw)
- build: clean

ExecutionEngine module: 13 suite / **272 pass** (조치 전 264 → +8: 위 6 + Loop count undefined + ForEach 'continue').

## 후속 처리

- 본 RESOLUTION 커밋 + 조치 코드 동일 단일 커밋 으로 묶음.
- `git mv plan/in-progress/expression-config-bug.md plan/complete/expression-config-bug.md` 실행 (W6).
- review/2026-05-08_19-44-00/ 디렉토리 자체는 자동 추적 대상 (raw 산출물 + 본 RESOLUTION).
