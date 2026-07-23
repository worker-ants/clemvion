# 아키텍처(Architecture) 리뷰

대상: `.claude/tools/reap-merged-worktrees.sh` (gh 조회 N+1 → 배치화), `.claude/tests/test_reap_merged_worktrees.py`, `plan/in-progress/harness-guard-followups.md`

## 발견사항

- **[INFO]** `gh_state()` 인터페이스를 유지한 채 내부 전략만 교체 — 좋은 캡슐화
  - 위치: `.claude/tools/reap-merged-worktrees.sh:846-859` (`gh_state`)
  - 상세: 배치 우선 조회 + 미스 시 단건 `gh pr view` 폴백을 `gh_state()` 내부로 숨겨, 호출부(pass 1/pass 2, 총 3곳)는 함수 시그니처·리턴 계약이 그대로라 한 줄도 바뀌지 않았다. "캐시-어사이드 + fallback" 패턴을 얕은 인터페이스 뒤에 넣어 개방-폐쇄 원칙에 부합하는 확장이다. 배치 실패/윈도우 초과 시 원래 동작(단건 조회, 동일 fail-safe)으로 정확히 축퇴하도록 설계되어 있어 성능 최적화가 정확성을 잠식하지 않는다.
  - 제안: 없음(긍정 관찰).

- **[INFO]** 전역 가변 상태(`_pr_states`)를 서브셸 제약 때문에 불가피하게 채택 — 근거가 코드에 명시됨
  - 위치: `.claude/tools/reap-merged-worktrees.sh:625-639` (주석), `_pr_states`/`_load_pr_states`/`gh_state`
  - 상세: 호출부가 전부 `state=$(gh_state …)` 커맨드 서브스티튜션(서브셸)이라 메모이제이션을 `gh_state` 내부에 두면 서브셸 종료 시 폐기되어 배치 의미가 소멸한다는 것을 주석으로 정확히 설명하고, 메인 셸에서 1회 선로드 후 서브셸이 상속된 변수를 읽기만 하도록 설계했다. bash 3.2(macOS 기본)에 연관 배열이 없어 `branch<TAB>state` 개행 문자열 + `awk` 선형 스캔으로 맵을 흉내낸 것도 제약이 명시된 pragmatic 선택이다. 일반적인 언어였다면 전역 가변 상태는 결합도를 높이는 냄새지만, 여기서는 실행 모델(서브셸 스코프) 자체가 강제하는 제약이고 그 이유가 주석에 정확히 남아 있어 "손으로 짠 primitive + 확신 주석" 류의 반증 위험이 낮다(이미 CLAUDE.md 이력에 유사 패턴의 함정이 여러 번 지적된 바 있으나, 이번엔 실행 모델의 근본 제약이지 재발명된 동시성 primitive가 아니다).
  - 제안: 없음(설계 제약 하에서의 합리적 선택). 다만 로드 여부(`_load_pr_states` 호출 유무)와 `_pr_states` 소유자가 파일 내 멀리 떨어져 있어(정의는 L630대, 호출은 L912) 향후 유지보수 시 "언제 채워지는가"를 놓치기 쉬우니, 두 지점을 묶는 짧은 상호 참조 주석(예: `_load_pr_states` 호출부에 "see gh_state below" 역참조는 이미 있음 — 반대 방향 참조도 있으면 더 좋음)은 선택적 개선.

- **[INFO]** `awk` "첫 매치 우선" 룩업이 `gh pr list`의 기본 정렬(생성일 내림차순)에 암묵적으로 의존
  - 위치: `.claude/tools/reap-merged-worktrees.sh:647` (`awk -F'\t' -v b="$branch" '$1==b{print $2; exit}'`), `841-843` (`_load_pr_states`의 `gh pr list --state all --limit ...`)
  - 상세: 동일 브랜치명이 배치 응답에 두 번 이상 등장하는 경우(예: 브랜치가 재사용되어 과거 PR과 신규 PR이 같은 head ref name을 가진 rare 케이스), `exit`가 붙은 awk는 JSON 배열에서 먼저 나온 항목의 state를 채택한다. 이는 `gh pr list`가 기본적으로 `created` 내림차순(최신 우선)으로 반환한다는 gh CLI의 암묵적 계약에 기대고 있는데, 이 가정이 코드/주석 어디에도 명시되어 있지 않다. 현재는 정상 동작(최신 PR이 먼저 나와 올바른 state를 채택)하지만, 외부 도구(`gh`)의 기본 정렬이 향후 바뀌거나 `--jq`/`--json` 조합이 달라지면 조용히 오판할 수 있는 미고정 외부 인터페이스 계약이다.
  - 제안: 주석 한 줄로 "gh pr list는 기본적으로 created desc이므로 첫 매치가 최신 PR"이라는 가정을 명시하거나, `--json headRefName,state,updatedAt`을 받아 `awk`에서 최댓값을 명시적으로 고르는 방식으로 가정을 코드화. 발생 빈도가 낮은 edge case이므로 시급하지 않음.

- **[INFO]** `claude_branches` 호이스팅으로 중복 `git for-each-ref` 호출 제거 — DRY 개선
  - 위치: `.claude/tools/reap-merged-worktrees.sh:903-912`, `979-681`(pass 2 heredoc이 재계산 대신 `$claude_branches` 재사용)
  - 상세: 변경 전에는 pass 2가 자체적으로 `git for-each-ref`를 다시 실행했다. 이번 diff는 이를 한 번 계산해 "두 pass가 후보를 뽑아오는 단일 진실"로 승격하고, 동시에 배치 로드 여부를 게이팅하는 조건(`claude/*` 브랜치 0개 → gh 호출 자체 스킵)에도 재사용한다. 책임이 명확한 리팩터(같은 값의 이중 계산 제거 + 그 값을 게이트 조건에도 활용)로, 테스트(`test_no_gh_calls_when_there_are_no_candidates`)가 이 경계를 직접 검증한다.
  - 제안: 없음(긍정 관찰).

- **[INFO]** 테스트가 구현 세부사항이 아닌 관측 가능한 계약(gh 호출 횟수·종류, 최종 reap 결과)만 검증 — 블랙박스 설계
  - 위치: `.claude/tests/test_reap_merged_worktrees.py:299-306`(`_gh_calls`), 신규 5개 테스트(`test_batches_state_lookups_instead_of_one_view_per_branch` 등)
  - 상세: `GH_CALL_LOG`를 통해 "몇 번, 어떤 종류의 gh 호출이 발생했는가"만 관측하고 `_pr_states`의 내부 포맷(TSV)이나 `awk` 로직에는 의존하지 않는다. 구현이 향후 바뀌어도(예: `awk` 대신 다른 파싱 방식) 테스트는 그대로 유효한 계약 테스트다. plan 문서(`harness-guard-followups.md`)에 "배치를 되돌린 뮤턴트에서 두 테스트 모두 실패 확인"이라는 non-vacuity 검증 기록도 있어 테스트가 실제로 회귀를 잡는다는 근거가 남아 있다.
  - 제안: 없음(긍정 관찰).

## 요약

이번 변경은 `reap-merged-worktrees.sh`의 `gh pr view` 순차 N+1 호출을 단일 `gh pr list` 배치 조회 + 윈도우 밖/실패 시 단건 폴백으로 교체하는 국소적이고 잘 캡슐화된 개선이다. 호출부(`gh_state`) 인터페이스가 그대로 유지되어 개방-폐쇄 원칙에 부합하고, 배치 실패나 `--limit` 초과 같은 저하 경로가 기존 동작으로 정확히 축퇴하도록 설계되어 성능 최적화가 정확성(fail-safe)을 침해하지 않는다. bash 3.2(연관 배열 부재) 제약으로 인한 전역 문자열 맵 + `awk` 선형 스캔, 그리고 서브셸 스코프 문제로 메인 셸에서 선로드해야 하는 구조는 셸 스크립트 실행 모델이 강제하는 것이며 그 근거가 주석에 명시적으로 남아 있어 반증 위험이 낮다. 순환 의존성, 레이어 경계 위반, 모듈 간 결합도 문제는 발견되지 않았고, `claude_branches` 호이스팅으로 기존 중복 호출도 함께 제거되었다. 유일한 지적 사항은 `gh pr list`의 기본 정렬(생성일 내림차순)에 대한 암묵적 의존인데, 현재 로직상 정확하게 동작하며 코드에 그 가정을 명시하는 정도의 저비용 개선만 남아 있다. 신규 테스트 5건이 배치/폴백/실패/무후보 경로를 관측 가능한 계약(호출 횟수) 기준으로 블랙박스 검증하고 있어 회귀 방지력도 충분하다.

## 위험도

LOW
