# Documentation Review — harness-block-backstop

## 발견사항

- **[WARNING]** 신규 "하향-모순 백스톱" 경고의 적용 범위가 정책 문서 서술보다 좁다 — `--impl-done` 세션에 한정된다는 제약이 문서에 없음
  - 위치: `.claude/agents/consistency-summary.md:49-53` (§요약 지침 3 인용문), `.claude/skills/consistency-checker/SKILL.md:113-116` (§4 BLOCK 처리)
  - 상세: 코드를 추적하면 `block_integrity.contradiction_note()`는 저장소 전체에서 **단 한 곳**, `.claude/hooks/_lib/review_guard.py`의 `_newest_resolved_impl_done_mtime()`에서만 호출된다. 그런데 그 함수는 `evaluate_review()`의 `if spec_linked:` 분기 안(Gate 2)에서만 실행되고, 그 안에서도 `_is_impl_done_session()`으로 걸러 **`--impl-done` 모드 세션만** 대조한다. 즉 이번 push/턴이 spec-linked 코드를 건드리지 않거나, 문제의 consistency 세션이 `--spec`/`--plan`/`--impl-prep` 모드였다면 이 백스톱은 아예 발화하지 않는다. 그러나 두 문서의 해당 문장은 "이제 게이트가 checker 의 `[CRITICAL]` 과 모순되면 경고를 냅니다"처럼 범위 한정 없이 일반화해 서술한다 — 이 프롬프트(consistency-summary.md)를 읽는 에이전트나 SKILL.md 를 읽는 developer 가 "모든 `/consistency-check` 호출은 이제 기계적으로 감시된다"고 오해할 여지가 있다. (다행히 두 문서 모두 "이 금지 조항이 여전히 1차 방어"라고 명시해 완전한 안전 오신은 아니지만, 그 자체가 바로 이 기능이 없애려던 "조용한 하향" 클래스를 정확히 어디까지 막는지는 불명확하다.)
  - 제안: 두 문장에 범위 한정 절 추가. 예: "(현재는 `--impl-done` 세션이 push/turn-end 게이트의 Gate 2 로 채택될 때만 발화합니다 — `--spec`/`--plan`/`--impl-prep` 세션이나 spec-linked 변경이 없는 `--impl-done` 세션의 하향은 아직 이 기계적 경고 대상이 아니며 본 금지 조항에만 의존합니다.)"

- **[INFO]** `retry_state.load_state()` 에 docstring 이 없음 — 같은 파일의 형제 함수 4개는 모두 있음
  - 위치: `.claude/_shared/retry_state.py:41` (`load_state` 함수)
  - 상세: 이 파일은 세 orchestrator 가 공유하는 단일 정본으로 신설됐고, `save_state`(45-63행)·`reconcile_state_with_disk`(78-116행)·`emit_summary_state`(119-155행)·`apply_status_update`(158-182행)는 모두 근거·계약을 설명하는 docstring 을 갖췄다. 유독 `load_state`만 없다. 특히 `load_state`는 `_retry_state.json`이 없으면 stderr 메시지를 찍고 `sys.exit(1)`로 하드 실패하는, 호출자가 알아야 할 계약을 갖고 있는데 이 부분이 이름만으로는 드러나지 않는다.
  - 제안: 한 줄 docstring 추가. 예: `"""Load _retry_state.json, or exit(1) with a stderr message if the session directory has none yet."""`

- **[INFO]** `.claude/tests/README.md`의 `test_block_integrity.py` 행이 "배선(wiring)" 검증 클래스를 언급하지 않음
  - 위치: `.claude/tests/README.md` (`test_block_integrity.py` 행, 표의 마지막 부분 — `test_retry_state_shared.py` 행 바로 위)
  - 상세: 새 행은 `CountCriticalTagsTest`/`VerdictIsAnchoredTest`/`DowngradedCriticalsTest`가 다루는 판정 predicate 설명에는 충실하지만, `test_block_integrity.py` 자체의 `GateSurfacesTheContradictionTest`(자기 docstring: "`review_guard` must actually CALL the check — not merely be able to... a rule that nothing reads")와 `AdvisoryReachesTheModelTest`/`NotesReachBothHooksTest`(경고가 올바른 스트림 — push 는 exit code 별 stdout/stderr, stop 은 항상 stderr — 에 실제로 도달하는지)가 검증하는 "배선" 속성은 언급하지 않는다. 이 README 는 다른 행(`test_stop_guard_failopen.py`, `test_review_guard_hardening.py` 등)에서 predicate 뿐 아니라 실제 배선 검증도 명시적으로 강조하는 관례를 갖고 있어, 이 행만 그 관례에서 벗어난다.
  - 제안: "게이트(`review_guard`)가 이 predicate 를 실제로 호출하는지, 그리고 경고가 훅별 올바른 스트림(push: exit code 별 stdout/stderr, stop: 항상 stderr)에 도달하는지"를 한 문장 추가.

## 확인했으나 문제 없음 (참고)

- **CHANGELOG.md**: 이 저장소의 확립된 관례상 `CHANGELOG.md`는 `codebase/`+`spec/` 제품 변경 전용이며 `.claude/` 하네스 변경은 과거 이력 전체에서 단 한 번도 기록된 적이 없다(`git log`로 확인). 이번 diff 는 하네스 전용이므로 CHANGELOG 갱신 누락은 결함이 아니다.
- **`_BLOCK_LINE` 중복 제거 확인**: 이전 리뷰 라운드(`review/code/2026/07/31/18_16_48`, `19_03_11`)가 지적했던 `_BLOCK_LINE` 정규식이 `block_integrity.py`와 `review_guard.py` 양쪽에 중복 존재하던 문제, 그리고 좌측-최우선 매칭이 override 배너보다 앞선 stale 판정을 잘못 채택하던 결함 모두 이번 diff 에서 이미 해소됐다(`review_guard.py`는 이제 `_block_integrity.summary_block_verdict()`를 위임 호출하고, 그 함수는 `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`로 두 형태를 모두 앵커링한다). 재발 없음.
- **모듈 docstring ↔ 테스트 docstring ↔ README 행 ↔ plan 문서 간 수치 일치**: "732 세션 / 698 일치 / 24 하향(3.3%) / 10 반대방향", "400개 리포트 중 bare CRITICAL 242회 대 실제 태그 72회" 수치가 `block_integrity.py`, `test_block_integrity.py`, `.claude/tests/README.md`, `plan/in-progress/harness-review-gate-ci-backstop.md` 네 곳에서 모두 일치한다. 모범적인 교차 일관성.
- **plan 문서 위생**: `plan/in-progress/harness-review-gate-ci-backstop.md`가 완료된 항목(#2)을 취소선 + "구현 완료" 각주로, 새로 발견된 후속(#9)을 이어지는 번호로, 자기 자신의 과거 오분석("`_apply_status_update`가 다르다"던 서술)을 정정 각주로 남기는 등 이력 보존과 정확성을 모두 지켰다. 번호 체계에 누락/중복 없음.
- **`.claude/agents/consistency-summary.md` / `SKILL.md` 문구 갱신**: "`review_guard.py`는 `BLOCK:` 한 줄만 파싱" 이라는 옛 서술을 "게이트는 판정을 `BLOCK:` 줄로 읽으므로... (이제 모순되면 경고)"로 정확히 갱신했고, 실제 코드 동작과 일치.
- **`merge_coordinator_orchestrator.py`의 의도적 미이관**: 이 파일의 `_reconcile_state_with_disk` 부재는 코드 주석(100-112행)이 "다른 skill 의 동작 변경이라 별도 PR 로 분리"라고 명시하고, plan 문서 항목 #9 로 추적된다 — 조용히 누락된 것이 아니라 의식적 스코프 결정.

## 요약

이번 diff는 문서화 품질이 전반적으로 높다. 신규 모듈(`block_integrity.py`, `retry_state.py`)의 module/함수 docstring 이 "왜"를 실측치와 함께 설명하고, 그 수치가 테스트 docstring·README 카탈로그 행·plan 추적 문서 네 곳에서 서로 어긋남 없이 일치하며, 과거 리뷰가 지적한 `_BLOCK_LINE` 중복·앵커링 결함도 이번 diff 안에서 이미 해소됐다. 정책 프롬프트(`consistency-summary.md`, `SKILL.md`)의 옛 서술("`BLOCK:` 한 줄만 파싱")도 실제 코드에 맞게 정확히 갱신됐다. 다만 그 갱신된 문구가 신규 백스톱을 범위 한정 없이 일반화해, 실제로는 `--impl-done` + spec-linked 변경이 있는 세션에만 국한된다는 제약을 감춘다(WARNING) — 백스톱이 advisory-only 이고 두 문서 모두 "여전히 1차 방어는 프롬프트 규약"이라고 명시하므로 실질 위험은 제한적이다. 그 외에는 새로 추출된 공유 모듈의 함수 하나가 형제들과 달리 docstring 이 없는 점, README 카탈로그 행이 테스트의 "배선 검증" 측면을 언급하지 않는 점 정도의 사소한 완결성 개선 여지만 남는다.

## 위험도

LOW
