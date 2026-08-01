# Documentation Review — `.claude/_shared/block_integrity.py` 외 7건

## 발견사항

- **[WARNING]** 하향 금지 정책의 "기계적 backstop" 구현이, 그 backstop 을 미착수 backlog 로 등재해 둔 in-progress plan 문서에 반영되지 않음
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:36` (관련: `plan/in-progress/harness-consistency-summary-downgrade-rule.md` — 같은 `worktree: harness-review-gate-fixes-1bd6aa`)
  - 상세: `harness-review-gate-ci-backstop.md` "신규 후속 (defer)" 목록 2번 항목은 "하향 금지 정책에 기계적 backstop 이 없다 … 후보: orchestrator 가 checker 리포트의 `[CRITICAL]` 수를 세어 최종 `BLOCK:` 와 모순되면 stderr 경고 / 반환 플래그"라고 적어 두었다. 이 plan 파일은 이 브랜치의 두 커밋(`30cc0f738` 18:08, `7b54b088a` 18:16)보다 **먼저**(같은 날 17:58, 커밋 `e7fef2510`) 갱신됐고, 정확히 그 후보안이 이번 PR 의 `.claude/_shared/block_integrity.py` + `review_guard.py` 호출부(707/722-733행)로 구현됐다 — "`[CRITICAL]` 카운트 대조 + stderr 경고"라는 문구까지 거의 일치. 그런데 두 plan 파일 어느 쪽도 이 항목이 처리됐다는 갱신을 받지 못한 채 여전히 `plan/in-progress/`에 남아 있어, 이 backlog 항목은 지금도 "미착수"로 읽힌다. 다음에 이 plan 을 참고하는 사람(에이전트 포함)이 이미 끝난 일을 다시 벌일 위험이 있다.
  - 제안: `harness-review-gate-ci-backstop.md` 2번 항목에 "구현 완료(commit 30cc0f738, `.claude/_shared/block_integrity.py`)" 짧은 addendum 을 달거나 상단 배너에 한 줄 추가. `harness-consistency-summary-downgrade-rule.md` 쪽도 같은 취지로 갱신하면 두 문서가 실제 상태와 어긋나지 않는다.

- **[INFO]** `_shared/retry_state.py` 로 추출되며 `apply_status_update` 가 갖고 있던 한 줄 독스트링이 소실
  - 위치: `.claude/_shared/retry_state.py:138`
  - 상세: 리팩터 전 `code_review_orchestrator._apply_status_update` 는 `"""Move agent between pending/success/fatal buckets and record history."""` 독스트링을 갖고 있었다(`git show origin/main:.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 로 확인). consistency 쪽 사본은 애초에 독스트링이 없었다. 통합된 `retry_state.apply_status_update` 는 어느 쪽 문구도 갖지 않는다 — 추출 전 AST 비교가 독스트링을 제외하고 수행됐기 때문에("동일" 판정에 영향 없음) 이 차이가 조용히 사라진 것으로 보인다. 같은 파일의 `reconcile_state_with_disk`/`emit_summary_state` 는 각각 충실한 독스트링을 유지하고 있어 `apply_status_update` 만 비어 있는 게 상대적으로 눈에 띈다.
  - 제안: 이 모듈은 이제 두 orchestrator 가 함께 참조하는 공개 API이므로, 짧게라도(원래 한 줄) 독스트링을 복원.

- **[INFO]** `block_integrity.py` 모듈 독스트링의 사건 인용이 "발생 세션"과 "탐지 세션"을 하나로 뭉뚱그림
  - 위치: `.claude/_shared/block_integrity.py:8-9`
  - 상세: "a downgrade passed the gate silently — which is what happened in `review/code/2026/07/25/22_58_00` and prompted the rule." 라고 적혀 있으나, 실제로 하향이 **일어난** 세션은 `review/consistency/2026/07/25/22_28_51/SUMMARY.md`다(직접 확인: `BLOCK: NO` 인데 그 세션의 `cross_spec.md` 는 `[CRITICAL]` 태그를 갖고 있음). `review/code/2026/07/25/22_58_00` 는 그 하향을 **CRITICAL 로 최초 보고한 코드 리뷰 세션**이다(해당 `SUMMARY.md`: "`22_28_51/SUMMARY.md` 가 … 하향하고 `BLOCK: NO` 를 선언"). "발생 지점"과 "보고 지점"이 서로 다른 세션인데 문장은 하나로 합쳐 인용했다. 같은 주제의 plan 문서(`harness-consistency-summary-downgrade-rule.md`)는 "`review/code/…22_58_00` **CRITICAL** 에서 분리"라고 정확히 구분해 적어 대비된다.
  - 제안: "… which is what happened in `review/consistency/2026/07/25/22_28_51` (surfaced by the code review at `review/code/2026/07/25/22_58_00`) …" 처럼 두 세션을 구분해 표기.

- **[INFO]** `review_guard.py` 모듈 상단 독스트링이 이번에 추가된 stderr 경고 부작용을 아직 반영하지 않음
  - 위치: `.claude/hooks/_lib/review_guard.py:46-49` ("Fresh impl-done consistency report" 절). 실제 변경 호출부는 707행(`_newest_resolved_impl_done_mtime`) / 722-733행.
  - 상세: 모듈 독스트링은 fail-open, in-flight suppression, freshness 시계 3종 등 게이트의 거의 모든 뉘앙스를 촘촘히 설명하는데, 이번에 `_newest_resolved_impl_done_mtime` 안에 추가된 "BLOCK:NO 세션이 checker 의 [CRITICAL] 과 모순되면 stderr 경고" 동작은 호출부의 인라인 주석(722-727행)에만 설명돼 있고 모듈 독스트링에는 전혀 등장하지 않는다. 이 게이트를 처음 읽을 때 보통 참조하는 곳이 모듈 독스트링이라, 스스로 세운 완결성 기준에 비추면 한 줄이 아쉽다. 판정(block/allow) 자체를 바꾸는 동작은 아니므로 심각도는 낮음.
  - 제안: "Fresh impl-done consistency report" 절 뒤에 "이 판정 중 BLOCK:NO 세션이 checker 의 [CRITICAL] 과 모순되면 stderr 경고를 낸다(차단은 아님) — `_shared/block_integrity.py`" 정도 한 줄 추가.

- **[INFO]** `.claude/tests/README.md` 의 `test_block_integrity.py` 행이 "배선(호출부) 자체를 검증"하는 테스트 클래스를 언급하지 않음
  - 위치: `.claude/tests/README.md` (`test_block_integrity.py` 행) / 대응 테스트: `.claude/tests/test_block_integrity.py` `GateSurfacesTheContradictionTest`
  - 상세: 신설된 `GateSurfacesTheContradictionTest` 는 "predicate 만 테스트하면 호출부(`review_guard`)에서 그 호출을 지워도 GREEN"이라는, 이 저장소가 여러 차례 겪은 실패 유형(헬퍼 테스트 ≠ 호출부 테스트 — README 자신도 `test_consistency_bundle_priority.py` 행 등에서 이 패턴을 명시적으로 짚어 왔다)을 정확히 겨냥한다. 클래스 자신의 독스트링도 "That is the exact failure this backstop exists to prevent, one level up: a rule that nothing reads."라고 이를 명시한다. 그런데 README 행은 "Pins the predicate that finds them"까지만 적고 이 배선-검증 축은 요약에서 빠져 있다.
  - 제안: 행 끝에 "and that `review_guard` actually calls it (not just the predicate)" 정도를 덧붙이면 이 서브테스트 클래스의 존재 이유가 README 만 읽어도 드러난다.

## 요약

이번 diff 는 이 저장소의 평소 기준으로 봐도 매우 두텁게 문서화돼 있다. 신설 모듈(`block_integrity.py`, `retry_state.py`) 모두 "측정 후 작성" 원칙에 따라 실측 수치·근거·기각한 대안을 모듈 독스트링에 담았고, `review_guard.py` 의 새 호출부는 왜 경고이지 차단이 아닌지까지 인라인 주석으로 설명한다. 신설 테스트 2종(`test_block_integrity.py`, `test_retry_state_shared.py`)의 독스트링은 각 회귀의 배경(실제로 스택 트레이스 없이 사라졌던 stderr 알림 등)까지 설명하고, `.claude/tests/README.md` 도 새 테스트 2건을 빠짐없이 등재했다. 실제 검증(git show/session 파일 직접 대조 포함) 결과 지적할 만한 결함은 모두 경미했다 — 리팩터 중 함수 하나의 한 줄 독스트링이 조용히 소실됐고, 사건 인용 한 곳이 발생 세션과 탐지 세션을 섞었으며, 매우 상세한 모듈 독스트링 하나가 새로 생긴 부작용(stderr 경고)을 아직 반영하지 못했다. 가장 눈에 띄는 항목은 코드 자체가 아니라 plan 위생이다 — 같은 worktree 의 in-progress plan(`harness-review-gate-ci-backstop.md`)이 바로 이 PR 이 구현한 항목을 여전히 "미착수 backlog" 로 등재하고 있어, 다음에 그 plan 을 참고하는 사람이 이미 끝난 일을 다시 시작할 위험이 있다. CHANGELOG.md 는 이 저장소 관례상 `codebase/` 제품 변경 전용이라(전수 확인) 이번 harness-only 변경에는 해당 없음.

## 위험도

LOW
