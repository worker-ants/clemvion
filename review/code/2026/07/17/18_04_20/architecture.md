# 아키텍처(Architecture) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tools/reap-merged-worktrees.sh`,
`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_push_detection.py`,
`.claude/tests/test_reap_merged_worktrees.py`, `.claude/docs/worktree-policy.md`,
`plan/in-progress/harness-session-anchor-guards.md`

## 발견사항

- **[INFO]** `_git_subcommand()` 반환값이 "확정된 서브커맨드"와 "보수적 추측"을 같은 `str | None` 타입에 섞어 반환
  - 위치: `.claude/hooks/guard_review_before_push.py:174-213` (`_git_subcommand`), 특히 205-211행 fail-closed 분기
  - 상세: 정상 경로(`return token`, 213행)는 실제로 파싱된 서브커맨드를 돌려주지만, 미지 글로벌 옵션을 만난 fail-closed 분기(211행 `return "push" if "push" in segment[i+1:] else None`)는 "확신 없음, 그러나 뒤에 push 라는 단어가 있으니 보수적으로 push 로 간주"라는 전혀 다른 신뢰도의 판정을 같은 반환 타입으로 내보낸다. 현재는 유일 호출부(`_is_git_push`)가 `== "push"` 로만 비교하므로 문제가 되지 않고, docstring 에도 의도적 트레이드오프로 명시돼 있어 은닉된 결함은 아니다. 다만 이 함수가 향후 다른 목적(예: 서브커맨드별 분기 로깅, 다른 gate 재사용)으로 재사용되면 "확정 파싱"과 "휴리스틱 추측"을 구분하지 못해 오용될 수 있다.
  - 제안: 현재 동작을 바꿀 필요는 없음. 재사용 시점이 오면 `(subcommand: str | None, confident: bool)` 튜플이나 별도 함수로 두 신뢰도를 분리하는 것을 고려.

- **[INFO]** `reap-merged-worktrees.sh` 의 `--help` 출력이 자기 자신의 무관한 리터럴(`set -u`)에 암묵적으로 결합
  - 위치: `.claude/tools/reap-merged-worktrees.sh:429-431`
  - 상세: `sed -n '2,/^set -u/p' "$0"` 로 파일 상단 주석 블록을 헤더 문서로 재사용하는 방식은 영리하지만, "주석 블록의 끝"이라는 개념적 경계를 "`set -u` 라는 문자열이 어디 있는가"라는 우연한 구현 디테일에 결합시킨다. 향후 `set -u` 를 다른 위치로 옮기거나 주석 블록 안에 `set -u` 문자열이 등장하면(예: 예시 코드 인용) `--help` 출력이 조용히 잘리거나 늘어난다. `test_reap_merged_worktrees.py` 에는 `--help` 경로를 검증하는 테스트가 없다.
  - 제안: 급하지 않음. 헤더 끝을 나타내는 전용 마커 주석(예: `# --- end of help text ---`)으로 바꾸면 이 결합이 끊어진다.

- **[INFO]** `bootstrap-session.sh` ↔ `reap-merged-worktrees.sh` 간 `--keep` 계약이 비-formalize된 CLI 인터페이스 하나로만 고정됨
  - 위치: `.claude/tools/bootstrap-session.sh:96-100` (anchor 유도 + `--keep` 전달), `.claude/tools/reap-merged-worktrees.sh:417-436` (인자 파서)
  - 상세: 두 스크립트는 프로세스 경계(subprocess 호출, `source` 아님)로 느슨하게 결합돼 있어 좋은 방향이지만, 계약 자체(플래그 이름·의미)는 버전 관리되지 않는 CLI 문자열 하나로만 존재한다. 이 계약이 깨지지 않는다는 보장은 `test_bootstrap_keeps_the_worktree_it_was_invoked_from` E2E 테스트 1건이 전부다 — plan 문서(`harness-session-anchor-guards.md` 1516-1517행)도 이 점을 정확히 인지하고 "reaper 만 단위 테스트하면 bootstrap 이 `--keep` 전달을 빠뜨려도 통과한다"고 명시했다. 현재 2-hop 조합 규모에서는 수용 가능한 트레이드오프이며 이미 최선의 방어(E2E pin)를 갖추고 있다.
  - 제안: 조치 불필요. `bootstrap → reaper → cleanup` 외에 추가 스크립트가 체이닝되기 시작하면, 공유 bash 함수 라이브러리(Python 의 `_lib/` 에 대응하는 `.claude/tools/_lib/`)로 승격하는 것을 고려.

- **[INFO]** 동일 계열("대리 지표 평가") 결함이 리뷰 대상 밖의 `review_guard.py` 에도 남아있을 가능성이 plan 문서에 명시됨
  - 위치: `plan/in-progress/harness-session-anchor-guards.md:1416-1417` ("`review_guard` 가 push 대상이 아니라 셸 cwd 를 평가하는 기존 이슈와도 같은 뿌리다"), 참고 `.claude/hooks/_lib/review_guard.py` (이번 diff 미포함)
  - 상세: 이번 PR 은 reaper(①)와 push 텍스트매칭(②) 두 건에서 "진짜 대상 대신 대리 지표를 평가"하는 동일 안티패턴을 고쳤다. plan 문서 스스로 `review_guard.py` 가 push 대상이 아니라 shell cwd 를 평가하는 유사 구조를 아직 갖고 있을 수 있다고 기록했으나, 이번 diff 범위에는 포함되지 않았다. 아키텍처 관점에서 이는 "한 곳에서 발견된 설계 결함이 형제 모듈에 반복될 수 있다"는 전형적 신호이며, 방치하면 이번에 고친 것과 같은 계열의 결함이 다른 가드에서 재발할 위험이 있다.
  - 제안: 이번 PR 범위 밖이므로 차단 사유는 아님. 별도 plan/이슈로 추적되고 있는지 확인 필요(이미 사용자 메모리에 별도 후속 언급 없음 — 후속 파악 권장).

## 요약

이번 변경은 애플리케이션 코드가 아닌 하네스 가드(git push 차단 훅, worktree GC 리퍼, 세션 부트스트랩) 인프라에 대한 신뢰성 강화 리팩터다. 아키텍처 관점에서는 전반적으로 매우 신중하게 설계되어 있다: (1) "탐지"(`_is_git_push`/`_tokenize`/`_git_subcommand`)와 "정책"(REVIEW/PLAN gate) 레이어가 명확히 분리돼 있고 `main()` 은 이를 얇게 오케스트레이션만 한다, (2) `review_guard`/`plan_guard` 임포트를 각각 독립 try/except 로 감싸 한쪽 모듈의 결함이 다른 쪽 게이트를 침묵시키지 않도록 한 것은 의도적인 장애 격리다, (3) `reap-merged-worktrees.sh` → `cleanup-worktree.sh` 호출처럼 "무엇을 지울지 결정"과 "어떻게 지울지 실행"이 별도 스크립트로 분리돼 재사용·재검증이 쉽다, (4) 모든 스크립트 간 결합이 `source` 가 아닌 subprocess(프로세스 경계) 호출이라 상태 누수가 없고, (5) 순환 의존성은 발견되지 않았다(hooks→_lib, bootstrap→reaper→cleanup 모두 단방향), (6) `_GIT_OPTS_WITH_VALUE` 화이트리스트가 완전하지 않아도 안전하도록 fail-closed 폴백을 둔 것은 개방-폐쇄 원칙을 실질적으로 만족시키는 좋은 예(git 이 새 글로벌 옵션을 추가해도 코드 수정 없이 안전측으로 동작), (7) 테스트 파일 자체도 `test_push_detection.py` 가 "이 게이트가 무엇을 검사하는지"만 다루고 "무엇을 판단하는지"는 `test_review_guard.py` 몫이라고 docstring 에 명시하는 등 코드의 모듈 경계가 테스트 스위트 경계에도 그대로 반영돼 있다. 발견된 항목은 전부 INFO 수준(반환 타입의 신뢰도 혼재, 자기참조적 help 텍스트 결합, 비-formal 크로스스크립트 계약, 형제 모듈에 남아있을 수 있는 동일 계열 이슈)이며 실제 결함이나 구조적 위험은 아니다.

## 위험도
LOW
