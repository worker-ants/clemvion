### 발견사항

---

**[WARNING] `resolveColumnLabels`가 static 모드에서 label expression을 무시함**
- 위치: `table.handler.ts` - `resolveColumnLabels` 메서드
- 상세: static 모드에서 `columns`의 label에 `{{ }}` 표현식이 있어도 평가되지 않고 원본 문자열 그대로 반환됨. dynamic 모드에서만 label expression 지원이 의도된 것인지 불명확함.
- 제안: 스펙에서 static 모드의 label expression 지원 여부를 명확히 정의하거나, 지원하지 않는다면 명시적 주석 추가.

---

**[WARNING] expression field를 row key로 사용하는 설계 불일치**
- 위치: `table.handler.ts:113-116`, `table.handler.spec.ts:592-600`
- 상세: expression field (`{{ $sourceItem.first + " " + $sourceItem.last }}`)가 row의 키로 사용되고, HTML 렌더링 시 `originalColumns`의 `col.field`로 셀을 조회함. 즉, 렌더링된 HTML에서 셀 데이터를 가져올 때 `row['{{ $sourceItem.first + " " + $sourceItem.last }}']`를 참조함. 이 키가 실제로 row에 존재하는지 여부가 `originalColumns` 기반 조회에 의존하므로 취약함.
- 제안: expression field의 결과를 별도 키(예: index 기반 또는 해시)로 저장하거나, expression field를 plain key로 매핑하는 구조를 검토.

---

**[WARNING] `validate`에서 expression field/label 형식 검증 없음**
- 위치: `table.handler.ts:22-65` - `validate` 메서드
- 상세: column의 `field`나 `label`에 잘못된 expression 문법(`{{ unclosed`)이 들어오면 `execute` 시점에 런타임 에러 발생. `validate`에서는 이를 감지하지 못함.
- 제안: validate 단계에서 expression 패턴 감지 시 간단한 문법 검증을 수행하거나, `execute`에서 expression 평가 실패를 적절히 핸들링.

---

**[WARNING] expression 평가 실패 시 에러 전파**
- 위치: `table.handler.ts:112-116`, `table.handler.ts:160-163`
- 상세: `evaluate(col.field, itemCtx)` 또는 `evaluate(col.label, ctx)` 호출 실패 시 예외가 그대로 `execute`에서 전파됨. 부분 실패(특정 row/column의 expression 오류)에 대한 처리가 없음.
- 제안: try-catch로 감싸 실패 시 `null` 또는 오류 문자열을 반환하거나, 에러를 명시적으로 재throw하는 의도를 문서화.

---

**[INFO] `sortBy` 유효성 검사가 expression field를 처리하지 못함**
- 위치: `table.handler.ts:49-58`
- 상세: `validate`에서 `sortBy`가 `columnFields`에 포함되어야 한다고 검증하지만, expression field (`{{ ... }}`)로 정의된 column에 대해 `sortBy`를 설정하면 동작이 불명확함 (정렬 시 row key는 expression 원문이 됨).
- 제안: expression field column에 대한 sortBy 지원 여부를 스펙에서 명확히 하고, 필요하면 validate에서 제한.

---

**[INFO] `context.expressionContext` 변경이 공유 컨텍스트를 직접 수정**
- 위치: `execution-engine.service.ts:578`
- 상세: `context.expressionContext = exprContext` 는 루프 외부에서 한 번 할당되지 않고, `executeNode` 호출 시마다 갱신됨. 현재 구조상 문제없지만, 병렬 실행 도입 시 컨텍스트 오염 위험 존재.
- 제안: 현 상태에서는 무방하나, 추후 병렬 실행 고려 시 per-node context 복사 전략 필요.

---

**[INFO] `resolveColumnLabels`에서 label expression 평가 시 `$sourceItem` 미제공**
- 위치: `table.handler.ts:148-166`
- 상세: label은 "once, using first item context"라는 주석이 있으나, 실제로 `$sourceItem`이 컨텍스트에 포함되지 않음. `{{ $sourceItem.fieldName }}`을 label에 사용하면 `ReferenceError` 발생.
- 제안: label expression에서 `$sourceItem` 필요 시 첫 번째 item을 제공하거나, label expression에서 `$sourceItem`을 지원하지 않음을 명시.

---

**[INFO] 테스트에서 label expression 케이스 누락**
- 위치: `table.handler.spec.ts`
- 상세: label에 expression을 사용하는 테스트 케이스가 없음. `resolveColumnLabels` 메서드의 실제 동작(label expression 치환)을 검증하는 테스트 부재.
- 제안: `{{ $dataSource.length + " items" }}`과 같은 label expression 테스트 추가.

---

### 요약

이번 변경은 Table 핸들러에 dot-path 중첩 필드 접근과 per-item expression 평가 기능을 추가한 것으로, 핵심 요구사항은 대체로 구현되어 있습니다. 다만 expression field가 row의 키로 그대로 사용되는 설계가 HTML 렌더링 경로에서 취약점을 만들고, `validate`에서 expression 문법 오류를 감지하지 못해 런타임 에러로 이어질 수 있습니다. `resolveColumnLabels`에서 label expression 평가 시 `$sourceItem`이 제공되지 않는 불일치와 해당 기능에 대한 테스트 케이스 누락도 보완이 필요합니다. expression 평가 실패에 대한 에러 핸들링 전략도 명시적으로 정의되어야 합니다.

### 위험도

**MEDIUM**