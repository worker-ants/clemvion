# RESOLUTION — 4라운드 (수렴)

리뷰: `review/code/2026/07/23/20_58_04/SUMMARY.md` — RISK=CRITICAL, Critical 1, Warning 1.
forced 7명 전원 확보(`forced_missing: []`).

## Critical (1) — §J, 별건 유지 (변동 없음)

3·4라운드 모두 같은 결함이다. **이 diff 가 만든 것이 아니라 2라운드에서 내가 발견해 §J 로
등록한 기존 결함**이며, 리뷰어도 "이 diff 가 만든 결함은 아니고 투명하게 스코프 아웃된 상태"
로 명시했다. `_GIT_PUSH` 는 `test_push_guard_allowlist.py` 가 byte-for-byte 고정 + 차등 코퍼스가
걸려 있어 핀 갱신·코퍼스 확장·뮤테이션을 동반한 별 PR 이 맞다.

**주의**: §J 가 살아 있는 한 이후 어떤 라운드도 Critical 0 이 될 수 없다(리뷰어가 매번 올바르게
재발견한다). 따라서 이 항목은 "라운드를 더 돌아 해소" 대상이 아니라 **다음 PR 의 작업**이다.

## Warning (1) — 반영: §J 캐너리 테스트

지적: §J 에 관측용 회귀 테스트가 0건이라 (a) 무관한 리팩터가 우회 폭을 넓혀도 스위트가 모르고,
(b) 별건 PR 의 수정 검증이 전부 수작업이 된다. 타당하다.

→ `KnownFalseNegativeTest` 신설. 기존 `KnownRemainingFalsePositiveTest` 와 **부호가 반대**라
(그쪽은 전부 차단 방향 = 안전) 같은 클래스에 넣지 않고, 클래스 docstring 에 "이 단언들은 의도가
아니라 **버그를 서술**한다" 를 명시했다. 우회 3형태 + 경계(따옴표 없는 값은 정상 탐지) 2건.

`_GIT_PUSH` 도 차등 코퍼스도 건드리지 않으므로 별건 연기 판단과 충돌하지 않는다.

**실측 검증**: §J 를 실제로 고친 뮤턴트를 주입하니 `test_quoted_env_prefix_hides_a_push` 와
`test_blind_pattern_is_frozen` 둘이 RED — §J PR 이 갱신해야 할 정확히 그 두 지점이다.
캐너리가 "고쳐졌음" 을 스스로 증명하는 핸드오프로 작동함을 확인했다.

## INFO 반영

- **#3** `_pick_commit_fixture` docstring 의 "Deliberately NOT HEAD" → "not hard-coded to HEAD"
  (임계값을 만족하면 HEAD 를 고를 수도 있다 — 내 문구가 부정확했다).
- **#4** CI shallow clone 에서 탐색이 사실상 1커밋으로 축소되지만 shallow root 는 부모가 없어
  numstat 총합이 임계값을 여유 있게 넘는다는 점을 docstring 에 기록.

## INFO 미반영(사유)

- **#5** `main()` 오케스트레이션 테스트: 2R·3R 에 이어 동일 판단 — 이 PR 스코프는 분류기이고
  리뷰어도 "명시적 연기(타당)" 로 기록. §J 다음 백로그 항목으로 남긴다.
- **#6** 주석 분량·`_is_mutating` docstring: 리뷰어 자신이 "조치 불필요, 하우스 스타일과 일관".
- **#7** `_PROBE` 인라인 소스: 기존 관례(push 가드 계열에도 동일 패턴), 새 패턴 아님.
- **#1/#2/#8~#11**: 전부 "조치 불필요" 판정(ReDoS 안전 재확인, advisory 반경, spec line-level
  일치, 이전 라운드 지적 해소 검증, 표준 defer 패턴, 감사 추적 커밋).

## 수렴 판단

궤적: 1R C0/W3 → 2R C1(기존)/W3 → 3R C1(동일)/W1 → **4R C1(동일)/W1 → 반영 후 코드 Warning 0**.
남은 Critical 은 정의상 다음 PR 의 작업이고, 이번 라운드 Warning 은 그 PR 을 **더 쉽게** 만드는
캐너리였다. 여기서 수렴으로 보고 PR 을 올린 뒤 §J 를 즉시 착수한다.

## 검증

- 하네스 전체 **532건 OK** (530 → +2 캐너리). plan-frontmatter 105건 OK.
- 캐너리 비-vacuity: §J-fixed 뮤턴트에서 정확히 2건 RED, 원복 확인.

## 한계

GitHub Actions 가 저장소 전체에서 비활성이라 위 수치는 **전부 로컬 실행** 결과다.
