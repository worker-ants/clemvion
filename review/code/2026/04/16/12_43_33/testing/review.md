### 발견사항

- **[CRITICAL]** `isFieldVisible` 함수에 대한 단위 테스트 누락
  - 위치: `frontend/src/components/editor/settings-panel/auto-form/visibility.ts`
  - 상세: `equals`, `notEquals`, `oneOf` 세 가지 규칙 분기를 추가했지만 어떤 분기에 대해서도 테스트가 없음. 특히 `oneOf`에서 `Array.isArray(rule.oneOf)` 검사가 실패하는 경우(비배열 값 전달)와 빈 배열 처리가 미검증 상태
  - 제안:
    ```ts
    // visibility.test.ts
    it("oneOf: returns false when value not in list", () => {
      expect(isFieldVisible({ visibleWhen: { field: "mode", oneOf: ["a","b"] } }, { mode: "c" })).toBe(false);
    });
    it("oneOf: returns true when value in list", () => {
      expect(isFieldVisible({ visibleWhen: { field: "mode", oneOf: ["a","b"] } }, { mode: "a" })).toBe(true);
    });
    it("notEquals: hides when value equals", () => {
      expect(isFieldVisible({ visibleWhen: { field: "mode", notEquals: "multi_turn" } }, { mode: "multi_turn" })).toBe(false);
    });
    ```

- **[CRITICAL]** `groupEntries` 및 `countGroupValues` 순수 함수에 대한 단위 테스트 누락
  - 위치: `frontend/src/components/editor/settings-panel/auto-form/schema-form.tsx`
  - 상세: 그룹핑 로직이 복잡하고 순서 의존적임. 동일 그룹명을 가진 비연속 항목이 별도 그룹으로 분리되는 동작, `collapsible` 플래그 전파, 빈 배열/null/false 값의 카운팅 제외 등 검증이 필요한 경계 케이스가 다수 존재
  - 제안: 두 함수를 별도 모듈로 분리하거나 export하여 직접 단위 테스트 가능하도록 구조화

- **[WARNING]** `clearFields` 로직 테스트 누락
  - 위치: `schema-form.tsx` `update` 함수
  - 상세: `mode` 스위치 시 연관 필드를 삭제하는 동작이 `clearFields` 배열에 의존함. `clearFields`에 존재하지 않는 키가 포함된 경우, 빈 배열인 경우 등이 미검증
  - 제안: `SchemaForm` 컴포넌트 통합 테스트에서 `mode` 변경 후 관련 필드가 실제로 제거되는지 확인하는 케이스 추가

- **[WARNING]** `FieldArrayWidget`의 구조적/비구조적 분기 테스트 누락
  - 위치: `frontend/src/components/editor/settings-panel/auto-form/widgets.tsx`
  - 상세: `isStructured` 분기(items에 properties가 있는 경우 vs 없는 경우)와 JSON parse 에러 시 silent ignore 동작, `itemDefault` 적용 여부가 미검증
  - 제안:
    ```ts
    it("falls back to raw JSON when itemSchema has no properties", () => { ... });
    it("uses itemDefault when provided for new items", () => { ... });
    it("silently ignores invalid JSON while typing", () => { ... });
    ```

- **[WARNING]** `TableGridWidget` 컬럼-행 동기화 로직 테스트 누락
  - 위치: `frontend/src/components/editor/settings-panel/auto-form/table-grid-widget.tsx`
  - 상세: `removeColumn` 시 static 모드에서 해당 필드가 행 데이터에서 동기적으로 제거되는 핵심 로직이 테스트 없음. 이 로직이 `TableConfig` override에서 이미 존재하던 코드를 복제한 것이므로 기존 동작 보존 여부 미검증
  - 제안:
    ```ts
    it("removeColumn syncs rows in static mode", () => {
      // columns: [{field:"a"}, {field:"b"}], rows: [{id:"1", a:"x", b:"y"}]
      // removeColumn(0) → rows: [{id:"1", b:"y"}]
    });
    ```

- **[WARNING]** 백엔드 스키마 변경에 대한 단위 테스트 누락
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`, `carousel.schema.ts`, `table.schema.ts`
  - 상세: `mode`, `conditions`, `maxToolCalls` 필드의 default값 변경 및 신규 필드 추가 후 `schema.parse({})` 결과가 기대와 일치하는지 검증하는 테스트가 없음. 특히 `conditionDefSchema`의 `id` 필드가 `hidden: true`로 변경되어 기존 직렬화된 config를 parse할 때 backward compatibility 미검증
  - 제안:
    ```ts
    it("parses empty input with correct defaults", () => {
      const result = aiAgentNodeConfigSchema.parse({});
      expect(result.mode).toBe("single_turn");
      expect(result.maxToolCalls).toBe(10);
      expect(result.conditions).toEqual([]);
    });
    ```

- **[INFO]** `ButtonListEditor` 이동(reorder) 로직 테스트 없음
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx`
  - 상세: `moveButton`에서 경계값(첫 번째 항목을 위로, 마지막 항목을 아래로) 처리가 미검증. `from === 0, to === -1` 케이스는 가드가 있으나 테스트로 보장되지 않음

- **[INFO]** `CollapsibleSection` 컴포넌트 렌더링 테스트 없음
  - 위치: `schema-form.tsx`
  - 상세: 초기 expanded 상태, 토글 동작, count badge 표시/숨김 조건이 미검증

- **[INFO]** `selector-widgets.tsx`의 re-export 구조가 테스트 가독성을 저해
  - 위치: `frontend/src/components/editor/settings-panel/auto-form/selector-widgets.tsx`
  - 상세: `ButtonListWidget`, `TableGridWidget`를 re-export하는 중간 레이어가 있어 import 경로가 불명확해짐. 테스트 작성 시 올바른 모듈을 mock해야 하는지 혼란 유발 가능

---

### 요약

이번 변경은 자동 폼 렌더러의 기능을 대폭 확장(그룹핑, collapsible 섹션, `notEquals`/`oneOf` visibility DSL, clearFields, 구조적 배열 위젯 등)하였으나 테스트 커버리지가 전무한 상태로 병행 추가되었습니다. 핵심 분기 로직(`isFieldVisible`의 3가지 규칙, `groupEntries`의 비연속 그룹 처리, `TableGridWidget`의 컬럼-행 동기화)은 순수 함수 또는 명확한 입출력을 가진 로직이므로 단위 테스트 작성이 용이한데도 누락되어 있으며, 특히 백엔드 스키마의 default값 변경 및 신규 필드 추가는 기존 저장된 config와의 역호환성을 검증하는 파싱 테스트가 반드시 필요합니다.

### 위험도

**HIGH**