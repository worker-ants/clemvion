# 유지보수성(Maintainability) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tools/reap-merged-worktrees.sh`,
`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_push_detection.py`,
`.claude/tests/test_reap_merged_worktrees.py`, `.claude/docs/worktree-policy.md`,
`plan/in-progress/harness-session-anchor-guards.md`

## 발견사항

- **[WARNING]** `reap-merged-worktrees.sh` pass-1 루프가 필터링 5종 + 실행 로직을 한 블록에서 처리
  - 위치: `.claude/tools/reap-merged-worktrees.sh:531-576` (pass 1 while 루프)
  - 상세: 루프 바디 하나가 (1) 빈 값 스킵 (2) 경로 prefix 필터 (3) 브랜치 prefix 필터 (4) 현재 worktree 스킵 (5) `--keep` 스킵 (6) dirty 스킵 (7) `gh` merge 상태 조회 (8) dry-run 로그/카운트 (9) 실제 삭제 실행까지 9~10개의 개별 책임을 순차적으로 담당한다(약 35~45줄). guard-clause 스타일과 각 단계 주석 덕분에 현재도 읽을 수는 있지만, "이 worktree 를 reap 해야 하는가" 판정과 "reap 을 실행한다" 를 분리하는 헬퍼(예: 조건만 반환하는 predicate 함수)가 없어 향후 필터 조건이 하나만 더 늘어도 루프가 계속 길어지는 구조다. pass-2 루프(578-608행)도 유사한 형태를 별도로 반복하고 있어, 두 곳이 독립적으로 계속 커질 위험이 있다.
  - 제안: `_should_reap_worktree(wt_path, wt_branch)` 류의 판정 전용 함수로 필터 단계(3~7)를 분리하고, 루프 바디는 "판정 → 실행(dry-run/real)" 두 단계만 남기는 리팩터를 고려. 셸 스크립트 특성상 강제할 필요는 없으나, 향후 조건 추가 시 우선적으로 적용할 기준으로 남겨둘 만하다.

- **[INFO]** `main()` 의 REVIEW/PLAN 게이트 두 블록이 구조적으로 거의 동일
  - 위치: `.claude/hooks/guard_review_before_push.py:296-329` (`main()`)
  - 상세: `evaluate_review()`/`evaluate_plan()` 각각을 감싸는 블록이 "None 체크 → try/except(fail-open) → 조건 만족 시 메시지 포맷 후 `return 2`" 로 거의 동일한 뼈대를 반복한다(각 ~12줄). 다만 이는 모듈 docstring(64-65행)이 명시하는 "두 게이트는 독립적으로 best-effort 로 임포트·평가되어, 한쪽이 깨져도 다른 쪽을 죽이지 않는다" 는 fault-isolation 설계의 자연스러운 결과이며, `review_guard.py`/`plan_guard.py` 가 원래 서로 다른 decision 객체(`decision.blocked`/`plan.untouched`)와 메시지 포맷(`_REVIEW_MSG`/`_PLAN_MSG`)을 갖는 독립 모듈로 설계되어 있어 억지로 공통 헬퍼를 뽑으면 오히려 이 격리 의도가 흐려질 수 있다.
  - 제안: 현재는 그대로 두는 편이 낫다. 게이트가 3개 이상으로 늘어나는 시점에 한해 공통 `_run_gate(evaluate_fn, bypass_env, blocked_pred, msg_fn)` 헬퍼 추출을 재고할 것.

- **[INFO]** "Critical #1~#4" 회귀 서술이 코드·테스트·plan 세 곳에 중복 서술됨
  - 위치: `.claude/hooks/guard_review_before_push.py` 의 `_is_segment_boundary`/`_tokenize`/`_git_subcommand` docstring, `.claude/tests/test_push_detection.py:763-780` 주석, `plan/in-progress/harness-session-anchor-guards.md:1598-1615` 표
  - 상세: 동일한 4건의 과소차단 회귀(개행 전용 구분자·인용부호 분할·git 대소문자·미등록 글로벌 옵션)에 대한 서술이 훅 코드 docstring, 회귀 테스트 주석, plan 문서 표에 각각 별도 표현으로 반복된다. 세 곳 모두 "왜 이 코드가 이런 형태인가"를 설명하려는 정당한 목적이 있고, 과거 사고에 대한 정적(static) 서술이라 재수정 가능성은 낮지만, 만약 이 진단 중 하나가 추후 더 정확히 정정되면(코드 리뷰에서 실제로 한 번 있었던 "진단 정정 기록") 세 곳을 모두 찾아 갱신해야 하는 동기화 부담이 있다.
  - 제안: 현 상태를 유지하되, 이 4건 서술을 다시 손볼 일이 생기면 plan 문서를 SoT 로 삼고 코드/테스트 주석은 plan 문서를 가리키는 짧은 참조로 축약하는 것도 고려할 만하다(단, 현재도 code-adjacent 설명이라는 가치가 있어 필수는 아님).

- **[INFO]** `_git_subcommand()` 의 순환 복잡도가 상대적으로 높음
  - 위치: `.claude/hooks/guard_review_before_push.py:174-213`
  - 상세: 약 24줄 안에 env-assignment 스킵 while, git 여부 판정, 옵션 순회 while 안에 `_GIT_OPTS_WITH_VALUE` 매칭 / `-` 접두 + `=` 포함 여부 / fail-closed 분기가 중첩되어 분기점이 7~8개에 달한다. 셸 서브커맨드 파싱이라는 도메인 특성상 불가피한 복잡도이고, `test_push_detection.py` 가 이 함수의 각 분기(옵션-값 스킵, `=` 내장값, 미등록 옵션 fail-closed 등)를 개별 테스트로 pin 하고 있어 실질적인 유지보수 위험은 테스트 커버리지로 상쇄되어 있다.
  - 제안: 현재 형태를 유지해도 무방하나, 향후 옵션 분류 규칙이 하나 더 늘면(예: `--foo bar=baz` 같은 새 패턴) 옵션 분류 로직만 별도 헬퍼로 뽑는 것을 고려.

- **[INFO]** 축약 변수명 `wt`/`br` 이 나머지 코드의 완전한 이름(`wt_path`/`wt_branch`)과 대비됨
  - 위치: `.claude/tools/reap-merged-worktrees.sh:500-510` (`_parse_worktrees()`)
  - 상세: 스크립트 전반은 `wt_path`, `wt_branch`, `main_root`, `current_top` 처럼 풀어 쓴 이름을 쓰는데, `_parse_worktrees()` 내부에서만 `wt`/`br` 로 축약된다. 함수 스코프가 12줄로 작고 바로 위 주석("Emit one 'path<TAB>branch' record")이 문맥을 보완해 실질적 혼동은 없다.
  - 제안: 선택 사항. 일관성을 위해 `worktree`/`branch` 로 풀어써도 되지만, 우선순위 낮음.

- **[INFO]** `main_root` 계산 시 `realpath_p` 적용 여부가 두 스크립트 간 다름
  - 위치: `.claude/tools/bootstrap-session.sh:16-17` vs `.claude/tools/reap-merged-worktrees.sh:52-53`
  - 상세: 두 스크립트 모두 `git rev-parse --path-format=absolute --git-common-dir` 로 `common` 을 구한 뒤 `main_root=$(dirname "$common")` 을 계산하는 동일한 2줄 패턴을 갖고 있는데, reaper 쪽만 symlink drift(`/var` ↔ `/private/var`) 방지를 위해 `realpath_p` 로 감싼다(그 이유는 reaper 자체 주석에 명시됨: 경로 비교가 있기 때문). bootstrap 은 `main_root` 를 다른 경로와 *비교*하지 않고 하위 경로 조립에만 쓰므로 기능적으로는 문제없지만, 동일한 git 커맨드를 다루는 두 스크립트가 겉보기엔 다른 처리를 하는 것으로 보여 코드를 나란히 볼 때 "왜 한쪽만 감싸는가" 라는 의문을 유발할 수 있다. 공유 셸 lib 디렉토리(`.claude/tools/_lib/` 등)가 없어(Python 훅의 `_lib/` 와 달리) 이 2줄이 두 파일에 독립적으로 존재하는 것 자체는 "셸 스크립트는 각자 self-contained" 라는 기존 설계와 일치한다.
  - 제안: 필요 시 bootstrap 쪽 주석에 "여기선 경로 비교가 없어 realpath_p 불필요" 한 줄만 덧붙이면 의문을 예방할 수 있다. 급하지 않음.

- **[INFO]** 안전-critical 가드의 방대한 docstring — 장기적으로 "코드 본문보다 큰 주석" 이 될 위험
  - 위치: `.claude/hooks/guard_review_before_push.py` 전반 (`_is_segment_boundary`, `_tokenize`, `_git_subcommand`, `_is_git_push` 의 docstring이 각각 함수 본문보다 길다)
  - 상세: 각 함수가 과거 Critical 버그 번호를 인용하며 "왜 이렇게 짜여 있는가"를 상세히 설명한다. 이는 `git push` 오탐/누락을 막는 안전-critical 가드라는 성격상 정당한 트레이드오프이며(과거에 실제로 "그럴듯해 보이는 단순화"가 회귀를 재도입한 사례가 있음, `_is_segment_boundary` docstring 참고), 현재 시점에서는 문제라기보다 강점에 가깝다. 다만 이 파일이 계속 회귀 수정을 거치며 "Critical #N" 이 계속 늘어나는 패턴이 관측되므로(#1~#4가 한 세션에서 추가됨), 앞으로도 이 방식이 반복되면 주석이 무한정 누적되는 changelog-in-comment 안티패턴으로 흐를 여지가 있다.
  - 제안: 지금 당장 조치는 불필요. 다만 다음 라운드의 회귀 수정부터는 "왜 지금 코드가 이 형태인가"에 대한 최소 설명만 docstring에 남기고, 사고 이력·번호 매김 자체는 plan/RESOLUTION 문서 쪽에 집중시키는 방향을 원칙으로 삼아두면 장기적으로 파일 크기 증가를 억제할 수 있다.

## 요약

전반적으로 유지보수성 품질이 높다. 두 훅/스크립트 모두 명확한 섹션 구분·가드절(guard clause) 스타일로 중첩 깊이를 낮게 유지하고, 함수/변수명이 목적을 잘 드러내며, `.claude/hooks/*.py` 파일군의 기존 컨벤션(`_read_payload()`, 모듈 docstring 안의 exit-code 계약 명시, `THIS_DIR`/`sys.path.insert` 패턴)을 그대로 따른다. 매직 넘버는 `REAP_MIN_INTERVAL`(6h)·`mtime +30` 등 전부 이름·주석으로 의미가 부여되어 있어 문제되지 않는다. 두 테스트 파일은 테이블 기반 케이스(`MUST_BLOCK`/`MUST_ALLOW`)와 설명적인 테스트명으로 회귀를 명확히 pin 하고 있어 향후 유지보수에 크게 기여한다. 유일하게 실질적으로 손볼 만한 지점은 `reap-merged-worktrees.sh` pass-1 루프가 여러 필터링 책임과 실행 로직을 한 블록에 담고 있다는 점(WARNING)이며, 그 외 항목들은 대부분 의도된 설계 트레이드오프(fault-isolation을 위한 게이트 중복, 안전-critical 가드의 상세 주석)이거나 스코프가 작아 실질 영향이 없는 사소한 스타일 편차(INFO)다.

## 위험도
LOW
