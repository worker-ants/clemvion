# Testing Review — render-form-options-and-state-fix

## 발견사항

### backfillFormOptionValues 단위 테스트 (render-tool-provider.spec.ts)

- **[INFO]** 테스트 존재 여부 — 충분
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts`, 신규 `describe` 블록 2개
  - 상세: `backfillFormOptionValues` 단위 테스트 10케이스 + 통합 테스트 1케이스가 신설되었다. non-form 타입 no-op, missing value 백필, 빈 문자열 처리, non-empty value 보존, null/undefined 처리, number/boolean typed value 보존, 다중 필드 인덱스 구분, options 없는 필드 skip, 참조 동일성(no-op fast path), 필드 배열 누락 graceful handling, primitive option entry 처리까지 모든 주요 경로가 커버된다.

- **[INFO]** 통합 테스트의 mock 범위
  - 위치: `describe('RenderToolProvider.execute — backfillFormOptionValues integration ...')`, line 260
  - 상세: `provider.execute()` 를 직접 호출하고 `blockingFormRender.formConfig` 를 검증한다. `provider` 인스턴스는 파일 최상단 `const provider = new RenderToolProvider()` 로 모든 `describe` 블록이 공유한다. 이 인스턴스가 싱글턴으로 재사용되므로 이전 테스트에서 provider 내부 상태가 변형되었을 경우 테스트 간 오염 가능성이 이론상 존재하나, `RenderToolProvider` 가 stateless 클래스임을 코드로 확인(`readonly key = 'render'`, static logger)했으므로 실질적 위험은 없다.

- **[WARNING]** `backfillFormOptionValues` 의 idempotency(멱등성) 테스트 누락
  - 위치: `describe('backfillFormOptionValues (spec §10.5 step 4)')` 전체
  - 상세: 함수 JSDoc 에 "idempotent" 성질이 명시되어 있으나, 이미 백필된 결과에 다시 `backfillFormOptionValues` 를 호출했을 때 값이 변경되지 않음을 검증하는 테스트가 없다. `opt-0-0` 같은 non-empty string 은 이미 "preserves non-empty" 케이스에서 간접 검증되지만, 백필 결과물을 입력으로 재호출하는 명시적 idempotency 케이스가 없다.
  - 제안: `const once = backfillFormOptionValues('form', payload); const twice = backfillFormOptionValues('form', once); expect(twice).toBe(once);` 형태의 케이스를 추가.

- **[WARNING]** `fields` 가 배열이지만 요소가 primitive인 경우 테스트 누락
  - 위치: `describe('backfillFormOptionValues ...')` — 현재 "non-object option entries" 케이스는 있으나 field 자체가 primitive인 케이스 없음
  - 상세: `fields: [42, 'string', null]` 처럼 field 요소 자체가 non-object 인 경우, 구현 코드는 `if (field === null || typeof field !== 'object') return field` 로 보호한다. 이 경로는 테스트되지 않는다. LLM 오염 입력에서 충분히 발생 가능한 케이스다.
  - 제안: 별도 `it('skips non-object field entries gracefully')` 케이스 추가.

- **[INFO]** 통합 테스트에서 `mode: 'multi_turn'` 만 검증
  - 위치: `describe('RenderToolProvider.execute — backfillFormOptionValues integration ...')`, line 290
  - 상세: `config: { mode: 'multi_turn', presentationTools: [{ type: 'form' }] }` 로만 테스트한다. `single_turn` 모드에서 `backfillFormOptionValues` 가 동일하게 적용되는지는 기존 테스트에 form-single_turn 케이스가 있을 경우 간접 커버되지만, 명시적 통합 케이스는 없다.
  - 제안: 현재 단위 테스트로 충분하나, regression guard 차원에서 single_turn 분기에서도 backfill 결과가 반영되는지 확인하는 케이스를 향후 추가 검토.

---

### DynamicFormUI 프론트엔드 테스트 (dynamic-form-ui.test.tsx)

- **[INFO]** 테스트 존재 여부 — 신규 파일로 전면 추가
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx` (신규)
  - 상세: select 백필 검증, placeholder 구분 회귀 가드, radio numeric value String coerce, number 빈 입력 보존, file 단일/다중/미선택, defaultValue 전체 필드 매트릭스까지 총 11케이스. 버그 보고와 직결된 핵심 경로가 모두 포함된다.

- **[INFO]** 테스트 격리 — 양호
  - 상세: 각 `it` 블록에서 독립적으로 `render()`를 호출하며 공유 상태가 없다. `vi.fn()` mock은 각 테스트에서 새로 생성된다. `beforeEach` cleanup이 명시되어 있지는 않으나, `@testing-library/react` 의 기본 cleanup이 각 테스트 후 DOM을 정리한다고 가정할 수 있다.

- **[WARNING]** `key={waitingNodeId}` 안정화 효과를 검증하는 테스트 부재
  - 위치: `page.tsx` diff (파일 3), `result-detail.tsx` diff (파일 6)
  - 상세: 이번 변경의 핵심 목적 중 하나인 "WS 이벤트 flicker로 DynamicFormUI가 remount되어 사용자 입력이 리셋되는 문제"는 frontend 레이어에서 `key` prop을 추가하여 해결했다. 그러나 `dynamic-form-ui.test.tsx`에는 동일 `key`로 props가 변경되었을 때 state가 보존되는 시나리오 테스트가 없다. React Testing Library에서는 `rerender()`로 시뮬레이션 가능하다.
  - 제안: `render(<DynamicFormUI key="same" formConfig={config1} ...>)` → 입력 변경 → `rerender(<DynamicFormUI key="same" formConfig={config2} ...>)` → 기존 입력이 보존됨을 검증하는 케이스 추가. 반대로 `key`가 바뀌면 state가 리셋되는 케이스도 추가하면 의도를 명확히 문서화할 수 있다.

- **[WARNING]** file 필드 다중 파일 실제 제출 경로 미검증
  - 위치: `describe("DynamicFormUI — file 케이스")` — `"maxFiles > 1"` 케이스
  - 상세: `maxFiles: 3` 케이스는 `multiple` 속성과 `accept` 속성만 검증하고, 실제로 복수 파일을 선택·제출했을 때 metadata 배열이 올바르게 수집되는지는 테스트하지 않는다. 단일 파일 케이스는 전체 흐름(change → submit)을 검증하지만, 다중 파일 케이스는 속성 검사에서 멈춘다.
  - 제안: `Object.defineProperty(fileInput, 'files', { value: [file1, file2] })` 후 submit하여 `submitted.docs` 가 length 2의 배열임을 검증하는 케이스 추가.

- **[INFO]** `textarea` 필드 테스트 누락
  - 위치: `describe("DynamicFormUI — defaultValue / 전체 필드 매트릭스")`
  - 상세: defaultValue 매트릭스 테스트에서 `text, number, email, textarea, date, select, radio, checkbox` 8종이 포함되어 있으나, textarea의 변경 이벤트와 submit까지의 흐름을 단독으로 검증하는 케이스는 없다. defaultValue 초기화는 검증되나, 사용자가 textarea를 수정 후 submit하는 경로는 미커버.
  - 제안: LOW 우선순위이나 향후 추가 권장.

- **[INFO]** `required` 속성 미제출 검증 없음
  - 위치: 전체 `dynamic-form-ui.test.tsx`
  - 상세: plan 에서 "required 검증 부족 — HTML attribute 만 의존" 을 LOW 위험도로 분류했으나, 이를 검증하는 테스트도 없다. HTML5 validation은 jsdom 환경에서 발화하지 않으므로 테스트로 잡기 어려운 영역이긴 하다.
  - 제안: 현재 단계에서 e2e 레이어로 위임 가능. 단, 향후 JS-level validation을 추가할 경우 unit 테스트 추가 필요.

- **[INFO]** `email` 필드 독립 케이스 없음
  - 위치: `dynamic-form-ui.test.tsx`
  - 상세: `email` 필드는 defaultValue 매트릭스에서 초기값 렌더만 검증. change → submit 흐름은 미커버. text/number와 로직이 동일하여 낮은 우선순위.

- **[INFO]** `date` 필드 독립 케이스 없음
  - 위치: `dynamic-form-ui.test.tsx`
  - 상세: `date` 필드도 defaultValue 초기값만 검증. 위와 동일한 이유로 낮은 우선순위.

---

### page.tsx / result-detail.tsx 변경 (파일 3, 6)

- **[INFO]** 변경 자체에 대한 단위 테스트 없음
  - 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`, `codebase/frontend/src/components/editor/run-results/result-detail.tsx`
  - 상세: `key` prop 추가는 JSX 한 줄 변경이며, 해당 컴포넌트들은 전체 page/context 의존성이 크다. 별도 unit 테스트보다는 e2e 또는 시각적 회귀 테스트가 더 적합한 영역이다. `DynamicFormUI` 자체에 대한 테스트가 `dynamic-form-ui.test.tsx`에 있으므로 레이어 분리는 적절하다.

---

## 요약

이번 변경은 TDD 방법론을 충실히 따르고 있다. backend의 `backfillFormOptionValues`에 대한 단위 테스트 10건과 통합 테스트 1건, frontend `DynamicFormUI`에 대한 신규 테스트 파일 11건이 모두 버그 보고와 직결된 경로를 커버한다. 특히 빈 문자열/null/undefined 처리, 타입 드리프트 coerce, 다중 필드 인덱스 구분, no-op fast path 참조 동일성 등 엣지 케이스 커버리지가 우수하다. 다만 (1) `backfillFormOptionValues` 멱등성 명시적 검증 부재, (2) field 요소 자체가 primitive인 경우 테스트 누락, (3) `key` prop 변경으로 인한 state 보존/리셋 동작을 직접 검증하는 케이스 부재, (4) 다중 파일 선택 후 실제 submit 경로 미검증이 개선 포인트로 남는다. 회귀 위험은 낮지만 장기 유지보수 관점에서 idempotency 케이스와 key-driven remount 케이스 추가를 권장한다.

## 위험도

LOW
