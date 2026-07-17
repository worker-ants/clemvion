# 테스트(Testing) 리뷰

대상: 세션 앵커 reap 가드(`--keep`) + push 오탐 가드(`_is_git_push` 재작성) 2건.
정적 리뷰에 그치지 않고 실제로 테스트를 실행·역검증했다:
`.claude/tests/` 전체 스위트(264건) 재실행, 신규/변경 두 테스트 파일을 fix 이전 커밋(HEAD~1)의
소스에 대해 재실행해 실패를 재현(비-vacuity 재검증), `--keep` repeatable 동작 수동 프로브,
`plan-frontmatter.test.ts`(plan frontmatter 가드) 실행, CI 트리거 경로 확인을 모두 수행했다.

## 발견사항

- **[WARNING]** `--keep` 의 "repeatable" 계약이 테스트로 고정되지 않음
  - 위치: `.claude/tools/reap-merged-worktrees.sh:14`(문서: "Never reap this worktree (repeatable)")·
    `:77-84`(구현: `--keep` 이 나올 때마다 `keep_paths` 에 누적) / `.claude/tests/test_reap_merged_worktrees.py`
  - 상세: 신규 테스트 9건은 전부 `--keep <path>` 를 **1회만** 호출한다. `--keep A --keep B` 처럼 두 번
    이상 넘기는 케이스는 어떤 테스트에도 없다. 구현 자체는 정상 동작함을 직접 확인했다
    (임시 repo 에서 `--keep "$A" --keep "$B" --dry-run` 실행 → 둘 다 "WOULD remove" 목록에서 제외,
    `worktrees=0`). 문제는 이 동작을 지키는 회귀 테스트가 없다는 것 — 향후 `--keep` 파서를
    리팩터링(예: 누적 대신 덮어쓰기로 실수)해도 현재 스위트는 아무 것도 잡지 못한다. 이 기능은
    "동시에 열린 여러 세션이 서로 다른 앵커를 가질 수 있다"는 문서화된 한계(§ "한계: 자기 세션의
    앵커만 알 수 있다")와 맞물려 있어, repeatable 이 실제로 필요해질 가능성이 낮지 않다.
  - 제안: `test_keep_accepts_multiple_paths` 류의 케이스 추가 — `--keep A --keep B` 로 실행해 A·B
    모두 생존, 무관한 C 는 reap 됨을 단언.

- **[WARNING]** `_GIT_OPTS_WITH_VALUE` 8개 항목 중 6개가 "분리 토큰 값 스킵" 경로로 테스트되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:63-66`
    (`{"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env", "--super-prefix"}`)
    / `.claude/tests/test_push_detection.py`
  - 상세: `MUST_BLOCK` 목록은 `-C`(`git -C /tmp/wt push`)와 `-c`(`git -c user.name="a b" push`)만
    "옵션 뒤 별도 토큰이 값" 경로로 실제 검증한다. `--git-dir=` 케이스는 `=` 내장 단일 토큰이라
    실제로는 `_GIT_OPTS_WITH_VALUE` lookup 이 아니라 그 옆의 `token.startswith("-")` 자기완결 분기를
    타고 통과한다(다른 코드 경로). `--work-tree`·`--namespace`·`--exec-path`·`--config-env`·
    `--super-prefix` 는 테스트 파일 어디에도 등장하지 않는다(`grep` 로 확인). 이 가드는 push 여부를
    판정해 미검토 브랜치의 실제 push 를 막는 보안성 게이트이므로, 이 표에 오타(예:
    `--work-tree` 를 `--worktree` 로 잘못 적음)가 들어가도 지금 스위트는 통과한다 — 그 상태에서
    `git --work-tree <path> push` 를 실행하면 다음 토큰(`<path>`) 이 서브커맨드로 오판되어
    **거짓 음성**(진짜 push 가 감지 안 됨)이 된다. 정확히 이번 리라이트가 없애려던 실패 계열이다.
  - 제안: `for opt in _GIT_OPTS_WITH_VALUE: assert guard._git_subcommand(["git", opt, "v", "push"]) == "push"`
    형태로 8개 전항목을 파라미터화해 테이블 자체를 회귀 가드로 승격.

- **[INFO]** `test_reap_merged_worktrees.py` 가 `.claude/tests/README.md` "What's covered" 표에 없음
  - 위치: `.claude/tests/README.md` (표는 24~30행대, `test_reap_merged_worktrees.py` 행 부재 —
    `grep -n "reap" .claude/tests/README.md` 0건)
  - 상세: 이 PR 은 README.md 를 직접 수정해 `test_push_detection.py` 행만 추가했고, plan 체크리스트는
    "README 신규 테스트 행 추가"를 완료로 표시했다. 그런데 이번에 8건이 새로 추가되며 세션-사망
    인시던트 재현 테스트로 성격이 바뀐 `test_reap_merged_worktrees.py` 자체는 표에 아예 없다
    (이 PR 이전부터 없었던 pre-existing 누락 — `test_check_e2e_playwright_config.py` 등 다른 6개
    파일도 같은 상태라 이 PR 만의 문제는 아니다). 다만 README.md 가 이번 diff 의 대상 파일이고,
    두 핵심 회귀 테스트 파일 중 하나가 색인에서 안 보이는 것은 아쉽다.
  - 제안: 이번 PR 범위에서 `test_reap_merged_worktrees.py` 행도 함께 추가(§ "merge-reap 계약 +
    `--keep`/세션-앵커 회귀" 요약). README 전체 완전성 감사는 별도 후속으로 분리 가능.

- **[INFO]** `guard_review_before_push.main()` 자체는 여전히 미검증 (이번 diff 의 회귀는 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py::main` (508~541행대) —
    `grep -rn "guard_review_before_push" .claude/tests/*.py` 결과 `test_push_detection.py` 외 참조 0건
  - 상세: 이번 변경으로 `_is_git_push`/`_tokenize`/`_git_subcommand` 는 잘 테스트되지만, 이를 실제로
    소비해 exit 0/2 를 결정하는 `main()`(JSON payload 파싱, `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`
    분기, `.claude/settings.json` 이 부르는 실제 진입점)은 이번에도 여전히 subprocess 수준 테스트가
    없다. `main()` 은 이번 diff 에서 손대지 않았으므로 새 회귀는 아니지만, "판정 로직을 고쳤는데
    그걸 소비하는 배선은 아무도 실행하지 않는다"는 간극은 남아있다.
  - 제안(비차단, 후속 과제): `test_reap_merged_worktrees.py` 처럼 subprocess 로 stdin JSON
    (`{"tool_input": {"command": "git push"}}`) 을 넣어 exit code 를 단언하는 얇은 통합 테스트 1~2건.

- **[INFO]** `_is_git_push` 세그먼트 처리의 대칭 케이스 일부 미검증 (구조상 위험 낮음)
  - 위치: `.claude/hooks/guard_review_before_push.py:281-307` (`_is_git_push` 루프)
  - 상세: 테스트는 "2번째/3번째 세그먼트의 push"(`"second segment of three"`)는 고정하지만, push 가
    **첫** 세그먼트인 경우(`git push && echo done`) 나 트레일링 구분자(`git push;`), 선행 구분자
    (`&& git push`) 는 별도 케이스가 없다. 코드를 읽으면 루프가 위치에 무관하게 대칭적으로 동작해
    실제 위험은 낮다고 판단되지만, 이 스위트가 이미 대칭성에 공들이는 스타일(양방향 표 분리, 폴백
    분기, 주석 문자 케이스 등)이라 언급해둔다.
  - 제안: 선택적. `("push first of two", "git push && echo done")` 1건 정도 추가하면 표가 완전해짐.

## 강점 (참고)

- 핵심 로직 변경 2건(`_is_git_push` 재작성, reaper `--keep`) 모두 전용 회귀 테스트를 갖췄고,
  **비-vacuity 를 직접 재검증**했다 — HEAD~1(fix 이전) 소스에 신규 테스트를 그대로 얹어 실행한 결과
  push 쪽 6/7 실패, reaper 쪽 6/8 실패(나머지는 plan 문서가 명시한 대로 구 파서의 우연한 exit 2 일치
  또는 의도된 회귀-보존 케이스)로, plan 의 자체 보고("전체 8건이 fix 이전 코드에서 실패")와 정확히
  일치함을 확인했다.
- `test_bootstrap_keeps_the_worktree_it_was_invoked_from` 은 reaper 단독이 아니라 실제
  `bootstrap-session.sh` 를 서브프로세스로 구동하는 end-to-end 케이스 — "reaper 만 고치고 bootstrap
  이 `--keep` 을 실제로 넘기는지는 아무도 확인 안 함" 이라는, 이 종류의 배선 버그에서 가장 흔한 함정을
  정확히 막는다. `_install_bootstrap` 헬퍼가 앵커 워크트리를 커밋해 clean 상태로 만들고 이를
  단언하는 것도 "dirty skip 이 우연히 살려줘서 테스트가 헛돈다"는 vacuity 를 능동적으로 차단한다.
  프로젝트 메모리에 기록된 "새 테스트가 실제로 회귀를 잡는지 검증" 교훈을 코드 레벨에서 실천한 사례.
- Mock 사용이 적절 — Python 쪽(`_is_git_push`)은 순수 함수라 목 없이 직접 호출, 셸 스크립트 쪽은
  git 자체는 진짜로 실행하고 외부 네트워크 의존(`gh`) 만 스텁 — 두 계층 모두 프로젝트의
  `.claude/tests/README.md` 컨벤션("git 자체가 아니라 git-backed helper 를 patch")과 부합한다.
  테스트 격리도 매 테스트 `tempfile.mkdtemp()` + `addCleanup` 으로 완전 독립.
- 전체 하네스 스위트(264건) 재실행 결과 `OK` — 이름 변경(`_GIT_PUSH`→`_GIT_PUSH_FALLBACK`)에 대한
  잔존 참조도 0건. CI(`harness-checks.yml`) 의 `paths:` 트리거가 `.claude/hooks/**`·`.claude/tools/**`·
  `.claude/tests/**` 를 모두 포함해 이번 diff 는 정상적으로 CI 스위트를 발화시킨다.
  `plan/in-progress/harness-session-anchor-guards.md` 프런트매터 변경도 `plan-frontmatter.test.ts`
  (93 assertions) 를 직접 실행해 통과를 확인했다 — plan 체크리스트가 요구한 프런트엔드 vitest
  실행 의무를 실제로 충족한다.

## 요약

세션 앵커 reap 사고와 push 오탐이라는 두 실제 인시던트에 대한 회귀 테스트가 신설/보강되었고,
단순히 "테스트를 추가했다"는 주장에 그치지 않고 fix 이전 코드로 되돌려 실패를 재현하는 방식으로
비-vacuity 를 스스로 증명한 점이 이 리뷰에서 가장 인상적인 부분이다(리뷰어가 독립적으로 동일한
재현을 수행해 plan 문서의 수치를 그대로 확인했다). Mock 적절성·테스트 격리·가독성 모두 프로젝트
컨벤션에 부합하며 기존 264건 스위트에 회귀가 없다. 남은 갭은 모두 2차적이다 — `--keep` 의
repeatable 계약과 `_GIT_OPTS_WITH_VALUE` 테이블 대다수 항목이 테스트로 고정되지 않아 향후 조용한
퇴행(silent regression) 여지가 있고(WARNING 2건), README 색인 완전성과 `main()` 진입점 자체는
이번 PR 스코프 밖에 가까운 기존 갭이다(INFO). 어느 것도 이번 변경이 해결하려던 핵심 문제(세션 사망,
push 오탐)의 실효성을 훼손하지 않는다.

## 위험도

LOW
