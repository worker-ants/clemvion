# 변경 범위(Scope) Review

리뷰 대상: carousel 잘림 배너(총 개수 노출 포함) 구현 — `plan/in-progress/webchat-widget-presentation-followups.md`
미구현 항목 1·2 해소. 파일 17건: 구현 5(`catalog.ts`/`presentation.ts`/`presentation.test.ts`/`presentations.tsx`/
`presentations.test.tsx`), plan 1, spec 1, 이전 라운드(21_59_01) 리뷰 산출물 10건(`RESOLUTION.md`/`SUMMARY.md`/
`meta.json`/`_retry_state.json`/reviewer 개별 md 6종).

## 발견사항

- **[INFO]** `toTable` 기존 코드가 이번 diff 로 함께 수정됨(신규 기능 파일 아님)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toTable()` 인라인 `rawTotal`/`totalCount` 계산 블록 →
    공용 `asTotalCount()` 헬퍼 호출로 교체, 동시에 `Number.isFinite` → `Number.isInteger` 로 판정 기준 강화(tighten).
  - 상세: 이번 작업의 표면 목표는 "carousel 에 table 과 대칭되는 잘림 배너 추가"다. 그 목표를 위해 `toCarousel` 이
    `toTable` 과 동일한 정규화 로직을 필요로 했고, 두 함수가 완전히 동일한 5줄을 갖게 되자 파일 기존 관례(`asArray`/
    `asRecord`/`asButtons` 같은 `as*` 헬퍼)를 따라 `asTotalCount()` 로 공통 추출했다 — 이 자체는 신규 기능이
    유발한 정당한 중복 제거이지 무관한 리팩터링이 아니다. 다만 그 과정에서 `toTable`(기존에 이미 프로덕션에 있던
    함수)의 판정 기준이 `Number.isFinite`(정수 아닌 유한수 12.5 도 허용)에서 `Number.isInteger`(12.5 는 거부)로
    엄격해졌다 — `carousel` 신규 코드 범위를 넘어 `table` 의 기존 동작을 바꾼 부분이다. 이는 spec §R8("유한한
    비음수 **정수**만 채택")과 코드 간 기존 괴리를 이번 diff 가 발견·정정한 것으로(이전 리뷰 라운드 requirement
    INFO1 + testing 라운드에서 식별), "carousel 배너 추가"라는 원 스코프보다 넓지만 "table·carousel 대칭·spec
    정합"이라는 이번 작업의 명시 목표(plan·spec 본문)에 정확히 부합해 의도 이상의 변경으로 보기 어렵다. RESOLUTION.md
    가 이 tighten 을 명시적으로 기록하고 무회귀(기존 테스트 통과)를 확인했다.
  - 제안: 조치 불요 — 이미 RESOLUTION.md 에 근거·검증 기록됨. 향후 유사 사례에서는 "기존 함수 동작 변경"을
    커밋 메시지/PR 노트에 한 줄로 명시해 두면 스코프 추적이 더 쉬워진다(선택 사항).

- **[INFO]** 이전 라운드(21_59_01) 리뷰 산출물 10건이 이번 diff 에 포함됨
  - 위치: `review/code/2026/07/12/21_59_01/*` (RESOLUTION.md, SUMMARY.md, meta.json, _retry_state.json, 6개
    reviewer md)
  - 상세: `review/` 는 `.gitignore` 대상이 아니며 프로젝트 컨벤션상 리뷰 산출물(SUMMARY·RESOLUTION 포함)은 커밋
    대상이다(MEMORY: "plan 체크박스 = 실제 상태 … review/ 는 gitignored 아님"). 이번 diff 에 나타난 10개 파일은
    모두 `review/code/2026/07/12/21_59_01/` 아래 순수 신규 파일(new file mode)이고 기존 코드/스펙 파일을 건드리지
    않는다 — 무관한 파일 수정이 아니라 직전 리뷰 라운드의 정상 산출물이 함께 diff 에 잡힌 것뿐이다.
  - 제안: 조치 불요.

- **[INFO]** spec 파일(`spec/7-channel-web-chat/1-widget-app.md`)이 코드와 같은 changeset
  - 위치: §2 표 셀(carousel/table presentation 행), §4 chrome 인벤토리, §R8 rationale 문단 — 3곳 국소 편집.
  - 상세: plan 의 "착수 조건" 절이 "project-planner 가 §2 에 표시 계약을 먼저 정의해야 한다"고 명시하는데, 이번
    diff 는 그 spec 편집과 developer 구현이 한 changeset 에 있다. 다만 이 항목은 직전 라운드(21_59_01/scope.md)에서
    이미 동일하게 지적됐고 RESOLUTION.md I7 이 "spec+code 동일 changeset = Phase A(planner)+Phase B(developer)
    한 worktree 명시, 단일 feature 국한 — 조치 불요"로 판정을 남겼다. 편집 내용 자체는 이번 기능(table·carousel
    대칭 잘림 배너)의 계약 정의에만 정확히 국한되며, 무관한 절 편집이나 스펙 범위 확장은 없다.
  - 제안: 조치 불요(기존 판정 유지). 이번 라운드에서 새로 발견된 스코프 이슈 아님.

CRITICAL/WARNING 없음.

## 스코프 정합성 확인 (핵심 5파일)

1. `catalog.ts`: `carousel.truncatedWithCount`/`carousel.truncated` ko/en 4줄 순수 추가. 기존 키 변경 없음.
2. `presentation.test.ts`: `toCarousel` truncated/totalCount 신규 테스트(비잘림 기본값·0 경계·이형 거부·top-level
   truncation 투영) + 기존 "top-level truncation" 테스트에 단언 2줄 추가(W1 해소). 무관 테스트 변경 없음.
3. `presentation.ts`: `CarouselData.truncated`/`totalCount` 필드, `toCarousel` 투영 로직, 공용 `asTotalCount` 추출
   (위 첫 발견사항 참고 — 정당한 범위). 그 외 `toChart`/`toTemplate`/`classifyPresentation` 등 무변경.
4. `presentations.test.tsx`: carousel 배너 렌더 테스트 2건 추가. 기존 carousel/table/chart/template 테스트 미변경.
5. `presentations.tsx`: `CarouselView` 구조분해에 `truncated, totalCount` 추가 + 배너 JSX 1블록. `TableView` 기존
   배너 패턴과 구조적으로 동일 — 신규 추상화·조기 리팩터 없음. 다른 컴포넌트 무변경.

포맷팅·주석·임포트·설정 파일 관련 잡음 없음 — 모든 hunk 가 기능 목표에 직접 연결된 additive/tighten 변경이며,
개행·들여쓰기·무관 라인 변경, 사용하지 않는 import 추가, 설정 파일(tsconfig/eslint/package.json 등) 변경은
diff 어디에도 없다.

## 요약

17개 파일 diff 전부가 "carousel 잘림 배너 + 총 개수 노출(table 대칭)"이라는 단일 목표에 대응한다. 핵심 5개 구현
파일은 순수 additive 이거나 신규 기능이 직접 유발한 정당한 중복 제거(`asTotalCount` 추출)에 그친다. `toTable` 의
판정 기준 강화(`Number.isInteger`)는 carousel 코드 범위를 벗어나 기존 함수를 건드린 유일한 지점이지만, spec
§R8 정합·table-carousel 대칭이라는 이번 작업 자체의 명시 목표에 부합하고 이미 이전 리뷰 라운드에서 근거·검증과
함께 기록됐다. 나머지 12개 파일(plan 1, spec 1, 이전 라운드 리뷰 산출물 10)은 프로젝트 컨벤션상 정상적으로
커밋되는 부수 산출물이거나 이미 직전 라운드에서 판정이 끝난 항목(spec+code 동일 changeset)이라 이번 라운드에서
새로 제기할 스코프 이슈는 없다. 불필요한 리팩토링·기능 확장(over-engineering)·무관 파일 수정·포맷팅 잡음·임포트
정리·설정 변경은 관찰되지 않는다.

## 위험도

NONE
