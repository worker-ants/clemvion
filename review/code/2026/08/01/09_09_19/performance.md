# 성능(Performance) Review — round 9

프롬프트가 잘라낸(⚠️ truncated) 파일(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`, `merge_coordinator_orchestrator.py`
후반부, `test_block_integrity.py`)은 전부 `Read` 로 직접 열어 확인했다. 라운드 9 지시에 따라
"고쳤다"고 적힌 항목은 **추론이 아니라 실측**으로 확인했고, git 히스토리에서 라운드 7(`5526fc8f8`)·
라운드 8(`54fff611f`) 이전 버전을 복원해 실제 old-vs-new 타이밍을 재고 mutation(부분 원복) 테스트까지
돌렸다. 방법론과 수치는 아래 각 항목에 그대로 남긴다.

## 발견사항

- **[WARNING]** `block_integrity.py` 8R 회귀 테스트 3개 중 1개가 자신이 막는다고 주장하는 결함을
  실제로는 재현하지 못한다 (vacuous, mutation-검증됨)
  - 위치: `.claude/tests/test_block_integrity.py:543-546`
    (`VerdictParserStaysLinearTest.test_a_trailing_run_after_a_real_verdict_returns_fast`).
    비교 대상 정규식: `.claude/_shared/block_integrity.py:100-102` (`_BLOCK_AT_LINE_END`).
  - 상세: 이 테스트의 docstring 은 "the tail gap in the END pattern" 을 가드한다고 주장한다
    (같은 클래스 형제 테스트 `test_a_bare_block_followed_by_a_long_run_returns_fast` 는 실제로
    유효 — 아래 검증 참고). 그러나 실측 결과, 이 tail 부분(`\**\s*$` → `[ \t*]*$`)은 8R 수정 이전
    상태(라운드 7 커밋 `5526fc8f8`)에서도 이 테스트의 입력(`'BLOCK: YES' + ' '*45000 + 'x'`)에
    대해 **0.0008초** 로 이미 빨랐다(수정 후는 0.0006초 — 유의미한 차이 없음). 순수 공백 외에도
    공백+개행 혼합, 순수 `*`, `*`+공백 혼합 등 6가지 이상의 입력 형태로 재확인했으나 old/new 사이에
    이차 시간 차이가 전혀 재현되지 않았다. **결정적 검증**: 현재 파일에서 middle-gap 수정
    (`[ \t*]*`, 이미 올바름)은 그대로 두고 tail 만 8R 이전 형태(`\**\s*$`)로 되돌려 이 테스트를
    다시 실행 — 여전히 0.0006초로 **GREEN** 이다. 즉 이 테스트는 tail 서브패턴이 원복돼도 잡아내지
    못한다. (반면 middle-gap 테스트는 동일한 되돌리기 방식으로 실측하면 old 30.1초 vs new
    0.0017초로 **확실히 유효**하다 — 아래 "검증한 것" 참고.) 프로덕션에 살아있는 결함이 있다는
    뜻은 아니다 — 여러 입력 형태로도 tail 서브패턴 자체가 애초에 진짜 이차가 아니었을 가능성이
    높다(겹치지 않는 두 quantifier `\**`+`\s*` 는 quadratic 분할 모호성이 없음). 다만 "라운드 8이
    닫은 두 번째 이차" 라는 서술과 실제로 이 테스트가 지키는 범위가 어긋나 있어, 향후 tail 이
    진짜로 손상돼도 이 테스트만으로는 못 잡는다.
  - 제안: docstring 을 "correctness 회귀(긴 trailing run 에서도 올바른 판정)" 로 정정하거나,
    tail 을 진짜로 이차로 만드는 입력(있다면)을 다시 찾아 넣을 것. 없다면 이 테스트를 성능
    회귀가 아닌 correctness 테스트로 재분류.

- **[WARNING]** `review_guard.py` 의 히스토리 전체 스캔이 매 push·매 turn-end 마다 무제한으로
  자란다 — 정렬·조기종료 없이 O(전체 세션 수), 실측 236ms/142ms
  - 위치: `.claude/hooks/_lib/review_guard.py:400-408` (`_iter_summaries`),
    `:535-565` (`_newest_resolved_review_mtime`), `:717-725` (`_iter_consistency_summaries`),
    `:757-799` (`_newest_resolved_impl_done_mtime`).
  - 상세: 이 저장소에서 직접 실행해 측정(`evaluate_review()` 가 호출하는 실제 함수들, 실제
    `review/` 트리 대상):
    ```
    _iter_summaries: 774개 SUMMARY.md 발견, 26.6ms
    _newest_resolved_review_mtime: 235.9ms  (774개 전부에 대해 _forced_coverage_missing +
                                              SUMMARY 본문 읽기 + RESOLUTION.md 존재 체크)
    _iter_consistency_summaries: 732개 발견, 17.9ms
    _newest_resolved_impl_done_mtime: 141.8ms
    ```
    `os.walk` 가 `review/code/**`·`review/consistency/**` 전체를 무조건 순회하고, "가장 최근의
    *resolved* 세션" 을 찾기 위해 **모든** SUMMARY.md 를 열어 판정한다 — 세션 디렉토리명이
    `<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>` 로 이미 사전순 정렬 가능함에도 최신순 역순회 + 첫
    resolved 히트에서 조기 종료하는 최적화가 없다. 이 훅은 **매 push** (그것도
    `_evaluate_over_targets` 가 push 커맨드에 언급된 **각 worktree 마다** 별도 호출 —
    `guard_review_before_push.py:809-883`) 와 **매 turn-end**(Stop 훅)에서 동기 실행된다.
    현재 이 worktree 만으로도 774+732=1,506개 세션이 쌓여 있고(이 브랜치가 9라운드째 리뷰
    세션을 계속 생성 중이므로 증가 속도가 느리지 않다), 스캔 비용은 세션 수에 선형 비례해
    계속 자란다. 이 저장소의 다른 모든 정규식/서브프로세스 경로는 `_MAX_REDACTION_INPUT`,
    `_OWNER_WINDOW`, `_MAX_GLOB_WILDCARDS` 등으로 철저히 상한을 두는데(`guard_review_
    before_push.py` 참고), 이 순수 Python 트리 순회에는 그런 시간/개수 상한이 전혀 없다 —
    같은 원칙이 이 경로에는 적용되지 않은 비일관성이다.
  - 제안: 세션 디렉토리를 이름 역순(최신 우선)으로 정렬해 순회하고 첫 resolved 매치에서
    멈추도록 바꾸면 일반적인 경우 O(k) (k=최근 미해결/무관 세션 수, 보통 한 자리) 로 줄어든다.
    당장 어렵다면 최소한 스캔할 세션 수 상한(예: 최근 N개월)을 두어 무제한 성장을 막을 것.

- **[WARNING]** `merge_coordinator_orchestrator.py` 가 analyzer 4명 분의 prompt 를 만들면서
  동일한 (base, branch) git diff 를 매번 다시 계산 — 캐싱 없음, 실측 branch 당 약 200ms 낭비
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:189-194`
    (`branch_diff_stat`), `:197-202` (`branch_touched_files`), `:205-244` (`categorise_paths`,
    `project_config.load` 매 호출), `:282-301` (`format_branches_section`), `:304-316`
    (`file_intersection_section`), `:319-343` (`spec_plan_overlap_section`), `:369-385`
    (`build_analyzer_prompt`), `:393-453` 특히 `:399-413` (analyzer 루프, `prepare_session`).
  - 상세: `prepare_session` 은 `ANALYZERS`(4개) 전부에 대해 `build_analyzer_prompt` 를 호출하고,
    그때마다 `format_branches_section(branches_info, base)` 를 **처음부터 다시** 실행한다 —
    각 branch 마다 `branch_diff_stat`(`git diff --stat`) 과 `branch_touched_files`
    (`git diff --name-only`) 를 서브프로세스로 재호출한다(캐시/메모이제이션 전혀 없음,
    `grep cache` 결과 0건). 거기에 더해 `ANALYZER_EXTRA_SECTION` 의 `file_intersection_section`
    (2개 analyzer 가 공유)·`spec_plan_overlap_section` 이 **같은** `branch_touched_files` 를
    또 다시 호출한다. 이 저장소에서 실제로 `git diff --stat origin/main...HEAD` /
    `git diff --name-only origin/main...HEAD` 를 8회 반복 측정:
    ```
    git diff --stat:      평균 ~28.6ms/회
    git diff --name-only: 평균 ~16.6ms/회
    ```
    branch 2~5개인 전형적 세션 기준으로 환산하면(analyzer 4명 × branch 당 stat+names 재계산
    + extra 섹션의 재조회 vs (base,branch) 당 한 번만 계산하는 이상적 캐싱):
    ```
    B=2 branch: 현재 22회 git 서브프로세스 vs 캐싱 시 4회 → 약 407ms 낭비
    B=3 branch: 현재 33회 vs 6회 → 약 610ms 낭비
    B=5 branch: 현재 55회 vs 10회 → 약 1,017ms 낭비
    ```
    `categorise_paths` 가 매 branch 마다 `project_config.load(repo_root)` 를 재호출하는 것도
    같은 패턴이다(`.claude/skills/_lib/project_config.py` 확인 — `lru_cache` 등 캐싱 전혀
    없음). 이 비용은 `/merge-coordinate` 의 analyzer fan-out(Agent tool 호출) **이전에** 동기로
    발생해 세션 준비 지연으로 그대로 드러난다.
  - 제안: `prepare_session` 진입 시 `{(base, branch): (stat, files)}` 딕셔너리를 한 번만 채워
    `format_branches_section`/`file_intersection_section`/`spec_plan_overlap_section` 이 모두
    그 결과를 재사용하도록 리팩터. `project_config.load()` 결과도 세션당 한 번만 로드해 전달.

- **[INFO]** 이미 추적/측정된, 이번 라운드가 만들지도 악화시키지도 않은 기존 항목 재확인
  (plan/in-progress/harness-review-gate-ci-backstop.md 신규 후속 7·1 번과 일치)
  - `consistency_orchestrator.py:416-418`(`_rank_plan_text`, 랭킹용 전체 read) 과 `:545,562`
    (`format_file_bundle` 이 같은 `plan/in-progress/` 파일들을 번들용으로 다시 read)가 이중 I/O
    임을 코드에서 직접 확인했다 — plan 문서가 적어 둔 "30개 430,929 bytes ≈3.5ms" 규모에서는
    무해하지만, 세션당 2배 I/O 라는 설계는 여전히 남아 있다.
  - `code_review_orchestrator.py:509` `build_files_section` 의 diff-only 초과 분기(`:577-619`)는
    `_truncated_note`/생략 placeholder 가 덧붙이는 길이를 `overflow` 차감에 반영하지 않아
    예산을 소폭 초과할 수 있다(plan 문서 실측 "1,678자 vs cap 1,500"). 이번 라운드가 만든 결함이
    아니고 이미 등재·defer 된 상태 — 재확인만.
  - `merge_coordinator_orchestrator.py` 에는 `_shared/retry_state.py` 로 이전된 다른 두
    orchestrator 와 달리 `reconcile_state_with_disk` 자기치유 로직이 없다(코드에서 직접 확인 —
    `_load_state`/`_save_state`/`_apply_status_update` 만 위임, reconcile 호출 없음). 성능
    문제라기보다 정확성 이슈에 가깝지만 `/loop` 재시도 판단에 쓰이는 상태의 신선도에 영향.

## 검증한 것 (측정 방법)

- `block_integrity.py` 의 두 진짜 이차 수정은 **실제로 유효함을 직접 재현**했다: git 에서
  라운드 7 이전(`5526fc8f8^`)·라운드 7 이후 8R 이전(`5526fc8f8`)·현재(`54fff611f`= HEAD) 버전을
  각각 추출해 `summary_block_verdict()` 를 직접 호출.
  - 선두 문자 클래스(`[\s…]`→`[ \t…]`, 20,000줄, BLOCK: 없음): 9.20초 → 0.002초.
  - 중간 gap(`\s*\**\s*`→`[ \t*]*`, `"BLOCK:" + " "*45000`): **30.10초 → 0.0017초**
    (8R 자신의 문서화 수치와 정합).
  - 이 두 건은 `test_no_verdict_in_a_large_document_returns_fast`,
    `test_a_bare_block_followed_by_a_long_run_returns_fast` 로 각각 실측 검증된 진짜 회귀
    가드다.
- 세 번째 테스트(`test_a_trailing_run_after_a_real_verdict_returns_fast`)는 위 발견사항에 적은
  대로 **mutation(tail 만 원복)으로도 GREEN** — 방어력이 없음을 직접 확인.
- `guard_review_before_push.py` 에 문서화된 과거 ReDoS 수정 4건(§(b) env-value `\s+`→
  `[^\S\n]+`, §(c) 구분자 뒤 `\s*`→`[^\S\n]*`, §(e) tail 개행 제외, `_MESSAGE_ARG` 이스케이프
  분리)을 각각의 대표 adversarial 입력으로 재실행 — 전부 문서 수치와 일치하는 5ms~9ms 대로
  빠르다. 새로 발견된 문제 없음.
- `_glob_to_regex` 의 `_MAX_GLOB_WILDCARDS=6` 상한이 실제로 지수 폭발을 막는지는 기존
  `SpecGlobCompilationIsBoundedTest` 로 이미 고정돼 있음을 확인(별도 재측정 생략, 코드 검토로
  상한 로직 자체는 올바름을 확인).
- `code_review_orchestrator.py` 는 `change_infos`(git diff 데이터)를 세션당 한 번만 수집해
  reviewer/router 프롬프트 생성 루프(`:1018`, `:788`)가 재사용함을 확인 — merge-coordinator 와
  달리 이 orchestrator 에는 위 N+1 패턴이 없다.

## 요약

이번 라운드가 직접 손댄 회귀 스위트(`block_integrity.py` 의 두 이차 정규식 수정)는 실측으로
검증한 결과 **의도한 두 사례 모두 실제로 유효**하다 — 이 부분에서는 "고쳤다는 주장이 코드와
일치"한다. 다만 같은 커밋이 추가한 세 번째 테스트는 자신이 지킨다고 적은 대상(END 패턴의 tail
gap)을 mutation 검증으로도 실제로 지키지 못하는 것으로 확인됐다(다만 그 tail 자체가 애초에 진짜
이차였다는 증거도 못 찾았다 — 살아있는 결함이 아니라 테스트 커버리지 주장의 과장에 가깝다).
리뷰 대상 전체로 넓히면 두 가지 독립된 실측 기반 성능 이슈가 남아있다: `review_guard.py` 가 매
push·매 turn-end 마다 전체 리뷰 히스토리(현재 1,500개 이상 세션)를 상한 없이 선형 스캔하는
구조(측정 236ms+142ms, worktree 대상 수만큼 배수), 그리고 `merge_coordinator_orchestrator.py`
가 analyzer 4명분 prompt 를 만들며 동일 git diff 를 캐싱 없이 반복 계산하는 구조(branch 수에
따라 400ms~1s 낭비). 둘 다 현재 시점에 훅 타임아웃이나 fail-open 을 유발하지는 않지만, 전자는
프로젝트 히스토리가 쌓일수록 계속 자라는 상한 없는 비용이고 후자는 간단한 메모이제이션으로 즉시
해소 가능하다. 그 외 항목(plan 텍스트 이중 read, budget 오차, merge-coordinator 의 self-heal
누락)은 이미 plan 문서에 측정·등재된 상태로, 이번 라운드가 새로 만들거나 악화시키지 않았음을
코드 대조로 확인했다.

## 위험도

MEDIUM
