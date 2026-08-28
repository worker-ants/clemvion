# 변경 범위(Scope) 리뷰 — system-error-banner (02_57_18)

## 검증 방법

`git diff origin/main...HEAD --stat` 로 전체 변경 파일을 전수 확인하고, 프롬프트가 diff 를
생략한 2개 파일(`use-execution-events.ts`, `use-execution-events.test.ts`)을 포함해
코드에 영향을 주는 4개 파일의 전체 diff 를 직접 `git diff` 로 열람·대조했다. `codebase/backend/**`,
`spec/**` 변경 여부도 확인했다.

## 발견사항

없음.

## 근거 (검토 절차)

- **코드/문서에 영향을 주는 변경은 정확히 4개 파일**: `CHANGELOG.md`(+19),
  `codebase/frontend/src/lib/websocket/use-execution-events.ts`(+85/−64 hunk 기준),
  `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`(+370/−100 hunk 기준),
  `plan/in-progress/system-error-banner-live-ws.md`(신규 +73). `codebase/backend/**`, `spec/**`
  는 diff 에 전혀 나타나지 않는다 — plan 문서 "스코프 밖" 항목(`output` 미동봉 2경로에 output
  싣기 / `error` 를 객체로 바꾸기, 둘 다 백엔드 계약 변경)이 실제로 손대지 않았음을 실측으로
  확인.
- **나머지 55개 파일은 `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,02_21_19,02_39_10}/**`
  경로의 리뷰 산출물**(RESOLUTION.md, SUMMARY.md, 각 관점 리포트, meta.json, _retry_state.json).
  프로젝트 컨벤션(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")
  이 규정한 표준 산출 경로이고, `/ai-review` 반복 라운드가 순차 커밋되는 정상 워크플로다.
  무관한 파일 추가가 아니다.
- **`use-execution-events.ts` diff 는 plan 체크리스트와 1:1 대응**:
  - `extractNodeErrorPayload` 시그니처를 `(rawError, rawOutput)` → `(rawOutput)` 으로 좁히고
    `nested` 를 `asRecord(rawOutput)?.output` → `asRecord(...)?.error` (래퍼 한 겹 통과)로 변경 —
    plan 항목 "nested 를 rawOutput.output.error 로" 와 정확히 일치.
  - 옛 `direct` 분기(객체 `error` 파싱) 제거는 사이드 리팩토링이 아니라, 그 분기가 도달 불가능함
    (호출부 2곳 모두 문자열/`undefined`)과 버그를 낳은 계약을 인코딩한다는 근거가 diff 내
    주석·plan·RESOLUTION(01_26_11 W4)에 함께 명시돼 있어 같은 결함 축의 필연적 축소다.
  - `handleNodeFailed` 가 `extractNodeErrorPayload(undefined, payload.output)` →
    `extractNodeErrorPayload(payload.output)` — plan 항목 "payload.output 을 넘긴다" 와 일치.
  - JSDoc(파일 상단, extractNodeErrorPayload 위)과 두 호출부(`handleNodeCompleted`,
    `handleNodeFailed`) 주변 주석이 모두 §4.1-a 기준으로 갱신돼 있다 — plan 항목 "헬퍼 주석의
    정정 전 §4.1 인용 교체" 및 이전 라운드가 지적한 "자매 주석 한 겹 얕음"(01_26_11 W2)이 이번
    diff 시점에 이미 해소된 상태로 반영됨.
  - 신규 `asRecord` 헬퍼는 `Record<string, unknown> | null` 정규화 1함수로, 새 기능이 아니라
    2단 중첩 접근(`asRecord(asRecord(rawOutput)?.output)?.error` 형태)을 읽을 만하게 만드는
    최소 추출이며 호출 지점도 헬퍼 함수 본문 내부로 국한된다.
- **`use-execution-events.test.ts` diff 는 전부 이 결함(라이브 WS `system_error` 미노출)과
  직결**된다: CT-S9/CT-S10/CT-S11/completed 4곳의 fixture 를 production shape(`error`: 문자열,
  `output`: `NodeHandlerOutput` 래퍼)으로 정정, 신규 헬퍼 `wrapNodeHandlerOutput` 도입(래퍼
  리터럴 손복제 회피, RESOLUTION 01_26_11 W3 대응), 캐너리 2건(문자열 error+래퍼 output 조합에서
  배너 발생 / output 미동봉 경로 미발생, 기존 "legacy" 테스트를 라벨·사유만 정정해 재사용) 및
  라운드 진행 중 발견된 커버리지 0(`||` 좌/우항 분리, `details` 타입 가드, single-turn 대칭 등)을
  메우는 가드 테스트들도 전부 같은 함수·같은 결함 축을 향한다. `output` 이 배열인 케이스의
  테스트는 "항을 못 가른다" 는 사실을 주석에 명시해 living-documentation 을 왜곡하지 않는다.
  기능 확장(새 API·새 UI 요소)이나 무관한 리팩토링은 없다.
- **`CHANGELOG.md`**: 기존 엔트리를 건드리지 않고 새 `## Unreleased` 섹션 1개를 최상단에
  삽입만 함 — 무관한 항목 수정 없음.
- **`plan/in-progress/system-error-banner-live-ws.md`**: 신규 plan 문서로, 결함 실측·체크리스트·
  스코프 밖 항목을 명시. 체크리스트 항목과 실제 diff 사이에 괴리 없음(pending 은 "push · PR"
  1건뿐, 코드 항목은 전부 체크됨).
- import·설정 파일(`package.json`, eslint/prettier config, tsconfig 등) 변경 없음. 포맷팅-only
  변경이 실질 변경과 섞인 흔적 없음 — 모든 hunk 가 의미 있는 코드/주석 변경이거나 그 변경에
  필연적으로 따르는 인접 주석 갱신.

## 요약

코드/문서에 영향을 주는 diff 는 4개 파일(`CHANGELOG.md`, `use-execution-events.ts`,
`use-execution-events.test.ts`, 신규 plan 문서)에 국한되며, 프로덕션 코드 변경은
`extractNodeErrorPayload` 의 래퍼 한 겹 통과 로직 정정과 `handleNodeFailed` 의 인자 배선
교정이라는 plan 이 명시한 두 지점에 정확히 대응한다. 신규 `asRecord` 헬퍼는 그 정정이
요구하는 가독성 최소치이지 기능 확장이 아니며, backend/spec 은 diff 에 전혀 등장하지 않아
plan 의 "스코프 밖" 경계가 실측으로도 지켜졌다. 나머지 55개 파일은 프로젝트 컨벤션이 규정한
`/ai-review` 라운드별 산출물(review/code/**)로, 무관한 파일 추가가 아니라 이 저장소의 표준
워크플로 결과물이다. 무관한 파일·설정·포맷팅·불필요한 임포트/주석 변경은 발견되지 않았다.

## 위험도

NONE
