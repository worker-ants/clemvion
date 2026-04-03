### 발견사항

- **[WARNING]** `ExecutionContext`에 `expressionContext` 직접 주입 — 암묵적 채널 안티패턴
  - 위치: `execution-engine.service.ts:578`, `node-handler.interface.ts:18`
  - 상세: `context.expressionContext = exprContext`로 실행 중에 컨텍스트 객체를 뮤테이션하여 핸들러에 데이터를 전달하고 있습니다. `ExecutionContext`는 실행 범위의 상태(ID, 변수, 캐시)를 담는 객체인데, 표현식 평가 컨텍스트(`ExpressionContext`)까지 혼재시켜 두 개의 서로 다른 관심사를 하나의 인터페이스에 결합시킵니다. 이는 암묵적인 side-channel이며, `tableHandler.execute()`가 `ExpressionResolverService`의 내부 산출물에 의존하는 비명시적 계약이 됩니다.
  - 제안: `execute()` 시그니처를 변경하거나, `TableHandler`가 필요로 하는 `ExpressionContext`를 `resolvedConfig` 내 별도 필드로 전달하는 것이 더 명확합니다. 또는 `NodeHandler.execute()`의 세 번째 인자를 `ExecutionContext & { expressionContext?: ExpressionContext }` 대신 별도 타입으로 분리하세요.

- **[WARNING]** `TableHandler`가 표현식 평가 레이어(`ExpressionResolverService`)를 우회하여 직접 `evaluate()`를 호출
  - 위치: `table.handler.ts:103`, `table.handler.ts:162`
  - 상세: 아키텍처상 표현식 해석은 `ExpressionResolverService`가 담당하고, 핸들러는 이미 해석된 config를 받아 비즈니스 로직을 수행하는 설계입니다. 그런데 `TableHandler`가 `@workflow/expression-engine`의 `evaluate()`를 직접 호출함으로써 이 레이어 경계를 위반합니다. 만약 표현식 엔진의 평가 방식이 바뀌면 `ExpressionResolverService`와 `TableHandler` 두 곳을 모두 수정해야 합니다.
  - 제안: `columns` 필드를 `EXPRESSION_EXCLUSIONS`에서 제외하고, `ExpressionResolverService`에 배열 내 아이템별 컨텍스트를 주입하는 메커니즘(예: `resolveConfigPerItem(config, itemContextFactory)`)을 추가하여 표현식 해석 책임을 서비스 레이어에 유지하세요.

- **[WARNING]** `col.field`를 row key로 사용하는 설계 — expression 문자열이 키가 됨
  - 위치: `table.handler.ts:104-109`
  - 상세: `{{ $sourceItem.first + " " + $sourceItem.last }}`와 같은 표현식 문자열 자체가 row 객체의 key로 저장됩니다(`row[col.field] = ...`). 테스트에서도 이 문자열 키로 직접 접근합니다. 이는 데이터 모델이 구현 세부사항(표현식 문법)에 종속되는 구조로, 클라이언트가 이 key를 그대로 받게 되면 API 계약이 표현식 문법에 결합됩니다.
  - 제안: 표현식 필드는 평가 후 `col.field`를 그대로 key로 쓰지 말고, 별도의 alias(예: `col.alias ?? col.field`)나 인덱스 기반 key를 사용하여 출력 데이터 구조를 구현 세부사항으로부터 분리하세요.

- **[INFO]** `resolveColumnLabels()`에서 `source`/`sourceArray` 계산 중복
  - 위치: `table.handler.ts:138-160` vs `table.handler.ts:96-100`
  - 상세: `execute()`와 `resolveColumnLabels()` 양쪽에서 동일한 `source = config.dataSource ?? input`, `sourceArray = Array.isArray(source) ? source : [source]` 로직이 반복됩니다. 단일 책임 원칙 위반은 아니나, 로직 변경 시 두 곳을 동시에 수정해야 하는 취약점입니다.
  - 제안: `normalizeSourceArray(config, input): unknown[]` private 메서드로 추출하세요.

- **[INFO]** `ExpressionContext` 인터페이스 확장 방식
  - 위치: `evaluator.ts:38-40`
  - 상세: `$dataSource`, `$sourceItem`, `$sourceItemIndex`를 공유 `ExpressionContext` 인터페이스에 직접 추가했습니다. 이 변수들은 Table 핸들러 전용 컨텍스트이므로, 향후 다른 핸들러들도 각자의 전용 변수를 인터페이스에 추가하면 인터페이스가 비대해질 수 있습니다.
  - 제안: `[key: string]: unknown` 인덱스 시그니처가 이미 존재하므로, Table 전용 변수는 타입 선언 없이 런타임에 동적으로 주입하거나, `ExpressionContext`를 base로 하는 핸들러별 확장 타입을 별도 정의하는 방식을 고려하세요.

---

### 요약

이번 변경의 핵심 목적(Table 핸들러의 per-item 표현식 평가)은 타당하며, `EXPRESSION_EXCLUSIONS`를 통한 사전 해석 차단과 핸들러 내 지연 평가 조합은 기능적으로 올바른 접근입니다. 그러나 아키텍처 관점에서 두 가지 중요한 레이어 경계 위반이 존재합니다: (1) `ExecutionContext`를 통한 암묵적 `expressionContext` 전달로 실행 컨텍스트와 표현식 컨텍스트의 책임이 혼재되고, (2) 표현식 해석 전담 레이어를 우회하여 핸들러가 직접 `evaluate()`를 호출함으로써 향후 표현식 엔진 변경 시 핸들러 코드도 함께 수정해야 하는 결합도가 발생했습니다. 또한 expression 문자열이 row key로 노출되는 구조는 API 계약 안정성에 잠재적 위험이 됩니다.

### 위험도

**MEDIUM**