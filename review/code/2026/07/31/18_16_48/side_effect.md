# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 새 downgrade 경고가 `stderr` 전용으로 하드코딩되어, push 게이트가 이미 문서화한 "exit code 별 stream 분리" 규약을 어긴다 — ALLOW(exit 0) 경로에서는 이 경고가 모델에게 사실상 보이지 않을 가능성이 크다.
  - 위치: `.claude/hooks/_lib/review_guard.py:728-733` (`_newest_resolved_impl_done_mtime` 내부 `print(f"⚠️  ...", file=sys.stderr)`), import 지점 `:131`
  - 상세:
    `_newest_resolved_impl_done_mtime`(review_guard.py) 은 저장소 전체의 `--impl-done` consistency SUMMARY 를 순회하며, `BLOCK: NO` 인데 checker 가 `[CRITICAL]` 을 낸 세션을 발견할 때마다 무조건 `file=sys.stderr` 로 경고를 찍는다(`_block_integrity.contradiction_note` 호출 결과). 이 함수는 `evaluate_review()` 의 gate 2(spec-impl 일관성)에서 **push 게이트와 stop 게이트 양쪽이 공유**하며, 최종 ALLOW/BLOCK 판정이 나기 훨씬 전, 그리고 판정과 무관하게 실행된다.

    그런데 이 경고의 유일한 소비자 중 하나인 `.claude/hooks/guard_review_before_push.py` 는 바로 같은 PR 계열의 `_report_fail_open`(약 733-748번째 줄)에서 스스로 다음을 명시한다:

    > "Channel depends on the exit code, because that decides what the harness surfaces: on exit 2 the refusal is read from stderr, while on exit 0 it is STDOUT that gets injected into the model's context... A banner on the wrong stream is a banner nobody reads."

    즉 이 저장소의 push 훅 설계자 자신이 "ALLOW(exit 0) 시에는 stdout 만 모델에 전달되고, stderr 는 오직 BLOCK(exit 2) 일 때만 '거절 사유'로 읽힌다" 는 사실을 실측/문서화해 두었다. 새 경고는 이 규약을 모르는 저수준 공유 헬퍼(`review_guard.py`) 안에 파묻혀 있어 최종 exit code 를 알 방법이 없고, 결과적으로 스트림을 정적으로 `stderr` 로 고정했다.

    실제 트리거 조건까지 고려하면 문제가 더 뚜렷하다: `_newest_resolved_impl_done_mtime` 은 **현재 PR 의 spec 영역과 무관한, 저장소 전체의 과거 impl-done 세션**까지 전부 순회하며 contradiction 을 찾는다. 즉 이번 push 를 실제로 막는 세션이 아니라 완전히 무관한 옛 세션에서 모순이 발견되어도 경고가 찍힌다 — 이런 경우 push 는 (다른 신선한 세션 덕에) 정상적으로 ALLOW 되며 exit code 는 0 이 된다. `block_integrity.py` 자체의 모듈 docstring 이 밝히는 이 기능의 존재 이유("a downgrade passed the gate silently... Making it visible is the fix", 732 세션 중 24건/3.3% 실측)를 생각하면, 정확히 그 실측된 24건 같은 무관/과거 세션이 걸리는 **바로 그 케이스에서** 경고가 stderr 로만 나가 모델에 전달되지 않을 공산이 크다 — 기능이 만들어진 이유를 스스로 무력화하는 구조.

    Stop 훅(`guard_review_before_stop.py`) 쪽은 애초에 stdout 이 JSON 프로토콜 전용이라 "Always stderr, unlike the push gate" 라고 이미 명시하고 있어 이 헬퍼의 stderr 고정과 상충하지 않는다 — 이 지적은 **push 훅 소비 경로에 한정**된다.

    `test_block_integrity.py::GateSurfacesTheContradictionTest` 는 `_newest_resolved_impl_done_mtime` 을 직접 호출해 "stderr 에 도달한다"만 확인할 뿐, `guard_review_before_push.py` 의 실제 ALLOW 경로를 relay 태워 이 문자열이 최종적으로 어느 스트림/채널로 나가는지는 검증하지 않는다 — 즉 이 갭은 테스트로도 잡히지 않는 상태다.
  - 제안: 이 헬퍼가 직접 `print(..., file=sys.stderr)` 하는 대신, contradiction 정보를 반환값(예: `ReviewDecision.reason` 에 append 하거나 별도 `warnings: list[str]` 필드)으로 올려 보내 각 호출자가 자신의 계약에 맞는 스트림으로 내보내게 하십시오. 최소한 `guard_review_before_push.py` 에서 ALLOW 로 끝나는 경로에 대해 이 경고가 stdout 으로도 다시 노출되는지 확인하는 e2e/통합 테스트를 추가하는 것을 권장합니다.

- **[INFO]** retry_state 추출 커밋이 목적과 무관한 라우팅-신뢰 rationale 코멘트(~26줄)를 collateral 삭제했다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` — `_routing_distrust_reason` 함수(현재 277번째 줄) 바로 위. 해당 코멘트는 diff 상 `-` 라인이라 새 파일에 게이트 번호가 없음 — 커밋 전 버전(`git show 7b54b088a^:...`)의 377-401번째 줄에 "Caller-side trust check for a routing decision…"으로 시작하는 블록.
  - 상세:
    이번 변경의 stated 목적은 `_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_emit_summary_state`/`_apply_status_update` 5종을 `_shared/retry_state.py` 로 옮기는 것(커밋 `7b54b088a`)이다. 그런데 실제 diff 는 `_apply_status_update` 함수 바로 뒤에 붙어 있던, **완전히 다른 함수(`_routing_distrust_reason`)를 설명하는** "Caller-side trust check for a routing decision..." 코멘트 블록 전체(라우터가 forced whitelist 를 어겼을 때의 신뢰 판단 로직 배경 — 2026-07-23 14_47_40 세션 사고, PR #244 등)까지 함께 삭제했다. state-bookkeeping 이동과는 무관한 내용으로, 커밋 메시지에도 이 삭제는 언급되지 않는다.

    다행히 내용 자체는 완전히 유실되지는 않았다 — `.claude/tests/test_router_decision_trust.py`, `.claude/tests/README.md`, `.claude/skills/code-review-agents/lib/router_safety.py` 에 동일/유사 rationale 이 남아 있고, `_routing_distrust_reason` 자신의 docstring(277-283번째 줄)도 최소한의 설명은 유지한다. 다만 이 파일을 직접 읽는 사람은 더 이상 그 자리에서 전체 배경(측정 수치, 사고 재현, #244 와의 관계)을 볼 수 없다.

    같은 패턴의 더 작은 사례가 `consistency_orchestrator.py` 에도 있다 — `_apply_status_update` 정의 바로 위에 있던 `# File / corpus collection` 섹션 구분 코멘트도 이번 커밋에서 사라졌고(현재 파일 어디에도 재등장하지 않음), 이쪽은 순수 조직용 코멘트라 실질적 손실은 미미하다.
  - 제안: 별도 커밋(문서 전용)으로 이 코멘트 블록을 원래 있던 `_routing_distrust_reason` 바로 위로 되돌리거나, 최소한 커밋 메시지에 "무관 코멘트 재배치/정리"를 명시해 리뷰어가 diff 크기를 오인하지 않도록 하십시오.

## 요약

핵심 변경(5종 상태 bookkeeping 함수를 `_shared/retry_state.py` 로 추출, `_shared/block_integrity.py` 신설 + `review_guard.py` 배선)은 AST 비교로 사전 검증되었고, 함수 시그니처는 각 orchestrator 에서 얇은 위임 래퍼로 전부 보존되어 있어 기존 CLI 호출자(`--update`/`--summary-state`)에 대한 계약 파괴는 없다. 전역 변수 오염, 파일시스템 부작용, 환경변수, 네트워크 호출 관련 새 위험은 발견되지 않았다. 다만 신설된 downgrade 경고가 스트림을 `stderr` 로 고정해, 같은 파일군이 이미 문서화한 "exit code 에 따라 stdout/stderr 를 갈라 써야 모델이 읽는다"는 규약과 충돌하며, 정확히 이 백스톱이 잡으려던 시나리오(무관하거나 과거의 BLOCK:NO 세션)에서 조용히 묻힐 개연성이 있다 — 기능 자체의 실효성에 관한 실질적 부작용이다. 그 외 `code_review_orchestrator.py` 리팩토링 과정에서 목적과 무관한 라우팅-신뢰 rationale 코멘트가 collateral 삭제된 것은 내용이 다른 곳에 남아 있어 지식 손실은 제한적이나, diff 범위를 벗어난 의도치 않은 변경이라는 점에서 위생 문제로 기록해 둔다.

## 위험도

MEDIUM
