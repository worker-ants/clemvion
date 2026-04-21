## 유지보수성 코드 리뷰

### 발견사항

---

- **[WARNING]** 조건부 스프레드 패턴 중복
  - 위치: `workflow-view.ts:52-53`, `workflow-assistant-stream.service.ts:743-744`
  - 상세: `...(typeof n.width === 'number' ? { width: n.width } : {})` 패턴이 두 파일에서 각각 width/height 쌍으로 총 4회 반복됨. 두 곳이 같은 의도(undefined 필드를 JSON에서 제거)를 구현하고 있어 향후 `null` 대신 `0`을 폴백으로 쓰는 등 정책 변경 시 누락 가능성이 있음
  - 제안: `spreadMeasured(node: { width?: number; height?: number })` 헬퍼를 `workflow-view.ts`에 두고 양쪽에서 임포트

---

- **[WARNING]** 폴백 수치가 상수로 추출되지 않고 프롬프트 문자열에 산재
  - 위치: `system-prompt.ts:106-111`
  - 상세: `250`(기본 폭), `80`(기본 높이), `32`(gap), `24`(sibling gap)가 시스템 프롬프트 문자열 안에 인라인 리터럴로 삽입되어 있음. 이 값들은 레이아웃 동작의 핵심 파라미터이지만, 변경 시 문자열 내부를 수동으로 찾아 수정해야 하며 타입 안전성이 없음
  - 제안: `system-prompt.ts` 상단에 `LAYOUT_DEFAULT_WIDTH = 250`, `LAYOUT_DEFAULT_HEIGHT = 80`, `LAYOUT_COLUMN_GAP = 32`, `LAYOUT_SIBLING_GAP = 24` 상수를 선언하고 템플릿 리터럴에서 참조

---

- **[WARNING]** 테스트 내 비일관적인 async 스타일
  - 위치: `workflow-assistant-stream.service.spec.ts:1542`, `1601`
  - 상세: 첫 번째 추가 테스트는 `async/await` + `await collect(...)` 패턴을 사용하고, 두 번째 테스트는 `return collect(...).then(...)` 패턴을 사용함. 같은 `describe` 블록 내에서 스타일이 혼재되어 있음
  - 제안: 두 번째 테스트도 `async/await`로 통일 (`it('...', async () => { ... await collect(...); ... })`)

---

- **[INFO]** `height` 필드 JSDoc 누락
  - 위치: `shadow-workflow.ts:12-18`
  - 상세: `width` 위에 상세한 JSDoc 블록이 있지만 `height` 필드는 같은 블록 이후 주석 없이 단독으로 선언됨. `width`의 설명이 암묵적으로 `height`에도 해당되지만 명시적이지 않음
  - 제안: `/** React Flow 가 렌더 후 측정한 노드 높이 (px). width 와 동일한 생명주기 */` 추가하거나, 두 필드를 하나의 JSDoc으로 묶어 선언

---

- **[INFO]** `assistant-panel.tsx`의 타입 캐스팅 방식이 취약
  - 위치: `assistant-panel.tsx:103-107`
  - 상세: `(n as { measured?: { width?: number; height?: number } }).measured`와 `n as { width?: number; height?: number }` 두 캐스트가 런타임 보장 없이 React Flow 내부 구조에 의존. React Flow가 `measured` API를 변경하면 TypeScript가 감지하지 못함
  - 제안: React Flow의 공식 타입 (`Node` from `@xyflow/react`)을 임포트해 `n.measured` 접근, 또는 별도 타입 가드 함수 `getMeasuredDimensions(node: Node)` 추출로 접근점 단일화

---

- **[INFO]** 주석 언어 불일치
  - 위치: `assistant.ts:80-86`
  - 상세: 해당 파일의 `AssistantWorkflowSnapshot` JSDoc이 영어로 작성된 반면, 동일 기능을 설명하는 `shadow-workflow.ts`와 `workflow-view.ts`의 JSDoc은 한국어. 두 언어가 섞이면 미래 기여자가 어느 언어로 주석을 작성해야 할지 혼란스러울 수 있음
  - 제안: 팀 내 주석 언어 컨벤션을 확정하고 일관되게 적용

---

### 요약

이번 변경은 React Flow의 렌더 측정값(`width`/`height`)을 DTO → Shadow → View → 프롬프트로 흘려 LLM 레이아웃 품질을 개선하는 작업으로, 전반적으로 목적이 명확하고 기존 코드베이스 스타일과 잘 어울린다. 핵심 우려사항은 조건부 스프레드 패턴의 4중 복제와 시스템 프롬프트 문자열에 매직 넘버가 흩어진 점인데, 두 문제 모두 향후 폴백 수치나 필드 제거 정책이 바뀔 때 누락 수정 리스크를 만든다. 테스트 커버리지(신규 `workflow-view.spec.ts` + 통합 테스트 2건)는 적절하며, 특히 측정값 유무에 따른 JSON 필드 누락/포함 동작을 명확히 검증하고 있어 회귀 방지 측면에서 우수하다.

### 위험도

**LOW**