## 발견사항

- **[INFO]** `resolveColumnLabels` private 메서드에 JSDoc 없음
  - 위치: `table.handler.ts` - `resolveColumnLabels` 메서드
  - 상세: label 표현식 평가 동작(dynamic 모드 전용, 첫 번째 아이템 컨텍스트 사용)이 주석으로만 설명됨. private 메서드이므로 JSDoc 필수는 아니나, 동작 조건이 비직관적
  - 제안: 메서드 상단에 조건 설명 주석 추가: `// Only resolves in dynamic mode; uses $dataSource without $sourceItem (header is shared)`

- **[INFO]** `renderHtml` 시그니처 변경 후 파라미터 의도 불명확
  - 위치: `table.handler.ts:194` - `renderHtml(resolvedColumns, originalColumns, rows)`
  - 상세: `resolvedColumns`는 헤더 렌더링, `originalColumns`는 데이터 셀의 field key 조회에 사용된다는 구분이 코드만으로는 파악하기 어려움
  - 제안: 인라인 주석 추가: `// resolvedColumns for <th> labels, originalColumns for row[col.field] key lookup`

- **[INFO]** `EXPRESSION_EXCLUSIONS`의 `table: columns` 추가에 대한 설명 부족
  - 위치: `expression-exclusions.ts`
  - 상세: 기존 `code` 항목에는 JSDoc 주석이 있으나, `table` 추가 이유("columns 내부 표현식은 TableHandler가 직접 평가하므로 ExpressionResolver가 선처리하면 안 됨")가 문서화되지 않음
  - 제안: JSDoc 블록에 `- table: columns — column field/label expressions are evaluated per-item inside TableHandler` 추가

- **[INFO]** `ExecutionContext.expressionContext` 필드 설명 없음
  - 위치: `node-handler.interface.ts`
  - 상세: 신규 추가된 선택적 필드에 JSDoc이 없어 어떤 핸들러가 어떤 목적으로 사용하는지 알 수 없음
  - 제안: `/** Resolved expression context, populated before handler.execute() for handlers requiring per-item evaluation (e.g. TableHandler). */` 추가

- **[INFO]** `ExpressionContext`의 신규 변수 3종 설명 없음
  - 위치: `evaluator.ts:38-40` - `$dataSource`, `$sourceItem`, `$sourceItemIndex`
  - 상세: 기존 `$loop`, `$item` 등도 JSDoc이 없지만, 신규 변수는 특히 TableHandler 전용 컨텍스트 변수임을 알기 어려움
  - 제안: 인터페이스 레벨 JSDoc이나 해당 필드 옆 인라인 주석으로 용도 명시: `// Injected by TableHandler for per-row expression evaluation`

- **[INFO]** `execution-engine.service.ts` 인라인 주석 적절
  - 위치: `execution-engine.service.ts:578`
  - 상세: `// Store expression context for handlers that need per-item evaluation` 주석이 의도를 잘 설명함. 추가 문서화 불필요

- **[INFO]** 스펙 문서(`spec/4-nodes/6-presentation-nodes.md`) 변경 여부 확인 필요
  - 위치: `spec/` 디렉토리
  - 상세: git status 기준 해당 파일이 수정됨. 새로 추가된 dot-path 접근, 표현식 field/label, `$dataSource`/`$sourceItem`/`$sourceItemIndex` 변수가 스펙에 반영되었는지 확인 필요
  - 제안: 스펙 문서에 Table 노드의 동적 표현식 기능 섹션이 포함되어 있는지 검토

---

### 요약

이번 변경은 Table 핸들러에 per-item 표현식 평가, dot-path 중첩 필드 접근, label 표현식 해석 기능을 추가한 의미 있는 기능 확장이다. 코드 자체의 가독성은 양호하나, `resolveColumnLabels`의 동작 조건(dynamic 모드 전용, 헤더는 공유 컨텍스트로 1회 평가), `renderHtml`의 이중 columns 파라미터 역할 구분, `expression-exclusions.ts`의 table 추가 이유, `ExecutionContext.expressionContext`의 용도, `ExpressionContext`의 신규 3개 변수의 사용 범위 등에 대한 문서화가 부재하여 향후 다른 핸들러 개발자가 패턴을 파악하거나 재사용하기 어렵다. 모두 INFO 수준으로 동작에는 영향이 없으나, 유지보수성 측면에서 간단한 주석 보완이 권장된다.

### 위험도

**LOW**