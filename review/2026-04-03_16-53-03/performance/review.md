## 성능 코드 리뷰 결과

### 발견사항

---

**[WARNING] `resolveColumnLabels`에서 `sourceArray` 중복 계산**
- 위치: `table.handler.ts` — `execute()` 및 `resolveColumnLabels()`
- 상세: `execute()`에서 이미 `sourceArray`를 계산하고 `dataRows`까지 만든 후, `resolveColumnLabels()`에서 `source`/`sourceArray`를 다시 계산함. 데이터 소스가 크면 배열 래핑(`[source]`) 연산이 중복 수행됨.
- 제안: `resolvedColumns`를 `sourceArray` 계산 이전에 처리하거나, `sourceArray`를 인자로 직접 전달.

```typescript
// execute() 내부에서 sourceArray를 이미 가진 상태에서 호출
const resolvedColumns = this.resolveColumnLabels(columns, sourceArray, context);
```

---

**[WARNING] 모든 행에서 `{ ...baseCtx }` 스프레드 연산 반복**
- 위치: `table.handler.ts` — `execute()` 동적 모드 `sourceArray.map()` (라인 ~105)
- 상세: `baseCtx` 스프레드가 매 행(`sourceArray`의 각 아이템)마다 실행됨. 데이터가 수천 행이고 `expressionContext`가 크면 `O(n * contextSize)` 메모리 할당 발생.
- 제안: 공유 가능한 부분은 map 외부에서 준비하고, 행별 변경 키만 갱신하는 방식으로 구조 변경.

```typescript
// 현재: 매 행마다 전체 스프레드
const itemCtx: EngineContext = { ...baseCtx, $dataSource: sourceArray, $sourceItem: item, $sourceItemIndex: index };

// 개선: 기본 컨텍스트를 한 번만 구성, 가변 필드만 변경
const sharedCtx = { ...baseCtx, $dataSource: sourceArray };
// 단, evaluate()가 ctx를 변경하지 않는다는 보장이 있을 때:
// sharedCtx.$sourceItem = item; sharedCtx.$sourceItemIndex = index; 방식도 가능
```

---

**[WARNING] `EXPRESSION_PATTERN.test(col.field)` 중복 실행**
- 위치: `table.handler.ts` — `execute()` 내 `for (const col of columns)` 루프
- 상세: 컬럼이 N개, 행이 M개일 때 `EXPRESSION_PATTERN.test(col.field)`가 `N*M`번 실행됨. 컬럼 정의는 실행 중 변하지 않으므로 불필요한 반복임.
- 제안: `sourceArray.map()` 외부에서 컬럼별 표현식 여부를 사전 분류.

```typescript
// map 루프 바깥에서 1회 분류
const exprCols = new Set(columns.filter(c => EXPRESSION_PATTERN.test(c.field)).map(c => c.field));

dataRows = sourceArray.map((item, index) => {
  const row: Record<string, unknown> = {};
  const itemCtx = { ...sharedCtx, $sourceItem: item, $sourceItemIndex: index };
  for (const col of columns) {
    row[col.field] = exprCols.has(col.field)
      ? evaluate(col.field, itemCtx)
      : getNestedValue(item, col.field) ?? null;
  }
  return row;
});
```

---

**[WARNING] `resolveColumnLabels`에서 `hasExpressionLabel` 검사 후 동일 루프 재실행**
- 위치: `table.handler.ts` — `resolveColumnLabels()`
- 상세: `columns.some()` O(N) → `columns.map()` O(N)으로 두 번 순회함. 단일 `reduce` 또는 `map`으로 합칠 수 있음.
- 제안:

```typescript
let hasExpr = false;
const resolved = columns.map(col => {
  if (EXPRESSION_PATTERN.test(col.label)) {
    hasExpr = true;
    return { ...col, label: String(evaluate(col.label, ctx)) };
  }
  return col;
});
if (!hasExpr) return columns; // 사본 반환을 막을 수 없으나 evaluate 호출은 0회
```

---

**[INFO] `renderHtml` 내 문자열 연결 방식**
- 위치: `table.handler.ts` — `renderHtml()`
- 상세: `Array.map().join('')` 패턴은 현재 수준에서는 합리적이나, 행이 수만 건 이상이면 대형 문자열 생성 비용이 선형적으로 증가함. 현재 `pageSize`로 제한하므로 실질적 위험은 낮음.
- 제안: `pageSize` 제한이 항상 적용됨을 코드 주석 또는 로직으로 명확히 보장.

---

**[INFO] `context.expressionContext` 매 노드 실행마다 덮어쓰기**
- 위치: `execution-engine.service.ts` — `executeNode()` (라인 ~575)
- 상세: `context`가 전체 워크플로우 실행 동안 공유되는 단일 객체이므로, `expressionContext`를 직접 변경하면 병렬 노드 실행(현재는 없으나 향후 도입 시) 시 race condition 위험 있음. 현재 순차 실행 구조에서는 성능 문제 없음.
- 제안: 지금 당장 문제는 없으나, 핸들러에 컨텍스트를 직접 주입하는 대신 `execute()` 시그니처 확장이 장기적으로 더 안전.

---

### 요약

전반적으로 구조적으로 잘 설계되어 있으며 심각한 성능 문제는 없다. 핵심 이슈는 `sourceArray.map()` 내에서 컬럼 수 × 행 수만큼 `EXPRESSION_PATTERN.test()`를 반복 실행하는 부분(`O(N*M)`)과, 각 행마다 `baseCtx` 전체를 스프레드하는 메모리 할당 패턴이다. 두 문제 모두 맵 루프 외부에서 한 번 전처리함으로써 쉽게 개선 가능하다. `resolveColumnLabels`의 이중 순회와 `sourceArray` 중복 계산도 사소하지만 불필요한 낭비다. 표현식 평가(`evaluate`) 자체의 비용이 더 크기 때문에 실제 운영 환경에서의 병목은 이 함수에 있을 가능성이 높으므로, 동일 표현식+컨텍스트 조합에 대한 경량 메모이제이션도 장기적으로 고려할 만하다.

### 위험도

**LOW**