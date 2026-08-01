# 변경 범위(Scope) Review

## 조사 방법

프롬프트의 "전체 파일 컨텍스트"가 6개 파일에서 크기 제한으로 실리지 않아, 대상 worktree
(`harness-block-backstop-b56163`, branch `claude/harness-block-backstop-b56163`)에서
`git diff origin/main...HEAD --stat` 로 실제 변경 파일 목록을 프롬프트와 전수 대조하고, 누락된
파일(`retry_state.py` 전체, `code_review_orchestrator.py`, `merge_coordinator_orchestrator.py`,
`consistency_orchestrator.py`, `guard_review_before_stop.py` 등)은 `Read`/`grep` 으로 직접 열어
확인했다. 대상 브랜치는 origin/main 대비 7개 커밋(`30cc0f738` feat 백스톱 → `7b54b088a` refactor
retry_state 추출 → `e364b4159`/`a0dcebea2`/`780e0837e`/`b06982ec4`/`179263dd2` 1R~4R 리뷰 반영),
15개 파일, `+1177/-278`. 직전 리뷰 세션(`review/code/2026/07/31/19_03_11/scope.md`)이 같은 번들링
쟁점을 11개 파일/`+831/-268` 시점에 이미 조사했으므로, 이번엔 그 이후 4개 라운드(2R~4R)가 새로운
스코프 이탈을 추가했는지를 중점 확인했다.

## 발견사항

- **[INFO]** 표제 기능(Critical 하향 금지 backstop)과 무관한 DRY 리팩토링(retry_state 추출)이 같은 브랜치에 번들 — 근거·테스트·명시적 경계 설정 모두 갖춘 사례, 조치 불요
  - 위치: `.claude/_shared/retry_state.py:1` (신규 파일 전체) / `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:48`, `:184-210` / `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:36-44`, `:100-122` / `.claude/tests/test_retry_state_shared.py:1` (신규 파일 전체)
  - 상세: 이 브랜치의 plan 항목 #2(`plan/in-progress/harness-review-gate-ci-backstop.md`)가 요구하는 작업은 `block_integrity.py` 신설 + `review_guard.py`/`guard_review_before_push.py`/`guard_review_before_stop.py`/`failopen_state.py` 배선만으로 완결된다. 그런데 같은 브랜치에 `code_review_orchestrator.py`·`consistency_orchestrator.py`·`merge_coordinator_orchestrator.py` 세 곳의 상태 bookkeeping 5개 함수(`load_state`/`save_state`/`reconcile_state_with_disk`/`apply_status_update`/`emit_summary_state`)를 `_shared/retry_state.py` 로 추출하는 별개 리팩토링이 함께 들어 있다. `grep -n "block_integrity"` 로 실측하면 `code_review_orchestrator.py`와 `merge_coordinator_orchestrator.py`의 diff는 `block_integrity` 를 **전혀 참조하지 않는다** — 즉 이 두 파일의 변경은 backstop 기능과 100% 무관하다. 특히 `merge_coordinator_orchestrator.py`는 consistency 하향 판정과 애초에 관계없는 스킬이라, 이 파일이 이 브랜치에 포함된 것 자체가 blast radius 확장이다. 정량적으로 diff `+1177/-278` 중 retry_state 관련 부분(`retry_state.py` 196줄 + `test_retry_state_shared.py` 175줄 + `code_review_orchestrator.py` 132줄 + `merge_coordinator_orchestrator.py` 68줄 + `consistency_orchestrator.py` 129줄 중 대부분)이 전체의 절반을 넘는다.
    다만 "무단 스코프 확장"으로 보기 어려운 근거가 갖춰져 있다: (1) `retry_state.py` 모듈 docstring 이 "AST 비교로 5개 중 4개가 완전 동일함을 사전 실측했다"고 명시하고 기존 `_shared/report_paths.py` 추출 선례를 그대로 따른다. (2) `consistency_orchestrator.py` 는 `block_integrity.ALL_CHECKERS` 를 파생시켜 쓰므로(`from _shared import block_integrity` 및 `ALL_CHECKERS = list(_block_integrity.ALL_CHECKERS)`) 이 파일만큼은 backstop 과 직접 연결된다. (3) plan 항목 #9 가 "`merge_coordinator_orchestrator.py`에 `reconcile_state_with_disk` 자기치유가 없다"는 실제 동작 변경을 **의도적으로 별도 PR 로 분리**한다고 명시해, 리팩토링 확산에 스스로 제동을 걸었다. (4) 전용 회귀 테스트(`test_retry_state_shared.py`, 3개 오케스트레이터 CLI 계약 + 원자적 쓰기 검증)가 갖춰졌다. (5) 3R(`b06982ec4`)·4R(`179263dd2`) 커밋이 이 추출 스크립트가 실수로 삼킨 무관 근거 주석(`code_review_orchestrator.py` router-trust 27줄, `merge_coordinator_orchestrator.py` "Git/gh helpers" 3줄)을 원본대로 복원했음을 직접 확인했다 — 리팩토링의 부작용까지 능동적으로 감사됨.
  - 제안: 조치 불요(허용 가능한 스코프 — 직전 라운드 판정과 동일 결론). 리팩토링 자체를 되돌리기보다, 커밋 메시지(`7b54b088a`)에 이미 있는 근거를 최종 PR 설명/SUMMARY 에도 한 줄 요약해 다음 reviewer 가 매 라운드 이 질문을 처음부터 재조사하지 않게 하는 것을 권장.

- **[INFO]** 순수 포맷팅 변경 — 빈 줄 2개 삽입 (실질 영향 없음)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:302-303`
  - 상세: retry_state 위임으로 `_apply_status_update` 본문이 삭제된 자리에 빈 줄 2개가 남았다(`_routing_distrust_reason` 함수 정의 앞). PEP8 함수 간 공백 관례에 부합하며 실질 변경과 섞여 판단을 흐리는 수준이 아니다.
  - 제안: 조치 불요.

## 점검한 다른 항목 (문제 없음)

- **무관한 파일/영역 수정**: `git diff origin/main...HEAD --stat` 결과가 프롬프트에 나열된 15개 파일과 정확히 일치. `codebase/`, CI 워크플로, `.claude.project.json` 등 제품 코드·설정 파일은 전혀 건드리지 않음.
- **주석 변경**: 추가된 주석은 전부 같은 diff의 변경 이유를 설명하는 근거 주석(측정치·과거 실패 사례 인용 포함). 리팩토링이 실수로 삼켰던 무관 근거 주석(3R/4R 발견)은 이미 원본대로 복원 완료 — 현재 diff 에 잔존하는 comment-loss 없음.
- **임포트 변경**: `code_review_orchestrator.py`·`consistency_orchestrator.py`·`merge_coordinator_orchestrator.py` 3곳 모두 `datetime`/`json` import 가 상태 함수 이관 후에도 다른 용도로 계속 쓰여 고아 임포트 없음(grep 확인, 각각 `datetime.now()`/`json.dump` 등 잔존 호출 존재). `consistency_orchestrator.py` 에서 제거된 `_report_paths_lib` 별칭은 파일 전체에서 참조가 완전히 사라졌음을 확인(잔존 참조로 인한 NameError 없음). `code_review_orchestrator.py` 는 `report_paths` import 를 유지하는데 `missing_reports()` 호출로 실사용 확인됨. 신규 `from _shared import block_integrity`/`from _shared import retry_state` 임포트는 모두 사용처 존재.
- **기능 확장(over-engineering)**: `block_integrity.py`/`retry_state.py` 가 export 하는 함수는 전부 최소 1곳 이상에서 실사용되며 미사용 공개 API 없음. `merge_coordinator_orchestrator.py` 의 `reconcile_state_with_disk` 자기치유 도입은 오히려 이번 스코프에서 의도적으로 defer.
- **설정 변경**: 없음.
- **plan 문서 갱신**: `plan/in-progress/harness-review-gate-ci-backstop.md` 의 `worktree:` frontmatter 정정(`harness-review-gate-fixes-1bd6aa` → `harness-block-backstop-b56163`)은 실제 작업 중인 worktree 를 반영하는 필수 메타데이터 동기화. 항목 #2 완료 처리(취소선)와 항목 #9 신규 등재(#10 으로 순연)는 이번에 실제로 구현/발견한 내용과 정확히 대응 — 서술과 코드 변경 범위 사이 괴리 없음.
- **guard_review_before_stop.py 신규 배선**: notes 전달·throttle 마커 로직을 직접 열어 확인 — `_marker_path`/`_already_nudged`/`_mark_nudged` 는 기존 nudge 인프라 재사용이고, 추가된 코드는 전부 "advisory 를 stderr 로, 세션당 1회만" 이라는 이번 기능 요구사항에만 대응한다. 무관한 로직(resolution-suppression, plan nudge) 은 건드리지 않음.

## 요약

이 브랜치는 표제 기능(Critical 하향 금지 backstop, `block_integrity.py` + 4개 훅/에이전트 문서
배선)과 그에 인접한 DRY 리팩토링(3개 오케스트레이터의 상태 bookkeeping을 `retry_state.py` 로
추출, `merge_coordinator_orchestrator.py` 포함)을 한 브랜치에 묶었다. 후자는 diff 절반 이상을
차지하고 backstop 로직과 직접 관련이 없지만(`code_review_orchestrator.py`·
`merge_coordinator_orchestrator.py` 는 `block_integrity` 를 전혀 참조하지 않음), 사전 측정 근거·
기존 추출 선례(`report_paths.py`)·전용 회귀 테스트·인접 확장(merge-coordinator 자기치유)의 의도적
defer 가 모두 갖춰져 있고, 리팩토링이 실수로 삼킨 무관 주석 2건도 후속 라운드(3R/4R)에서 이미
복원돼 "관련 없는 정리를 몰래 끼워 넣은" 사례라기보다 "같은 원칙을 이번 기회에 세 곳 모두에
적용하고 부작용까지 스스로 감사한" 사례다. 직전 라운드(19_03_11) 스코프 리뷰와 동일한 결론이며,
그 이후 4개 라운드(1R~4R)는 이 번들링 자체를 확장하지 않고 backstop 기능의 결함 수정과 리팩토링
부작용 복원에만 집중했다. 제품 코드·CI·설정 등 무관 영역 수정, 의미 있는 포맷팅 전용 변경, 미사용
임포트, 근거 없는 주석 변경은 발견되지 않았다.

## 위험도

LOW
