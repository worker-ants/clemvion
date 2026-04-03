## 부작용 코드 리뷰 결과

### 발견사항

---

**[WARNING] `context.expressionContext` 공유 상태 변경 — 노드 간 컨텍스트 오염 가능**
- 위치: `execution-engine.service.ts`, `context.expressionContext = exprContext` 라인
- 상세: `context`는 워크플로우 전체 실행 동안 공유되는 단일 객체입니다. 각 노드 실행 시 `exprContext`를 덮어쓰므로, 다음 노드가 이전 노드의 `expressionContext`를 참조할 수 있습니다. 특히 비동기 실행(retry, form 대기 등) 시 이전 노드의 `$dataSource`, `$sourceItem` 등이 다음 노드로 누출될 위험이 있습니다.
- 제안: 노드 실행 완료 후 `context.expressionContext = undefined`로 초기화하거나, 핸들러 호출 시에만 별도로 전달하는 방식 사용

---

**[WARNING] `resolveColumnLabels`에서 `dataSource`를 `execute`와 중복 파싱**
- 위치: `table.handler.ts`, `resolveColumnLabels` 메서드
- 상세: `execute` 내에서 이미 `sourceArray`를 계산했음에도 `resolveColumnLabels`가 `config`와 `input`을 다시 받아 동일한 로직(`config.dataSource != null ? config.dataSource : input`)을 재수행합니다. `execute`에서 `dataRows`에 정렬/페이징을 적용한 이후에 `resolveColumnLabels`가 호출되지만, 레이블 해석은 전체 원본 `sourceArray`를 기준으로 하므로 의미적 불일치는 없습니다. 그러나 동일 파싱 로직의 중복은 향후 변경 시 불일치 버그를 유발할 수 있습니다.
- 제안: `execute` 내에서 이미 계산된 `sourceArray`를 `resolveColumnLabels`에 직접 인자로 전달

---

**[WARNING] `EXPRESSION_PATTERN`이 `col.field`를 키로 사용 — 표현식 결과가 행 키로 고정됨**
- 위치: `table.handler.ts:111-115`
- 상세: `row[col.field] = evaluate(col.field, itemCtx)` 코드에서 행 데이터의 키가 표현식 문자열(`"{{ $sourceItem.first + ..." }}`)로 저장됩니다. 테스트도 이를 그대로 검증하고 있습니다. 외부 소비자(프론트엔드 렌더러 등)가 이 키를 읽어야 한다면 동일한 표현식 문자열을 키로 알아야 하므로, API 계약이 불안정합니다.
- 제안: 행 키를 `col.field` 대신 별도의 `col.key` 또는 정규화된 필드명으로 분리하거나, 결과 행을 인덱스 기반 배열로 반환하는 방식 검토

---

**[INFO] `renderHtml`의 시그니처 변경 — 내부 전용이므로 직접 영향 없음**
- 위치: `table.handler.ts`, `renderHtml` 메서드
- 상세: `renderHtml(columns, rows)` → `renderHtml(resolvedColumns, originalColumns, rows)` 로 변경됨. `private` 메서드이므로 외부 호출자 영향은 없습니다. 단, 헤더는 `resolvedColumns`, 셀 키는 `originalColumns`를 사용하는 비대칭 구조가 의도된 것인지 주석으로 명시하면 혼란을 줄일 수 있습니다.
- 제안: 코드 주석으로 의도 명시 (`// Header uses resolved labels; cell lookup uses original field keys`)

---

**[INFO] `ExecutionContext` 인터페이스에 `expressionContext` 필드 추가 — 하위 호환 유지**
- 위치: `node-handler.interface.ts`
- 상세: Optional 필드(`expressionContext?`)로 추가되어 기존 `ExecutionContext` 구현체 및 테스트 픽스처에 영향을 주지 않습니다. `spec.ts`의 `context` 객체에도 해당 필드가 없으나 정상 동작합니다.

---

**[INFO] `ExpressionContext` 타입에 `$dataSource`, `$sourceItem`, `$sourceItemIndex` 추가**
- 위치: `evaluator.ts`
- 상세: 공유 패키지(`@workflow/expression-engine`)의 타입 확장입니다. 기존 `[key: string]: unknown` 인덱스 시그니처가 있으므로 런타임 동작은 동일하나, 타입 명시로 오타 방지 및 자동완성 개선 효과가 있습니다. Breaking change 없음.

---

**[INFO] `EXPRESSION_EXCLUSIONS`에 `table: columns` 추가 — 올바른 격리**
- 위치: `expression-exclusions.ts`
- 상세: `columns` 배열 전체가 expression resolver를 건너뛰고 핸들러에서 직접 표현식을 처리하도록 의도된 변경입니다. `dataSource`, `mode` 등 다른 table config 키는 여전히 resolver를 통해 사전 해석됩니다. 이 전략은 일관성이 있으나, `columns` 내 다른 속성(예: `label`)도 사전 resolver로 처리하면 안 되는지 명시적인 문서화가 없습니다.

---

### 요약

이번 변경에서 가장 주의해야 할 부작용은 **공유 `context` 객체에 `expressionContext`를 직접 쓰는 패턴**입니다. 단일 워크플로우 실행에서 노드들이 순차 실행되더라도, 재시도(retry)나 form 대기 이후 재개 시점에 이전 노드의 컨텍스트가 의도치 않게 잔류할 수 있습니다. 나머지 변경사항들(타입 추가, `EXPRESSION_EXCLUSIONS` 확장, `renderHtml` 시그니처 변경)은 모두 내부 범위가 명확하거나 선택적 확장이므로 외부 부작용이 없습니다. 표현식 결과를 행 키로 그대로 사용하는 패턴은 API 계약 안정성 측면에서 중장기적인 위험 요소입니다.

### 위험도

**MEDIUM**