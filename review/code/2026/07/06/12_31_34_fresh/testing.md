# 테스트 리뷰 (Fresh, resolution 후) — /schedules 딥링크 blank-match 가드

- 대상: `git diff origin/main...HEAD` (3 commits, 최신 `8e9133dd5`)
- 주 대상 파일:
  - `codebase/frontend/src/app/(main)/schedules/page.tsx` (+32/-2)
  - `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` (+83, 신규 describe 4 테스트)
  - `spec/2-navigation/3-schedule.md` (+9, Rationale 절 추가)
- 선행 리뷰: `review/code/2026/07/06/12_23_40/testing.md` (INFO: 빈 문자열 triggerId 가드 회귀 테스트 부재) → 본 커밋(`8e9133dd5`)에서 반영됨.

## 검증 방법

1. `git diff origin/main...HEAD` 로 전체 변경 확인.
2. 신규 테스트 `does not blank-match a trigger-less schedule when ?triggerId= is empty`(schedules-page.test.tsx:592-613)의 non-vacuous 여부를 실험으로 검증.
   - 1차 시도: `!!focusTriggerId` → `focusTriggerId`(bare)로 변경 — `""` 는 JS 에서 falsy 이므로 이 변경만으로는 가드가 실질적으로 동일하게 동작해 회귀가 재현되지 않음(예상된 결과, 진행).
   - 2차 시도: 가드를 `focusTriggerId !== null && schedule.triggerId === focusTriggerId` 로 변경(파라미터 "존재 여부"만 검사하도록 완화) — 이것이 실제로 `?triggerId=`(빈 문자열) 진입 시 트리거 없는 스케줄(`triggerId: ""`)과 blank-match 시키는 회귀를 재현.
   - `../../node_modules/.bin/vitest run "src/app/(main)/schedules/__tests__/schedules-page.test.tsx"` (cwd=`codebase/frontend`) 실행 결과: **18개 중 1개 실패**(`does not blank-match a trigger-less schedule when ?triggerId= is empty`), 나머지 17개는 통과.
   - 실험 후 `git checkout -- "codebase/frontend/src/app/(main)/schedules/page.tsx"` 로 즉시 원복, `git status --short` 로 clean 확인(출력 없음).
   - 원복 후 재실행: **18개 전부 통과**.

## 발견사항

결함 없음. 신규 테스트는 non-vacuous 이며 의도한 회귀(orphan 스케줄 + 빈 `?triggerId=` 파라미터의 blank-match)를 실제로 탐지한다.

- **[INFO]** 신규 blank-match 가드 테스트 non-vacuous 실증 확인
  - 위치: `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx:592-613`, `page.tsx:1018-1019`
  - 상세: `isFocused = !!focusTriggerId && schedule.triggerId === focusTriggerId` 에서 `!!focusTriggerId` 가드가 "파라미터 존재 여부"만으로 완화되면(`focusTriggerId !== null`), `?triggerId=`(빈 문자열) + `trigger` 없는 스케줄(`mapSchedule` 이 `triggerId: s.trigger?.id ?? ""` 로 매핑) 조합이 `"" === ""` 로 blank-match 되어 orphan 스케줄 행이 잘못 강조되는 회귀가 발생한다. 이 실험으로 신규 테스트가 정확히 이 회귀를 잡아낸다는 것을 확인했다.
  - 제안: 없음(현행 유지 권장). 직전 리뷰(12_23_40)에서 지적된 커버리지 갭이 정확히 이 케이스로 메워졌다.

- **[INFO]** 나머지 3개 describe 내 테스트(정상 매치·불일치 매치·파라미터 부재)와 신규 4번째 테스트 간 상호 격리 양호
  - 위치: `schedules-page.test.tsx:535-545` (`beforeEach`: `vi.clearAllMocks()`, `currentSearchParams` 재할당, `cleanup()`, `Element.prototype.scrollIntoView` 재설정)
  - 상세: 각 테스트가 `currentSearchParams`, `apiGetMock` 응답, DOM 을 매 테스트 전 재설정하므로 실행 순서에 의존하지 않는다. 4개 테스트를 개별/전체 실행 모두 결과 동일(18/18 통과) 확인.
  - 제안: 없음.

- **[INFO]** mock 데이터 구조(`focusRow()` 헬퍼 vs 인라인 orphan 픽스처)의 의도적 비대칭은 가독성 상 적절
  - 위치: `schedules-page.test.tsx:546-563` (`focusRow()`), `schedules-page.test.tsx:597-611` (인라인 orphan 객체)
  - 상세: 신규 테스트는 `focusRow()` 를 재사용하지 않고 `trigger` 필드를 아예 생략한 별도 인라인 fixture 를 사용한다. 이는 "trigger-less 스케줄"이라는 핵심 조건을 코드 상에서 명시적으로 드러내는 선택으로, 주석(`// No \`trigger\` → mapSchedule sets triggerId = ""`)과 결합되어 의도가 명확하다. `focusRow()` 를 억지로 재사용해 `trigger: undefined` 를 덮어쓰는 것보다 가독성이 좋다.
  - 제안: 없음.

## 종합 결론

- 18개 테스트 전부 통과 재확인 완료(원복 후).
- `git status --short` clean 확인 완료(실험 잔여물 없음).
- 직전 testing INFO(빈 문자열 triggerId 가드 회귀 테스트 부재)가 실제로 해소되었으며, 실험으로 해당 테스트가 vacuous 하지 않음을 실증했다.
- spec Rationale(`spec/2-navigation/3-schedule.md` "딥링크 소비의 방향별 비대칭") 은 코드의 `!!focusTriggerId` 가드·cross-page 미지원 코멘트와 내용상 정합.

## 위험도

NONE
