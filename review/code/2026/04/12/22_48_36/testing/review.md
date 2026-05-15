### 발견사항

---

**[CRITICAL] execution-engine.service.ts — `waitForButtonInteraction` 변경 사항에 대한 단위 테스트 전무**
- 위치: `execution-engine.service.ts` diff 중 `waitForButtonInteraction` 내부 (버튼 클릭 후 `updatedStructured` 빌드 및 `setStructuredOutput` 호출 부분)
- 상세: 버튼 클릭 처리 이후 구조화된 출력 캐시(`structuredOutputCache`)를 갱신하고, `nodeExec.outputData`를 flat shape 대신 `NodeHandlerOutput`으로 저장하는 로직이 추가되었지만, 이를 검증하는 테스트가 없음. `buttonConfig`를 structured cache → flat cache 순으로 fallback하는 경로, `structuredOutputPayload.previousOutput`, `structuredOutputPayload.selectedItem` 등 새로운 필드 모두 미검증
- 제안: `waitForButtonInteraction`에 대한 단위 테스트 추가 필요:
  - structured cache에 `buttonConfig`가 있는 경우 vs flat cache에만 있는 경우
  - `buttonItemMap`이 있을 때 `selectedItem`이 올바르게 resolve되는지
  - `nodeExec.outputData`가 `updatedStructured` 형태인지 확인
  - `setStructuredOutput`이 올바른 인자로 호출되는지 spy 검증

---

**[CRITICAL] `pdf.handler.spec.ts` 부재 — 출력 shape 변경 미검증**
- 위치: `pdf.handler.ts` 전체
- 상세: `PdfHandler`의 반환 형태가 flat shape(`{ type, status, fileName, ... }`)에서 `{ config, output, status }` 구조로 완전히 변경되었으나, 제출된 변경사항에 `pdf.handler.spec.ts`가 포함되지 않음. 기존에 테스트가 존재하지 않거나 누락된 것으로 추정
- 제안: 최소한 다음 케이스를 포함한 테스트 작성 필요:
  ```typescript
  expect(result.output.type).toBe('pdf');
  expect(result.output.fileName).toBe('document.pdf');
  expect(result.config.fileName).toBeDefined();
  expect(result.status).toBe('requires_playwright');
  ```

---

**[CRITICAL] `interactionType` fallback 경로 검증 없음**
- 위치: `execution-engine.service.ts`:461–470, 845–852 (두 곳)
- 상세: 새로운 로직:
  ```typescript
  const interactionType =
    (structuredMeta?.interactionType as string | undefined) ??
    (nodeOutput?.interactionType as string | undefined);
  ```
  structured cache 우선, legacy flat cache fallback 구조인데, 다음 세 경로 모두 미검증:
  1. structured cache에 `interactionType`이 있을 때
  2. structured cache 없이 legacy flat cache만 있을 때
  3. 둘 다 없을 때 (`undefined` → `if` 분기 스킵)
- 제안: `executeInline`/`resumeExecution` 관련 통합 테스트에서 각 케이스 커버

---

**[WARNING] `chart-buttons.handler.spec.ts` — `config.buttonConfig` 내용 미검증**
- 위치: `chart-buttons.handler.spec.ts`:48–58
- 상세: carousel/table 테스트는 `result.config.buttonConfig`의 내용(`buttons`, `buttonTimeout`, `buttonTimeoutAction`)을 검증하는데, chart 버튼 테스트는 `result.output.data` 존재 여부만 확인하고 `buttonConfig` 구조 검증이 없음
- 제안:
  ```typescript
  expect(result.config.buttonConfig).toEqual({
    buttons,
    buttonTimeout: undefined,
    buttonTimeoutAction: 'continue',
  });
  ```

---

**[WARNING] carousel per-item 버튼 시나리오에서 `buttonItemMap` 미검증**
- 위치: `carousel-buttons.handler.spec.ts` 전체
- 상세: `CarouselHandler`는 `itemButtons` 설정 시 `buttonItemMap`을 생성해 `config.buttonConfig.buttonItemMap`에 포함시키지만, 이 경로를 검증하는 테스트가 없음. `buttonItemMap`은 `waitForButtonInteraction`에서 `selectedItem` resolve에 사용되므로 중요한 경로
- 제안: `itemButtons`를 포함한 케이스 추가:
  ```typescript
  it('should include buttonItemMap when itemButtons are configured', async () => {
    const result = await handler.execute(
      [{ name: 'Item A' }, { name: 'Item B' }],
      { titleField: 'name', itemButtons: [{ id: 'approve', label: 'Approve', type: 'port' }] },
      context,
    );
    expect(result.config.buttonConfig.buttonItemMap).toBeDefined();
    expect(result.config.buttonConfig.buttonItemMap['approve__item_0']).toBe(0);
  });
  ```

---

**[WARNING] `buttonConfig` 비어있을 때 non-null assertion 런타임 위험**
- 위치: `execution-engine.service.ts`:1551 부근
  ```typescript
  const buttonConfig = ((structuredConfig?.buttonConfig ??
    nodeOutput.buttonConfig) as ButtonConfig | undefined)!;
  const buttons = buttonConfig.buttons; // buttonConfig가 undefined면 throw
  ```
- 상세: `!` assertion을 사용했지만 `structuredConfig?.buttonConfig`와 `nodeOutput.buttonConfig` 둘 다 없을 경우 `buttonConfig.buttons`에서 TypeError 발생. 테스트에서 이 defensive 경로를 다루지 않음
- 제안: null 가드 추가 또는 `buttonConfig`가 없을 때의 동작을 검증하는 테스트

---

**[WARNING] `outputItems` 3단계 fallback 경로 미검증**
- 위치: `execution-engine.service.ts` diff 중 `outputItems` 관련 코드
  ```typescript
  const outputItems = (structuredOutputObj?.items ??
    nodeOutput.items ??
    cleanNodeOutput.items) as unknown[] | undefined;
  ```
- 상세: structured output에 items가 있는 경우, flat cache에만 있는 경우, 둘 다 없는 경우 각각 `selectedItem` resolve가 올바른지 테스트 없음
- 제안: 각 fallback 케이스에 대한 단위 테스트

---

**[INFO] `handler-output.adapter.ts` — 타입 캐스트 제거에 대한 기존 테스트 검증 충분**
- 위치: `toEngineFlatShape` 함수
- 상세: `adapted.config`의 타입 캐스트 제거는 타입 시스템 수준의 변경으로, 기능적 동작은 동일. `NodeHandlerOutput.config`가 이미 올바른 타입이라면 기존 테스트로 충분하나, `handler-output.adapter.spec.ts`가 변경사항에 포함되지 않아 기존 테스트 존재 여부 불확실

---

**[INFO] `table.handler.spec.ts` — `configEcho` 내용 검증 없음**
- 위치: `table.handler.spec.ts` 전반
- 상세: `result.output.*` 검증은 철저하지만, `result.config`(mode, columns, pageSize, sortBy, sortOrder)의 내용을 검증하는 테스트가 없음. 특히 `configEcho`에 `columns`가 resolved label로 포함되는지 미검증

---

### 요약

이번 변경은 핸들러 출력 shape를 flat 구조에서 `{ config, output, meta, status }` 구조화 형태로 마이그레이션하는 대규모 리팩토링으로, presentation handler들(carousel, table, chart, pdf)과 서비스 레이어 모두 영향을 받습니다. `carousel`, `table`, `chart`의 핸들러 단위 테스트는 새로운 shape에 맞게 잘 업데이트되었으나, **`pdf.handler.ts`의 테스트 부재**, **`execution-engine.service.ts`의 핵심 변경 로직(버튼 클릭 처리, structured 캐시 갱신, interactionType fallback)**에 대한 테스트가 전무한 것이 가장 큰 위험입니다. 특히 `waitForButtonInteraction` 내부의 복잡한 structured output 빌드 로직과 `nodeExec.outputData` 변경은 회귀 위험이 높으며, `buttonItemMap`을 통한 `selectedItem` resolve 경로도 end-to-end 검증이 필요합니다.

### 위험도

**HIGH**