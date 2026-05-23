# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `findButtonLabel` → `findButtonContext` 함수명/시그니처 변경 — export 공개 API 전환
- 위치: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx`
- 상세: 기존 `findButtonLabel(data, buttonId): string | undefined` 는 파일 내부에서만 사용되었으며 export 되지 않았다. 이번 변경으로 `findButtonContext` 와 `composeUserMessage` 가 `export function` 으로 공개되었다. 현재 이 파일을 import 하는 외부 소비자가 `findButtonLabel` 을 import 하고 있었다면 빌드 오류가 발생한다. 단, 검색 범위 내에서 기존 `findButtonLabel` 은 같은 파일 내부에서만 호출되고 있었고 외부 re-export 흔적이 없으므로 현 변경 집합 내에서는 breaking caller 가 없는 것으로 보인다.
- 제안: `findButtonLabel` 이 `export` 되지 않았음을 확인했으므로 위험도는 낮다. 그러나 신규 export 된 `findButtonContext` / `composeUserMessage` 는 이제 공개 API 가 되었으므로, 향후 시그니처를 바꿀 때 하위 호환성을 고려해야 한다.

### [INFO] `buttonDefSchema` 로컬 정의 중복 — `_shared/button.types.ts` 와 미연동
- 위치: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts`, `chart/chart.schema.ts`, `table/table.schema.ts`, `template/template.schema.ts`
- 상세: 각 schema 파일이 로컬에 `buttonDefSchema`(zod) 를 별도로 정의하고 있으며, 이번 변경에서 각각에 `userMessage` 필드를 추가했다. `_shared/button.types.ts` 의 `ButtonDef` 인터페이스(TypeScript interface)와 `validateButtons` 함수는 별개로 유지되어 있다. `validateButtons` 는 `userMessage` 필드를 검사하지 않으므로 4개의 zod 스키마 정의에 각각 `userMessage` 를 추가했지만, 그 중 하나가 누락되거나 다른 제약을 두는 경우 스키마 드리프트가 발생할 수 있다. 이번 변경에서는 4곳 모두 동일하게 추가되어 있어 즉각적인 부작용은 없다.
- 제안: 중장기적으로 공유 `buttonDefSchema` 를 `_shared/` 에 단일 정의하고 각 schema 에서 re-use 하는 구조로 리팩터링하면 향후 필드 추가 시 누락 위험을 제거할 수 있다.

### [INFO] `validateButtons` 에 `userMessage` 검증 미포함
- 위치: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` (`validateButtons` 함수)
- 상세: `ButtonDef` 인터페이스에 `userMessage?: string` 이 추가되었으나, `validateButtons` 함수(imperative validation)에는 `userMessage` 에 대한 유효성 검사(예: `type: "link"` 에서 `userMessage` 설정 시 경고)가 추가되지 않았다. spec 은 "link 타입에서는 무시" 라고 명시하므로 현재 동작(통과)은 의도적이다. 그러나 향후 다른 개발자가 `validateButtons` 를 참조할 때 `userMessage` 유효성 검사 부재를 인지하지 못할 수 있다.
- 제안: 코드 주석에 "link+userMessage 는 parse-time 허용, 런타임 무시는 frontend 책임" 을 명시하면 혼란을 방지할 수 있다.

### [INFO] `findButtonContext` 의 검색 우선순위 — static 모드 `items[].buttons` 에서 `buttonId` 완전 일치만 시도
- 위치: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx`, 라인 수 `items[].buttons` 루프
- 상세: 기존 `findButtonLabel` 은 `items[].buttons` 에서 `b.id === buttonId || buttonId.startsWith(\`${b.id}__item_\`)` 로 매칭했으나, 새 `findButtonContext` 는 1단계에서 `b.id === buttonId` 완전 일치만 시도한다. `__item_{idx}` 접미사가 붙은 ID 는 2단계(itemButtons) 또는 3단계(global buttons)에서 처리된다. 이 변경이 의도적이면 문제없으나, static 모드 per-item 버튼에 `__item_` 접미사가 붙는 시나리오(예: runtime ID 합성 후 items[].buttons 에 저장)가 존재한다면 1단계에서 매칭 실패하고 부모 item 컨텍스트 없이 global 경로로 폴백할 수 있다.
- 제안: static 모드에서 per-item 버튼의 런타임 ID 형식 문서를 확인하고, `items[].buttons` 에 `__item_` 접미사 ID 가 저장되는 경우가 없음을 테스트로 보장하면 된다. 현재 테스트는 완전 일치 케이스만 커버한다.

### [INFO] `handleLinkButtonClick` 내 `window` 객체 직접 접근 — SSR/테스트 환경 영향 없음(기존 코드 유지)
- 위치: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx`
- 상세: 이번 변경에서 `window` 접근 로직 자체는 수정되지 않았으므로 새로운 부작용이 없다. 다만 `"use client"` 지시문이 파일 상단에 있어 SSR 환경 안전성이 보장된다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 `ButtonDef` 인터페이스와 zod 스키마에 옵션 필드 `userMessage` 를 추가하고, frontend의 버튼 클릭 user-message 합성 로직을 `findButtonContext` / `composeUserMessage` 로 분리·확장한 것이다. 전역 변수 도입, 예상치 못한 파일시스템 조작, 환경 변수 접근, 네트워크 호출, 이벤트 발화 변경은 없다. 기존 `findButtonLabel` 함수가 파일 내부 private 사용이었으므로 시그니처 변경으로 인한 외부 breaking change 도 없다. 가장 주목할 부분은 각 presentation 노드별 로컬 `buttonDefSchema` 가 동기화 없이 중복 정의되어 있어 향후 필드 추가 시 드리프트 위험이 잠재한다는 점이다. 또한 static 모드 `items[].buttons` 검색에서 `__item_` 접미사 ID 처리 방식이 기존 대비 변경되었으나, 실제 static 모드에서 해당 ID 패턴이 발생하지 않는다는 전제가 테스트로 명시되어 있지 않다.

## 위험도

LOW
