---
title: 리뷰 게이트 CI 백스톱 진행 중 발견한 미해결 후속
worktree: harness-review-ci-backstop-91f379
started: 2026-08-07
owner: developer
priority: P3
spec_impact: none
---

# harness — 리뷰 게이트 백스톱 후속 백로그

> 출처: [`plan/complete/harness-review-gate-ci-backstop.md`](../complete/harness-review-gate-ci-backstop.md).
> 그 티켓은 CI 백스톱을 관측 모드로 착지시키고(2026-08-01) `--enforce` 로 전환(2026-08-07)하며
> 종결됐다. 아래는 **그 주제와 별개로** 진행 중 발견된 항목들이라 함께 종결할 수 없어 분리했다.
> lifecycle §3 의 완료 조건("체크박스 전부 `[x]` + 미해결 follow-up 0건")을 만족시키려면
> 이 분리가 필요하다 — 남겨 두면 원 plan 이 영원히 완료되지 않는다.
>
> **번호는 원 plan 의 것을 유지한다.** §2·§12 는 그쪽에서 이미 종결돼 여기 없다 — 번호가
> 비어 있는 것은 누락이 아니라 그 뜻이다. §11 은 **부분 종결**이라(침묵 해소는 완료,
> 구조적 차단·동반 2건은 잔여) 그 사실을 명시해 유지했다. 원문(발견 경위·실측치·처방
> 후보)은 그대로 옮겼다.

## 미해결 항목

**신규 후속 (defer) — 아래 11건 + 기본 브랜치 해석 중복 1건**

1. ~~**`build_files_section` 의 diff-only 예산 분기가 상한을 넘는다**~~ → **처분 완료 (2026-08-07).**
   원인: 줄어든 양을 `cut` 으로 셈했다. 대체 텍스트가 잘림 note·placeholder 를 덧붙이므로
   실제 감소분이 `cut` 보다 작고, 짧은 diff 에서는 placeholder 가 원본보다 길어 **오히려
   늘어난다**. 실측(수정 전): cap 1500·12파일·diff 300자 → 1,822자(+322), cap 8000·30파일 → +90.
   처분: 감소분을 **실측해서** 차감하고, 이득 없는 대체는 채택하지 않으며(통째로 비움),
   진행이 없을 때까지 반복한다.
   **내가 만든 소액 초과를 한 번 더 고쳤다** — 루프 뒤에 붙인 전역 안내를 계상하지 않아
   37~71자가 남았다(이 분기가 고치려던 결함의 재생산). 사전 예약으로 옮겨 전 조합 0건.
   회귀 테스트는 **§4 와 갈라서** 단언한다: 조합마다 "헤더만" 크기를 먼저 재고 그게 상한
   안일 때만 비교한다. 동반 vacuity 검사가 **실제로 값을 했다** — 첫 판은 diff 를 생성 뒤에
   꽂아 분기를 한 번도 타지 않았고(exercised=0) 주 단언이 전부 헛통과였다.

1. **`build_files_section` 의 diff-only 예산 분기가 상한을 넘는다 (기존 결함)** —
   headers+diffs 만으로 예산을 넘는 분기에서, 절단 루프가 `_truncated_note` 와
   `"diff 생략"` placeholder 를 덧붙이면서 그 길이를 `cut` 에 계상하지 않는다. 실측:
   같은 fixture 로 `origin/main` 판 **1,681자 vs cap 1,500** (이 브랜치 판은 1,678 —
   이번에 추가한 안내는 `overflow` 에 계상했기에 오히려 3바이트 작다). 즉 **내가 만든 결함이
   아니고 악화시키지도 않았다.** 다른 분기의 같은 계상 누락은 이번에 고쳤으므로, 이 분기도
   같은 처방(노트 길이를 절단량에 포함)으로 닫으면 된다.
3. **`build_files_section` 이 예산 전략 3개를 한 함수(약 190줄)에 누적** — 무예산 /
   header+diff 초과 / 콘텐츠 할당 세 경로가 "안내문 길이도 예산에 포함" 이라는 같은 불변식을
   각자 손으로 재구현한다. 3R CRITICAL 이 정확히 이 구조에서 재발했다(한 경로를 고쳤는데
   다른 규모에서 같은 클래스가 다시 나옴). `_render_unbounded` /
   `_render_diff_only_overflow` / `_allocate_content_budget` 로 분리하고 예산 계상을 단일
   헬퍼로 공유시킬 것.
4. **파일 수가 아주 많으면 헤더만으로 상한 초과** — n=3000 실측: 헤더+구분자만 157,887자
   vs cap 141,557. 어느 분기도 **파일 섹션 자체를 버리는** 기능이 없어 구조적으로 준수 불가다
   (origin/main 도 동일 — 이번 변경이 만든 것도 악화시킨 것도 아니다). 실제 리뷰 규모에서는
   발생하지 않으므로 P3. 닫으려면 "N개 파일은 목록만" 같은 파일-단위 드롭이 필요하다.
5. **`evaluate_review` 의 boolean flag 구조** — push(hard block)/stop(soft nudge) 두 보증
   수준을 `in_flight_ok` 하나로 스위칭한다. 현재는 fail-safe 기본값 + 양방향 seam 테스트로
   봉쇄돼 있으나, 세 번째 호출부가 생기면 다시 기본값에 의존한다.
   `evaluate_review_for_push()` / `_for_stop()` 얇은 wrapper 로 시그니처 레벨 차단 검토.
6. **git 브랜치-diff 헬퍼가 두 orchestrator 에 중복** — `_branch_changed_rels`(consistency)
   와 `get_git_branch_diff_files`(code-review)가 같은 git 연산이다. 상호참조 주석은 넣었지만
   구조적 중복은 남는다. 위 "기본 브랜치 해석 4곳" 과 같은 뿌리(= `_lib` 충돌 해소 선행).
7. **`_rank_plan_text` 이중 read (이번 PR 이 도입한 I/O 회귀)** — `collect_context` 가
   랭킹 신호용으로 `plan/in-progress/` 전체를 한 번 읽고, 곧이어 `format_file_bundle` 이
   같은 디렉터리를 처음부터 다시 읽는다. 세션당 2배 I/O. 실측 규모는 30개 430,929 bytes
   (≈3.5ms 수준)라 현재는 무해하지만 **내가 만든 회귀**이고, `{path: text}` 맵을 한 번만
   만들어 랭킹·번들 양쪽에서 재사용하면 닫힌다. 5R 에서 코드를 더 건드리지 않기로 해
   등재만 한다.
8. ~~**`_default_branch_ref()` 의 성공 경로 3갈래가 미검증**~~ → **처분 완료 (2026-08-07).**
   `DefaultBranchRefSuccessPathsTest` 5케이스(symbolic-ref 적중 / origin/main / origin/master /
   둘 다일 때 main 우선 / origin 없음). 기존 테스트는 전부 stub 이거나 실패-흡수만 봤다.
   §15 와 같은 분리 기법이 필요했다 — 평범한 clone 은 `origin/HEAD` 와 `origin/main` 이 둘 다
   있어 누가 답했는지 모른다. 기본 브랜치를 `trunk` 로 둬 폴백이 답할 수 없게 만들었다.
   `_git` 이 cwd 를 받지 않아 프로세스 cwd 에서 도는 것도 계약이라, 스니펫이 `os.chdir` 한다.
   뮤테이션 3/3 RED(symref 분기 제거·main/master 순서 뒤집기·`refs/remotes/` 접두사 유지).

8. **`_default_branch_ref()` 의 성공 경로 3갈래가 미검증** — 모든 테스트가 이 함수를 통째로
   stub 하거나 실패-흡수 경로만 본다. 자매 함수 `_branch_changed_rels` 는 임시 git repo 로
   성공 경로까지 고정돼 있어 비대칭이다. 같은 패턴으로 4케이스(symbolic-ref 적중 /
   `origin/main` 만 / `origin/master` 만 / origin 없음) 고정할 것.
9. **`merge_coordinator_orchestrator.py` 에 `reconcile_state_with_disk` 자기치유가 없다** —
   상태 helper 를 `_shared/` 로 옮기며 확인: 이 파일은 세 번째 사본인데 `_load_state`/
   `_save_state`/`_apply_status_update` 가 다른 둘과 동일하고(전부 위임 완료),
   `_emit_summary_state` 만 branch/base 를 다뤄 다르며, **`_reconcile_state_with_disk` 는
   아예 없다.** (`_apply_status_update` 를 "다르다" 고 적었던 첫 서술은 틀렸다 — AST 차이가
   이름 접두뿐인데 정규화를 안 하고 발산으로 읽었다.) 즉 Agent tool 로 직접 fan-out 한 세션이 prepare 시점 스냅샷에 멈춘 채
   SUMMARY 는 실제 성공을 보고하는, 다른 두 orchestrator 가 이미 고친 모순을 그대로 겪는다.
   다른 skill 의 동작 변경이라 별도 PR 로 분리한다.
10. **`_retry_state.json` 의 lost update — 잠금이 없다** — `apply_status_update` 는
   read-modify-write 인데 파일 잠금이 없다. `save_state` 를 원자적으로 만든 것은 *찢어진 읽기*
   만 닫는다. 수렴이 있는 필드는 `agents_success` **하나뿐**이다(디스크의 리포트 파일에서 매번
   재도출). `agents_fatal` 은 이미 메모리에 있던 값을 필터링할 뿐이라 **한 번 유실되면 어떤
   reconcile 로도 복구 불가** — `/loop` 가 영구 실패로 판정된 checker 를 다시 돌린다.
   `agent_history` · `rate_limit_episodes` · `last_reset_hint_sec` 도 마찬가지.
   `fcntl.flock` 은 모든 훅 경로에 블로킹 프리미티브를 놓는 것이라 채택 안 했고, 대안은
   `<name>.fatal` sentinel 파일로 `agents_fatal` 도 디스크에서 재도출하는 것 — 새 설계라 분리.
   (docstring 은 이번에 정정했다. 종전 서술이 "버킷들은 디스크에서 재도출된다" 로 읽혀
   보장 범위를 과대하게 주장하고 있었다.)
11. **`--branch` 가 `--files` 를 조용히 덮어쓴다 — 부분 종결, 잔여 있음.**
    경고 출력(침묵 해소)은 8R 에 구현됐다. **남은 것은 구조적 차단과 동반 2건**이라
    여기 유지한다 — 아래 원문의 마지막 세 bullet 이 그것이다.

       무력화할 수 있는 결함이라 우선순위 높음. 재현 실험:

       | 명령 | `meta.json` files |
       |---|---|
       | `--prepare --files A B` | 2 (준 그대로) |
       | `--prepare --branch origin/main --files A B` | **44 (전부 `review/**`, 내 목록 폐기)** |

       `collect_change_infos` 가 `if/elif` 체인이고 `--branch` 분기가 `--files` 분기보다 앞에 있어,
       `--files` 는 **도달 불가능한 죽은 분기**가 된다. 경고도 없다.
       이 저장소의 표준 절차는 "명시 파일 + `--route=all`" 인데(증분 changeset 이 결함을 구조적으로
       놓치므로), 커밋 후엔 `--branch` 를 함께 줘야 diff base 가 맞는다 — 정확히 그 조합에서 명시
       목록이 통째로 버려진다.
       1R~5R 이 무사했던 건 우연이다: 그때는 리뷰 산출물이 untracked 라 branch diff 가 소스만 담았다.
       5R 산출물을 커밋한 순간 같은 명령이 리뷰 산출물만 담은 changeset 을 만들었고, 14명 전원이
       자기 브랜치가 고친 소스를 **한 줄도 못 본 채** "CRITICAL 0" 을 냈다.

       > **동반 발견 — 호출자(나) 쪽 결함이 더 컸다.** 위 진단은 절반만 맞다. 나는 매 라운드
       > `--files $FILES` 로 호출했는데 **셸이 zsh 라 unquoted `$FILES` 가 단어 분할되지 않는다** —
       > 17개 경로가 한 덩어리 문자열 하나로 전달됐다(`${=FILES}` 나 배열이라야 분할된다).
       > 즉 `--branch` 가 없었더라도 내 명시 목록은 **애초에 전달된 적이 없다**. 실측:
       > `python3 -c ... $V` → 인자 1개 `['a b c']` / `${=V}` → 인자 3개.
       > 결론: 하네스 결함(위)과 호출 결함(이것)이 겹쳐 "명시 파일" 절차가 이 브랜치 전 라운드에서
       > 무효였다. 소스가 리뷰된 것은 `--branch` 의 diff 가 마침 소스뿐이었기 때문이다.
       > **bash 문법을 zsh 에서 쓰는 이 클래스는 재발하기 쉽다** — 파일 목록은 배열로 넘길 것.
       - ~~최소 조치: 두 옵션이 같이 오면 `--files` 우선 + 무시되는 쪽을 stderr 로 경고(현재 침묵).~~
         **구현 완료 (8R)** — 다만 **우선순위는 바꾸지 않았다.** 서술과 실제가 다르므로 정정한다:
         scope 플래그(`--commit`/`--range`/`--branch`)가 계속 이긴다(다른 호출부가 그 의미에
         의존한다). 바뀐 것은 폐기가 **더 이상 침묵하지 않는다**는 것뿐 —
         `!! --files IGNORED (N path(s)) — --<flag> takes precedence …` 를 stderr 로 내고
         무시된 경로를 최대 5개까지 이름으로 찍는다. 회귀 테스트 4개(
         `ScopeFlagDiscardingFilesIsAnnouncedTest`)가 세 플래그 각각과 "경고하면 안 되는" 두 경우를
         고정한다. 구조적 차단(`add_mutually_exclusive_group`)은 아래 동반 항목과 함께 남는다.
       - 동반: `get_directory_files()` 가 `.gitignore` 를 안 보는 raw `os.walk` 이고,
         `collect_change_infos` 의 `elif args.files:` 분기에는 기본 경로에 있는
         `warn_if_committed_work_is_missing` 대칭 안전장치가 없다.
       - 동반: changeset 이 `review/**` 로만 구성되면 그 자체가 오구성 신호 — advisory 경고 대상.

13. ~~**테스트 픽스처가 공유 `.git/config` 를 오염시킬 수 있다**~~ → **처분 완료 (2026-08-07).**
    `_harness.git_in()` / `make_temp_git_repo()` 로 통합하고, **속성 기반 가드**를 붙였다
    (`TempRepoFixturesGoThroughTheSharedHelperTest`) — 메커니즘이 아니라 `-C`(디렉터리
    argv 고정) + `GIT_CEILING_DIRECTORIES`(상향 차단)를 본다. 첫 판은 "`git_in` 을
    쓰는가" 로 짜서 **이미 옳은 10곳을 전부 위반으로** 잡았고, 속성으로 바꾸자 **진짜
    3곳**(`-C` 는 있는데 ceiling 없음)이 나왔다. plan 이 적은 "미경화 4곳" 도 틀렸다 —
    실제는 임시저장소 5곳 + 실저장소 읽기 3곳이었고 후자는 대상이 아니다.
    **잔여**: AST 는 문자열 안의 픽스처를 못 본다(`test_consistency_context_budget.py`
    의 fresh-interpreter 스니펫). 그 사각을 이름 붙인 테스트로 고정해 뒀고, §14 에서
    보일러플레이트를 추출할 때 함께 닫는다.

13. **테스트 픽스처가 공유 `.git/config` 를 오염시킬 수 있다 (2026-08-06 실제 사고)** —
   11R 에서 `actions/checkout` 위상을 재현하려 만든 픽스처의 `git remote add origin` 이
   워크트리 쪽에서 실행돼 `origin` URL 이 임시 경로로 덮였다. 이 저장소는 워크트리 5개가
   **같은 `.git/config` 를 공유**하므로 다른 세션의 `fetch`/`push` 까지 함께 깨졌고,
   오염 시점엔 아무 신호가 없어 다음 `git fetch` 실패로 우연히 발견됐다.
   복구: `origin` 을 정상 URL 로 되돌리고 `git ls-remote` 로 확인. 커밋·작업 손실 없음.
   이 브랜치가 손댄 3개 픽스처는 즉시 경화했다 — 임시 트리 밖이면 단언으로 죽고,
   `git -C` 로 cwd 를 명시하며, `GIT_CEILING_DIRECTORIES` 로 상위 탐색을 막는다.
   - **잔여 (12R 재집계): pre-existing 4곳.** 최초 조사는 4곳이라 했는데 12R 리뷰어가
     **내가 편집한 파일 안에도 3곳이 남아 있음**을 짚었다 — 그 3곳은 이번에 닫았고, 실제
     잔여는 아래 4곳이다(전부 이 티켓 밖): — `test_consistency_bundle_priority.py`
     `test_consistency_impl_done.py` · `test_line_anchors.py` ·
     `test_push_guard_worktree_scope.py` (전부 `-C`/ceiling 없이 `init`/`config` 호출).
     이 티켓 범위 밖이라 등재만 한다. 근본 처방은 `_harness.py` 에 공용
     `make_temp_git_repo()` 를 두고 이 가드를 그 안에 한 번만 넣는 것이다.
14. ~~**fresh-interpreter 테스트 보일러플레이트가 4개 파일에 복제**~~ → **처분 완료 (2026-08-07).**
    `_harness.orchestrator_preamble()` + `run_in_orchestrator()` 로 추출. tests/ 순 -123줄.
    **전제가 절반만 맞았다**: runner 본문은 4개 중 3개가 byte-identical(나머지 하나도 주석만
    다름)이었지만, preamble 은 유사도 **44~70%** 로 각자 고유 픽스처를 얹고 있었다. 그래서
    **코어만** 옮기고 파일별 픽스처는 `extra=` 로 그 파일에 남겼다 — 전부 옮겼다면 존재한 적
    없는 공통을 발명하는 셈이다.
    작업 중 추출을 두 번 틀렸다: (a) 고유부를 "emit 뒤 ~ ARG 앞" 으로 떠서 `emit` **앞**에
    있던 `ArgsFor` 클래스를 통째로 잃었고, (b) 필터의 `spec =` 이 `spec = plan = impl_done =
    diff_base = None` 을 함께 잘라 클래스 속성이 사라졌다. 둘 다 테스트가 즉시 잡았다.
    **부수 효과 — §13 의 잔여 사각이 닫혔다**: 공유 preamble 이 `_harness` 를 서브프로세스
    경로에 실어 보내므로 스니펫도 `git_in` 을 쓴다. 문자열 안 raw git 은 AST 가드가 못 보므로,
    닫힌 상태를 텍스트 검사(`test_the_former_ast_blind_spot_stays_closed`)로 고정했다 —
    그 가드가 처음엔 **자기 docstring 과 자기 탐지 코드**를 위반으로 잡아 주석·docstring 을
    제외하도록 정정했다.

14. **fresh-interpreter 테스트 보일러플레이트가 4개 파일에 복제** — `_lib` 네임스페이스 충돌을
   피하는 `run_in_orchestrator` + `_PREAMBLE` (~35줄)이 `test_consistency_context_budget` ·
   `test_consistency_bundle_priority` · `test_prompt_omission_notice` ·
   `test_review_changeset_warning` 에 각각 있다. `_harness.py` 로 추출하면 한 곳만 고치면 된다
   (이번에 timeout 을 3곳에 각각 넣어야 했던 것이 그 비용의 실례).
15. ~~**`git_probe._default_branch` 의 Method 1 성공 경로가 실 저장소로 구동된 적이 없다**~~
    → **처분 완료 (2026-08-07).** `DefaultBranchResolutionOrderTest` 6케이스.
    **평범한 clone 으로는 Method 1 을 분리할 수 없다** — `origin/HEAD` 와 `origin/main`
    이 둘 다 있어 결과가 'main' 이어도 누가 답했는지 모른다. 기본 브랜치를 `trunk` 로
    두면 폴백(main/master만 조회)이 답할 수 없어 갈린다.
    작업 중 **내 테스트 하나가 vacuous** 했다: `update-ref -d` 는 rc 0 을 내면서 symref 를
    지우지 않아(실측) Method 1 이 살아 있었고, 우연히 기대값과 같아 통과했다.
    `symbolic-ref --delete` + 전제 단언으로 정정. 뮤테이션 2/2 RED.

15. **`git_probe._default_branch` 의 Method 1 성공 경로가 실 저장소로 구동된 적이 없다** (12R
   W3) — 유일한 실 저장소 픽스처(`ActionsCheckoutTopologyTest`)가 **정의상 그 ref 가 없는**
   위상이라, `refs/remotes/origin/HEAD` 가 **있을** 때의 동작은 stub 으로만 고정돼 있다.
   11R 이 닫은 결함이 바로 "이 함수가 위상에 따라 다르게 행동한다" 였는데, 두 위상 중
   하나만 실물로 본다. `git clone` 픽스처가 필요해 별도 범위 — §8 과 같은 클래스이되
   다른 함수다(§8 은 `code_review_orchestrator._default_branch_ref()`).
16. ~~**`_run_git` 의 타임아웃 경로가 미검증**~~ → **처분 완료 (2026-08-07).**
    `RunGitTimeoutIsSwallowedTest` — PATH 앞에 30초 자는 가짜 `git` 을 두고 상한 0.3초로
    구동한다. `(1, "", "")` 반환을 단언하고, **정말 매달렸는지**를 경과시간으로 따로
    확인한다(즉시 끝나면 다른 이유로 통과하므로). 뮤테이션(TimeoutExpired 를 catch 에서
    제거) 2/2 RED.

16. **`_run_git` 의 타임아웃 경로가 미검증** (12R W4) — `subprocess.TimeoutExpired` 를
   삼키고 실패로 취급하는 분기가 어떤 테스트도 통과하지 않는다. 11R 이 드러냈듯 이 경로는
   가설이 아니라 **CI 에서 매번 실제로 밟히던 경로**였다(네트워크 프로브 2.58초 → 상한).
   지금은 그 호출을 최후로 밀어 평시엔 안 밟지만, 삼키는 방향이 fail-open 이라 고정이 필요하다.

**신규 후속 (defer)** — "origin 기본 브랜치 해석" 이 4곳에 독립 구현돼 있다:
`branch_guard._origin_default_branch()`(정본) · `review_guard._default_branch()` ·
`code_review_orchestrator._default_branch_ref()`(이번 신설) ·
`consistency_orchestrator` 의 `args.diff_base or "origin/main"` 리터럴. 반환 계약이 서로
달라(로컬 `main` vs `origin/main`) 단순 통합은 불가하고, 실제 코드 공유엔 **hooks/skills 의
`_lib` 네임스페이스 충돌 해소가 선행**이라 별도 범위로 남긴다. 기본 브랜치 정책이 바뀌면
4곳을 모두 고쳐야 하는 drift 위험이 현재 상태다.

## 원 plan 에서 함께 넘어온 미해결 조사 1건

- [ ] **동일 커밋의 형제 파일이 부분만 뽑히는 원인 확인** — code-review changeset 산정에서
      같은 커밋에 든 형제 파일이 일부만 리뷰 대상으로 잡히는 현상. 원 plan §관측(1) 의
      꼬리다. 그 절의 교훈을 함께 옮긴다: **"우회(파일 명시 + `--route=all`)가 통했다" 는
      사실이 원인 진단을 보증하지 않는다** — 우회가 통한 이유는 `--branch` 가 고장나서가
      아니라 기본 경로가 커밋된 작업을 안 담아서였고, 두 설명 모두 같은 우회로 해결되므로
      관측만으로는 갈리지 않는다. 코드를 읽고 실측해야 갈린다.
