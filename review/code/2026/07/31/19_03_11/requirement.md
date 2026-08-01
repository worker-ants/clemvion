STATUS=success requirement review complete (2 WARNING, 1 WARNING/doc-staleness, 2 INFO)
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) Review — harness-block-backstop

리뷰 대상: `origin/main...HEAD` 의 4개 커밋(`30cc0f738` feat 하향 금지 backstop, `7b54b088a` refactor
retry_state 공유화, `e364b4159` / `a0dcebea2` 1R 리뷰 반영). 프롬프트에서 크기 제한으로 생략된
`review_guard.py` / `guard_review_before_push.py` / `code_review_orchestrator.py` 는 `Read` +
`git diff origin/main...HEAD`로 직접 확인했다. 전체 `.claude/tests` 스위트(735 tests)를 로컬에서
실행해 통과를 확인했고, `merge_coordinator_orchestrator.py`의 `--summary-state`/`--update` 및
`_evaluate_over_targets`의 notes 배관은 별도 스모크 스크립트로 직접 구동해 동작을 확인했다.

## 발견사항

- **[WARNING]** Stop 가드가 `evaluate_review()`의 신규 `notes`(하향 경고)를 전혀 읽지 않는다 — push 만 반쪽 배관.
  - 위치: `.claude/hooks/guard_review_before_stop.py` — `_run()` 내 `decision = evaluate_review(in_flight_ok=True)` 호출부(주석 "in_flight_ok=True 는 Stop-only" 바로 아래), 이후 `decision.blocked`/`decision.reason`만 읽고 `decision.notes`는 어디서도 참조되지 않음. 대조: `.claude/hooks/guard_review_before_push.py`의 신설 `_report_notes()`.
  - 상세: 이번 PR의 핵심 기능(`_shared/block_integrity.py`)은 "SUMMARY 가 `BLOCK: NO` 인데 checker 가 `[CRITICAL]` 을 냈다"를 `evaluate_review()` 내부에서 계산해 `ReviewDecision.notes` 에 싣는다. 이 계산은 `evaluate_review()`가 호출될 때마다(즉 push 가드와 Stop 가드 양쪽에서) Gate 2 평가의 부산물로 항상 실행된다. 그런데 실제로 그 결과를 스트림에 내보내는 코드(`_report_notes`/`outcome.notes` 배관)는 이번 PR에서 **push 가드에만** 추가됐다. Stop 가드(`guard_review_before_stop.py`)는 `failopen_state`/`_report_fail_open` 패턴과 동일한 위치에 `_report_notes` 대응물이 없고, `decision.notes`를 읽는 코드도 없다 — 계산은 되지만 조용히 버려진다. Stop 가드 자신의 모듈 docstring은 "이 nudge 는 push 게이트가 개입하기 **전에**, 턴 종료 시점에 잡는다"고 명시하므로, 원래 이 기능이 가장 유용할 시점(가장 이른 시점)에 정확히 비어 있다. 더 나쁜 점: `_newest_resolved_impl_done_mtime()`은 오직 "게이트가 현재 채택하는 단 하나의 최신 세션"만 추적하므로, Stop 시점에 존재하던 하향 세션이 다음 push 전에 더 최신 `--impl-done` 세션으로 대체되면 그 경고는 push 시점에도 다시 나타나지 않는다 — 즉 지연이 아니라 영구 유실 가능. `_report_fail_open`은 이미 Stop 가드에서 안전하게 stderr 로 나가는 선례(exit code 무관 stderr 고정)가 있으므로 동일 패턴을 notes 에도 적용할 수 있었다. 이 갭이 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`)에 의도적 defer 항목으로 등재돼 있지도 않다 — `merge_coordinator_orchestrator.py`의 reconcile 누락(항목 #9)과 달리, 이건 문서화된 스코프 결정이 아니라 누락으로 보인다.
  - 제안: `guard_review_before_stop.py`에 `_report_notes`(또는 동등 로직, stderr 고정)를 추가하고 `decision.notes`를 그쪽에도 넘길 것. 최소한 plan 문서에 "Stop 가드는 의도적으로 제외" 라는 결정 근거를 등재해 향후 재조사 비용을 없앨 것.

- **[WARNING]** 신설된 notes 배관(`_evaluate_over_targets` → `outcome.notes` → `_report_notes`)의 이음매(seam)를 검증하는 테스트가 없다 — 지워도 전체 스위트가 GREEN.
  - 위치: `.claude/hooks/guard_review_before_push.py` 의 `_evaluate_over_targets()` 함수 내 `notes = getattr(outcome, "notes", None)` 로 시작하는 블록(신규 추가분).
  - 상세: `test_guard_review_before_push_main.py`의 subprocess 스텁 `_Decision`(REVIEW 가드 stub)은 `notes` 필드를 정의하지 않는다. 따라서 `_evaluate_over_targets`가 `getattr(result, "notes", ()) or ()`로 항상 빈 튜플을 받아 이 블록은 사실상 매 테스트에서 no-op으로 통과한다. `test_push_guard_worktree_scope.py` 역시 `.notes`를 전혀 참조하지 않는다. `test_block_integrity.py::AdvisoryReachesTheModelTest`는 `_report_notes()`를 손으로 만든 `outcome.notes` 로 직접 테스트하고(배관을 건너뜀), `GateSurfacesTheContradictionTest`는 `_newest_resolved_impl_done_mtime()`을 직접 호출한다(마찬가지로 `_evaluate_over_targets` 배관은 건너뜀). 즉 "`ReviewDecision.notes`가 실제로 `_evaluate_over_targets`를 거쳐 `outcome.notes`에 복사되고 그것이 다시 `_report_notes`로 출력된다"는 이음매 전체를 검증하는 테스트가 하나도 없다. 실제로 스크립트로 이 경로를 수동 구동해 현재 동작 자체는 정확함을 확인했으나(회귀 없음), 이 배관을 삭제/변형하는 뮤턴트가 있어도 어떤 테스트도 RED 가 되지 않는다 — 이 PR의 자매 테스트인 `GateSurfacesTheContradictionTest`가 스스로 "호출부를 지워도 전부 GREEN 이면 안 된다"는 정확히 같은 원칙으로 한 단계 아래(`review_guard`)를 지키고 있는 것과 대비된다.
  - 제안: `test_guard_review_before_push_main.py`의 `_Decision` stub 에 `notes` 필드를 추가하고, ALLOW/BLOCK 양쪽 경로에서 stdout/stderr 에 해당 텍스트가 실제로 나타나는지 단언하는 케이스를 1~2개 추가할 것(`_report_fail_open`류 다른 관측성 기능들이 이미 이 파일에서 그렇게 검증되고 있음).

- **[WARNING]** `.claude/skills/consistency-checker/SKILL.md` §4 BLOCK 처리의 하향-금지 근거 서술이 이번 PR 이후 부분적으로 낡았다 (spec/ 문서는 아니라 SPEC-DRIFT 태그는 붙이지 않음 — harness SKILL 문서).
  - 위치: `.claude/skills/consistency-checker/SKILL.md:114` — "`review_guard.py` 는 `BLOCK:` 한 줄만 파싱하므로 그 하향이 게이트를 실제로 통과시킨다"
  - 상세: 이 문장은 이번 PR 이전 상태(`review_guard.py`가 checker 리포트를 전혀 대조하지 않던 상태)를 근거로 "하향 금지"를 정당화한다. 이번 PR로 `review_guard.py`(정확히는 `_shared/block_integrity.py`)는 이제 SUMMARY 의 `BLOCK:` 값과 각 checker 의 `[CRITICAL]` 개수를 실제로 대조하고, 불일치 시 경고를 낸다. 결론("하향이 게이트를 실제로 통과시킨다" = push 가 막히지 않는다)은 여전히 참이지만(경고이지 차단이 아니므로), 그 근거로 제시된 메커니즘 서술("한 줄만 파싱하므로")은 더 이상 정확하지 않다 — 지금은 대조하지만 의도적으로 차단은 안 할 뿐이다. `git diff --stat`로 확인한 결과 `SKILL.md`는 이번 PR에서 전혀 수정되지 않았다. 같은 기능을 다루는 자매 plan 문서(`harness-review-gate-ci-backstop.md`)는 이번 PR로 꼼꼼히 갱신된 것과 대비된다.
  - 제안: 이 reviewer 는 spec 을 직접 수정하지 않으나(그리고 SKILL.md 는 spec/ 밖이라 §9 spec-fidelity 대상도 아니다), §4 문장을 "게이트가 대조는 하되 하향을 막지는 않는다(경고만)"로 갱신할 것을 권한다 — 대상: `.claude/skills/consistency-checker/SKILL.md` §4 BLOCK 처리, `.claude/_shared/block_integrity.py` 도입을 반영.

- **[INFO]** 이번 변경 영역(harness 리뷰 게이트 자체)을 규정하는 `spec/` 문서가 없다. `grep -rl "consistency-summary\|BLOCK:\|review_guard\|block_integrity" spec/` 결과 실질적 연관 문서 0건(우연한 문자열 일치 1건은 무관 문맥). CLAUDE.md 컨벤션상 `spec/`은 제품 정의 전용이고 harness 워크플로 규약은 `.claude/docs/`+`SKILL.md`+agent 정의(`.claude/agents/consistency-summary.md`)가 SoT 이므로, 이는 정상이며 갭이 아니다 — `.claude/agents/consistency-summary.md` §요약 지침 3/4 은 `block_integrity.py`의 docstring 이 인용한 내용과 line-level 로 일치함을 확인했다.
  - 위치: 해당 없음 (spec/ 부재 확인용 INFO)

- **[INFO]** `merge_coordinator_orchestrator.py`는 여전히 `reconcile_state_with_disk` 자기치유가 없다(다른 두 orchestrator는 이번 PR로 `_shared/retry_state.py`를 통해 보유). 그러나 이는 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 #9에 "다른 skill 의 동작 변경이라 별도 PR 로 분리한다"로 명시적으로 defer 등재돼 있어 숨은 갭이 아니다. `_load_state`/`_save_state`만 위임하고 `_apply_status_update`/`_emit_summary_state`(branch/base 필드라 실제로 다름)는 로컬 유지한 것도 AST 비교 근거(주석)와 일치하며, `--summary-state`/`--update` 스모크 테스트로 동작 확인했다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`

## 세부 검증 메모 (문제 없음, 참고용)

- `_shared/block_integrity.py`의 `_BLOCK_LINE`/`_CRITICAL_TAG` 정규식, `_shared/retry_state.py`로의
  5개 함수 추출(AST-identical 주장)은 `code_review_orchestrator.py`/`consistency_orchestrator.py`
  diff와 대조해 동작이 보존됐음을 확인했다(원래 인라인 코드와 추출된 shared 코드가 byte-for-byte
  동일). `test_retry_state_shared.py`가 두 오케스트레이터의 stdout 라인과 stderr "reconciled" 알림을
  모두 핀 하고 있어 "첫 배선이 알림을 한쪽에서 조용히 잃었다"는 퇴행 클래스를 이미 커버한다.
- `evaluate_review()`의 세 반환 경로(Gate 1 블락 / Gate 2 no-session 블락 / Gate 2 stale 블락 /
  최종 allow) 중 `notes`가 실제로 채워지는 유일한 지점(최종 allow)과 나머지 블락 경로에서 `notes`가
  항상 빈 상태로 유지되는 것을 코드 추적으로 확인했다 — 설계상 자연스럽다(블락 시 reason 문자열
  자체가 이미 더 강한 신호이므로).
- `_evaluate_over_targets`가 REVIEW/PLAN 두 게이트에 공용으로 쓰이지만 `getattr(result, "notes", ())`
  방어 덕분에 `notes`가 없는 `PlanDecision`류 결과에도 안전함을 확인했다.
- `ALL_CHECKERS` 정본화(`consistency_orchestrator.py` → `_shared/block_integrity.ALL_CHECKERS`
  파생)는 순서·값 모두 기존과 동일하고, `test_orchestrator_derives_its_list_from_here`가 프로세스
  분리로 실측 대조한다.
- 로컬 전체 스위트 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → 735 passed, 0
  failed.

## 요약

핵심 기능(consistency SUMMARY의 `BLOCK: NO` 하향을 checker `[CRITICAL]` 태그와 대조해 경고하는
기계적 backstop, `_shared/retry_state.py`로의 상태 관리 통합, checker 목록 정본화)은 의도대로
구현돼 있고 관련 plan 문서·agent 정의와 line-level 로 일치하며, 전체 하네스 테스트 스위트(735건)가
통과한다. 다만 신규 `notes`(하향 경고) 기능이 두 호출부(push 가드/Stop 가드) 중 **push 에만**
배선돼 있어 — Stop 가드는 이 PR이 막으려는 바로 그 실패 유형(하향 발생을 아무도 못 읽는 문제)을
자기 시점에서는 여전히 겪는다 — 기능 완전성 관점의 실질 갭이다. 또한 그 push 쪽 배선조차
end-to-end 이음매 테스트가 없어 향후 회귀를 잡지 못한다. 두 갭 모두 하드 게이트(push)의 최종
BLOCK/ALLOW 판정 자체를 그르치지는 않으므로(경고 시스템의 완결성 문제이지 오판정 문제가 아님)
CRITICAL 로는 보지 않았다. SKILL.md 의 근거 서술 하나가 부분적으로 낡은 점은 낮은 우선순위 문서
정합성 이슈다.

## 위험도

MEDIUM
