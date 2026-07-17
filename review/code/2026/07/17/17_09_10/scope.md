# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 서로 독립된 두 결함(① reaper 세션 앵커 보호, ② push 가드 서브커맨드 판정)이 하나의 plan/커밋으로 묶여 있음
  - 위치: 전체 diff (파일 1·2·4·5·6·7), `plan/in-progress/harness-session-anchor-guards.md`
  - 상세: ①은 `.claude/tools/bootstrap-session.sh` + `.claude/tools/reap-merged-worktrees.sh`(+테스트), ②는 `.claude/hooks/guard_review_before_push.py`(+테스트)로 코드상 서로 의존관계가 없는 별개 훅이다. 다만 plan 문서의 Overview("가드가 진짜 대상 대신 대리 지표를 평가한다"는 동일 계열 프레이밍)와 Rationale("왜 별도 plan 인가" 절)에서 두 건을 하나의 plan 으로 묶은 이유를 명시적으로 밝히고 있고, 원래 발견된 무관 PR(`report-paths-shared-0edbf0`)에서 일부러 분리해냈다는 이력까지 남아 있다. 커밋 메시지("대리 지표 2건을 진짜 대상으로 교체")도 이 프레이밍과 일치한다. 즉 은폐된 범위 확장이 아니라 **사전에 정당화·기록된 의도적 묶음**이다.
  - 제안: 근거가 충분히 기록되어 있어 추가 조치 불요. 완전 독립된 결함을 한 PR 로 묶을 때 plan Rationale 에 근거를 남기는 이번 패턴을 관례로 유지 권장.

- **[INFO]** plan frontmatter `worktree:` 값이 plan 주제·branch 이름과 다름
  - 위치: `plan/in-progress/harness-session-anchor-guards.md` frontmatter (`worktree: llm-usage-doc-alignment-01d7a4`)
  - 상세: 실측(`git worktree list`) 결과 이 worktree 디렉토리는 실제로 branch `claude/harness-session-anchor-guards-611d98` 를 체크아웃 중이다. `task_name-slug` 규칙(worktree-policy.md §2)상 디렉토리명("llm-usage-doc-alignment-01d7a4")과 branch 이름("harness-session-anchor-guards-611d98")의 task_name·slug 가 서로 다르다 — 다른 작업용으로 만들어졌던 worktree 를 재사용했거나 세션 복구 과정에서 이렇게 된 것으로 보인다. CLAUDE.md §3("현재 worktree 이름을 기록")기준으로 기록값 자체는 사실과 일치하므로 규약 위반은 아니며, 이번 diff 의 코드 내용에는 영향이 없다.
  - 제안: 코드 범위 밖의 정보성 관찰. 조치 불요 — 인지 목적으로만 기록.

- **[INFO]** `reap-merged-worktrees.sh` 의 `--keep` 플래그가 다회 지정(repeatable) 을 지원 — 현재 유일한 호출자(`bootstrap-session.sh`) 는 1회만 사용
  - 위치: `.claude/tools/reap-merged-worktrees.sh` 인자 파서(`--keep` case, `keep_paths` 누적) 및 주석("Never reap this worktree (repeatable)")
  - 상세: 이번 결함(①)이 요구하는 것은 "세션 앵커 1개 보호"뿐이지만 구현은 `--keep` 을 여러 번 줘도 누적되도록 일반화했다. 다만 구현 비용이 문자열 append + `grep -qxF` 수준으로 사실상 0이고, CLI 플래그의 통상적 관용구(반복 가능한 `--exclude`/`--keep` 류)라 과잉설계로 보기는 어렵다.
  - 제안: 조치 불요. 향후 "동시에 열린 다른 세션의 앵커도 보호" 같은 요구가 생기면 이미 지원되는 인터페이스이므로 오히려 유리한 선제적 설계.

## 요약

리뷰 대상 8개 파일은 plan(`plan/in-progress/harness-session-anchor-guards.md`)의 체크리스트 항목(① bootstrap `--keep` 전달 + reaper skip 집합 / ① 회귀 테스트 / ② 서브커맨드 판정 + shlex 폴백 / ② 회귀 테스트 / 문서 동기화)과 1:1 로 정확히 대응하며, `git diff --stat origin/main...HEAD` 로 재확인한 결과도 이 8개 파일 이외의 변경은 없다. 코드 레벨에서 무관한 리팩토링·포맷팅 잡음·불필요한 주석/임포트·의도치 않은 설정 변경은 발견되지 않았다 — `guard_review_before_push.py` 의 신규 함수(`_tokenize`/`_git_subcommand`)와 `reap-merged-worktrees.sh` 의 `realpath_p` 이동, `test_reap_merged_worktrees.py` 의 `_run`→`_env`/`_run` 분리는 모두 해당 fix 를 위해 기계적으로 필요한 변경이다. 다만 서로 독립적인 두 하네스 결함(세션 앵커 reap·push 서브커맨드 판정)을 하나의 plan/커밋으로 묶은 점은 plan 자체의 Rationale 에서 명시적으로 정당화되어 있어 은폐된 범위 확장은 아니다. 그 외 worktree/branch 명명 불일치는 코드 diff 범위와 무관한 환경상 관찰 사항으로 기록만 남긴다.

## 위험도
LOW
