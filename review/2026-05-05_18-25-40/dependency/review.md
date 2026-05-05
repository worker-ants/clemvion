### 발견사항

---

- **[INFO]** `@workflow/expression-engine` 내부 패키지 신규 import
  - 위치: `filter.handler.ts:1-4`
  - 상세: `evaluate`, `ExpressionContext`를 `@workflow/expression-engine`에서 가져옴. 플랜 문서에서 명시한 TableHandler 선례와 동일 패턴이며, backend-only 핸들러 파일에 한정된 import로 번들 오염 없음.
  - 제안: 이상 없음. 기존 선례를 따른 적절한 의존 추가.

---

- **[WARNING]** `Condition.field: string → unknown` — 공유 인터페이스 파괴적 타입 변경
  - 위치: `condition-eval.util.ts:38`
  - 상세: `_shared/` 아래 공유 인터페이스이므로 `filter` 외 `if-else` 핸들러 등 다른 consumers도 `Condition`을 사용할 가능성이 있음. 타입이 `unknown`으로 완화됨에 따라 해당 consumers에서 `condition.field`를 `string`으로 직접 사용하던 코드는 TypeScript 컴파일 오류가 발생함 — 이는 런타임 버그를 방지하므로 의도된 결과이나, 빌드 전 다른 consumer 영향 범위를 확인해야 함.
  - 제안: `grep -r "condition\.field" backend/src/nodes/logic` 로 `_shared/condition-eval.util` 을 사용하는 모든 지점을 확인하고, 특히 `if-else` 핸들러가 `field`를 string으로 narrow 없이 사용하는 곳이 있는지 검증할 것.

---

- **[WARNING]** VALID_OPS 연산자 목록 이중 관리 (operator whitelist 중복)
  - 위치: `filter.schema.ts:103-121` vs `condition-eval.util.ts:3-18`
  - 상세: `filter.schema.ts`의 `validateFilterConfig` 내 `VALID_OPS` Set은 `condition-eval.util.ts`의 `VALID_OPERATORS` 배열과 동일한 목록을 인라인으로 복사. 코멘트로 이유("프론트엔드 번들에 server-side 모듈 유입 방지")를 설명하고 있으나, 향후 연산자 추가·제거 시 두 곳을 동시에 갱신해야 하는 유지보수 위험이 존재.
  - 제안: 단기적으로는 현 상태 유지가 적절(번들 분리 요건 때문). 단, 두 목록 간 diff 를 CI에서 자동 검증하는 테스트를 추가하거나, `filter.schema.ts` 상단에 "MUST STAY IN SYNC WITH condition-eval.util.ts VALID_OPERATORS" 주석을 명시하여 동기화 누락을 방지할 것.

---

- **[INFO]** `compileRegexCache` export가 filter에서 사용 중단됨
  - 위치: `condition-eval.util.ts` (export 유지) / `filter.handler.ts` (더 이상 import 안 함)
  - 상세: filter 핸들러는 사전 컴파일 모델(`compileRegexCache`) 대신 per-item 메모이즈 방식(`regexCache Map`)으로 교체. `compileRegexCache`는 `condition-eval.util.ts`에 여전히 export되어 있으므로 다른 consumer(e.g. if-else 핸들러)가 사용 중이면 영향 없음. 사용처가 없다면 dead export가 될 수 있으나, 현재 변경 범위에서는 문제 없음.
  - 제안: if-else 핸들러 등 다른 consumer가 `compileRegexCache`를 사용하지 않는다면 향후 정리 검토.

---

- **[INFO]** `context.expressionContext` — ExecutionContext 인터페이스 선언 확인 필요
  - 위치: `filter.handler.ts:66`
  - 상세: `context.expressionContext ?? {}` 접근이 `ExecutionContext` 인터페이스에 `expressionContext?: EngineContext` 선언이 없다면 TypeScript 오류. 테스트 픽스처(`{ executionId, workflowId, variables, nodeOutputCache }`)에는 해당 필드가 없어 `??` fallback으로 동작하지만, 타입 안전성은 인터페이스 선언 여부에 달림.
  - 제안: `node-handler.interface.ts`에 `expressionContext?: EngineContext` 선언이 있는지 확인. 없다면 추가하거나 타입 단언(`as any`)을 사용하는 현재 패턴을 타입 선언으로 교체.

---

### 요약

이번 변경의 신규 외부 의존성은 없으며, 추가된 `@workflow/expression-engine` import는 기존 TableHandler가 이미 확립한 내부 패턴을 따른 것으로 적절하다. 주요 의존성 위험은 두 가지: (1) `Condition.field` 타입을 `string → unknown`으로 완화한 공유 인터페이스 변경이 `if-else` 등 다른 consumer에 컴파일 오류를 유발할 수 있으므로 빌드 전 영향 범위 확인이 필요하고, (2) 연산자 목록의 이중 관리가 향후 연산자 추가 시 동기화 누락 위험을 내포한다. 나머지 변경(import 조정, regex 캐시 교체)은 의존성 관점에서 안전하다.

### 위험도

**LOW**