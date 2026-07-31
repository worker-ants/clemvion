---
title: 리뷰 게이트의 훅-독립 CI 백스톱 — 정규식이 유일 판정자인 사각지대를 닫을지
worktree: harness-review-gate-fixes-1bd6aa
started: 2026-07-25
owner: developer
priority: P2
---

> **2026-07-31 진행** — 아래 §관측 2건을 처리했다. 한 건은 **전제가 반증**됐고 그 자리에 다른
> 진짜 결함이 있었다. 본 티켓의 **주제(CI 백스톱)는 여전히 미착수**이며 설계 결정이 선행이다.
>
> | 항목 | 결과 |
> |---|---|
> | §관측(1) changeset 증분 산정 | **전제 반증** → 다른 결함으로 대체 수정 (아래) |
> | §관측(2) `SUMMARY pending` push 허용 | **수정 완료** (아래) |
> | §재발 관측 8번째 (번들 누락) | **수정 완료** — `harness-consistency-summary-downgrade-rule.md` 쪽에 기록 |
> | CI 백스톱 본체 | **미착수** — §결정이 필요한 지점 그대로 |
>
> **작업 중 발견된 신규 결함 1건 (수정 완료)** — `code_review_orchestrator.build_files_section`
> 이 프롬프트 예산 초과 파일을 **아무 표시 없이** 통째로 누락시켰다. 내용을 작은 파일부터
> 담고 안 들어가는 첫 파일에서 `break` 하므로, 그 뒤 더 큰 파일들은 헤더만 남는다(명시 파일
> 리뷰에는 diff 도 없어 메타데이터 2줄이 전부). **이 PR 의 리뷰 세션에서 실제로 발현** —
> `review_guard.py`·`code_review_orchestrator.py` 가 14개 프롬프트 전원에서 31바이트 섹션으로
> 나왔고 그 둘이 이 PR 의 핵심 파일이었다. 즉 §재발 관측이 consistency 쪽에서 8회 기록한
> 결함 클래스의 **code-review 쪽 쌍둥이**다. 생략 사실 + 읽을 경로를 명시하도록 수정.
>
> **신규 후속 (defer) — 아래 7건 + 기본 브랜치 해석 중복 1건**
>
> 1. **`build_files_section` 의 diff-only 예산 분기가 상한을 넘는다 (기존 결함)** —
>    headers+diffs 만으로 예산을 넘는 분기에서, 절단 루프가 `_truncated_note` 와
>    `"diff 생략"` placeholder 를 덧붙이면서 그 길이를 `cut` 에 계상하지 않는다. 실측:
>    같은 fixture 로 `origin/main` 판 **1,681자 vs cap 1,500** (이 브랜치 판은 1,678 —
>    이번에 추가한 안내는 `overflow` 에 계상했기에 오히려 3바이트 작다). 즉 **내가 만든 결함이
>    아니고 악화시키지도 않았다.** 다른 분기의 같은 계상 누락은 이번에 고쳤으므로, 이 분기도
>    같은 처방(노트 길이를 절단량에 포함)으로 닫으면 된다.
> 2. ~~**하향 금지 정책에 기계적 backstop 이 없다**~~ → **구현 완료 (2026-07-31, `30cc0f738`)**.
>    `.claude/_shared/block_integrity.py` 가 checker 리포트의 `[CRITICAL]` 태그를 세어 SUMMARY 의
>    `BLOCK:` 와 모순되면 경고한다. 착수 전 실측: consistency 세션 732개 중 24건(3.3%)이
>    `BLOCK: NO` 인데 `[CRITICAL]` 을 갖고 있었고, 표본의 SUMMARY 들이 하향을 스스로 서술한다.
>    게이트가 실제 채택하는 세션만 대조하며(전 이력 재경고는 +0.39초에 늘 우는 경고가 된다),
>    경고는 결정 객체의 `notes` 로 올라가 호출자가 자기 exit-code 계약에 맞는 스트림으로 낸다 —
>    ALLOW(exit 0)에서는 stdout 이 모델에 주입되므로 stderr 고정은 아무도 안 읽는 자리였다.
>    원래 항목 서술: — `.claude/agents/consistency-summary.md` 의
>    규약은 prompt 지시일 뿐이고, 게이트(`_BLOCK_LINE`)는 `BLOCK:` 값이 각 checker 의
>    `[CRITICAL]` 개수와 모순되는지 대조하지 않는다. 정확히 그 불변식이 깨진 사례가 이미
>    기록돼 있다(`review/code/2026/07/25/22_58_00`). 후보: orchestrator 가 checker 리포트의
>    `[CRITICAL]` 수를 세어 최종 `BLOCK:` 와 모순되면 stderr 경고 / 반환 플래그.
>    (사용자가 정책 자체는 "하향 금지 + planner 인계" 로 확정했으므로 이건 그 집행 수단이다.)
> 3. **`build_files_section` 이 예산 전략 3개를 한 함수(약 190줄)에 누적** — 무예산 /
>    header+diff 초과 / 콘텐츠 할당 세 경로가 "안내문 길이도 예산에 포함" 이라는 같은 불변식을
>    각자 손으로 재구현한다. 3R CRITICAL 이 정확히 이 구조에서 재발했다(한 경로를 고쳤는데
>    다른 규모에서 같은 클래스가 다시 나옴). `_render_unbounded` /
>    `_render_diff_only_overflow` / `_allocate_content_budget` 로 분리하고 예산 계상을 단일
>    헬퍼로 공유시킬 것.
> 4. **파일 수가 아주 많으면 헤더만으로 상한 초과** — n=3000 실측: 헤더+구분자만 157,887자
>    vs cap 141,557. 어느 분기도 **파일 섹션 자체를 버리는** 기능이 없어 구조적으로 준수 불가다
>    (origin/main 도 동일 — 이번 변경이 만든 것도 악화시킨 것도 아니다). 실제 리뷰 규모에서는
>    발생하지 않으므로 P3. 닫으려면 "N개 파일은 목록만" 같은 파일-단위 드롭이 필요하다.
> 5. **`evaluate_review` 의 boolean flag 구조** — push(hard block)/stop(soft nudge) 두 보증
>    수준을 `in_flight_ok` 하나로 스위칭한다. 현재는 fail-safe 기본값 + 양방향 seam 테스트로
>    봉쇄돼 있으나, 세 번째 호출부가 생기면 다시 기본값에 의존한다.
>    `evaluate_review_for_push()` / `_for_stop()` 얇은 wrapper 로 시그니처 레벨 차단 검토.
> 6. **git 브랜치-diff 헬퍼가 두 orchestrator 에 중복** — `_branch_changed_rels`(consistency)
>    와 `get_git_branch_diff_files`(code-review)가 같은 git 연산이다. 상호참조 주석은 넣었지만
>    구조적 중복은 남는다. 위 "기본 브랜치 해석 4곳" 과 같은 뿌리(= `_lib` 충돌 해소 선행).
> 7. **`_rank_plan_text` 이중 read (이번 PR 이 도입한 I/O 회귀)** — `collect_context` 가
>    랭킹 신호용으로 `plan/in-progress/` 전체를 한 번 읽고, 곧이어 `format_file_bundle` 이
>    같은 디렉터리를 처음부터 다시 읽는다. 세션당 2배 I/O. 실측 규모는 30개 430,929 bytes
>    (≈3.5ms 수준)라 현재는 무해하지만 **내가 만든 회귀**이고, `{path: text}` 맵을 한 번만
>    만들어 랭킹·번들 양쪽에서 재사용하면 닫힌다. 5R 에서 코드를 더 건드리지 않기로 해
>    등재만 한다.
> 8. **`_default_branch_ref()` 의 성공 경로 3갈래가 미검증** — 모든 테스트가 이 함수를 통째로
>    stub 하거나 실패-흡수 경로만 본다. 자매 함수 `_branch_changed_rels` 는 임시 git repo 로
>    성공 경로까지 고정돼 있어 비대칭이다. 같은 패턴으로 4케이스(symbolic-ref 적중 /
>    `origin/main` 만 / `origin/master` 만 / origin 없음) 고정할 것.
> 9. **`merge_coordinator_orchestrator.py` 에 `reconcile_state_with_disk` 자기치유가 없다** —
>    상태 helper 를 `_shared/` 로 옮기며 확인: 이 파일은 세 번째 사본인데 `_load_state`/
>    `_save_state`/`_apply_status_update` 가 다른 둘과 동일하고(전부 위임 완료),
>    `_emit_summary_state` 만 branch/base 를 다뤄 다르며, **`_reconcile_state_with_disk` 는
>    아예 없다.** (`_apply_status_update` 를 "다르다" 고 적었던 첫 서술은 틀렸다 — AST 차이가
>    이름 접두뿐인데 정규화를 안 하고 발산으로 읽었다.) 즉 Agent tool 로 직접 fan-out 한 세션이 prepare 시점 스냅샷에 멈춘 채
>    SUMMARY 는 실제 성공을 보고하는, 다른 두 orchestrator 가 이미 고친 모순을 그대로 겪는다.
>    다른 skill 의 동작 변경이라 별도 PR 로 분리한다.
> 10. **fresh-interpreter 테스트 보일러플레이트가 4개 파일에 복제** — `_lib` 네임스페이스 충돌을
>    피하는 `run_in_orchestrator` + `_PREAMBLE` (~35줄)이 `test_consistency_context_budget` ·
>    `test_consistency_bundle_priority` · `test_prompt_omission_notice` ·
>    `test_review_changeset_warning` 에 각각 있다. `_harness.py` 로 추출하면 한 곳만 고치면 된다
>    (이번에 timeout 을 3곳에 각각 넣어야 했던 것이 그 비용의 실례).
>
> **신규 후속 (defer)** — "origin 기본 브랜치 해석" 이 4곳에 독립 구현돼 있다:
> `branch_guard._origin_default_branch()`(정본) · `review_guard._default_branch()` ·
> `code_review_orchestrator._default_branch_ref()`(이번 신설) ·
> `consistency_orchestrator` 의 `args.diff_base or "origin/main"` 리터럴. 반환 계약이 서로
> 달라(로컬 `main` vs `origin/main`) 단순 통합은 불가하고, 실제 코드 공유엔 **hooks/skills 의
> `_lib` 네임스페이스 충돌 해소가 선행**이라 별도 범위로 남긴다. 기본 브랜치 정책이 바뀌면
> 4곳을 모두 고쳐야 하는 drift 위험이 현재 상태다.

## Overview

[`harness-push-gate-did-not-fire`](../complete/harness-push-gate-did-not-fire.md) §M 에서 분리.
그 티켓은 push 탐지 정규식의 결함(newline separator 누락)을 고쳤다. 이 티켓은 그 근본 수정이
**닫지 못하는** 층을 다룬다.

## 문제 — 사후 탐지가 같은 사각지대를 공유한다

§M 이 고친 결함은 "`_GIT_PUSH` 가 여러 줄 push 를 못 잡아 게이트가 조용히 skip" 이었다.
자연스러운 방어책은 "게이트가 안 돌았음을 사후에 기록/탐지" 인데, **그게 성립하지 않는다**:

- push 가 실제 push 인지 판정하는 게 **바로 그 정규식**이다.
- 정규식이 push 를 놓치면, "게이트를 돌려야 했는데 안 돌았다" 는 사실 자체를 인지할 주체가 없다.
  fail-open 배너조차 `_is_git_push` 가 True 여야 찍힌다("not a push" 는 조기 return).
- 즉 사후 탐지 로직을 훅 안에 두면 **같은 판정자에 의존**해 같은 구멍으로 샌다.

## 후보 — 훅에 의존하지 않는 층

- [ ] **CI 게이트**: PR 에 `codebase/**` diff 가 있는데 그 변경을 커버하는 *해결된* 리뷰
      산출물이 없으면 CI fail. 훅(로컬 PreToolUse)과 **독립**이라 정규식 사각지대를 공유하지 않는다.
      - 리뷰 산출물(`review/code/**`)은 gitignored 라 PR 에 없다 → CI 가 무엇으로 "리뷰됨" 을
        판정할지 설계 필요(커밋 trailer? PR label? 별도 signed marker?).
- [ ] 대안: push 시 게이트 **통과 기록**(상태 파일 타임스탬프)을 남기고, 별도 감사에서
      "codebase 변경 push 인데 기록 없음" 을 탐지. 단 이것도 "codebase 변경 push" 판정에
      정규식이 끼면 부분적으로만 독립.

## 결정이 필요한 지점 (그래서 P2, 사용자/설계 판단)

- CI 가 "리뷰됨" 을 무엇으로 인식하는가 — gitignored 산출물을 CI 에 어떻게 노출하나.
- 로컬 훅과 CI 의 **이중 게이트**가 마찰(느린 CI·false block)을 얼마나 만드나.
- 이 저장소가 이미 `guard_review_before_push` 를 신뢰하는데, 두 번째 층의 비용 대비 이득.

## Rationale

**왜 P2 (즉시 아님).** §M 이 활성 결함(가장 흔한 push 형태 우회)을 이미 닫았다. 이 티켓은
"방어 심화" 이지 활성 구멍이 아니다. 그리고 CI 층은 설계 결정(리뷰됨 판정 메커니즘)이 선행이라
독립 범위다.

**왜 훅 안에서 안 닫나.** 위 §문제 — 자기 판정자에 의존하는 사후 탐지는 사각지대를 공유한다.
이 통찰 자체가 §M 조사의 산물이라 유실되지 않게 티켓으로 고정한다.

## 관측 — 리뷰 게이트를 거짓 통과시킬 수 있는 경로 2건 (2026-07-27, 실측)

`ie-resume-turn-boundary-cancel` PR 진행 중 **둘 다 실제로 발생**했다. 하나는 리뷰 자체를
무의미하게 만들고, 다른 하나는 그 상태로 push 를 허용한다. 위 CI backstop 논의의 직접 근거 사례.

### (1) changeset 산정이 증분이라 직전 fix 가 통째로 리뷰에서 빠진다

5라운드 리뷰의 changeset 이 **`testing.md` 1건**뿐이었다. 그런데 직전 라운드 fix 는
`codebase/backend/src/modules/execution-engine/` 아래 **5개 파일**을 바꿨다(개명 + 헬퍼 추출).
즉 그 코드는 **한 번도 리뷰되지 않은 채** "Critical 0 / LOW" 라는 수렴 신호만 나왔다.

- `--prepare --branch origin/main` 도, `--prepare --range origin/main..HEAD` 도 결과가 같았다
  (둘 다 1건) — **changeset 은 "직전 리뷰 세션 이후 변경분" 증분으로 산정되고 `--branch`/
  `--range` 는 그 산정에 쓰이지 않는 것으로 보인다.**
- 게다가 그 1건조차 동일 원자 커밋(`75967fab3`)에 함께 들어간 16개 형제 파일 중 하나만
  뽑힌 것이었다(리뷰어 scope 도 독립 지적).
- **우회(실측 성공)**: 파일을 positional 인자로 **명시** + `--route=all`
  → changeset 5건, router skip, 전수 14명 실행 확인.

- [x] ~~`--branch`/`--range` 가 changeset 산정에 실제로 반영되도록 수정~~ → **전제 반증**.
      실측하면 완전히 반영된다: raw `git diff --name-only origin/main~5...` 189건 =
      `get_git_branch_diff_files()` 189건 = `collect_change_infos(--branch)` 189건.
      `prepare_session` 도 받은 `change_infos` 를 그대로 쓰고 증분 필터가 없으며,
      `loop_mode` 는 config 에 저장만 되고 어디서도 읽히지 않는다(dead field).
      **진짜 결함은 기본 경로였다** — 인자 없는 `--prepare` 는 staged+unstaged+untracked,
      즉 "아직 커밋 안 된 것" 만 모은다. 리뷰 워크플로는 커밋을 먼저 하므로(push 게이트가
      커밋이 리뷰보다 앞서기를 요구) 그 시점 집합은 비거나 한두 개뿐이고, 리뷰어는 거의 빈
      코퍼스를 받는데 요약은 "Critical 0" 을 낸다. 실측(2026-07-31, 이 브랜치): 기본 **0건**
      vs `--branch origin/main` **6건**. 위 관측의 "1건" 도 이 경로였을 것이다.
      → **[x] 경고 구현**: 기본 경로에서 브랜치 diff 미포함분을 감지해 빠진 파일을 이름으로
      나열하고 `--branch <base>` 를 안내. changeset 자체는 불변(조용히 넓히면 호출자가 요청하지
      않은 파일을 리뷰하게 되고, 명시 모드는 이미 올바르다). git 실패 시 침묵.
      테스트 `test_review_changeset_warning.py` 12건 + mutation 4종 RED (라운드마다 증가 — 정확한 수는 파일이 SoT).

> 교훈: **"우회(파일 명시 + `--route=all`)가 통했다"는 사실이 원인 진단을 보증하지 않는다.**
> 우회가 통한 이유는 `--branch` 가 고장나서가 아니라 기본 경로가 커밋된 작업을 안 담아서였다.
> 두 설명 모두 같은 우회로 해결되므로 관측만으로는 갈리지 않는다 — 코드를 읽고 실측해야 갈린다.
- [ ] 동일 커밋의 형제 파일이 부분만 뽑히는 원인 확인

### (2) `SUMMARY pending` 세션이 push 를 허용한다

리뷰 Workflow 가 끝났지만 main 이 아직 `SUMMARY.md` 를 디스크에 쓰기 전 상태에서
`evaluate_review()` 가 이렇게 답한다:

```text
blocked: False
reason : a code review session is in flight (started, SUMMARY pending) — allowed
```

`SUMMARY.md` 를 기록한 직후 재판정하면 정확히 차단된다
(`8 codebase/ file(s) changed AFTER the most recent resolved review`).
즉 **세션 디렉토리만 만들어 두면 그 사이 push 가 열린다.** 메모리의 "빈 세션 디렉토리가
게이트를 거짓 통과시킴 — `blocked=False` 여도 reason 을 읽어라" 와 같은 클래스이며,
이번엔 정상 워크플로 진행 중에 자연 발생했다.

- [x] ~~in-flight 허용을 **시간 상한**으로 제한~~ → **시간 상한은 이미 있었다**
      (`_IN_FLIGHT_TTL_SECONDS = 1800`, checkout-immune 세션 디렉토리 타임스탬프 기준,
      `meta.json` 파싱 검증까지 포함). "무기한" 이라는 서술은 부정확했다.
- [x] **진짜 결함은 스코프였다 — 수정 완료.** push 가드(`guard_review_before_push.py:846`)와
      stop 가드(`guard_review_before_stop.py:340`)가 **같은 `evaluate_review()`** 를 부르는데,
      in-flight 억제가 그 함수 안에서 **무조건** 적용됐다. 그 억제의 목적은 Stop nudge 전용
      ("모델이 지금 돌리는 중인 리뷰를 두고 턴 종료를 막지 말 것")인데, 같은 함수를 쓰는
      push 까지 TTL(30분) 동안 열어 준 것이다.
      **자기 불변식이 거짓이었다**: `_IN_FLIGHT_TTL_SECONDS` 주석과 `_code_review_in_flight`
      docstring 이 둘 다 "the push guard still hard-gates" 라고 적어 뒀는데, 억제가 무조건인
      동안 그 문장은 참일 수 없었다.
      → `evaluate_review(cwd=None, *, in_flight_ok=False)` 로 opt-in 화하고 Stop 가드만
      `True` 를 넘긴다. push 호출부 무변경. 주석 2곳은 "opt-in 이라서 참" 이라는 근거를 붙여
      정정. 테스트: 양방향 분리 + Stop→evaluate_review seam 이 실제로 kwarg 를 넘기는지 단언
      (seam 단언이 없으면 kwarg 를 떨어뜨려도 결정 객체가 동일해 전부 통과한다). mutation 3종 RED.

> 부수 교훈: `evaluate_review()` 는 `blocked` 만 보지 말고 **`reason` 을 읽어야** 한다.

### 재발 관측 (2026-07-30 `19_00_25`) — 8번째

`--impl-done spec/5-system/` 에서 실제 target(`4-execution-engine.md`·`6-websocket-protocol.md`)이
5개 checker 프롬프트 **전원**에서 누락되고 무관 파일 3개(`1-auth.md`/`10-graph-rag.md`/
`11-mcp-client.md`)만 실렸다. 사전순 정렬 + 예산초과 조합, 같은 패턴 8번째.

완화 확인: 이번엔 checker **5명 전원**이 워크트리 직접 Read + `git diff` 로 우회해 결론 신뢰성에는
영향이 없었다. 다만 7번째 재발(`17_21_27`) 때는 5명 중 1명만 우회했고 **나머지 3명은 그 영역을
전혀 검토하지 못했다** — 우회는 checker 별로 불균등하므로 완화책으로 신뢰할 수 없다.
