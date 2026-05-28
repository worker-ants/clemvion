# Testing Review — cafe24-mcp-label-i18n

검토 대상: label → labelKey i18n 일원화 PR (파일 1~26)
검토 일시: 2026-05-28

---

## 발견사항

### [INFO] constraint-validator.spec.ts 헬퍼 주석 업데이트가 코드 변경과 일치
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.spec.ts` diff
- 상세: `label` 제거에 맞춰 `op()` 헬퍼의 JSDoc 주석도 "`id`/`description`/etc. are stubs"로 정확히 갱신되었다. `label: 'test'` 라인도 함께 제거됨. 기능 동작에는 영향 없고 가독성 개선.
- 제안: 특이 사항 없음.

---

### [INFO] public-meta.spec.ts — labelKey 시나리오 적절히 커버
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.spec.ts` diff
- 상세: `toPublicSupportedOperation` 의 두 번째 인자(`resource: Cafe24Resource`) 추가에 따라 모든 호출부가 `'product'` 를 전달하도록 갱신되었다. `label` → `labelKey` 단언도 교체됨. 특히 "preserves id, scope, paginated, description, and emits labelKey" 테스트가 `pub.labelKey === 'cafe24.product.product_list'` 와 `pub.label === undefined` 를 동시에 검증해 필드명 전환을 명확히 보호한다.
- 제안: 특이 사항 없음. 다만 아래 커버리지 갭 항목 참고.

---

### [WARNING] `toPublicPlannedOperation` 의 `labelKey` 생성 경로가 테스트되지 않음
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.spec.ts`
- 상세: `public-meta.spec.ts` 는 `toPublicSupportedOperation` 의 `labelKey` 형식(`cafe24.<resource>.<id>`)을 검증하지만, 동일 패턴을 적용한 `toPublicPlannedOperation` → `labelKey` 경로는 해당 spec 파일에 단언이 없다. `buildCafe24Extras()` 를 통해 `plannedByResource` 전체가 올바르게 변환되는지도 명시적 테스트가 없다.
- 제안:
  ```ts
  it('planned operation emits labelKey', () => {
    const planned = buildCafe24Extras().plannedByResource;
    // at least one resource with planned entries
    const resource = Object.keys(planned)[0] as Cafe24Resource;
    const op = planned[resource]?.[0];
    if (op) {
      expect(op.labelKey).toMatch(/^cafe24\.[^.]+\.[^.]+$/);
      expect((op as unknown as Record<string, unknown>).label).toBeUndefined();
    }
  });
  ```

---

### [WARNING] `resolveCafe24OperationLabel` 함수에 대한 직접 단위 테스트 없음
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (`resolveCafe24OperationLabel`)
- 상세: dict lookup miss 시 `labelKey` 자체를 반환하는 fallback 정책이 spec §7.5 에 명문화되어 있고 이 함수가 그 핵심인데, `cafe24-config.test.tsx` 는 이 함수를 간접 경로(컴포넌트 렌더링)로만 검증한다. 두 가지 엣지 케이스가 테스트되지 않음:
  1. dict 에 존재하는 키 → 한국어/영어 라벨 반환
  2. dict 에 없는 키(drift 상황) → `labelKey` 자체 반환(fallback)
- 제안: `resolveCafe24OperationLabel` 을 별도 유틸 모듈로 추출하거나, `cafe24-config.test.tsx` 에 아래 테스트를 추가:
  ```ts
  it('resolves known key from ko dict', () => {
    // mock cafe24CatalogKo to contain a known key
    expect(resolveCafe24OperationLabel('ko', 'cafe24.product.product_list'))
      .toBe('상품 목록 조회');
  });

  it('falls back to labelKey when key is missing from dict', () => {
    expect(resolveCafe24OperationLabel('ko', 'cafe24.unknown.nonexistent'))
      .toBe('cafe24.unknown.nonexistent');
  });
  ```
  현재 `resolveCafe24OperationLabel` 은 파일 내부 함수여서 외부에서 직접 호출할 수 없다. 추출 또는 `vi.importActual` 패턴 활용을 권장.

---

### [WARNING] 카탈로그 동기 테스트(`catalog-sync.spec.ts`)가 `labelKo` 컬럼을 파싱하지만 backend metadata 의 `label` 제거 후 불일치를 검증하지 않음
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` (라인 176 `labelKo` 필드)
- 상세: `CatalogRow` 인터페이스에 `labelKo: string` 필드가 있고 카탈로그 MD 파일의 "라벨 (한)" 컬럼을 파싱한다. 그러나 본 PR 이후 backend metadata 에는 `label` 이 없으므로, 카탈로그의 `labelKo` 와 frontend dict `cafe24Catalog[cafe24.<resource>.<id>]` 가 실제로 일치하는지 검증하는 테스트가 아무것도 없다. 향후 dict 누락이나 카탈로그-dict 드리프트가 자동으로 잡히지 않는다.
- 제안: `catalog-sync.spec.ts` 에 3방향 동기 검증 테스트 추가:
  ```ts
  it('cafe24Catalog ko dict key covers all supported catalog operations', () => {
    for (const resource of CAFE24_RESOURCES) {
      for (const row of catalog[resource]) {
        if (row.status !== 'supported') continue;
        const key = `cafe24.${resource}.${row.id}`;
        expect(cafe24CatalogKo[key]).toBeDefined(); // dict miss = drift
      }
    }
  });
  ```
  이는 spec §7.5 "dict lookup miss fallback" 정책이 의도하는 drift 즉시 감지를 테스트 레벨에서 보장한다.

---

### [INFO] `cafe24-config.test.tsx` 는 locale 변경 시 라벨 재렌더를 검증하지 않음
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx`
- 상세: `beforeEach` 에서 `locale: 'ko'` 로 고정하고 라벨이 `'상품 목록 조회'` 등 한국어인지 확인하지만, `locale: 'en'` 으로 전환했을 때 영어 라벨이 올바르게 적용되는지 테스트가 없다. `resolveCafe24OperationLabel` 이 `locale === 'en'` 분기를 올바르게 처리하는지 컴포넌트 레벨에서 확인되지 않음.
- 제안: 아래 테스트 추가 고려:
  ```ts
  it('shows english labels when locale is en', () => {
    useLocaleStore.setState({ locale: 'en' });
    render(<ControlledCafe24 initial={{ resource: 'product' }} onChange={vi.fn()} />);
    const options = Array.from(
      (screen.getAllByRole('combobox')[1] as HTMLSelectElement).options,
    );
    const labels = options.map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining([
      expect.stringContaining('Product List'), // or whatever en dict says
    ]));
  });
  ```
  단, 이를 추가하려면 `cafe24CatalogEn` mock 도 함께 필요.

---

### [INFO] metadata.spec.ts 가 `label` 필드 부재를 직접 단언하지 않음
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/metadata.spec.ts`
- 상세: `listAllCafe24Operations()` 로 전 operation 을 순회하는 테스트가 다수 있으나, `op.label` 이 `undefined` 인지를 명시적으로 단언하는 테스트가 없다. TypeScript 컴파일 타임에는 타입 수준으로 걸리지만, 런타임 데이터가 JSON 으로 직렬화되어 API 응답에 포함될 때 잔여 `label` 키 유출을 막지 못한다.
- 제안: 선택적 단언으로 regression guard 추가:
  ```ts
  it('no operation carries a label field (removed in favor of labelKey)', () => {
    for (const { operation } of listAllCafe24Operations()) {
      expect((operation as unknown as Record<string, unknown>).label).toBeUndefined();
    }
  });
  ```

---

### [INFO] 테스트 격리 — `beforeEach`/`afterEach` 복원 패턴 적절
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx` 라인 155–163
- 상세: `useLocaleStore` 와 `useNodeDefinitionsStore` 를 `beforeEach` 에서 세팅하고 `afterEach` 에서 원래 상태로 복원하는 패턴이 적절히 적용되어 있다. 테스트 간 상태 누수 위험 없음.
- 제안: 특이 사항 없음.

---

### [INFO] public-meta.spec.ts — `buildCafe24Extras()` 통합 경로 테스트 없음
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.spec.ts`
- 상세: `toPublicSupportedOperation`, `toPublicPlannedOperation` 은 직접 테스트되지만, 이 둘을 `.map()`으로 묶어 전체 extras 객체를 빌드하는 `buildCafe24Extras()` 함수의 통합 호출 경로는 테스트되지 않는다. 특히 `resource` 파라미터 전달이 클로저(`(op) => toPublicSupportedOperation(op, resource)`)로 이루어지므로, 잘못된 리팩토링 시 모든 labelKey 가 마지막 resource 값으로 고정될 위험이 있다.
- 제안:
  ```ts
  it('buildCafe24Extras sets correct labelKey for each resource', () => {
    const extras = buildCafe24Extras();
    for (const [resource, ops] of Object.entries(extras.operationsByResource)) {
      for (const op of ops) {
        expect(op.labelKey).toMatch(new RegExp(`^cafe24\\.${resource}\\.`));
      }
    }
  });
  ```

---

## 요약

이번 PR 은 backend metadata 18개 파일에서 `label` 하드코딩 필드를 제거하고, `/nodes/definitions` 응답에 `labelKey` 를 도입하며, frontend 컴포넌트가 `cafe24Catalog` dict 를 직접 lookup 하도록 전환한다. 핵심 경로(`toPublicSupportedOperation`, `public-meta.spec.ts`, `cafe24-config.test.tsx`)에 대한 테스트 갱신은 적절히 이루어졌다. 그러나 `toPublicPlannedOperation`의 `labelKey` 경로, `resolveCafe24OperationLabel` 함수의 fallback 동작, `cafe24Catalog` dict ↔ catalog MD 3방향 동기, `buildCafe24Extras()` 통합 경로, 영어 locale 전환 시 라벨 렌더링에 대한 직접 테스트가 없다. 이 중 dict drift 를 자동으로 감지하는 테스트(WARNING 3번)와 fallback 정책 검증(WARNING 2번)은 spec §7.5 의 의도(drift 즉시 감지)를 테스트로 보장하기 위해 추가를 권장한다.

## 위험도

LOW
