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

## 현재 상태 (2026-08-07 갱신)

원 번호 14건 중 **12건 종결 + 1건 철회(§5)**. `in-progress/` 에 남는 이유는 아래 셋이다:

- **§11 잔여** — 침묵 해소는 8R 에 끝났으나 구조적 차단(`add_mutually_exclusive_group`)과
  동반 2건이 남는다.
- **"origin 기본 브랜치 해석 4곳"** (아래 defer 절) — 착수 전제를 이번에 정정했다.
- **미해결 조사 1건** (문서 끝) — 형제 파일 부분 추출 원인.

이번 턴(§6·§9·§10)에서 **전제가 한 건 반증됐다** — §6 의 "`_lib` 네임스페이스 충돌 해소가
선행" 은 사실이 아니었다(`.claude/_shared/` 가 이미 그 회피책이고 훅·orchestrator 양쪽이
쓰고 있다). 반증 근거는 §6 항목 본문과 defer 절의 정정 인용구에 남겼다.

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
3. ~~**`build_files_section` 이 예산 전략 3개를 한 함수에 누적**~~ → **처분 완료 (2026-08-07).**
   착수 시점 실측은 201줄이었는데, §1·§4 를 고치며 **253줄·7 return** 까지 커졌다 — 분리
   근거가 오히려 강해졌다.
   `_render_unbounded`(16) · `_render_diff_only_overflow`(98) · `_allocate_content_budget`(96)
   으로 나누고 `build_files_section` 은 **71줄 디스패처**로 남겼다. 순수 이동이며 883 tests
   가 전후로 동일하게 통과한다.
   분리 근거를 각 docstring 에 적었다: 셋 다 "안내문 길이도 예산에 포함" 이라는 **같은
   불변식**을 지켜야 하는데 한 함수에 섞여 있을 때 각자 손으로 재구현했고, 3R CRITICAL 이
   정확히 그 구조에서 재발했다(한 경로를 고쳤는데 다른 규모에서 같은 클래스가 다시 나옴).
   이번 §1 에서도 같은 일이 반복됐다 — 계상 누락을 고치다 새 안내문의 계상을 또 빠뜨렸다.

3. **`build_files_section` 이 예산 전략 3개를 한 함수(약 190줄)에 누적** — 무예산 /
   header+diff 초과 / 콘텐츠 할당 세 경로가 "안내문 길이도 예산에 포함" 이라는 같은 불변식을
   각자 손으로 재구현한다. 3R CRITICAL 이 정확히 이 구조에서 재발했다(한 경로를 고쳤는데
   다른 규모에서 같은 클래스가 다시 나옴). `_render_unbounded` /
   `_render_diff_only_overflow` / `_allocate_content_budget` 로 분리하고 예산 계상을 단일
   헬퍼로 공유시킬 것.
4. ~~**파일 수가 아주 많으면 헤더만으로 상한 초과**~~ → **처분 완료 (2026-08-07).**
   원인은 계상이 아니라 **수단 부재**였다 — 어느 분기에도 파일 섹션 자체를 버리는 기능이
   없어 헤더+구분자만으로 상한을 넘으면 구조적으로 준수 불가였다(n=3000 실측: 157,887자
   vs cap 141,557). diff 를 전부 버려도 줄지 않는다.
   처분: diff 축소 후에도 넘으면 **파일 단위로 버린다**. 다만 조용히 버리면 리뷰어는 그
   파일이 변경되지 않았다고 읽으므로, **버린 개수/전체를 숫자로 말하는** 안내를 붙이고
   그 안내분도 사전 예약한다(§1 에서 배운 것). 예약분만으로 넘는 극단에서도 최소 1개
   섹션은 남겨 "무엇을 보는 요청인지" 를 지킨다.
   실측: cap 500~141,557 × 파일 12~3,000 **25개 조합 전부 초과 0건**.
   §1 테스트의 `skipTest("§4 구조적")` 예외를 **걷어냈다** — 남겨 두면 §4 가 되돌아가도
   조용히 통과한다. 뮤테이션(드롭 제거) 2건 RED.

4. **파일 수가 아주 많으면 헤더만으로 상한 초과** — n=3000 실측: 헤더+구분자만 157,887자
   vs cap 141,557. 어느 분기도 **파일 섹션 자체를 버리는** 기능이 없어 구조적으로 준수 불가다
   (origin/main 도 동일 — 이번 변경이 만든 것도 악화시킨 것도 아니다). 실제 리뷰 규모에서는
   발생하지 않으므로 P3. 닫으려면 "N개 파일은 목록만" 같은 파일-단위 드롭이 필요하다.
5. **`evaluate_review` 의 boolean flag 구조** — **시도했다가 철회 (2026-08-07). 재개하려면
   아래 실측부터 반박할 것.**
   `evaluate_review_for_push()` / `_for_stop()` 래퍼를 만들고 두 훅을 그쪽으로 돌렸더니,
   **훅의 import 표면이 넓어져 게이트가 더 깨지기 쉬워졌다**. 훅은 `review_guard` 에서
   심볼을 import 하는데, 구버전·부분 모듈이면 `ImportError` 가 나고 그 실패 경로는
   **fail-open** 이다. 실측: `test_review_gate_present_but_none_is_accurate_too` 가
   `ImportError: cannot import name 'evaluate_review_for_stop'` 와 함께 리뷰 게이트
   fail-open 을 보고했다. 가드를 명확하게 만들려다 **가드가 안 도는 경로**를 늘린 셈이다.
   부수 비용도 있었다 — 훅이 소비하는 stub 5곳(4개 파일)을 전부 갱신해야 했다.
   그리고 이 항목이 막으려는 성질은 **이미 행위로 고정돼 있다**:
   `test_push_never_opts_into_the_in_flight_concession` 이 seam 으로 `in_flight_ok` 값을
   기록해, push 가 양보를 켜면 RED 를 낸다.
   재개한다면 import 표면을 넓히지 않는 형태여야 한다 — 예컨대 라이브러리 쪽에서
   `in_flight_ok` 를 **호출부 식별자로 요구**(키워드 필수화)해 기본값 자체를 없애는 쪽.

5. **`evaluate_review` 의 boolean flag 구조** — push(hard block)/stop(soft nudge) 두 보증
   수준을 `in_flight_ok` 하나로 스위칭한다. 현재는 fail-safe 기본값 + 양방향 seam 테스트로
   봉쇄돼 있으나, 세 번째 호출부가 생기면 다시 기본값에 의존한다.
   `evaluate_review_for_push()` / `_for_stop()` 얇은 wrapper 로 시그니처 레벨 차단 검토.
6. ~~**git 브랜치-diff 헬퍼가 두 orchestrator 에 중복**~~ → **처분 완료 (2026-08-07).**
   **선행 조건 전제가 반증됐다.** 이 항목은 "실제 코드 공유엔 `hooks/_lib` 와 `skills/_lib`
   의 네임스페이스 충돌 해소가 선행" 이라 적혀 있었으나, `.claude/_shared/` 가 **이미 그
   회피책**이다 — 최상위 이름이 달라 충돌 자체가 없고, `hooks/_lib/{review,plan,branch}_guard.py`
   와 세 orchestrator 가 모두 `from _shared import ...` 를 하고 있다(실측). 즉 선행 조건은
   애초에 없었고, `_shared/git_probe.py` 는 정확히 같은 종류의 통합을 훅 쪽에서 이미 했다.
   **그리고 이 쌍은 이미 갈라져 있었다** — 픽스처 1개로 실측(변경 전):
   `" lead.ts"` → code-review 사본은 `"lead.ts"`(자기 `.strip()` 이 선행 공백을 먹음, 7R 이
   `git_probe._run_git` 에서 고친 그 결함의 **세 번째 자리**), consistency 사본은 정상.
   비-ASCII 파일명은 **양쪽 다** C-quote(`core.quotePath=false` 를 아무도 안 켬 — `_shared`
   의 `_run_git` 은 이미 켠다). 같은 실패에 상한이 10초/30초로 서로 달랐고, 양쪽 다 실패가
   **빈 changeset** 이라 downstream 은 "변경 없음" 으로 읽는다.
   처분: `_shared/git_probe.branch_diff_files` 하나로 통합하고 둘 다 위임. `_run_git` 의
   `rstrip` 은 스칼라 프로브에는 맞지만 **경로 목록**에는 마지막 경로를 개명하므로
   `_run_git_raw` 를 분리했다(스칼라 계약은 무변경). consistency 의 `-- .` 는 뺐다 — 자기
   docstring 이 "whole-repo on purpose" 라고 적고 있었고 `root == os.getcwd()` 일 때만
   참이었다. 실패 로깅은 `on_error` 콜백으로 각자 `debug_log` 를 유지.
   오늘 이 저장소엔 두 병리 형태가 **0건**(18,748 tracked 중 비-ASCII·선/후행 공백·따옴표·
   백슬래시 전부 0)이라 둘 다 잠재 결함이었다. 그래도 고정한 이유: **두 구현을 갈라놓는
   유일한 수단이 픽스처**이고, "둘이 일치한다" 가 'change both' 주석이 사람에게 맡기던
   바로 그 속성이다.
   테스트는 두 orchestrator 의 **각자 진입점**을 같은 실 저장소에 물려 일치를 단언한다.
   뮤테이션 6/6 RED — 다만 **첫 판의 후행-공백 테스트가 vacuous 했다**: 픽스처 이름을
   `"trail .ts"` 로 지어 공백이 가운데 있었고 `rstrip` 이 건드리지 않아 깨진 구현에서도
   초록이었다. 뮤테이션이 잡았고, 픽스처가 자기 전제(마지막 줄이 후행 공백으로 끝나는가)를
   스스로 단언하도록 고쳤다.
   **리뷰가 진짜 회귀를 하나 잡았다 (requirement, MEDIUM).** 통합 전 두 사본은 git 호출을
   **넓은 `except Exception`** 으로 감쌌는데, `_run_git_raw` 는 `(TimeoutExpired,
   FileNotFoundError, OSError)` 만 잡는다. `subprocess.run(text=True)` 는 strict UTF-8 로
   디코드하므로 왕복 불가 바이트에서 `UnicodeDecodeError` 를 던지는데 그건 `ValueError`
   지 `OSError` 가 아니다 — 그대로 뚫고 나가 orchestrator 가 **크래시**한다. 세 곳
   docstring 이 전부 "실패 시 빈 값" 을 약속하는데 실패 양상이 "빈 changeset" 에서
   "크래시" 로 바뀐 것이다. 그리고 **내가 켠 `core.quotePath=false` 가 이걸 도달 가능하게
   만들었다** — 비-ASCII 바이트를 C-quote 하지 않게 하는 바로 그 플래그다.
   실측: 가짜 `git` 이 `printf "bad\344name.ts"` 를 내면 raise. 처방은 `errors=
   "surrogateescape"`(바이트가 살아남아 파일시스템에 되돌릴 수 있다 — `replace` 는 경로를
   망친다) + `except` 를 원래 계약대로 되돌림. 뮤테이션 3/3 RED.
   **잔여**: 같은 뿌리로 묶여 있던 "origin 기본 브랜치 해석 4곳"(아래 절)은 **그대로 남는다.**
   선행 조건이 사라졌으므로 그쪽의 남은 장벽은 네임스페이스가 아니라 **반환 계약 불일치**
   (로컬 `main` vs `origin/main`) 하나뿐이다 — 아래 절의 서술을 그에 맞게 정정했다.

6. **git 브랜치-diff 헬퍼가 두 orchestrator 에 중복** — `_branch_changed_rels`(consistency)
   와 `get_git_branch_diff_files`(code-review)가 같은 git 연산이다. 상호참조 주석은 넣었지만
   구조적 중복은 남는다. 위 "기본 브랜치 해석 4곳" 과 같은 뿌리(= `_lib` 충돌 해소 선행).
   *(↑ 마지막 괄호는 **반증됨** — 위 처분 요약 참고. 아래 defer 절의 정정 인용구와 같은 처리.)*
7. ~~**`_rank_plan_text` 이중 read**~~ → **처분 완료 (2026-08-07).**
   호출부를 고치는 대신 `read_text_file` 이 한 실행 안에서 같은 경로를 한 번만 읽도록
   했다 — 호출부가 6곳이라 **다른 이중 읽기까지 함께** 닫힌다.
   캐시가 안전한 근거: 이 orchestrator 는 세션을 준비하고 끝나는 단명 CLI 다. 한 실행
   안에서 같은 경로의 내용이 달라지면 번들과 랭킹이 **서로 다른 문서**를 보게 되므로,
   오히려 첫 읽기를 유지하는 편이 진단 가능하다. 테스트는 `_READ_CACHE.clear()` 로 격리한다.
   테스트는 **호출 횟수**로 잰다 — 이 규모(30개 430,929 bytes ≈ 3.5ms)에서 "빨라졌다" 는
   측정 잡음에 묻혀 캐시가 통째로 빠져도 초록일 수 있다. `open` 을 세면 그 축이 사라진다.
   뮤테이션(캐시 제거) → 신규 2건 + 기존 2건 RED.

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
9. ~~**`merge_coordinator_orchestrator.py` 에 `reconcile_state_with_disk` 자기치유가 없다**~~
   → **처분 완료 (2026-08-07).** 전제 재판정: AST(주석·docstring 제외) 실측 **코드 0회 /
   주석 1회** — 전제 성립. 자매 둘은 `--summary-state` 와 `--resume` 양쪽에서 재조정한다.
   처분: `_emit_summary_state` 를 shared `emit_summary_state` 로 위임하고 이 파일 고유의
   `branches=`/`base=` 는 `extra_fields` 로 보존(필드 **순서까지** 동일). `--resume` 에도
   자매와 같은 재조정을 넣었다.
   **기존 픽스처 하나가 이 결함을 가리고 있었다** — 디스크에 리포트 없이 `agents_success`
   를 주장하고도 통과했다(재조정이 없었으니까). 계약이 제거하려는 바로 그 가짜 성공이라
   픽스처를 정직하게 고치고, 단언을 필드별 `assertIn` 에서 **전체 라인 비교**로 바꿨다 —
   순서도 CLI 계약인데 `assertIn` 은 재배열을 못 본다.
   뮤테이션 2/2 RED(`--summary-state` 재조정 제거 → 3건, `--resume` 재조정 제거 → 1건).

9. **`merge_coordinator_orchestrator.py` 에 `reconcile_state_with_disk` 자기치유가 없다** —
   상태 helper 를 `_shared/` 로 옮기며 확인: 이 파일은 세 번째 사본인데 `_load_state`/
   `_save_state`/`_apply_status_update` 가 다른 둘과 동일하고(전부 위임 완료),
   `_emit_summary_state` 만 branch/base 를 다뤄 다르며, **`_reconcile_state_with_disk` 는
   아예 없다.** (`_apply_status_update` 를 "다르다" 고 적었던 첫 서술은 틀렸다 — AST 차이가
   이름 접두뿐인데 정규화를 안 하고 발산으로 읽었다.) 즉 Agent tool 로 직접 fan-out 한 세션이 prepare 시점 스냅샷에 멈춘 채
   SUMMARY 는 실제 성공을 보고하는, 다른 두 orchestrator 가 이미 고친 모순을 그대로 겪는다.
   다른 skill 의 동작 변경이라 별도 PR 로 분리한다.
10. ~~**`_retry_state.json` 의 lost update — 잠금이 없다**~~ → **처분 완료 (2026-08-07).**
    전제 재판정: `retry_state.py` 의 `flock`/`fcntl` 은 AST 실측 **0회**(기각 사유만 주석).
    그리고 **유실 자체를 실측**했다 — 겹친 `--update` 두 건에서 앞 writer 의 전이가 파일에서
    사라졌고, 이어진 reconcile 은 `agents_success` 만 복구했다. `agents_fatal` 은 복구 0.
    처방은 plan 이 적어 둔 그대로 — `fcntl.flock` 은 여전히 기각(모든 훅 경로에 블로킹
    프리미티브)하고, **디스크가 기록하는 범위를 넓힌다**: fatal 전이가 `_fatal/<name>`
    sentinel 을 남기고 reconcile 이 **JSON ∪ sentinel** 로 재도출한다.
    설계 근거 4가지: (a) 에이전트당 파일 1개 — 공유 `_fatal.json` 리스트였다면 그것도
    read-modify-write 라 같은 유실을 물려받는다. (b) `save_state` **앞**에 쓴다(양방향) —
    JSON 쓰기가 유실돼도 sentinel 이 남는다. (c) 매니페스트 **이름** 기준이고 경로 성분이
    아닌 이름은 sentinel 을 아예 안 만든다 — 찾는 곳과 다른 곳에 쓰는 침묵 불일치가 갭보다
    나쁘다. (d) `OSError` 는 삼킨다 — 읽기 전용 FS 는 변경 전 동작으로 degrade 할 뿐 update
    를 실패시키지 않는다. 합집합인 이유는 **이 변경 이전에 커밋된 세션엔 `_fatal/` 이 없어서**
    — sentinel 만 읽으면 그 fatal 들을 전부 조용히 지운다.
    `save_state`·모듈 docstring 이 "복구 불가" 를 계약으로 서술하고 있었으므로 함께 정정
    (방금 고친 결함을 docstring 이 설명하고 있는 상태를 남기지 않는다). README 의 세션
    디렉토리 구조·스키마도 동반 갱신.
    테스트는 **재진입으로 레이스를 결정적으로 재현**한다(스레드·sleep 없이, 실제
    `apply_status_update` 를 그대로 구동) — writer B 를 read 와 write 사이에서 끊고 그 창
    안에서 writer A 를 완주시킨 뒤 B 의 낡은 사본을 착지시킨다. sentinel 을 지운 **대조군**이
    무엇이 일을 하는지 고정한다. 뮤테이션 6/6 RED.
    **잔여 1 (의도적 미조치)**: `agent_history` · `rate_limit_episodes` · `last_reset_hint_sec`
    는 여전히 수렴하지 않는다. 게이트도 `/loop` 도 이 값들로 분기하지 않는 bookkeeping 이라
    수용했고, 그 범위를 `save_state` docstring 에 명시했다.
    **잔여 2 — 해제 방향은 안 닫혔다 (리뷰가 잡음, concurrency·architecture·side_effect 3명 수렴).**
    sentinel 은 "fatal 이 됐다" 의 **양성 증거**다. 반대로 "더 이상 fatal 아님" 은 sentinel 의
    **부재**뿐인데, 재도출이 합집합이라(변경 전 커밋된 세션엔 `_fatal/` 이 없으므로 필수)
    부재는 증거가 되지 못한다. 그래서 해제 전이의 JSON 쓰기가 유실되면 stale JSON 이 그
    이름을 되살린다. **회귀는 아니다** — JSON-only 판도 같은 stale 상태를 읽어 동일하게
    행동했다. 다만 내 최초 docstring 이 "양방향 복구 가능" 으로 **실제보다 넓게 주장**하고
    있었다(그 주장부터 정정했다).
    처방은 해제의 양성 증거가 필요하다 — `_cleared/` 마커나 sentinel mtime 대 상태파일 비교.
    패치가 아니라 설계라 분리하고, 지금 상태를 캐너리
    (`test_clearing_fatal_is_still_unprotected_against_a_lost_update`)로 고정했다. 닫는 날
    이 테스트가 뒤집혀 스스로 알린다(뮤테이션으로 확인).
    **잔여 3**: 성공으로 수렴한 에이전트의 sentinel 이 `--update` 를 안 거친 경로에서는 남는다
    (판정은 정확 — success 가 이긴다. 위생 문제). 세션 아카이빙이 리포트만 지우고 `_fatal/` 을
    남기는 형태로 구현되면 이 잔여가 실제 버그로 표면화되므로, 그 작업 착수 시 함께 정리할 것.
    **잔여 4 — 같은 agent 에 대한 겹친 `--update` (2R concurrency 가 발견, 실측 재현).**
    `_record_fatal` 은 자기 `status` 만 보고 무조건 해제하므로, 한 update 가 `x` 를 fatal 로
    확립한 직후 `x` 에 대한 다른 update 가 `load_state` 와 `_record_fatal` 사이에 있었다면
    sentinel 을 지우고 fatal 이전 스냅샷을 저장한다 — 양쪽 기록에서 사라져 복구 불가.
    **잔여 2 와 방향이 다르다**(저긴 해제 유실로 fatal 이 잘못 유지, 여긴 확립된 fatal 이 소멸).
    회귀 아님(JSON-only 판도 동일하게 잃었다)이고, 문서화된 흐름은 에이전트당 update 1건이라
    발생하지 않는다 — 중복 재시도나 수동 재실행이 `/loop` 와 경합할 때만.
    호출자 계약으로 docstring 에 못박고 캐너리로 고정했다. **잔여 2 와 같은 설계 축**(sentinel
    mtime 대 상태파일 비교)이 둘을 함께 닫는다.
    > **실측 주의 — 인터리빙 지점을 틀리면 재현되지 않는다.** 첫 프로브는 `save_state` 에서
    > 끊어 아무것도 재현하지 못했고(오히려 sentinel 이 살아남아 복구됐다), 하마터면 리뷰어
    > 지적을 오탐으로 기각할 뻔했다. 창은 `load_state` 와 `_record_fatal` **사이**다.

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
달라(로컬 `main` vs `origin/main`) 단순 통합은 불가하다. 기본 브랜치 정책이 바뀌면
4곳을 모두 고쳐야 하는 drift 위험이 현재 상태다.

> **정정 (2026-08-07, §6 처분 중).** 이 항목은 "실제 코드 공유엔 hooks/skills 의 `_lib`
> 네임스페이스 충돌 해소가 선행" 이라고 적고 있었다 — **틀렸다.** `.claude/_shared/` 가
> 이미 그 회피책이고(최상위 이름이 달라 충돌 없음), 훅 3개와 orchestrator 3개가 모두
> 거기서 import 한다. `branch_guard._origin_default_branch` 는 **이미** `_shared/git_probe.py`
> 로 옮겨져 있다. 남은 장벽은 네임스페이스가 아니라 **반환 계약 불일치 하나뿐**이므로,
> 착수 비용을 그 전제로 다시 산정할 것.

## 원 plan 에서 함께 넘어온 미해결 조사 1건

- [ ] **동일 커밋의 형제 파일이 부분만 뽑히는 원인 확인** — code-review changeset 산정에서
      같은 커밋에 든 형제 파일이 일부만 리뷰 대상으로 잡히는 현상. 원 plan §관측(1) 의
      꼬리다. 그 절의 교훈을 함께 옮긴다: **"우회(파일 명시 + `--route=all`)가 통했다" 는
      사실이 원인 진단을 보증하지 않는다** — 우회가 통한 이유는 `--branch` 가 고장나서가
      아니라 기본 경로가 커밋된 작업을 안 담아서였고, 두 설명 모두 같은 우회로 해결되므로
      관측만으로는 갈리지 않는다. 코드를 읽고 실측해야 갈린다.

      **2026-08-09 — 재현 조건과 증상을 실측했다. 원인 후보가 좁혀졌다: 배치 분할.**
      `backend-lint-gate` PR(74파일)에서 `--prepare` 가 changeset 을 **여러 배치로
      나누는데, 배치들이 같은 타임스탬프 세션 디렉터리를 공유해 뒤 배치가 앞 배치를
      덮는 것으로 보인다.** 실측:

      - `xargs … --prepare --route=all` 에 **74개 경로**를 넘김 (`xargs` 가 74개를
        한 번에 넘기는 것은 `xargs sh -c 'echo $#'` 로 확인 — 분할 아님)
      - stderr: `--- Batch 1/2 (50 files) ---` / `--- Batch 2/2 (24 files) ---`
      - stdout: **같은 세션 경로를 2번** 출력
      - 그 실행으로 새로 생긴 세션 디렉터리는 **1개**이고 `meta.json` files = **24**
      - 그 세션 프롬프트에 배치 1 파일(`shadow-workflow.ts` 등)은 **0회**, 배치 2 파일
        (`makeshop-mcp-tool-provider.ts`)은 등장
      - 예산을 `REVIEW_MAX_PROMPT_SIZE=600000` 으로 올려도 **files 는 24 그대로**
        (프롬프트만 154KB → 564KB) → **예산 절단이 아니라 배치 분할이 원인**

      ⇒ 겉보기 증상이 정확히 "형제 파일이 부분만 뽑힌다" 다. 게다가 이 경로에는
      §4 가 만든 `_files_dropped_note`("N/M 파일 섹션이 통째로 빠졌습니다")가 **붙지
      않는다**(프롬프트 grep 0건) — 그 안내는 *한 세션 안의* 예산 절단용이라, 배치
      분할로 사라진 파일은 커버하지 않는다.

      **우회(검증됨)**: 파일 목록을 배치 상한 아래로 직접 쪼개 `--prepare` 를 각각
      호출하면 세션이 따로 생긴다 (40 + 34 → `meta.json` 40 / 34, 합 74).

      **남은 확인**: 배치 로직이 (a) 세션을 하나만 만들도록 설계된 것인지 (b) 만들려다
      타임스탬프 충돌로 덮는 것인지 코드로 갈라야 한다. 위 증거는 증상까지만 고정한다.
      전자면 "배치 = 순차 리뷰" 계약이 문서화돼야 하고, 후자면 세션 이름에 배치 인덱스를
      넣는 것이 처방이다.

      > **이번에도 "우회가 통했다" 가 진단을 보증하지 않는다** — 위 우회는 (a)/(b)
      > 어느 쪽이어도 통한다. 그래서 원인 확정을 미해결로 남긴다.
