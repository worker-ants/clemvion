### 발견사항

- **[INFO]** `ExecutionContext` 인터페이스에 `expressionContext` 필드 추가
  - 위치: `node-handler.interface.ts`
  - 상세: optional 필드(`?`)로 추가되어 기존 핸들러 구현체에 breaking change 없음. 기존 코드는 이 필드를 사용하지 않으므로 하위 호환성 유지됨.
  - 제안: 없음 (적절한 설계)

- **[INFO]** Table 노드 출력 응답 구조 변경 — `columns` 필드가 expression이 resolve된 값으로 반환
  - 위치: `table.handler.ts` execute() 반환값
  - 상세: 기존에는 `columns`가 config에서 넘어온 원본 값이었으나, 이제 label expression이 evaluate된 `resolvedColumns`로 대체됨. API 응답의 `columns[].label`이 `{{ expr }}` 리터럴 문자열 대신 평가된 값으로 변경됨.
  - 제안: 이 변경은 의도된 개선이며 breaking change로 볼 수 없으나, 클라이언트가 label을 원본 표현식 형태로 기대했다면 주의 필요. 스펙 문서에 명시 권장.

- **[INFO]** `ExpressionContext` 인터페이스에 `$dataSource`, `$sourceItem`, `$sourceItemIndex` 추가
  - 위치: `packages/expression-engine/src/evaluator.ts`
  - 상세: 모두 optional 필드로, 기존 expression 평가 로직에 영향 없음. 공유 패키지(`@workflow/expression-engine`) 변경이므로 해당 패키지를 사용하는 다른 핸들러에도 동일한 변수명을 사용할 수 있게 됨.
  - 제안: 없음

- **[INFO]** `EXPRESSION_EXCLUSIONS`에 `table: Set(['columns'])` 추가
  - 위치: `expression-exclusions.ts`
  - 상세: 이제 `columns` 필드는 `ExpressionResolverService`에서 전역적으로 expression resolve되지 않음. 대신 핸들러 내부에서 per-item 컨텍스트와 함께 직접 평가. API 계약 측면에서는 외부 노출되는 인터페이스 변경 없음.
  - 제안: 없음

---

### 요약

이번 변경은 Table 노드 내부 실행 로직 개선(expression 평가 지원, nested field 접근)에 해당하며, 외부 HTTP API 엔드포인트 추가·수정·삭제는 포함되지 않는다. 내부 인터페이스(`ExecutionContext`, `ExpressionContext`) 변경은 모두 optional 필드 추가로 이루어져 하위 호환성이 유지된다. 유일한 클라이언트 체감 변화는 Table 노드 실행 결과의 `columns[].label` 값이 expression 문자열 대신 evaluated 값으로 반환된다는 점이나, 이는 의도된 기능 개선으로 breaking change에 해당하지 않는다.

### 위험도
**LOW**