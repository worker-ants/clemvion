# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** report-path 해석 로직이 두 파일에 상호 참조 없이 독립 중복 구현됨
  - 위치: `.claude/hooks/_lib/review_guard.py:355-380` (`_forced_coverage_missing`) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:213-232` (`_report_paths`, `_reconcile_state_with_disk:158-186` 에서 소비)
  - 상세: 두 함수 모두 "`subagent_invocations[].output_file` 의 basename 을 세션 디렉토리에 재-anchor 해 실제 리포트 절대경로를 구한다"는 동일한 정책을 각자 구현한다. `review_guard.py` 쪽은 forced 이름마다 `subagent_invocations` 를 매번 선형 탐색하는 `next(generator, None) or f"{name}.md"` 관용구를 쓰고, `code_review_orchestrator.py` 쪽은 한 번에 `{name: path}` dict 를 만들어 재사용한다 — 같은 목적의 코드가 서로 다른 형태로 두 벌 존재하고, 어느 쪽 docstring 에도 "다른 쪽과 함께 유지" 라는 상호 참조가 없다. 이 로직은 이번 PR 이 새로 만드는 커버리지 게이트의 핵심(디스크의 리포트 파일이 유일한 판정 기준)이며, 훅(push/stop) 쪽과 CLI(`--verify-coverage`/`--sync-from-disk`) 쪽 **두 강제 지점**이 공유해야 하는 정책이라 드리프트 위험이 특히 크다. 향후 파일명 규칙이나 fallback 정책이 바뀌면 두 구현이 서로 다른 시점에 갱신되어 훅과 CLI 의 판정이 조용히 어긋날 수 있다.
  - 제안: 최소한 두 함수 docstring 에 "이 로직은 `<다른 파일>::<함수명>` 과 동일 정책 — 함께 수정" 상호 참조 주석을 추가한다. 가능하면 `_report_paths` 의 dict-기반 구현을 `review_guard.py` 쪽에도 그대로 이식해 두 구현의 알고리즘 형태만이라도 통일한다. 완전한 코드 공유는 `hooks/_lib`·`skills/_lib`·`workflows/_lib` 패키지 이름 충돌 제약(테스트 하네스 주석에 명시) 때문에 별도 아키텍처 작업이 필요해 이번 PR 스코프를 벗어날 수 있다.

- **[WARNING]** `_reconcile_state_with_disk` 의 `changed` 판정이 자신이 갱신하는 필드 중 `agents_fatal` 을 비교 대상에서 누락
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:158-186`
  - 상세: `changed = before != (state["agents_success"], state["agents_pending"])` 로 `_save_state` 를 조건부 실행하는데, `before`/비교 튜플 모두 `agents_success`·`agents_pending` 두 필드뿐이다. 그러나 바로 위에서 같은 함수가 `state["agents_fatal"] = [n for n in state.get("agents_fatal", []) if n in missing]` 로 `agents_fatal` 도 함께 갱신한다. `_apply_routing` 이 이미 fatal 로 분류된 이름을 이후 `agents_skipped` 에도 추가할 수 있는 것처럼 세 버킷이 항상 상호 배타적이라는 불변식이 모든 경로에서 보장되지 않으므로, success/pending 은 이전과 동일한데 fatal 목록만 걸러져야 하는 조합이 이론상 가능하다 — 이 경우 메모리상의 `state` 는 올바르게 고쳐지지만 `changed=False` 라 `_save_state` 가 스킵되어 디스크에는 반영되지 않는다. `changed` 라는 이름이 약속하는 범위(이 함수가 만든 모든 변경)보다 실제 체크 범위가 좁아, 다음에 이 함수를 확장하는 사람이 같은 패턴을 복사해 반복하기 쉽다. 문서화된 주 사용 경로(순수 fallback fan-out 세션 — `agents_fatal` 이 애초에 비어 시작)에서는 실질 영향이 낮다.
  - 제안: 비교 튜플에 `state.get("agents_fatal")` 을 포함시키거나, `_save_state` 조건부 스킵 자체를 없애고 `known` 이 비어 있지 않으면 항상 저장하도록 단순화한다(JSON 저장 비용은 무시할 수준이라 "조용함"을 위한 최적화의 실익이 작다).

- **[INFO]** 동일 개념("상태 기록은 이제 자동")이 3개 문서에 각각 다른 문구로 중복 서술
  - 위치: `.claude/docs/subagent-call-contract.md` §7, `.claude/skills/code-review-agents/SKILL.md`("(fallback) 수동 Agent 경로"), `.claude/skills/consistency-checker/SKILL.md`("(fallback) 수동 Agent 경로")
  - 상세: 세 곳 모두 "`--summary-state`/`--resume` 가 읽을 때 디스크로 자가 reconcile" 한다는 동일 사실을 조금씩 다른 문장으로 반복 서술한다. 각 SKILL.md 가 hub 문서 링크에만 의존하지 않고 자체적으로 요약을 포함하는 기존 관례와 일치하므로 새로운 위반은 아니지만, 메커니즘이 다시 바뀔 때 세 곳을 모두 손으로 맞춰야 하는 drift 위험은 여전하다.
  - 제안: 지금 조치는 불필요. 다음에 이 메커니즘을 또 바꿀 때 hub 문서(`subagent-call-contract.md`) 문구를 canonical 로 하고 두 SKILL.md 는 그 표현을 그대로 인용하는 정도로 맞추면 충분하다.

- **[INFO]** `_summary_is_resolved` 가 이번 diff 로 네 번째 책임을 추가 흡수
  - 위치: `.claude/hooks/_lib/review_guard.py:405-465` (`_summary_is_resolved`)
  - 상세: 이 함수는 이미 "RESOLUTION.md 존재 확인 + 위험도 파싱 + Critical/Warning 행 존재 확인" 세 가지를 하나의 함수에서 처리하고 있었는데, 이번 diff 로 "forced reviewer 커버리지 확인"(`missing_forced = _forced_coverage_missing(session_dir); if missing_forced: return False`)이 앞단에 추가되며 책임이 넷으로 늘었다(순환복잡도 대략 9~10 수준). 이번에 추가된 부분 자체는 2줄짜리 조기 반환으로 깔끔하게 들어가 있어 이 diff만의 문제는 아니지만, 함수가 계속 커지는 추세라 다음 조건이 하나 더 필요해질 때는 분해를 고려할 시점이다.
  - 제안: 지금 당장 조치는 불필요. 다음 확장 시 "커버리지 판정"과 "내용(위험도·행) 판정"을 이름이 분리된 두 헬퍼로 나누는 것을 고려.

## 요약

이번 변경은 review coverage gate 를 "산문 의무"에서 "기계적 강제"로 승격시키는 작업으로, 새로 추가된 코드(`_forced_coverage_missing`, `_reconcile_state_with_disk`, `_report_paths`)는 전반적으로 읽기 쉽고 함수 길이·중첩 깊이가 적절하며, 기존 파일의 타입힌트·네이밍·에러 처리(fail-open, `(OSError, ValueError)` 캐치) 컨벤션을 잘 따른다. 특히 `code_review_orchestrator.py` 내부에서는 `_sync_from_disk`/`_verify_coverage` 에 흩어져 있던 경로 계산 로직을 `_report_paths`/`_reconcile_state_with_disk` 로 추출해 파일 내부 중복을 실제로 줄였고, 새 동작 하나하나에 실측 수치(575건 중 160건, 537건 등)를 근거로 한 상세한 "왜" 주석과 그에 대응하는 테스트(정상/누락/꾸민 success/fail-open/worktree 소멸 케이스)를 동반한 점은 이 코드베이스의 기존 문서화 관례와 일관되며 장기 유지보수에 실질적으로 도움이 된다. 다만 이번 PR 이 세우는 커버리지 정책의 핵심 로직(리포트 경로 해석)이 `review_guard.py` 와 `code_review_orchestrator.py` 에 상호 참조 없이 두 벌로 구현되어 있어 향후 정책이 바뀔 때 훅과 CLI 두 강제 지점의 판정이 조용히 어긋날 여지가 있고, `_reconcile_state_with_disk` 의 `changed` 플래그가 자신이 갱신하는 `agents_fatal` 필드를 비교에서 빠뜨려 이름과 실제 동작 범위가 어긋나는 점은 짚고 넘어갈 만하다. 두 건 모두 문서화된 주 사용 경로에서는 실질적 위험이 낮은 미세한 기술 부채 수준이며, 즉시 차단할 사안은 아니다.

## 위험도

LOW
