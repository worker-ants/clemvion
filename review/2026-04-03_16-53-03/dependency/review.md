### 발견사항

- **[INFO]** 내부 패키지 `@workflow/expression-engine`에서 `evaluate` 함수와 `ExpressionContext` 타입 추가 임포트
  - 위치: `table.handler.ts` 7-10행
  - 상세: 이미 프로젝트에서 사용 중인 내부 monorepo 패키지이므로 외부 의존성 추가 없음. 기존 의존 구조와 일관성 있음.
  - 제안: 문제 없음

- **[INFO]** 내부 유틸 `../logic/nested-value.util.js` 신규 임포트
  - 위치: `table.handler.ts` 11행
  - 상세: 동일 모듈 내 유틸리티 파일로, 외부 의존성 없음. 단, 해당 파일이 실제 존재하는지 확인 필요.
  - 제안: 파일 경로 `.js` 확장자는 ESM 환경에서 올바른 패턴이며 문제 없음.

- **[INFO]** `ExpressionContext` 인터페이스에 `$dataSource`, `$sourceItem`, `$sourceItemIndex` 신규 필드 추가
  - 위치: `packages/expression-engine/src/evaluator.ts` 38-40행
  - 상세: 공유 패키지(`@workflow/expression-engine`)의 인터페이스 확장. 기존 필드 방식과 일관되며, `[key: string]: unknown` 인덱스 시그니처가 이미 있어 breaking change 없음.
  - 제안: 문제 없음

- **[INFO]** `ExecutionContext` 인터페이스에 `expressionContext?: Record<string, unknown>` 추가
  - 위치: `node-handler.interface.ts` 18행
  - 상세: optional 필드 추가로 기존 구현체에 영향 없음. `ExpressionContext`(`EngineContext`) 타입 대신 `Record<string, unknown>`으로 타입을 느슨하게 정의했는데, 핸들러 내부에서 `as EngineContext`로 캐스팅하고 있어 타입 안정성이 다소 약화됨.
  - 제안: `expressionContext?: import('@workflow/expression-engine').ExpressionContext`로 타입을 명시하면 캐스팅 없이 안전하게 사용 가능. 다만 인터페이스 파일에 외부 패키지 의존이 생기는 트레이드오프 존재.

- **[WARNING]** `expression-exclusions.ts`에 `table: new Set(['columns'])` 추가로 인한 암묵적 결합
  - 위치: `expression-exclusions.ts` 8행
  - 상세: `columns` 배열 전체를 expression 해석 대상에서 제외하면서, `table.handler.ts` 내부에서 직접 `evaluate(col.field, itemCtx)`를 호출하는 방식으로 이중 처리 구조가 형성됨. `ExpressionResolverService`와 `TableHandler` 양쪽에 표현식 평가 책임이 분산되어, 향후 expression resolver 로직 변경 시 누락될 위험이 있음.
  - 제안: 이 결합 관계를 주석으로 명시하거나, 설계 문서에 의도를 기록해 유지보수 시 혼선을 방지할 것.

---

### 요약

이번 변경은 신규 외부 라이브러리를 도입하지 않고, 기존 monorepo 내부 패키지(`@workflow/expression-engine`)와 내부 유틸리티만 활용한 의존성 확장으로 의존성 관점에서 전반적으로 안전합니다. 다만 `ExecutionContext.expressionContext` 필드가 `Record<string, unknown>`으로 느슨하게 타입 지정되어 핸들러마다 캐스팅이 필요한 점, 그리고 `expression-exclusions`와 `TableHandler` 사이의 암묵적 결합이 유지보수 시 잠재적 혼선을 야기할 수 있는 점이 경미한 주의사항입니다.

### 위험도

**LOW**