## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `renderHtml` 메서드의 두 컬럼 파라미터 혼용으로 인한 인지 부하 증가**
- 위치: `table.handler.ts` — `renderHtml(resolvedColumns, originalColumns, rows)`
- 상세: `resolvedColumns`(header용)와 `originalColumns`(body용)를 동시에 받는 구조는 "header는 resolved, body는 original field key로 lookup"이라는 암묵적 계약을 메서드 시그니처만으로는 파악하기 어렵습니다. 두 파라미터가 별도로 존재하는 이유가 직관적으로 명확하지 않습니다.
- 제안: 파라미터명을 `displayColumns`(header용)와 `fieldColumns`(data key lookup용)로 변경하거나, 메서드 내부 주석으로 각 역할을 명시하세요.

---

**[WARNING] `resolveColumnLabels`에서 `dataSource` 처리 로직 중복**
- 위치: `table.handler.ts` — `execute()` L96~99, `resolveColumnLabels()` L167~172
- 상세: `const source = config.dataSource != null ? config.dataSource : input; const sourceArray = Array.isArray(source) ? source : [source];` 패턴이 `execute()`와 `resolveColumnLabels()` 양쪽에 동일하게 존재합니다.
- 제안: `private resolveDataSource(config, input): unknown[]` 헬퍼로 추출하세요.

```typescript
private resolveDataSource(config: Record<string, unknown>, input: unknown): unknown[] {
  const source = config.dataSource != null ? config.dataSource : input;
  return Array.isArray(source) ? source : [source];
}
```

---

**[WARNING] `execute()` 함수 길이 및 다중 책임**
- 위치: `table.handler.ts` — `execute()` (약 65줄)
- 상세: static 행 처리 → dynamic 행 처리 → 정렬 → 페이징 → label 해석 → HTML 렌더링까지 단일 메서드에 집중되어 있습니다. `resolveColumnLabels`를 별도 메서드로 분리한 것은 좋으나, row 처리 부분도 `buildStaticRows()` / `buildDynamicRows()` 로 분리하면 가독성이 개선됩니다.
- 제안: dynamic rows 생성 로직을 `private buildDynamicRows(sourceArray, baseCtx, columns)` 로 추출하세요.

---

**[INFO] `EXPRESSION_PATTERN = /\{\{/` — 패턴 이름이 충분히 구체적이지 않음**
- 위치: `table.handler.ts` L14
- 상세: 이 패턴은 "expression template 시작 감지용"이라는 의도가 있는데, `EXPRESSION_PATTERN`은 동일한 패턴을 사용하는 다른 코드(`expression-engine` 등)와 혼동될 수 있습니다. 또한 동일한 `{{` 체크가 field와 label 양쪽에 사용되는데, 모듈 레벨 상수로 잘 추출된 것은 긍정적입니다.
- 제안: `TEMPLATE_EXPRESSION_PREFIX` 또는 `HAS_EXPRESSION` 등 역할을 더 명확히 드러내는 이름을 고려하세요.

---

**[INFO] `expressionContext` 설정 위치가 side-effect에 의존**
- 위치: `execution-engine.service.ts` L578 — `context.expressionContext = exprContext;`
- 상세: `context` 객체를 직접 변경하는 방식입니다. `createContext()`나 `executeNode()` 시그니처에 `expressionContext`를 포함시키거나, `ExecutionContextService.setExpressionContext()`를 통해 관리하는 것이 명시적입니다. 현재 구조는 이 assignment를 놓치면 `table` 핸들러가 silently degraded된다는 위험이 있습니다.
- 제안: `ExecutionContextService`에 `setExpressionContext(executionId, ctx)` 메서드를 추가하거나, `context` 빌드 시점에 포함시키는 구조를 고려하세요.

---

**[INFO] `expression-exclusions.ts` 주석이 신규 항목을 설명하지 않음**
- 위치: `expression-exclusions.ts` L4~7
- 상세: 파일 상단 JSDoc은 `code: Raw JavaScript` 케이스만 설명하고 있습니다. `table: columns` 추가 의도("columns는 핸들러 내부에서 직접 expression 처리")가 문서화되지 않으면 향후 개발자가 삭제하거나 오해할 수 있습니다.
- 제안: 주석에 `table`에 대한 설명을 추가하세요:
```typescript
// - table: columns config is expression-resolved per-item inside TableHandler
```

---

**[INFO] 테스트에서 표현식 템플릿 문자열이 row key로 사용되는 구조**
- 위치: `table.handler.spec.ts` — per-item expression 테스트들
- 상세: `rows[0]['{{ $sourceItem.first + " " + $sourceItem.last }}']` 패턴이 여러 테스트에 반복됩니다. 표현식 문자열 자체가 key로 사용되는 현재 설계를 테스트가 그대로 반영하므로 구조적으로는 올바르나, 테스트 의도가 "key는 원본 표현식 문자열, value는 평가 결과"임을 주석으로 명시하면 가독성이 향상됩니다.
- 제안: 테스트 그룹(`describe`) 또는 각 `it` 블록에 이 동작에 대한 간단한 설명을 추가하세요.

---

### 요약

이번 변경은 Table 핸들러에 per-item 표현식 평가, dot-path 접근, label 표현식 해석이라는 세 가지 기능을 일관된 방향으로 추가했습니다. `EXPRESSION_PATTERN` 상수화, `resolveColumnLabels` 분리 등 기본적인 관심사 분리는 잘 이루어져 있습니다. 다만, `dataSource` 처리 로직의 중복, `renderHtml` 두 컬럼 파라미터의 암묵적 역할 구분, `context.expressionContext` 직접 변이(mutation) 방식은 향후 유지보수 시 혼란을 야기할 수 있는 부분입니다. `execute()` 메서드도 아직 여러 책임을 가지고 있어 row 처리 로직을 별도 메서드로 추출하면 가독성이 더욱 개선될 것입니다. 전반적으로 구조는 건전하나 일부 리팩터링으로 유지보수 부담을 줄일 수 있는 수준입니다.

### 위험도
**LOW**