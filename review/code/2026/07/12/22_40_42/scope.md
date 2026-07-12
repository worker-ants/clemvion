# 변경 범위(Scope) 리뷰 결과 (3R, 22_40_42)

리뷰 대상: carousel 잘림 배너(총 개수 노출 포함) 구현 — `plan/in-progress/webchat-widget-presentation-followups.md`
미구현 항목 1·2 해소. `origin/main` 대비 누적 diff 29건: 구현/스타일 6(`catalog.ts`/`presentation.ts`/
`presentation.test.ts`/`presentations.tsx`/`presentations.test.tsx`/`styles.ts`), `CHANGELOG.md` 1, plan 1,
spec 1, 이전 두 라운드(21_59_01·22_18_19) 리뷰 산출물 19건(`RESOLUTION.md`/`SUMMARY.md`/`meta.json`/
`_retry_state.json`/reviewer 개별 md).

## 발견사항

- **[INFO]** `toTable` 기존 코드가 이번 diff 로 함께 수정됨 (범위 확장이지만 정당화됨)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toTable()` 인라인 `rawTotal`/`totalCount`
    계산 5줄이 신규 공용 헬퍼 `asTotalCount()` 호출로 교체되고, 동시에 판정 기준이 `Number.isFinite` →
    `Number.isInteger` 로 강화(tighten)됨.
  - 상세: 표면 목표는 "carousel 에 table 과 대칭되는 잘림 배너 추가"이나, `toCarousel` 이 `toTable` 과 완전히
    동일한 정규화 로직을 필요로 하면서 파일 기존 `as*` 헬퍼 관례(`asArray`/`asRecord`/`asButtons`)를 따라
    공통 추출한 것 자체는 신규 기능이 유발한 정당한 중복 제거다. 다만 그 과정에서 이미 프로덕션에 있던
    `toTable` 의 동작이 "정수 아닌 유한수(예 12.5)도 허용"에서 "정수만 허용"으로 엄격해졌다 — carousel
    신규 코드 범위를 넘어 기존 함수 동작을 바꾼 유일한 지점이다. spec §R8("유한한 비음수 **정수**만 채택")과
    코드 간 기존 괴리를 이번 diff 가 발견·정정한 것이며, CHANGELOG·RESOLUTION 양쪽에 근거·회귀 테스트
    통과(무회귀)가 명시적으로 기록돼 있어 은닉된 부수 변경이 아니다.
  - 제안: 조치 불요 — 이미 CHANGELOG/RESOLUTION.md 에 근거·검증이 기록됨. 향후 유사 사례에서 "기존 함수
    동작 변경"을 diff 상단에 한 줄 더 명시하면 스코프 추적이 쉬워진다(선택 사항).

- **[INFO]** 이전 두 라운드(21_59_01·22_18_19)의 리뷰 산출물 19건이 이번 diff 에 포함됨
  - 위치: `review/code/2026/07/12/21_59_01/*`, `review/code/2026/07/12/22_18_19/*`
  - 상세: `review/` 는 프로젝트 컨벤션상 커밋 대상(SUMMARY·RESOLUTION 포함)이며, 이번 diff 의 해당 파일은
    모두 `new file mode` 로 기존 코드/스펙을 건드리지 않는다 — 무관한 파일 수정이 아니라 직전 두 리뷰
    라운드의 정상 산출물이 누적 diff 범위(`origin/main` 대비)에 함께 잡힌 것뿐이다.
  - 제안: 조치 불요.

- **[INFO]** spec 파일(`spec/7-channel-web-chat/1-widget-app.md`)이 코드와 같은 changeset
  - 위치: §2 표 셀(carousel/table presentation 행), §4 chrome 인벤토리, §R8 rationale 문단 — 3곳 국소 편집.
  - 상세: plan 의 "착수 조건" 절은 project-planner 가 §2 표시 계약을 먼저 정의해야 한다고 명시하는데, 이번
    diff 는 그 spec 편집과 developer 구현이 한 changeset(한 worktree)에 있다. 편집 내용 자체는 이번 기능
    (table·carousel 대칭 잘림 배너)의 계약 정의에만 정확히 국한되며, 무관한 절 편집이나 스펙 범위 확장은
    없다. 이전 두 라운드에서 이미 동일하게 지적·판정(Phase A/planner + Phase B/developer 한 worktree,
    단일 feature 국한 — 조치 불요)이 끝난 항목으로, 이번 라운드에서 새로 제기할 이슈는 아니다.
  - 제안: 조치 불요(기존 판정 유지).

- **[INFO]** ko 배너 문구가 spec 본문 서술과 표현이 살짝 다름 (스코프 자체와는 무관, 참고 기록)
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts` `"carousel.truncated": "일부 항목만 표시돼요."`
    vs `spec/7-channel-web-chat/1-widget-app.md` R8 rationale 문단의 예시 문구(현재 버전은 "carousel
    무개수 폴백"을 별도 인용 문구 없이 서술).
  - 상세: 이는 문구 정합성(requirement/documentation 관심사)이지 "의도 이상의 변경"·"무관한 수정" 같은
    스코프 위반은 아니다. 실제 catalog·CHANGELOG·plan 완료 노트 3곳은 서로 "일부 항목만 표시돼요."로
    일치한다.
  - 제안: 스코프 관점 조치 불요 — requirement/documentation 리뷰어 소관.

CRITICAL/WARNING 없음.

## 스코프 정합성 확인 (핵심 6파일)

1. `CHANGELOG.md`: Unreleased 섹션에 이번 기능 항목 1개만 추가. 기존 다른 Unreleased 항목 미변경.
2. `catalog.ts`: `carousel.truncatedWithCount`/`carousel.truncated` ko/en 4줄 순수 추가. 기존 키 변경 없음.
3. `presentation.ts`/`presentation.test.ts`: `CarouselData.truncated`/`totalCount` 필드, `toCarousel` 투영
   로직, 공용 `asTotalCount` 추출(위 첫 발견사항 참고 — 정당한 범위) + 대칭 테스트. `toChart`/`toTemplate`/
   `classifyPresentation` 등 무변경.
4. `presentations.tsx`/`presentations.test.tsx`: `CarouselView` 구조분해에 `truncated, totalCount` 추가 +
   배너 JSX 1블록·대응 렌더 테스트. `TableView` 기존 배너 패턴과 구조적으로 동일 — 신규 추상화·조기
   일반화 없음. 다른 컴포넌트(`ButtonBar`/`ChartView`/`TemplateView`) 무변경.
5. `styles.ts`: `.wc-table-truncated` 셀렉터에 `.wc-carousel-truncated` 를 콤마로 병합해 스타일 공유. 순수
   시각 대칭 목적, 다른 규칙 무변경.
6. plan 파일: 항목 1·2 체크박스 완료 처리 + 완료 각주, worktree frontmatter 갱신. 3번째(선택) 항목은
   그대로 미착수 유지 — 스코프 규율 준수.

포맷팅·주석·임포트·설정 파일 관련 잡음 없음 — 모든 hunk 가 기능 목표에 직접 연결된 additive/tighten
변경이며, 개행·들여쓰기·무관 라인 변경, 사용하지 않는 import 추가, 설정 파일(tsconfig/eslint/package.json
등) 변경은 diff 어디에도 없다.

## 요약

29개 파일 diff 전부가 "carousel 잘림 배너 + 총 개수 노출(table 대칭)"이라는 단일 목표에 대응한다. 핵심
구현 파일은 순수 additive 이거나 신규 기능이 직접 유발한 정당한 중복 제거(`asTotalCount` 추출)에 그친다.
`toTable` 의 판정 기준 강화(`Number.isInteger`)는 carousel 코드 범위를 벗어나 기존 함수를 건드린 유일한
지점이지만, spec §R8 정합·table-carousel 대칭이라는 이번 작업 자체의 명시 목표에 부합하고 CHANGELOG·
RESOLUTION 에 근거·회귀 검증과 함께 기록돼 은닉성이 없다. 나머지 파일(CHANGELOG 1, plan 1, spec 1, 이전
두 라운드 리뷰 산출물 19)은 프로젝트 컨벤션상 정상적으로 커밋되는 부수 산출물이거나 이미 이전 라운드에서
판정이 끝난 항목(spec+code 동일 changeset)이라 이번 라운드에서 새로 제기할 스코프 이슈는 없다. 불필요한
리팩토링·기능 확장(over-engineering)·무관 파일 수정·포맷팅 잡음·임포트 정리·설정 변경은 관찰되지 않는다.

## 위험도

NONE
