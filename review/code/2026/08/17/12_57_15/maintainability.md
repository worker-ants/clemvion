# 유지보수성(Maintainability) 리뷰 — eia-masking-round2 (12_57_15, 라운드 3)

## 발견사항

- **[INFO]** (긍정 확인) 직전 두 라운드(`12_06_12`, `12_33_36`)에서 제기된 유지보수성 WARNING 2건과 INFO 1건이 모두 실제 소스에 반영되어 있음을 재확인했다.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339`(`export const MASKED_MARKERS`), `:371`(`export function isMaskedMarker`), `:439`/`:474`(안내 문구·description 모두 `text-[hsl(var(--muted-foreground))]` 로 통일), `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:3`(`import { DynamicFormUI, MASKED_MARKERS }`), `:600`(`const MARKERS = [...MASKED_MARKERS]`), `:605-607`(리터럴 대조 캐너리 테스트).
  - 상세: (1) 프런트 미러 상수/함수 이름이 backend `sanitize-error-message.ts` 의 `MASKED_MARKERS`/`isMaskedMarker`(`:128`, `:134`)와 정확히 일치해 grep 기반 동기화가 성립한다. (2) 안내 문구가 파일이 이미 확립한 muted-text 관용구(`text-[hsl(var(--muted-foreground))]`)를 그대로 따른다 — 미적용 CSS 유틸리티(`text-muted-foreground`) 잔존 없음. (3) 테스트 파일이 마커 리터럴을 손으로 3중 복제하던 상태에서 벗어나, `export` 된 구현 상수를 `it.each` 로 파생 순회하면서도 값 자체의 drift 는 별도 리터럴 대조 테스트(`toEqual(["***", "[REDACTED]", "[REDACTED_DEPTH]"])`)로 못박아 두었다 — "파생만 하면 값이 통째로 바뀌어도 초록" 이라는 흔한 vacuous-test 함정을 스스로 피했다.
  - 제안: 조치 불요.

- **[INFO]** `CHANGELOG.md` 의 "아래 항목" 죽은 포인터(직전 라운드 documentation WARNING)가 방향·대상 모두 정정되어 이 파일 자신의 "최신이 위로 쌓인다" 관례와 일치한다.
  - 위치: `CHANGELOG.md:3`(신설 `## Unreleased` 절, 파일 최상단), `:62`(`(**닫는 조건**인 프런트 마커 가드는 위 항목이 폼 프리필에 세웠다 …)`)
  - 상세: 실제로 상단(`:3`)에 이 PR 전용의 자기-완결적 `## Unreleased` 절이 신설됐고, 하단(`:62`)의 참조는 "아래"에서 "위"로 방향이 바뀌어 그 절을 정확히 가리킨다. `grep -n "isMaskedMarker" CHANGELOG.md` 로 확인해도 실재하지 않는 항목을 가리키는 잔여 포인터는 없다.
  - 제안: 조치 불요.

- **[INFO]** 이번 diff 로 추가된 신규 코드(`MASKED_MARKERS`, `isMaskedMarker`, `initialValueFor` 확장, 안내 JSX, 테스트 `describe` 블록)는 함수 길이·중첩 깊이·순환 복잡도가 모두 낮고, 이 파일이 기존에 확립한 컨벤션(근거-설명형 JSDoc, `DEFAULT_FILE_*` 와 동일한 backend↔frontend 미러 관용구, `it.each` 데이터 주도 테스트, 양·음 단언 병행)을 그대로 따른다. `isMaskedMarker` 는 `typeof v === "string" && MASKED_MARKERS.has(v)` 한 줄짜리 순수 함수이고, `initialValueFor` 는 얼리 리턴 3단으로 중첩이 없다. 매직 넘버 없음(마커 문자열 3종은 이름 있는 상수로 선언).
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339-384`, `:471-477`; `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-136`
  - 제안: 조치 불요.

- **[INFO]** (참고, 비차단) backend `MASKED_MARKERS` ↔ frontend `MASKED_MARKERS` 는 여전히 두 파일에 수동 복제된 SoT-미러 구조이고, 이를 기계로 대조하는 크로스-스택 계약 테스트(backend jest ↔ frontend vitest)는 아직 없다. 다만 이는 새로 발견된 사안이 아니라 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 별건으로 등재돼 있고(공유 패키지 추출 선행 필요), 프런트 쪽 절반은 이번 라운드에서 리터럴 대조 테스트로 이미 기계화됐다.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339`, `codebase/backend/src/shared/utils/sanitize-error-message.ts:128`
  - 제안: 트래커 등재 상태 유지, 이번 PR 범위에 추가 조치 불요.

## 요약

이번 diff(라운드 3, `12_57_15`)는 앞선 두 라운드에서 제기된 유지보수성 WARNING·INFO 전부가 실제 소스에 반영·해소된, 이미 충분히 정제된 상태를 담고 있다. 직접 파일을 열어 재검증한 결과 미러 명명 일관성(`MASKED_MARKERS`/`isMaskedMarker` 양쪽 동일), muted-text 클래스 관용구 준수, 테스트 리터럴 3중 복제 제거(파생 + 리터럴 대조 병행), CHANGELOG 죽은 포인터 정정까지 모두 확인됐다. 신규 코드는 함수 길이·중첩·복잡도가 낮고 이 파일이 이미 확립한 스타일(무거운 근거 JSDoc, backend-frontend 미러 관용구, 데이터 주도 테스트)을 벗어나지 않는다. 새로 발견된 유지보수성 결함은 없다. 유일한 잔여(크로스-스택 계약 테스트 부재)는 이번 PR 이전부터 알려진 구조적 제약이며 별도 트래커 항목으로 이미 관리되고 있어 이번 diff 의 결함이 아니다.

## 위험도
NONE
