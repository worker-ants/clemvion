# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `backfillButtonUuids` — `form` 타입에서 `normalisedPayload`는 `backfillButtonUuids` 내부에서 early-return으로 원본 `payload` 참조를 그대로 반환하지만, 호출부는 `normalisedPayload`를 `formConfig`에 사용한다. 기능상 동일한 객체이나, 함수 계약("side-effect-free, returns new reference when rewritten")과의 명확성이 낮다.
  - 위치: `render-tool-provider.ts` `backfillButtonUuids` line 364 / 호출부 line 604
  - 상세: `form` 분기에서는 `backfillButtonUuids`가 원본 `payload` 참조를 그대로 반환한다. 호출부 주석("form returns early below so the form branch reads `capped.payload` directly")은 역설적으로 실제로는 `normalisedPayload = capped.payload`와 동일 객체를 `formConfig`에 쓰고 있음을 암시한다. 외부에서 `capped.payload`를 공유 참조로 쓰는 경로가 없으므로 실제 상태 오염 가능성은 없다. 다만 주석이 "form 은 아래에서 early return" 이라고 했으나 실제 코드는 form 도 `normalisedPayload`를 소비해 주석과 미묘하게 어긋난다.
  - 제안: 주석을 "form early-returns from `backfillButtonUuids` unchanged; `normalisedPayload === capped.payload` for form" 으로 정정하거나, 가독성을 위해 `form` 분기 호출 이전에 분기를 앞당기는 방향을 검토.

### 발견사항 2
- **[INFO]** `backfillButtonUuids` — 입력 `payload` 객체를 직접 변경하지 않고 스프레드로 새 객체를 생성한다. 원본 참조 공유로 인한 부작용 없음. 함수 주석도 "side-effect-free — returns a new payload reference only when at least one button array was rewritten"으로 명시되어 있으며 구현이 이를 충실히 따른다.
  - 위치: `render-tool-provider.ts` lines 380–408
  - 상세: `out = { ...out, buttons: ... }`, `out = { ...out, items: ... }` 패턴으로 불변성 유지. 내부 `fillButtons`도 `arr.map()`으로 새 배열 반환. `randomUUID()` 호출은 Node.js 내장 `node:crypto`를 사용해 외부 네트워크 없이 로컬에서 처리된다.
  - 제안: 이상 없음.

### 발견사항 3
- **[INFO]** `import { randomUUID } from 'node:crypto'` 신규 추가 — Node.js 내장 모듈이므로 외부 네트워크 호출 없음. 테스트 환경(Jest/Vitest)에서 `node:crypto`는 기본 지원된다. `crypto.randomUUID()`는 부작용 없는 순수 함수(엔트로피 소비 제외)이며 전역 상태를 변경하지 않는다.
  - 위치: `render-tool-provider.ts` line 2
  - 제안: 이상 없음.

### 발견사항 4
- **[INFO]** `backfillButtonUuids` export — 기존에 없던 새 공개 함수가 모듈 인터페이스에 추가되었다. 테스트 파일(`render-tool-provider.spec.ts`)이 이를 직접 import하는 것이 유일한 현재 소비자다. 공개 export이므로 향후 다른 모듈에서 import 가능하나, 현재로서는 외부 호출자 영향 없음.
  - 위치: `render-tool-provider.ts` line 360 (`export function backfillButtonUuids`)
  - 상세: `overlayDefaults`, `renderToolName` 등 기존 테스트 전용 export와 동일한 패턴. 클래스 외부 helper를 export하는 것은 이 파일의 기존 관례와 일치한다.
  - 제안: 이상 없음. 단, 장기적으로 내부 구현 변경 자유도를 높이려면 `@internal` JSDoc 태그 추가를 고려.

### 발견사항 5
- **[INFO]** 프론트엔드 `isSelected` 로직 변경 — `selectedButtonId === btn.id` → `selectedButtonId != null && selectedButtonId === btn.id`. 기존 동작에서 `selectedButtonId`가 실제 string 값(null/undefined 아님)이고 `btn.id`와 일치할 때 `isSelected = true`가 되는 케이스는 그대로 보존된다. 변경은 양쪽 모두 `undefined`일 때의 오동작을 수정하는 것이므로 선택 상태 하이라이팅·클릭 차단 semantics가 깨지지 않는다. `PresentationContent`의 global buttons 영역도 동일 패턴 적용.
  - 위치: `presentation-renderers.tsx` CarouselContent line 249-250, PresentationContent line ~511-512
  - 상세: `isSelected`에 의존하는 `disabled={!isInteractive && !isSelected}` 계산도 영향받는다. 이전에는 `undefined === undefined` → `isSelected=true` → `disabled=false`였던 것이 `isSelected=false` → `disabled=!isInteractive`로 바뀐다. 이는 버튼이 실제로 interactive하지 않은 상황에서 disabled로 정확히 표시되는 올바른 방향이다.
  - 제안: 이상 없음.

### 발견사항 6
- **[INFO]** `CarouselContent`가 테스트 파일(`presentation-renderers.test.tsx`)에서 새로 named export로 import된다. 프로덕션 코드에서 `CarouselContent`가 이미 export되어 있는지 확인이 필요하다. 테스트 빌드 시 존재하지 않으면 컴파일 에러.
  - 위치: `presentation-renderers.test.tsx` line 392, `presentation-renderers.tsx`
  - 상세: diff에서 `presentation-renderers.tsx`의 `CarouselContent` 함수 시그니처 자체는 변경되지 않았고 export 여부는 기존 파일 전체 컨텍스트에서 확인해야 한다. 그러나 테스트가 이미 존재하는 파일에서 해당 함수를 성공적으로 import해 렌더링하는 것을 전제로 작성되어 있으므로, 파일에 export가 있거나 추가된 것으로 간주된다.
  - 제안: `presentation-renderers.tsx`에서 `export function CarouselContent` 또는 `export { CarouselContent }` 선언이 실제로 존재함을 PR 체크리스트에서 확인.

---

## 요약

이번 변경은 `backfillButtonUuids` 순수 함수 추가(불변 스프레드 패턴, 외부 I/O 없음)와 프론트엔드 `isSelected` 비교 가드(`!= null` 추가)로 구성된다. 전역 변수 도입·기존 함수 시그니처 변경·파일시스템/네트워크 부작용·환경 변수 접근은 전혀 없다. `backfillButtonUuids`의 공개 export가 새 API 표면을 추가하지만 현재 소비자는 테스트 파일 하나뿐이고 기존 export 관례와 일관된다. `form` 타입에 대한 호출부 주석이 실제 코드 흐름과 미묘하게 어긋나는 INFO 수준의 관찰이 있으나 기능적 오류는 없다. 전체적으로 의도하지 않은 부작용은 발견되지 않았다.

## 위험도

NONE
