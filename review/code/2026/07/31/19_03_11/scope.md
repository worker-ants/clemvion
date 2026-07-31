# 변경 범위(Scope) Review

## 조사 방법

프롬프트에 담긴 "전체 파일 컨텍스트"만으로는 "무엇이 바뀌었는지"(diff)를 알 수 없어, 리뷰
대상 worktree(`harness-block-backstop-b56163`, branch `claude/harness-block-backstop-b56163`)에서
`git diff origin/main...HEAD`를 직접 열어 실제 변경분을 파일별로 대조했다. 대상 브랜치는
origin/main 대비 4개 커밋(`30cc0f738` feat 백스톱 → `7b54b088a` refactor retry_state 추출 →
`e364b4159`/`a0dcebea2` 1R 리뷰 반영), 11개 파일, `+831/-268`.

## 발견사항

- **[INFO]** 브랜치가 서로 다른 두 관심사(신규 기능 + 무관 리팩토링)를 한 PR에 묶었다 — 단, 근거·테스트·의도적 경계 설정이 모두 갖춰진 사례
  - 위치: `.claude/_shared/retry_state.py:1-29` (모듈 docstring, 추출 근거 서술) / `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`·`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` 전체 diff (두 파일 모두 백스톱 로직과 무관하게 retry_state 리팩토링만 담음)
  - 상세: 이 브랜치의 표제 작업은 `30cc0f738`(Critical 하향 금지 backstop, `block_integrity.py` 신설 + `review_guard.py`/`guard_review_before_push.py` 배선)이다. 그런데 같은 브랜치의 `7b54b088a`가 `code_review_orchestrator.py`/`consistency_orchestrator.py`가 각각 들고 있던 5개 상태 bookkeeping 함수(`_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_apply_status_update`/`_emit_summary_state`)를 `.claude/_shared/retry_state.py`로 추출하고, `merge_coordinator_orchestrator.py`에도 부분 배선(`_load_state`/`_save_state`만)했다. 이 리팩토링은 backstop 기능과 직접 관련이 없다(`code_review_orchestrator.py`·`merge_coordinator_orchestrator.py`의 diff에는 `block_integrity` 관련 코드가 전혀 없음) — diff 규모로는 신규 기능(≈502줄: `block_integrity.py` 131 + `review_guard.py` 47 + `guard_review_before_push.py` 35 + `test_block_integrity.py` 287 + README 2)과 리팩토링(≈579줄: `retry_state.py` 167 + `code_review_orchestrator.py` 155 + `consistency_orchestrator.py` 일부 + `merge_coordinator_orchestrator.py` 35 + `test_retry_state_shared.py` 99)이 거의 반반이다.
    다만 이를 "무단 스코프 확장"으로 보기 어려운 근거가 코드 자체에 명시돼 있다: (1) `block_integrity.py`의 `summary_block_verdict` docstring이 "Two copies of a BLOCK: regex is the 'Change both' shape this branch is elsewhere removing, and it would have been created in the same diff"라고 밝혀, 이번 backstop이 만드는 신규 단일 파서를 또 다른 "Change both" 사본으로 만들지 않기 위한 동일 원칙의 연장이라고 설명한다. (2) AST 비교로 5개 중 4개가 완전 동일함을 사전 실측했고(`_emit_summary_state`만 파라미터화), 기존 `report_paths.py` 추출 선례를 그대로 따른다. (3) `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 #9가 "`merge_coordinator_orchestrator.py`에 `reconcile_state_with_disk` 자기치유가 없다"를 **의도적으로 이번 PR 범위 밖으로 미루고**("다른 skill 의 동작 변경이라 별도 PR 로 분리한다") 별도 후속으로 등재해, 리팩토링 확산에 스스로 제동을 걸고 있다. (4) 신규 함수 각각에 `test_retry_state_shared.py`가 붙어 회귀 안전망도 갖췄다.
  - 제안: 조치 불요(허용 가능한 스코프). 다만 향후 유사 상황에서 "무관한 파일까지 건드리는 리팩토링"과 "기능과 진짜 결합된 정리"를 구분하는 절단선으로, 이번 사례처럼 (a) 사전 실측(AST/diff) 근거 명시, (b) 인접 확장 지점의 명시적 defer, (c) 전용 회귀 테스트 3가지를 계속 요구하면 됨.

## 점검한 다른 항목 (문제 없음)

- **무관한 파일/영역 수정**: `git diff origin/main...HEAD --stat` 결과가 프롬프트에 나열된 11개 파일과 정확히 일치. `codebase/`, CI 워크플로, `.claude.project.json` 등 제품 코드·설정 파일은 전혀 건드리지 않음.
- **포맷팅/공백 변경**: `review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`, `merge_coordinator_orchestrator.py`의 실제 diff를 전수 확인 — 의미 없는 재포맷팅이 실질 변경과 섞인 hunk 없음.
- **주석 변경**: 추가된 주석은 전부 같은 diff의 변경 이유를 설명하는 근거 주석(측정치·과거 실패 사례 인용 포함)이며, 변경과 무관한 기존 주석 훼손 없음.
- **임포트 변경**: 신규 `from _shared import block_integrity`/`from _shared import retry_state` 임포트 전부 사용처 확인됨(grep으로 각 심볼의 소비처 대조). 리팩토링 후에도 `datetime`/`json` 등 기존 임포트가 다른 용도로 계속 쓰여 고아 임포트 없음. `merge_coordinator_orchestrator.py`의 `CLAUDE_DIR`/`sys.path.insert` 추가는 다른 두 orchestrator가 이미 쓰던 패턴과 동일한 관례를 따름.
- **기능 확장(over-engineering)**: `block_integrity.py`/`retry_state.py`가 export하는 함수는 전부 최소 1곳 이상에서 실사용되며 미사용 공개 API 없음. 오히려 `merge_coordinator_orchestrator.py`의 `reconcile_state_with_disk` 도입, `test_consistency_context_budget` 계열 4파일의 fresh-interpreter 보일러플레이트 추출(plan 항목 #10) 등 "더 할 수 있었던" 확장을 의도적으로 defer.
- **설정 변경**: 없음.
- **plan 문서 갱신**: `plan/in-progress/harness-review-gate-ci-backstop.md`의 diff(+16/-2)는 이번에 실제로 구현한 항목(#2)만 완료 처리(취소선)하고, 이번에 새로 발견해 미룬 항목(#9)만 추가 — 실제 코드 변경 범위와 문서 서술이 정확히 대응.

## 요약

이 브랜치는 표제 기능(Critical 하향 금지 backstop, `block_integrity.py`)과 그에 인접한 DRY
리팩토링(`retry_state.py` 추출)을 한 PR에 묶었다. 후자는 backstop 로직과 직접 관련은 없지만
diff 안에 사전 측정 근거·기존 추출 선례(`report_paths.py`)·전용 테스트·인접 확장(merge
coordinator 자기치유)의 의도적 defer가 모두 갖춰져 있어, "관련 없는 정리를 끼워 넣은" 사례라기
보다 "같은 원칙(단일 파서/단일 사본)을 이번 기회에 두 곳 모두에 적용한" 사례로 판단된다.
파일 목록·diff 전수 대조 결과 제품 코드·CI·설정 등 무관 영역 수정, 포맷팅 전용 변경, 미사용
임포트, 근거 없는 주석 변경은 발견되지 않았다.

## 위험도

LOW
