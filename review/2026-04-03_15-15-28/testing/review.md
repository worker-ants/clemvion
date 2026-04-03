## 발견사항

### Backend (table.handler.ts / table.handler.spec.ts)

- **[INFO]** `toDisplayString` private 메서드에 대한 직접 테스트 없음
  - 위치: `table.handler.ts:120-128`
  - 상세: `execute`의 rendered HTML 테스트를 통해 간접 커버되나, `null/undefined`, `boolean`, `object`, `array` 입력에 대한 직접 케이스가 없음
  - 제안: XSS 테스트에서 이미 HTML 이스케이프를 검증하므로 LOW 우선순위. 다만 object/array 타입 값의 `JSON.stringify` 경로가 rendered HTML 테스트로는 검증되지 않음

- **[WARNING]** `toDisplayString`의 object/array 값 렌더링 테스트 누락
  - 위치: `table.handler.spec.ts` execute 섹션
  - 상세: `config.rows`에 `{ col0: { nested: 'obj' } }` 또는 `[1,2,3]` 같은 중첩 값이 들어올 때 `JSON.stringify` 경로가 실행되는지 검증하는 테스트 없음
  - 제안:
    ```typescript
    it('should render object/array values as JSON string', async () => {
      const result = await handler.execute(
        [{ data: { x: 1 } }],
        { columns: [{ field: 'data', label: 'Data' }] },
        context,
      ) as Record<string, unknown>;
      expect(result.rendered as string).toContain('{"x":1}');
    });
    ```

- **[WARNING]** 정렬 로직의 null 값 처리 테스트 누락
  - 위치: `table.handler.ts:72-78` (sort 비교 함수)
  - 상세: `aVal != null && bVal != null && aVal < bVal ? -1 : 1` 로직에서 한쪽이 null일 때 항상 1을 반환함. null 값이 포함된 정렬 결과의 안정성 검증 없음
  - 제안:
    ```typescript
    it('should handle null values in sort', async () => {
      const result = await handler.execute(
        [{ score: null }, { score: 10 }, { score: 5 }],
        { columns: [{ field: 'score', label: 'Score' }], sortBy: 'score', sortOrder: 'asc' },
        context,
      ) as Record<string, unknown>;
      // null 값이 특정 위치(앞/뒤)에 오는지 검증
      const rows = result.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(3);
    });
    ```

- **[INFO]** static 모드에서 `dataSource` 설정이 있어도 무시되는지 테스트 없음
  - 위치: `table.handler.spec.ts`
  - 상세: `execute`에서 static 모드는 `config.rows`만 사용하고 `config.dataSource`를 무시하는데, 두 값이 동시에 있을 때 static rows가 우선함을 명시적으로 검증하는 케이스 없음 (현재 "ignore input in static mode" 테스트가 input만 무시를 검증)

- **[INFO]** `pageSize: 0` 엣지 케이스 테스트 없음
  - 위치: `table.handler.ts:81-83`
  - 상세: `if (pageSize)` 조건에서 `pageSize: 0`은 falsy이므로 전체 행을 반환. 의도된 동작인지 명시적 테스트로 확인 필요

- **[INFO]** 테스트 격리: `tableRowId` 모듈 레벨 변수
  - 위치: `presentation-configs.tsx:146`
  - 상세: `let tableRowId = 0`은 모듈 레벨 뮤터블 변수로, 동일 모듈을 import하는 테스트 간에 상태가 공유될 수 있음. 현재 프론트엔드 컴포넌트 테스트는 없으므로 즉각적 문제는 아니나, 테스트 추가 시 `carouselItemId`와 동일한 패턴으로 격리 문제 발생 가능

### Frontend (presentation-configs.tsx)

- **[WARNING]** `TableConfig` 컴포넌트에 대한 단위 테스트 없음
  - 위치: `presentation-configs.tsx`
  - 상세: mode 전환 시 `rows`/`dataSource` 필드 정리 로직(`handleModeChange`), 새 컬럼 추가 시 자동 field명 생성(`col${columns.length}`), static 모드에서 행 추가/삭제/편집 등의 UI 로직이 테스트되지 않음. `CarouselConfig`도 테스트가 없지만 기존 패턴이므로 신규 추가인 Table의 복잡한 로직은 검증 필요
  - 제안: `handleModeChange` 순수 로직(config 변환)만이라도 단위 테스트 추가

- **[INFO]** `mode === 'dynamic'` 전환 시 `rows` 필드 제거 로직 테스트 없음
  - 위치: `presentation-configs.tsx:165-172`
  - 상세: `handleModeChange`에서 dynamic 전환 시 `rows`와 `dataSource`가 config에서 제거되는데, 이 destructuring 로직을 검증하는 테스트 없음

### Frontend (node-config-summary.ts / test)

- **[INFO]** `tableSummary`에서 `mode`가 `'static'`도 `'dynamic'`도 아닌 값일 때 `"dynamic"` label 반환 — 테스트 없음
  - 위치: `node-config-summary.ts:189`
  - 상세: `mode === "static" ? "static" : "dynamic"` 로직에서 임의의 무효 mode 값도 "dynamic"으로 표시됨. 스펙상 문제는 없으나 일관성 확인 필요

- **[INFO]** 기존 테스트 유효성: 모두 새 포맷(`"dynamic · N column(s) · pagination"`)으로 올바르게 업데이트됨 — 회귀 없음

---

## 요약

백엔드 테스트(`table.handler.spec.ts`)는 핵심 경로(dynamic/static 모드, 정렬, 페이지네이션, 필드 누락, HTML 이스케이프, dataSource 우선순위)를 잘 커버하고 있으며 구조도 명확합니다. 주요 갭은 `toDisplayString`의 object/array 입력 경로와 null 값이 포함된 정렬 동작으로, `JSON.stringify` 경로와 null 처리 버그가 숨어있을 수 있어 Warning 수준의 테스트 추가가 권장됩니다. 프론트엔드는 컴포넌트 테스트 자체가 없어 `TableConfig`의 mode 전환 로직, 자동 field명 생성 등 복잡한 UI 로직이 미검증 상태입니다. `node-config-summary` 테스트는 변경 사항을 적절히 반영하여 회귀 위험이 없습니다.

## 위험도

**LOW**