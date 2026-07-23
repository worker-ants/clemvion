# 요구사항(Requirement) 리뷰 — review/code/2026/07/24/00_34_09/** 산출물 커밋 (round 01_02_21)

## 검증 방법

프롬프트가 준 12개 파일은 전부 `review/code/2026/07/24/00_34_09/**` 신규 마크다운/JSON(4차
라운드가 만든 리뷰 산출물을 저장소에 영구 기록)이다. 하지만 이 12개 파일이 커밋된 실제 커밋
(`3dc3a160a`)을 `git show --stat`으로 직접 대조한 결과, 같은 커밋에는 **애플리케이션 코드 3개
파일도 함께 포함**되어 있었다(`.claude/hooks/guard_review_before_push.py` +47/-12,
`.claude/tests/README.md` +2/-1, `.claude/tests/test_push_guard_worktree_scope.py` +90/-0).
이 코드 변경분이 이번 프롬프트에는 **전혀 등장하지 않는다** — "파일 1~12" 전부 review artifact
뿐이다. 이 사실 자체가 아래 CRITICAL 발견의 근거이므로, RESOLUTION.md/SUMMARY.md(파일 1·2)가
주장하는 6건의 코드 반영(WARNING 1·2·4·5·6·7)이 실제로 코드에 존재하는지를 `Read`/`grep`으로
직접 대조하고, `python3 -m unittest discover -s .claude/tests -p 'test_push_guard_worktree_scope.py' -v`
(23 passed) 및 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`(540 passed, 0 failed)
를 재실행해 검증했다. `plan/in-progress/push-guard-worktree-scope.md`도 대조했다.

## 발견사항

- **[CRITICAL]** 이번 리뷰 세션(01_02_21)의 changeset이 같은 커밋(`3dc3a160a`)에 포함된 실제 코드
  변경 3개 파일을 누락 — 이 라운드가 리뷰해야 할 진짜 대상(WARNING 6건 반영분)이 어떤 fan-out
  reviewer에게도 코드로 노출되지 않았다
  - 위치: `review/code/2026/07/24/01_02_21/meta.json`("files" 배열이 review/ 산출물 12건뿐,
    `agents_forced`가 `["documentation"]` 하나뿐 — .py 변경 시 강제되는 security/requirement/
    scope/side_effect/maintainability/testing이 전혀 트리거되지 않음), 그리고 `_retry_state.json`의
    동일 `agents_forced` 필드. 대조 근거: `git show --stat 3dc3a160a`(15개 파일 변경, 그중
    `.claude/hooks/guard_review_before_push.py`/`.claude/tests/README.md`/
    `.claude/tests/test_push_guard_worktree_scope.py` 3건은 이번 프롬프트의 "파일 1~12" 어디에도
    없음). 이 라운드의 다른 sub-reviewer도 같은 전제를 그대로 받아들였다 —
    `review/code/2026/07/24/01_02_21/security.md:9-12` "그 파일들에 대한 실제 코드 변경은 이 diff
    이전(00_34_09 라운드 이전) 커밋에서 이미 이뤄졌고, 이번 커밋은 그 리뷰 결과물을 저장소에 영구
    기록하는 것뿐이다"(**사실과 다름** — 코드 변경은 `3dc3a160a` **같은 커밋**에 있다),
    `maintainability.md:47` "12개 파일 전부 `git diff` 상 `new file mode`(추가)이며 기존 파일
    수정이 아님"(코드 3개 파일의 수정을 이 12개 파일 밖에서 아예 안 셈).
  - 상세: `00_34_09` 라운드는 커밋 `feda5b219`(WARNING 픽스 **이전** 상태)를 리뷰했다. 그 뒤 커밋
    `3dc3a160a`가 WARNING 1·2·4·5·6·7을 코드에 반영하면서 **동시에** `00_34_09`의 산출물을
    커밋했다. 프로젝트 관례("fresh review after resolution" — fix 후 원 리뷰가 stale하므로 fresh
    `/ai-review` 1회 필요)에 따르면 이번 01_02_21 라운드가 바로 그 fresh review여야 하고, 그렇다면
    `3dc3a160a`가 새로 만든 코드(worktree 경로 매칭, `TARGET_SELECTION` degraded 기록, docstring
    복원, `result is None` 분기 주석, README/테스트 이름 정정, `_ensure_on_path` 헬퍼)가 review
    대상에 포함돼야 한다. 그런데 이번 changeset은 그 코드를 완전히 빠뜨린 채 "이전에 이미
    리뷰됨"이라는 잘못된 전제로 스스로를 정당화하는 리포트만 생산했다. 이 상태로 이번 라운드가
    CRITICAL/WARNING 0으로 수렴하면 SUMMARY.md가 커밋 `3dc3a160a`에 대해 "리뷰 완료"로 기록되고,
    push 가드(`.claude/hooks/guard_review_before_push.py` REVIEW gate)는 그 SUMMARY만 보고
    push를 허용한다 — 그러나 이 가드가 존재하는 이유인 바로 그 보안 관련 매칭/관측 로직
    (`_mentions_branch`/`_push_targets`/`_evaluate_over_targets`의 `outcome.degraded` 기록)이
    AI 리뷰를 실제로는 한 번도 받지 않은 채로 "리뷰됨" 판정을 얻는 셈이다 — 이 PR 자신이 닫으려는
    "우회 커버리지 갭"과 같은 성격의 프로세스 갭.
  - 실측(직접 검증, 위 CRITICAL이 코드 결함을 뜻하지 않음을 확인): RESOLUTION.md/SUMMARY.md가
    주장하는 6건은 전부 실제 코드에 존재한다 — `_push_targets`가 `_mentions_branch(command, path)`로
    worktree 경로도 매칭(`guard_review_before_push.py:491`), `main()`의 `_push_targets` 예외
    핸들러가 `outcome.degraded.append(("TARGET_SELECTION", ...))` 기록(:741), 모듈 docstring에
    "by branch or by path" 요약 복원(:16-18), `_evaluate_over_targets`의 `result is None` 분기에
    의도 설명 주석 추가(:644-648), `.claude/tests/README.md:47`·`test_push_guard_worktree_scope.py:257`
    두 곳 모두 `_run_gate`→`_evaluate_over_targets`로 정정(`grep -n "_run_gate\b"` 결과 0건),
    `_ensure_on_path()` 헬퍼가 신설되어 두 테스트 클래스에서 사용됨(:84-92, :496, :533-534).
    테스트는 21→23건(`test_bare_push_from_another_worktree_is_scoped_by_path`,
    `test_target_selection_failure_is_counted_not_silent` 신설, 둘 다 직접 실행해 pass 확인),
    harness 전체 540 passed(`test_line_anchors.py` 포함, 실패 0). 즉 이번 CRITICAL은 "코드가
    틀렸다"가 아니라 "이번 리뷰 라운드가 그 코드를 review 대상으로 보지 못했다"는 프로세스 결함이다.
  - 제안: 이번 세션의 changeset 계산 로직(diff base/파일-목록 산출 스크립트)이 왜 같은 커밋의
    코드 변경 3건을 누락했는지 조사해 수정하고, `.claude/hooks/guard_review_before_push.py`/
    `.claude/tests/README.md`/`.claude/tests/test_push_guard_worktree_scope.py`를 포함한 완전한
    diff로 이 라운드(또는 fresh 라운드)를 재실행할 것. 최소한 이번 SUMMARY가 확정되기 전에 이
    갭을 SUMMARY 자체의 발견사항으로 반드시 반영해 "코드는 review되지 않았다"는 사실이 push
    가드의 판정 근거에서 누락되지 않게 할 것.

- **[WARNING]** RESOLUTION.md(파일 1)가 검증했다고 주장하는 수치(테스트 23건, mutation 11건
  M1~M11)와 코드 comment("RESIDUAL GAP") 개선이 `plan/in-progress/push-guard-worktree-scope.md`의
  체크리스트·mutation 표·"남은 갭(의도)" 절에는 반영되지 않아 그 문서만 구버전 상태로 남음
  — 이 PR 자신이 5라운드 내내 반복 지적해 온 "감사 기록 비대칭" 패턴의 재발
  - 위치: `plan/in-progress/push-guard-worktree-scope.md:104`("테스트 **21건**"),
    `:105`("mutation 실측 **9건**"), `:116-129`(mutation 표가 M7까지만 존재, M8/M9/M10/M11 행
    없음 — M9는 `:166`에 산문으로만 언급되고 표에는 없음), `:184-185`("남은 갭(의도)"이
    "체크아웃되지 않은 branch"만 언급하고, 이번 라운드가 코드 주석에 추가한 새 RESIDUAL GAP
    케이스—"둘 다 안 나타나는 완전 bare push, 심볼릭 링크 별칭 경로"—는 미기재)
  - 상세: 커밋 `3dc3a160a`는 `plan/in-progress/push-guard-worktree-scope.md`를 건드리지 않았다
    (`git show --stat 3dc3a160a`에 이 파일 없음). 그런데 documentation.md(00_34_09 라운드,
    review/code/2026/07/24/00_34_09/documentation.md WARNING 1)의 제안은 명시적으로 "plan 의
    'origin/main 재구조화 흡수' 절에 '병합 시 docstring 요약 한 줄이 유실됐다가 5차에서 복원'
    한 줄을 남기면 이번에도 감사 추적이 비대칭이 되는 걸 막을 수 있다"였고, SUMMARY.md WARNING 1의
    제안도 "plan 문서에 이 케이스를 명시적 잔여 위험으로 추가"였다. RESOLUTION.md는 코드
    docstring/comment는 갱신했지만 plan 문서 갱신은 언급하지 않았고, 실제로 plan 문서는 변경되지
    않았다. 결과적으로 "테스트 21건"·"mutation 9건" 체크리스트, "남은 갭" 절이 지금 코드 상태
    (23건/11건, worktree 경로 매칭 후의 새 잔여 갭)보다 뒤처진 채 남아, 다음 라운드가 다시 같은
    종류의 "실측 대 문서 불일치"를 찾아야 하는 상태다.
  - 제안: `plan/in-progress/push-guard-worktree-scope.md`의 체크리스트(21→23건), mutation
    표(M8~M11 행 추가 또는 최소 요약), "남은 갭(의도)" 절(bare-push-neither-case 추가)을 이번
    라운드 반영분에 맞춰 갱신.

- **[INFO]** 관련 spec 문서 없음 — 정상(harness 전용, `spec/`는 제품 코드 대상)
  - 위치: `spec/`(전체) — `grep -rl "guard_review_before_push\|push_guard_worktree_scope"
    spec/` 결과 0건, 이번 라운드 requirement.md(파일 8, `review/code/2026/07/24/00_34_09/requirement.md:135-137`)가 이미 동일하게 확인한 바와 일치
  - 상세: CLAUDE.md 폴더 구조상 `.claude/hooks/`는 harness 자동화이며 `spec/`(제품 정의) 범위 밖.
    spec fidelity 위반이 아니라 애초에 spec 대상이 아님.
  - 제안: 조치 불요.

- **[INFO]** RESOLUTION.md·SUMMARY.md(파일 1·2) 자체의 내부 정합성은 양호
  - 위치: `review/code/2026/07/24/00_34_09/RESOLUTION.md` 전체, `SUMMARY.md:10-20`(WARNING 표
    7행)
  - 상세: SUMMARY의 WARNING 1~7과 RESOLUTION의 WARNING 1~7이 번호·내용 모두 1:1 대응하고,
    "반영"/"미조치(근거 있음)" 표기가 상호 모순 없이 일치한다. RESOLUTION의 "INFO 8 은 오판이었다"
    절(`test_line_anchors.py` 실패 재분류)도 직접 재현 가능했다(현재 HEAD에서 전체 스위트 540
    passed, 실패 0 — 머지 커밋 문제였다는 설명과 일치).
  - 제안: 조치 불요.

## 요약

이번 changeset(review/code/2026/07/24/00_34_09/** 12개 파일 신규 커밋)이 담고 있는 문서
내용 자체는 내부적으로 정합적이며, 그 문서가 주장하는 코드 반영 6건(worktree 경로 매칭,
TARGET_SELECTION 관측 기록, docstring 복원, `result is None` 분기 문서화, `_run_gate` 이름
드리프트 정정, sys.path 멱등화)은 실제 코드(`.claude/hooks/guard_review_before_push.py`,
`.claude/tests/test_push_guard_worktree_scope.py`, `.claude/tests/README.md`)를 직접 읽고
23/23·540/540 테스트를 재실행해 전부 사실임을 확인했다 — 기능적으로는 문제가 없다. 그러나
CRITICAL로 기록한 것은 그 코드가 아니라 **이번 리뷰 세션 자체의 changeset 계산**이다: 그 코드
3개 파일은 리뷰 산출물과 같은 커밋(`3dc3a160a`)에 있음에도 이번 라운드의 어떤 파일 목록·프롬프트에도
등장하지 않았고, 그 결과 이 라운드에 강제됐어야 할 security/requirement/scope/side_effect/
maintainability/testing 리뷰어가 전혀 트리거되지 않았으며, 이미 실행된 sibling 리뷰어들(security,
maintainability)조차 "코드는 이전 커밋에서 이미 리뷰됐다"는 틀린 전제를 그대로 받아들였다.
이 상태로 라운드가 clean 수렴하면, 이 PR의 핵심 목적(push 가드가 리뷰 안 된 코드 변경을 놓치지
않게 하는 것)과 정확히 같은 종류의 실패가 리뷰 하네스 자신에게서 재발하는 셈이다 — 실제 코드가
맞다는 사실이 이 갭을 덜 심각하게 만들지 않는다(우연히 맞았을 뿐, 이번 라운드가 검증한 것이 아니다).
부수적으로 RESOLUTION이 주장한 검증 수치가 plan 문서에는 반영되지 않아 문서 드리프트가
재발했다(WARNING).

## 위험도

CRITICAL
