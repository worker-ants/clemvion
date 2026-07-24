# RESOLUTION — §J-후속 (폴백 누락 회귀 + 생성 입력 바닥)

리뷰: `review/code/2026/07/24/01_25_14/SUMMARY.md` — RISK=MEDIUM, **Critical 0**, Warning 4.
forced 7명 전원 확보. Warning 4건 전부 반영, INFO 도 대부분 반영.

## Warning (4) — 전부 반영

### W1 모듈 docstring 이 이번 diff 가 고친 동작을 반박 (documentation)

`guard_default_branch_bash.py` 최상단이 "unclosed quote 는 여전히 unmatched" 라고 서술하고
있었다. 이번 diff 가 정확히 그걸 고쳤으므로 자기모순이다. **내 메모리가 "4번째 재발 경로" 로
지목한 바로 그 패턴** — 그것만 읽은 사람이 코드를 버그 쪽으로 되돌린다.
→ "unclosed quote 는 이제 매치된다(`\S+` 폴백이 그래서 있다), empty value 만 남는다" 로 교정.

### W2 §K/§L 레터 자기모순 (documentation)

`GeneratedFloorTest._VALUES` 주석만 §K 로 오기 — §K 는 실제로 전혀 다른 항목(게이트 제어흐름
4중 복제)이다. W3 처리로 그 리터럴이 공유 상수로 이동하며 함께 해소됐고, 잔존 없음을 grep 확인.

### W3 두 테스트의 `_VALUES` 중복 + 이미 드리프트 (maintainability)

리뷰어 지적대로 이미 벌어져 있었다(push 가드만 §L 형태 3건 추가). 드리프트 **감지** 가드를
추가하는 대신 **구조적으로 불가능**하게 했다 — 값 형태를 `_harness.ENV_VALUE_SHAPES` 로 단일화.
두 훅이 같은 접두를 건너뛰고 같은 방식으로 두 번 회귀했으므로, 한쪽에서 배운 형태는 즉시
다른 쪽에도 시도돼야 한다.

### W4 `test_no_duplicate_values` 비대칭 (maintainability)

넛지 훅 쪽에 추가. INFO#7 의 비-vacuity 커버리지 하한(`_MIN_COVERAGE`)도 함께 대칭화 —
지금은 84건 중 68건이 참여하지만 리팩터링으로 조용히 무력화될 수 있다는 지적이 맞다.

## 리뷰가 놓친 것 — 탈출구를 뮤테이션이 잡았다

W3 를 공유 상수로 정리한 뒤 뮤테이션을 돌려보니, **공유 목록에서 미종료 따옴표 형태를 지우면
아무 테스트도 실패하지 않았다**(Q3 GREEN). 생성 입력은 그 자체가 커버리지이므로, 실패하는
superset 테스트를 "입력을 빼서" 통과시킬 수 있다 — 전형적인 탈출구다.
→ `test_the_regression_shapes_are_still_generated`: 실제로 released 회귀를 일으킨 5개 형태를
사유와 함께 이름으로 고정. 재측정 결과 Q3' 는 RED 로 뒤집혔다.

## INFO 반영

- **#7** 넛지 훅 superset 테스트에 커버리지 하한 단언 추가(W4 와 함께).
- **#8** plan 의 "두 훅 + 미러 3곳" → "총 3곳(훅 2 + 테스트 미러 1)" 로 오독 여지 제거.
- **#9** `.claude/tests/README.md` 두 행 보강 — 신규 클래스 3개와 **왜** 생성 입력이 필요했는지
  (바닥도 차등도 옳았는데 큐레이션만 순회해서 판정 기회를 못 얻었다)까지 기록.

## INFO 미반영(사유)

- **#1/#2/#4/#5/#6** 전부 "조치 불요" 판정(보안 강화 방향, ReDoS 미재도입 독립 재현, spec 대상
  밖, SoR 경로 정정은 disclosed minor, 판정 경계 확장은 의도됨).
- **#3** §L 은 이번 범위 밖 — 캐너리 + 백로그로 관리 중이고 리뷰어도 우선순위 유지 권고.
- **#10** "168건/28건/12건" 수치가 diff 만으로 재현되지 않는다 — 맞다. 다만 정성적 결론
  ("무손실 상위집합")은 리뷰어가 독립 재검증했고, 수치는 `GeneratedFloorTest` 를 돌리면 언제든
  재산출된다. 서술에 숫자를 남기는 편이 "왜 이렇게 생겼는가" 를 전달한다고 판단.

## 검증

- 하네스 전체 **552건 OK**(550 → +2), plan-frontmatter 105건 OK.
- 뮤턴트: Q1 #1002 상태 원복 → `test_blind_pass_never_narrows_below_the_floor` RED /
  Q2 #1001 상태 원복 → `test_no_classification_is_lost` RED /
  Q3' 값 목록 축소 → `test_the_regression_shapes_are_still_generated` RED. 전부 포착, 원복 확인.

## 한계

GitHub Actions 가 저장소 전체에서 비활성이라 위 수치는 **전부 로컬 실행** 결과다.
