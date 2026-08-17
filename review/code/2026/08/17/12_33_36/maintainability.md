# 유지보수성(Maintainability) 리뷰 — eia-masking-round2 (round 2, 12_33_36)

## 발견사항

- **[INFO]** 마스킹 마커 리터럴이 3곳에 수동 복제되어 있는데, 이번 라운드에서 `MASKED_MARKERS` 가 export 로 승격돼 그중 한 곳(테스트)은 이제 import 로 대체 가능한데도 여전히 하드코딩 배열을 쓴다.
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:598` (`const MARKERS = ["***", "[REDACTED]", "[REDACTED_DEPTH]"];`)
  - 상세: 같은 값 집합이 backend `sanitize-error-message.ts` 의 `MASKED_MARKERS`(SoT), frontend `dynamic-form-ui.tsx` 의 `MASKED_MARKERS`(export 미러), 그리고 이 테스트 파일의 로컬 `MARKERS` 배열까지 세 군데에 존재한다. 직전 라운드(`review/code/2026/08/17/12_06_12/SUMMARY.md` INFO #8)가 이미 같은 지적을 했지만 당시엔 프런트 상수가 export 되지 않아(`MASK_MARKERS`, 비-export) `it.each([...MASK_MARKERS])` 전환이 불가능했다. 이번 라운드에서 그 상수가 `export const MASKED_MARKERS`(`dynamic-form-ui.tsx:339`)로 승격됐으므로, 테스트 파일이 `import { MASKED_MARKERS } from "../dynamic-form-ui"` 후 `it.each([...MASKED_MARKERS])` 로 바꾸는 비용이 이제 사실상 0에 가깝다. 값 자체는 fail-safe 방향(구현이 마커를 늘려도 테스트가 거짓으로 실패하지는 않고 그 신규 마커에 대한 커버리지만 조용히 빠짐)이라 급하지 않지만, 리터럴을 손으로 3중 복제하는 상태가 이 PR 의 "미러 어긋나면 가드가 조용히 뚫린다" 라는 스스로의 경고와 같은 클래스 문제다.
  - 제안: `MARKERS` 선언을 `[...MASKED_MARKERS]` (import 경유)로 교체. 우선순위는 낮음(INFO 유지) — 이번 PR 스코프에 넣을지는 재량.

- **[INFO]** (긍정 확인) 직전 라운드(`12_06_12`)가 지적한 두 WARNING — muted-text 클래스 오사용(`text-muted-foreground` → 미적용 CSS)과 미러 명명 불일치(`MASK_MARKERS`/`isMaskedValue` → backend 와 어긋남) — 가 이번 diff 에서 실제로 해소되어 있음을 확인했다.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:474`(`text-[hsl(var(--muted-foreground))]` 로 통일, 같은 파일 439번 줄의 `description` 렌더와 동일 관용구), `:339`/`:371`(`MASKED_MARKERS`/`isMaskedMarker` — backend `sanitize-error-message.ts` 의 `MASKED_MARKERS`/`isMaskedMarker` 와 이름이 정확히 일치)
  - 상세: `RESOLUTION.md`(`review/code/2026/08/17/12_06_12/RESOLUTION.md` §5·§6)에 기록된 수정 내용과 실제 소스가 일치한다. 조치 불요.

- **[INFO]** `sanitize-error-message.ts` 의 마커 상수 재배치(순서만 이동, JSDoc 을 정확한 선언에 귀속)는 그 자체로 가독성 개선이며 로직·값 변경이 없다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-127`
  - 상세: 이전엔 `MASKED_MARKERS` 를 설명하는 대형 JSDoc 이 실제로는 그 앞의 무관한 선언(`MAX_REDACT_DEPTH`)에 붙어 있었는데, 이번 diff 로 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 세 상수 선언이 관련 JSDoc 바로 위로 옮겨지고 `{@link MASKED_MARKERS}` 상호참조가 추가돼 TSDoc 귀속이 맞게 잡혔다. 조치 불요.

- **[INFO]** 신규 코드(`isMaskedMarker`, `initialValueFor` 확장, hint JSX, `dynamic-form-ui.test.tsx` 신규 `describe` 블록)는 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, 이 파일이 이미 확립한 컨벤션(무거운 "왜" 설명 JSDoc, `DEFAULT_FILE_*` 와 동일한 backend-frontend 미러 관용구, `it.each` 데이터 주도 테스트, 양의/음의 단언을 함께 검증)을 그대로 따른다. 매직 넘버 없음, 새로 추가된 조건문은 단일 depth(중첩 없음).
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339-384`, `:471-477`

## 요약

이번 diff 는 EIA 마스킹 왕복 오염을 막는 작은 가드(`isMaskedMarker`/`initialValueFor` 확장, 안내 문구, 회귀 테스트 6건)와 JSDoc 귀속 버그 재배치(backend)로 구성되며, 직전 라운드(`12_06_12`)에서 발견된 WARNING 2건(muted-text 클래스 오사용, 미러 명명 불일치)이 모두 실제로 해소되었음을 확인했다. 남은 것은 INFO 수준의 사소한 항목뿐이다 — 테스트 파일의 마커 리터럴이 이제는 export 된 `MASKED_MARKERS` 를 import 해 대체할 수 있는데도 여전히 손으로 복제돼 3중 하드코딩 상태다(값 자체는 fail-safe 방향이라 급하지 않음). 함수 길이·중첩·순환 복잡도·네이밍·일관성 모두 이 파일이 기존에 확립한 패턴을 벗어나지 않는다.

## 위험도
NONE
