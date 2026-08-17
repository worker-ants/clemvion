# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새로 추가한 안내 문구가 이 파일이 이미 확립한 muted-text 관용구를 벗어나 `text-muted-foreground` 유틸리티 클래스를 쓰는데, 이 저장소(Tailwind v4, `@import "tailwindcss"` 만 있고 `@theme`로 `--color-muted-foreground` 를 매핑하는 블록이 없음)에서는 이 클래스가 실제 CSS 규칙을 생성하지 않는다.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:460`
  - 상세: 바로 3줄 위(같은 파일 425번 줄, `description` 문단)에서는 `text-[hsl(var(--muted-foreground))]` 를 쓰고, 이 관용구는 `run-results/` 디렉터리의 다른 12개 컴포넌트 전부와 이 파일 자체가 이미 일관되게 쓰고 있다. 전체 `src/` 기준으로 `text-muted-foreground"` (플레인 유틸리티) 를 쓰는 파일은 단 2곳뿐이고, 컴파일된 `.next/static/css/*.css` 번들에도 `.text-muted-foreground` 규칙이 0건이다 — 즉 이 안내 문구(`formMaskedDefaultHint`)는 의도한 회색 텍스트가 아니라 스타일 미적용(기본 전경색) 으로 렌더링될 가능성이 높다. 기능적으로 문구 자체는 보이지만, "왜 비어 있는지 알려준다"는 의도(주석에 명시)와 달리 시각적으로 옅게 처리되지 않아 다른 필드 설명·description 톤과 어긋난다.
  - 제안: `text-[hsl(var(--muted-foreground))]` 로 통일한다.

- **[WARNING]** frontend 미러 상수/함수 이름이 backend SoT 와 달라, 이 파일이 스스로 세운 "미러 동기화" 관례를 어긴다.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:335`(`const MASK_MARKERS`), `:357`(`export function isMaskedValue`) — backend 쪽은 `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `MASKED_MARKERS`(128번 줄대) / `isMaskedMarker`(134번 줄대).
  - 상세: 같은 파일에서 이미 확립된 미러 관용구인 `DEFAULT_FILE_ALLOWED_MIME_TYPES` / `DEFAULT_FILE_MAX_FILE_SIZE_MB` 등은 backend `form-mode.ts` 와 frontend 가 **글자 그대로 같은 식별자**를 쓴다(실측: `grep -rn DEFAULT_FILE_ codebase/backend` 결과 이름이 정확히 일치). 반면 이번에 추가된 마커 미러는 `MASKED_MARKERS`(backend) ↔ `MASK_MARKERS`(frontend), `isMaskedMarker`(backend) ↔ `isMaskedValue`(frontend) 로 이름이 갈린다. 주석에는 "이 목록이 backend 와 어긋나면 가드가 조용히 뚫린다"고 명시하면서도, 정작 backend 상수명으로 grep 하면 frontend 미러가 걸리지 않는다(실측: `grep -rln "MASKED_MARKERS" codebase` → backend 파일 1개만 hit). 두 미러 세트가 나란히 있는 같은 파일 안에서 한쪽만 명명 규칙이 다른 것은 향후 리네임·검색 기반 동기화 작업 시 누락 위험을 높인다.
  - 제안: `MASK_MARKERS` → `MASKED_MARKERS`, `isMaskedValue` → `isMaskedMarker` 로 맞추거나(이 저장소의 기존 `DEFAULT_FILE_*` 선례를 따름), 이름을 의도적으로 다르게 두는 이유를 주석에 남긴다.

- **[INFO]** backend `MASKED_MARKERS` ↔ frontend `MASK_MARKERS` 는 두 파일에 각각 하드코딩된 값이며 자동 동기화 검증(양쪽을 함께 읽어 비교하는 테스트)이 없다. 다만 이는 같은 파일의 `DEFAULT_FILE_*` 미러도 동일하게 겪는, 이 저장소가 이미 받아들인 patterns(frontend CSR ↔ backend NestJS 번들 분리 제약)이라 이번 PR 이 새로 만든 리스크는 아니다. 후속으로 두 상수를 문자열로 비교하는 간단한 계약 테스트(예: 두 값을 각각 import 해 diff 하는 스크립트/테스트)를 고려할 만하다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (MASKED_MARKERS) / `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` (MASK_MARKERS)

- **[INFO]** `sanitize-error-message.ts` 의 마커 상수(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`) 재배치는 그 자체로 가독성을 개선한다 — 이전엔 `MASKED_MARKERS` 를 설명하는 대형 JSDoc 이 실제로는 그 앞의 무관한 `MAX_REDACT_DEPTH` 에 귀속돼 있었는데, 이번 diff 로 세 상수 선언이 JSDoc 바로 앞으로 옮겨지고 `{@link MASKED_MARKERS}` 상호참조가 추가돼 TSDoc 귀속이 올바르게 잡혔다. `deepRedactCore`/`deepRedactObject` 로의 함수 분리, 옵션 객체(`DeepRedactOptions`) 도입, depth-0 캐시의 캐시 키 identity 제약을 명시한 주석 모두 기존 스타일과 일관되고 함수 길이·중첩도 적절하다. 새로 추가된 코드에서 이 파일 자체의 결함은 발견되지 않았다.

- **[INFO]** `dynamic-form-ui.test.tsx` 에 추가된 `describe("DynamicFormUI — 마스킹된 defaultValue 왕복 차단", …)` 블록은 이 파일의 기존 테스트 스타일(JSDoc 으로 "왜"를 먼저 설명, `it.each` 로 마커 3종을 순회, 마스킹 안 됨/프리필 유지 케이스로 과잉 가드 여부까지 검증, 제출 payload 최종 단언)을 그대로 따르고 있어 일관성이 좋다. 별다른 유지보수성 이슈 없음.

## 요약

이번 변경은 EIA 마스킹 왕복 오염을 막는 작은 방어 로직(`isMaskedValue`/`initialValueFor` 가드, 안내 문구, 회귀 테스트)과 기존 JSDoc 귀속 버그 정리(backend `sanitize-error-message.ts`)로 구성되며, 전반적으로 이 저장소의 기존 컨벤션(무거운 근거-설명형 JSDoc, frontend/backend 값 미러 관용구, "양쪽 미러 동시 갱신" 의무 명시)을 잘 따르고 함수 길이·중첩·복잡도 모두 낮게 유지되어 있다. 다만 새로 추가된 안내 문구가 이 파일 스스로 확립한 muted-text 클래스 관용구를 벗어나 실제로 렌더링되지 않을 가능성이 있는 Tailwind 유틸리티(`text-muted-foreground`)를 썼고, 마커 미러의 상수/함수 이름이 같은 파일의 `DEFAULT_FILE_*` 미러 선례와 달리 backend SoT 와 어긋나 grep 기반 동기화 검색이 실패한다는 두 가지 구체적 일관성 결함이 있다. 둘 다 기능 자체를 깨뜨리지는 않지만(문구는 보이고, 마스킹 가드 로직 자체는 정확), 향후 유지보수 시 놓치기 쉬운 함정이라 WARNING으로 보고한다.

## 위험도
LOW
