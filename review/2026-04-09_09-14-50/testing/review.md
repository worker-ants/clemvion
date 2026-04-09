### 발견사항

---

**[WARNING] `vi.clearAllMocks()` 이후 `workflowsApi.get` 미재설정 — 실제로는 안전하나 오해 소지**
- 위치: `execution-detail-page.test.tsx` L119, `execution-list-page.test.tsx` L54
- 상세: 여러 리뷰어가 `vi.clearAllMocks()`가 구현을 날린다고 지적했으나 이는 오진. `clearAllMocks()`는 호출 기록만 초기화하고 `mockResolvedValue` 구현은 유지됨. 그러나 `execution-list-page.test.tsx`는 `beforeEach`에서 `executionsApi.getByWorkflow`를 재설정하지 않아, 향후 테스트 추가 시 구현 소실 위험이 있음(실제로 `clearAllMocks` 대신 실수로 `resetAllMocks`로 바꾸면 즉시 전파됨).
- 제안: `beforeEach` 내에서 `workflowsApi.get`도 명시적으로 재설정하는 패턴으로 통일. 의도를 주석으로 명시.

---

**[WARNING] `executionId: "exec-fail"` vs `failedExec.id: "exec-1"` 불일치**
- 위치: `execution-detail-page.test.tsx` L192, L210
- 상세: `Failed Execution` describe에서 컴포넌트에는 `executionId: "exec-fail"`을 전달하지만 mock 데이터의 `id`는 `"exec-1"`. 결과적으로 `adjacentQuery`의 `items.findIndex`가 `currentIndex === -1`을 반환하여 prev/next 모두 null이 되는 상태로 렌더링됨. 현재는 `mockGetById`가 ID 무관하게 동일 데이터를 반환하므로 통과하지만, 실제 사용 시나리오와 다른 상태를 테스트하고 있어 오해를 유발.
- 제안: `failedExec`의 `id`를 `"exec-fail"`로 맞추거나, `executionId: "exec-1"`로 통일.

---

**[WARNING] `buttonItemMap` 기능 테스트 누락**
- 위치: `carousel.handler.spec.ts`, `carousel-buttons.handler.spec.ts`
- 상세: `carousel.handler.ts`에 추가된 `buttonItemMap` 생성 로직(`buttonItemMap[btn.id] = i`)과 `allButtons` 병합 로직이 전혀 테스트되지 않음. Dynamic 모드에서 `itemButtons`를 설정했을 때 `buttonConfig.buttonItemMap`에 올바른 인덱스 매핑이 생성되는지 검증하는 테스트가 없음.
- 제안:
  ```ts
  it('should generate buttonItemMap for dynamic itemButtons', async () => {
    const result = await handler.execute({
      mode: 'dynamic', source: [{ name: 'A' }, { name: 'B' }],
      titleField: 'name',
      itemButtons: [{ id: 'btn-approve', label: 'Approve', type: 'port' }],
    }, null);
    expect(result.buttonConfig.buttonItemMap).toEqual({
      'btn-approve__item_0': 0,
      'btn-approve__item_1': 1,
    });
  });
  ```

---

**[WARNING] `__item_` 버튼 ID → 포트 라우팅 로직 테스트 누락**
- 위치: `execution-engine.service.spec.ts`, `execution-engine.service.ts:1601-1605`
- 상세: 버튼 클릭 처리에서 `buttonId.includes('__item_') ? buttonId.split('__item_')[0] : buttonId`로 포트를 결정하는 로직이 핵심 기능이나 전용 테스트가 없음. 잘못된 `__item_` 파싱이나 중복 언더스코어 케이스 등에 대한 검증 부재.
- 제안: `btn-approve__item_0` 클릭 시 `selectedPort`가 `"btn-approve"`가 되는지 명시적으로 검증하는 테스트 추가.

---

**[WARNING] `selectedItem` 필드 포함 여부 테스트 누락**
- 위치: `execution-engine.service.spec.ts`
- 상세: 아이템 버튼 클릭 시 `interactionData`에 `selectedItem` 필드가 추가되는 신규 로직이 있으나, 이 필드가 올바른 아이템 데이터를 담는지, global 버튼 클릭 시 누락되는지 검증하는 테스트가 없음.
- 제안: `buttonItemMap`이 있는 상황에서 아이템 버튼 클릭 시 `interactionData.selectedItem`이 해당 인덱스의 아이템과 일치하는지 단위 테스트 추가.

---

**[WARNING] Carousel `source` 필드 실행 경로 테스트 누락**
- 위치: `carousel.handler.spec.ts`
- 상세: `validate()`에 `source` 필드가 추가된 테스트는 있으나, `execute()`에서 `config.source`가 `input` 파라미터보다 우선 사용되는 로직(`const sourceData = config.source`)이 검증되지 않음. `source`가 배열로 resolve된 경우 vs `input`이 배열인 경우의 우선순위 테스트 없음.
- 제안:
  ```ts
  it('should use source over input when source is an array', async () => {
    const result = await handler.execute(
      { titleField: 'name', source: [{ name: 'From Source' }] },
      [{ name: 'From Input' }],
    );
    expect(result.items[0].title).toBe('From Source');
  });
  ```

---

**[INFO] Back 버튼 테스트가 `buttons[0]` 인덱스에 의존 (취약)**
- 위치: `execution-detail-page.test.tsx` L150
- 상세: `screen.getAllByRole("button")[0]`으로 뒤로가기 버튼을 특정. DOM 구조 변경 시 인덱스가 달라지면 다른 버튼이 클릭됨.
- 제안: `screen.getByRole("button", { name: /back/i })` 또는 `aria-label="Back"` 추가 후 해당 선택자 사용.

---

**[INFO] `mockBack` 선언 후 미검증**
- 위치: `execution-list-page.test.tsx` L7
- 상세: `mockBack`이 선언되어 있고 `useRouter`에 주입되지만 어떤 `expect`에서도 사용되지 않음.
- 제안: 뒤로가기 버튼 클릭 시 `router.back()`이 호출되는지 검증하거나, 변수 제거.

---

**[INFO] 페이지네이션/정렬/필터 인터랙션 테스트 부재**
- 위치: `execution-list-page.test.tsx`
- 상세: `ExecutionListPage`의 핵심 인터랙션—필터 버튼 클릭 후 `status` 파라미터로 API 재호출, 컬럼 헤더 클릭 시 정렬 변경, 페이지 버튼 클릭 시 페이지 이동—이 전혀 테스트되지 않음. `handleSort`의 asc→desc 토글 로직도 미검증.

---

**[INFO] `formatDuration(59999)` 경계값 결과가 직관적이지 않음**
- 위치: `execution-status.test.ts` L44
- 상세: `formatDuration(59999)` → `"60.0s"`. 59.999s는 `< 60` 조건에서 `toFixed(1)` = `"60.0s"`로 출력되지만 사용자는 "1m 0s"를 기대할 수 있음. 테스트는 현재 구현을 정확히 반영하나, 경계 처리 방식의 의도가 불명확.
- 제안: 경계값 의도를 주석으로 명시 또는 `< 59950` (반올림 기준) 기준으로 분기 조정 검토.

---

### 요약

백엔드 테스트 변경은 대체로 적절하며, `_selectedPort` 스트립 동작을 검증하는 방향으로 테스트가 업데이트되었다. 그러나 이번 변경에서 도입된 **carousel 아이템 버튼(buttonItemMap, itemButtons, selectedItem, __item_ 라우팅)**의 핵심 로직이 단 한 개의 테스트에도 커버되지 않아, 새 기능의 신뢰도가 낮다. 프론트엔드 테스트는 `execution-status.ts` 유틸 분리와 함께 단위 테스트가 추가된 점은 긍정적이나, `executionId` 불일치(`exec-fail` vs `exec-1`)로 인해 Failed Execution 테스트가 실제 시나리오와 다른 상태를 검증하고 있으며, 정렬·필터·페이지네이션 인터랙션과 Prev/Next 네비게이션에 대한 커버리지 갭이 크다.

### 위험도
**MEDIUM**