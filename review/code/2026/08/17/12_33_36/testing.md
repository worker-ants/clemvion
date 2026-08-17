# 테스트(Testing) 리뷰 — EIA 마스킹 왕복 오염 가드 (round2, fix 반영 후 재검토)

## 조사 방법

- 이 diff 는 직전 라운드(`review/code/2026/08/17/12_06_12/`)의 testing WARNING 2건이 이미
  `RESOLUTION.md` 로 fix 됐다고 주장하는 상태다. 주장을 신뢰하지 않고 **독립적으로 재현**했다:
  1. `Button type="submit"` → `type="button"` 뮤테이션 후 `dynamic-form-ui.test.tsx` 재실행 →
     **14 failed / 11 passed** (RESOLUTION 주장과 일치). 제출 테스트가 이제 `fireEvent.click`
     을 쓰므로 이 회귀를 정상 포착.
  2. 힌트 노출 조건 `isMaskedMarker(field.defaultValue) &&` → `true &&` 뮤테이션 후 재실행 →
     **2 failed / 23 passed** (RESOLUTION 주장과 일치). "안내가 아예 없다" 부재 단언 테스트가
     정상 포착.
  3. 마커 가드 자체(`initialValueFor` 의 `!isMaskedMarker(...)` 조건) 제거 뮤테이션 → **4 failed
     / 21 passed** — plan(`eia-masked-prefill-roundtrip-guard.md`)이 주장한 "가드 제거 → 오염
     재현" 뮤테이션도 재현됨.
  - 세 뮤테이션 모두 `cp` 백업 → 원복으로 처리, 최종 `git diff` 로 무결 확인
    (`git status --porcelain` 에 대상 파일 잔여 diff 없음, 25 passed 로 복귀).
- `sanitize-error-message.ts` diff 는 JSDoc/상수 재배치뿐임을 `git diff` 로 재확인하고 기존
  `sanitize-error-message.spec.ts` 를 직접 실행 — 48 passed, 회귀 없음.
- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` /
  `__tests__/dynamic-form-ui.test.tsx` 실제 파일을 `Read`/`grep` 로 열어 diff 게이트 번호가
  실제 소스 줄 번호와 일치함을 확인.

## 발견사항

- **[INFO]** (긍정 확인) 직전 라운드 testing WARNING 1·2 는 실제로 해소됐다 — 뮤테이션 재현으로 검증 완료
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:717-718`(`fireEvent.click`), `:696-699`(부재 단언), `:667-683`(1건만 노출 단언)
  - 상세: 위 "조사 방법" §1·2 로 독립 재현. `fireEvent.submit`→`fireEvent.click` 통일과
    "마스킹되지 않은 필드만 있으면 안내가 아예 없다" 부재 단언 추가가 실제로 해당 뮤턴트를
    RED 로 잡는다. 재작업 불필요.

- **[INFO]** `MASKED_MARKERS` 가 이번 라운드에 `export` 됐는데도(WARNING #6 fix), 테스트
  fixture 는 여전히 리터럴을 세 번째로 복제한다 — 직전 라운드 INFO #8 의 "export 되면 없앨 수
  있다"는 제안이 실행 가능해졌는데도 반영 안 됨
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:598` (`const MARKERS = ["***", "[REDACTED]", "[REDACTED_DEPTH]"];`) vs `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339` (`export const MASKED_MARKERS`)
  - 상세: 직전 라운드 리뷰(`12_06_12/testing.md` INFO #4)는 "`MASK_MARKERS`가 비-export 라
    테스트가 재사용 못 하고 세 번째로 복제한다"고 지적했다. 이번 라운드에서 명명 통일
    (WARNING #6)의 부수 효과로 `MASKED_MARKERS` 가 `export` 로 승격됐지만, 테스트는 여전히
    `it.each(MARKERS)` 의 `MARKERS` 를 하드코딩 배열로 유지한다. fail-safe 방향(구현이 값을
    늘려도 테스트가 자동으로 안 따라가고 그대로 있을 뿐 거짓 통과는 아님)이라 위험도는 낮지만,
    지금은 `import { MASKED_MARKERS } from "../dynamic-form-ui"` 후
    `it.each([...MASKED_MARKERS])` 로 바꾸는 데 비용이 0에 가깝다(export 장벽이 이미 제거됨).
  - 제안: `MARKERS` 리터럴을 지우고 `MASKED_MARKERS` re-export 를 import 해 재사용.

- **[INFO]** 신규 `export function isMaskedMarker` 에 대한 직접 단위 테스트가 없다 — 컴포넌트
  렌더를 통한 간접 테스트만 존재, non-string 타입 입력 경로는 전혀 행사되지 않음
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:371-373`
  - 상세: `FormField.defaultValue` 는 `unknown` 타입이라 checkbox 의 `true/false`, number
    필드의 숫자, `null` 등도 들어올 수 있다. `isMaskedMarker` 는 `typeof v === "string"` 가드로
    안전하게 처리하지만, 이 분기(비-string 입력)를 직접 행사하는 테스트가 없다 — 새로 추가된
    5건은 전부 `type: "text"` 필드에 문자열 `defaultValue` 만 쓴다. 구현이 2줄로 단순해 현재는
    위험이 낮지만, 이 함수가 이제 `export` 된 공개 유틸(향후 다른 컴포넌트가 import 할 수 있는
    표면)이라는 점에서 `isMaskedMarker(123)`, `isMaskedMarker(null)`, `isMaskedMarker(undefined)`,
    `isMaskedMarker(true)` 같은 순수 함수 단위 테스트를 별도로 두면 향후 판별 로직이 정규식
    등으로 진화할 때 회귀 방어가 즉시 생긴다(직전 라운드 리뷰도 같은 지적을 INFO 로 남겼고
    아직 반영되지 않았다).
  - 제안: 필수는 아님. 저비용 후속으로 `isMaskedMarker` 자체를 `import` 해 boolean/number/null
    입력에 대한 순수 함수 단위 테스트 4~5줄 추가를 고려.

- **[INFO]** 신규 가드 테스트가 전부 `field.type: "text"` 로만 검증됨 — checkbox/select/number
  /file 등 다른 필드 타입에서 `defaultValue` 가 마커 문자열인 케이스는 미검증
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:597-724` (신규 describe 블록 전체)
  - 상세: `initialValueFor`/힌트 렌더 로직은 `field.type` 을 분기하지 않고 모든 필드 타입에
    동일하게 적용된다(`dynamic-form-ui.tsx:375-384`, `:473`). 실무적으로 자격증명이 select/
    checkbox 기본값으로 들어올 가능성은 text/textarea 보다 훨씬 낮아 우선순위는 낮지만, 가드가
    "모든 필드 타입에 적용된다"는 설계 의도(JSDoc 이 필드 타입을 구분하지 않음)를 테스트가
    명시적으로 고정하고 있지는 않다.
  - 제안: 필수는 아님. 여력이 되면 `type: "select"` 또는 `type: "textarea"` 필드에 마커
    `defaultValue` 를 준 케이스 1건을 `it.each` 에 추가해 타입-불문 가드임을 고정.

## Mock 적절성 / 테스트 격리

- `onSubmit={vi.fn()}` 외 별도 mock 없음 — 실제 DOM(jsdom) 렌더 + `fireEvent` 로 실제 사용자
  상호작용에 가깝게 검증하는 통합 테스트 스타일이며 이 컴포넌트 계층에 적절하다.
- `useT()` 는 mock 되지 않고 실제 i18n dict(`ko/editor.ts`)를 그대로 태운다 — 힌트 텍스트
  단언(`/자격증명으로 판별되어 가려졌어요/`)이 번역 키 오타·배치 오류까지 함께 잡는다.
  `beforeEach`가 `locale: "ko"` 로 고정해 로케일 store 잔류를 방어(파일 상단 W5 코멘트와 일치).
- `@testing-library/react` auto-cleanup(`vitest.config.ts` 의 `globals: true` + RTL 표준 동작)로
  DOM 격리 확인. 신규 5건은 서로 상태를 공유하지 않고 각자 `render` 를 새로 호출한다 — 격리 양호.

## 회귀 테스트 유효성

- 전체 스위트 25 passed 확인(`npx vitest run dynamic-form-ui.test.tsx`). 기존 20건(마커 도입
  이전)은 `"***"`/`"[REDACTED]"`류 문자열을 쓰지 않아 신규 가드와 충돌하지 않음을 grep 으로
  확인 — 회귀 없음.
- backend `sanitize-error-message.spec.ts` 48건은 diff 가 순수 재배치+JSDoc 뿐이라 100% 유효
  (직접 실행 재확인).

## 요약

직전 라운드(`12_06_12`)가 뮤테이션으로 실측해 낸 testing WARNING 2건(`fireEvent.submit` vacuous,
힌트 음의 단언 부재)은 이번 라운드에서 진짜로 고쳐졌다 — 동일 뮤턴트를 독립 재현해 각각
14/2건이 정상 RED 로 전환됨을 확인했고, 가드 제거 뮤테이션(4 RED)도 재확인했다. 남은 항목은
전부 INFO 수준이다: (1) `MASKED_MARKERS` export 승격의 부수 효과로 테스트 fixture 삼중 복제를
없앨 길이 열렸는데 아직 활용 안 함, (2) 신규 export 함수 `isMaskedMarker` 의 non-string 입력
경로에 대한 직접 단위 테스트 부재, (3) 신규 가드 테스트가 `text` 필드 타입에만 국한. 셋 다
현재 위험은 낮고(구현이 단순하거나 fail-safe 방향) 필수 조치는 아니다. backend 변경은 순수
문서 재배치로 회귀 리스크 없음(48/48 유지). Mock 사용은 최소(`onSubmit` 만)이고 실제 i18n·DOM
을 그대로 태워 실동작에 가깝다.

## 위험도

LOW
