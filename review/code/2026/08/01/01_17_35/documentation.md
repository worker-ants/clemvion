# 문서화(Documentation) Review

## 발견사항

- **[CRITICAL]** 신규 주석이 코드가 실제로 하는 일과 정반대를 주장한다 — 마커는 "노트 텍스트" 가 아니라 **위치(index)** 로 키가 만들어진다
  - 위치: `.claude/hooks/guard_review_before_stop.py:369-370` (주석) ↔ `:373` (코드)
  - 상세: 주석은 "The marker keys on the note text, so a DIFFERENT contradiction still gets through" 라고 명시적으로 단언한다. 그러나 실제 코드는
    ```python
    for idx, note in enumerate(...):
        marker = _marker_path(session_id, token, f"note{idx}")
        if _already_nudged(marker):
            continue
        _mark_nudged(marker)
        print(note, file=sys.stderr)
    ```
    이고, `_marker_path` 의 `kind` 인자는 `f"note{idx}"` — 즉 **enumerate 의 위치 인덱스**일 뿐 `note` 텍스트 자체는 마커 경로에도, 마커 파일 내용에도(`_mark_nudged` 는 빈 파일을 씀) 전혀 들어가지 않는다. `review_guard._newest_resolved_impl_done_mtime` 은 "게이트가 실제 채택하는 세션" 단 하나만 대조하므로 `notes` 는 사실상 0개 아니면 1개이고, 있으면 항상 `idx=0` 이다. 따라서: 오늘 세션 A 의 하향 경고가 `note0` 마커를 만들고 출력된 뒤, 같은 Claude 세션·같은 브랜치에서 **채택 세션이 세션 B 로 바뀌어 완전히 다른 하향 경고**가 `notes[0]` 에 들어와도, `note0` 마커가 이미 존재하므로 `_already_nudged` 가 True 를 반환해 **세션 B 의 경고는 조용히 억제된다** — 주석이 약속하는 정확히 반대의 동작이다. 이 backstop 이 이번 PR 전체의 존재 이유("하향이 조용히 게이트를 통과하는 것을 막는다")를 스스로 재현할 수 있는 지점이라 심각도가 높고, `test_block_integrity.py` 의 관련 테스트들(`AdvisoryReachesTheModelTest`/`NotesReachBothHooksTest`/`NotesSurviveBlockingTest`) 어디에도 "같은 인덱스·다른 텍스트" 시나리오를 검증하는 케이스가 없어 회귀를 잡지 못한다. (push 훅의 `_report_notes` 는 이런 스로틀이 아예 없어 매번 전체를 출력하므로 이 문제가 없다 — Stop 훅 한정.)
  - 제안: 주석을 실제 동작(위치 기반 1회 스로틀)에 맞게 정정하거나, "다른 하향은 반드시 통과시킨다" 는 속성이 실제로 필요하다면 마커 키에 노트 텍스트의 해시를 포함시켜 코드를 주석에 맞출 것. 어느 쪽이든 "같은 인덱스, 다른 텍스트" 픽스처를 테스트에 추가해 고정.

- **[WARNING]** `Outcome` 클래스 docstring 이 신규 `notes` 필드를 기술하지 않음
  - 위치: `.claude/hooks/_lib/failopen_state.py:37-44` (docstring), `:54` (신규 필드)
  - 상세: 클래스 docstring 은 `answered`/`bypassed`/`degraded` 세 필드를 각각 한 줄씩 설명하는 "필드 열거" 스타일을 스스로 채택하고 있다. 같은 diff 에서 추가된 `self.notes: list[str] = []` (54행, 위쪽에 별도 인라인 주석은 있음)는 이 열거에서 빠져 있어, docstring 만 읽으면 "이 클래스의 필드는 세 개가 전부" 로 오인하기 쉽다.
  - 제안: docstring 열거에 `notes — 판정을 바꾸지 않지만 모델에 반드시 전달돼야 하는 advisory` 한 줄 추가.

- **[WARNING]** `_evaluate_over_targets` docstring 이 이번 diff 로 추가된 세 번째 책임(advisory 수집)을 기술하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:810-827` (docstring), `:847-859` (신규 로직)
  - 상세: docstring 은 "Bridges two invariants that arrived from different directions and both have to survive" 라며 (1) fail-open 관측성, (2) per-target fail-open 두 가지만 명시적으로 열거한다. 이번 diff 에서 이 함수는 세 번째 책임 — 각 target 의 `result.notes` 를 `outcome.notes` 로 중복 제거하며 누적하는 로직(847-859행) — 을 새로 얻었지만 docstring 은 갱신되지 않아 "두 불변식을 잇는다" 는 서술이 이제 불완전하다.
  - 제안: docstring 에 세 번째 책임(advisory 전파)에 대한 짧은 문단 추가.

- **[WARNING]** `review_guard.py` 모듈 docstring("Policy") 이 새 하향-모순 backstop 을 전혀 언급하지 않음
  - 위치: `.claude/hooks/_lib/review_guard.py:1-89` (모듈 docstring, 특히 Gate 2 서술부)
  - 상세: 이 모듈의 docstring 은 Gate 1/Gate 2 판정 기준을 매우 세밀하게(freshness clock, in-flight suppression, resolution suppression 까지) 설명하는 사실상 "정책의 단일 진실" 문서다. 그런데 이번 diff 로 Gate 2 안에 새로 생긴 동작 — "게이트가 채택하는 세션이 자기 checker 의 `[CRITICAL]` 과 모순되면 non-blocking `notes` 를 반환한다" — 은 이 docstring 어디에도 나오지 않는다. `_newest_resolved_impl_done_mtime`/`ReviewDecision.notes` 자신의 개별 docstring 은 훌륭하지만, 모듈 최상단만 읽고 "이 게이트가 뭘 하는지" 파악하려는 독자는 이 backstop 의 존재를 놓친다.
  - 제안: "Policy" 섹션 끝 또는 Gate 2 서술 직후에 한 단락 추가 — notes 가 언제·왜 채워지는지, 어느 gate 에서만 나오는지.

- **[WARNING]** `test_consistency_orchestrator_state.py`(+ README 해당 행) 가 이번 PR 이 없앤 "중복" 아키텍처를 여전히 현재형으로 서술
  - 위치: `.claude/tests/test_consistency_orchestrator_state.py:3` (모듈 docstring), `.claude/tests/README.md:33` (해당 표 행) — 둘 다 이번 diff 의 직접 변경 대상은 아니지만, 이번 diff 가 그 서술을 무효화한 대상이다.
  - 상세: 이 테스트의 모듈 docstring 은 "The two orchestrators keep their state machines in lockstep by duplication (a convention their headers state)" 라고 현재형으로 단언하고, README.md 33행도 "Exists because the two orchestrators mirror each other by duplication" 이라 서술한다. 그러나 이번 diff 는 정확히 그 "복제(duplication)" 를 없애고 `_shared/retry_state.py` 위임으로 바꿨다 — 그리고 두 orchestrator 파일 상단에 있던 "Mirrors `X`. Change both." 주석(정확히 "a convention their headers state" 가 가리키는 그 관행)도 이번 diff 에서 함께 삭제됐다(코드 리뷰 스크립트 diff 의 `-    Mirrors \`consistency_orchestrator._reconcile_state_with_disk\`. Change both.` / consistency 스크립트 diff 의 대칭 삭제 참고). 즉 이 문장이 근거로 드는 "관행" 자체가 이제 존재하지 않는다. 테스트가 여전히 통과하는 이유(CLI 출력 계약은 그대로 유지됨)와 "왜 이 테스트가 존재하는가" 라는 서술은 별개이며, 후자가 stale 해졌다.
  - 제안: 두 곳 모두 "과거엔 손 복제였고 지금은 `_shared/retry_state.py` 로 통합됐지만, 이 테스트는 그 시절 계약(orchestrator 별 CLI 출력 차이)을 계속 지킨다" 정도로 갱신.

- **[INFO]** `merge_coordinator_orchestrator.py` 섹션 헤더 주석 "Mirror code_review_orchestrator" 가 4개 함수 중 3개엔 더 이상 정확하지 않음
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:80-82`
  - 상세: `_load_state`/`_save_state`/`_apply_status_update` 는 이제 `_shared/retry_state.py` 에 위임하는 것이지 진짜 "mirror"(손으로 복제)가 아니다 — 그 구분은 바로 아래(100-112행)의 새 주석이 정확히 설명하는데, 정작 그 위 섹션 헤더는 옛 표현("Mirror code_review_orchestrator so main never has to Read...")을 그대로 쓴다. `_emit_summary_state` 하나만 여전히 진짜 "mirror"(독립 구현)다.
  - 제안: "Mirror" → "Delegate to (see note below for the one exception)" 정도로 다듬기. 선택 사항.

- **[INFO]** push/stop 훅의 모듈 최상단 docstring 이 신규 non-blocking advisory(`notes`) 메커니즘을 언급하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:1-41`, `.claude/hooks/guard_review_before_stop.py:1-27`
  - 상세: 두 모듈 docstring 모두 hard gate/soft nudge 정책과 fail-open 관측성(§E)은 상세히 설명하지만, 이번 diff 로 추가된 "차단하지 않지만 모델에 반드시 도달해야 하는 advisory" 개념은 등장하지 않는다. `_report_notes` 및 관련 로직 자체의 함수 docstring 은 훌륭해서 실질 위험은 낮지만, 최상단만 읽는 독자는 이 기능의 존재를 놓친다.
  - 제안: 각 모듈 docstring 에 한두 문장 추가. 우선순위 낮음.

## 요약

이번 diff 의 신규 핵심 모듈(`_shared/block_integrity.py`, `_shared/retry_state.py`)과 신설 테스트(`test_block_integrity.py`, `test_retry_state_shared.py`), 그리고 `.claude/tests/README.md`·`plan/in-progress/harness-review-gate-ci-backstop.md`·`consistency-summary.md`·`consistency-checker/SKILL.md` 갱신은 문서화 관점에서 이례적으로 우수하다 — 모든 정규식·자료구조 선택에 실측 수치(732개 세션, 3.3%, +0.39초 등)를 근거로 남기고, 여러 문서(모듈 docstring·테스트 docstring·README 행·plan 기록) 간 수치와 서술이 정확히 일치한다. 다만 정밀 대조 결과 한 곳에서 **신규 주석이 코드의 실제 동작과 정반대를 주장**하는 문제(Stop 훅의 노트-스로틀 마커가 "텍스트" 가 아니라 "위치" 로 키가 만들어짐)를 발견했으며, 이는 이 PR 이 막으려는 "조용한 하향 통과" 와 같은 성격의 실패를 이 backstop 자체 안에 재도입할 수 있어 우선 수정이 필요하다. 그 외에는 이번 diff 로 필드/책임이 늘어난 몇몇 클래스·함수의 docstring 이 그 확장을 반영하지 못했고(열거형 docstring 이 신규 필드를 누락, "두 불변식" 서술이 이제 세 번째를 놓침), 이번 PR 이 없앤 "orchestrator 간 손 복제" 관행을 여전히 현재형으로 서술하는 인접 테스트 파일이 하나 있다 — 모두 국지적이고 고치기 쉬운 수준이다. README/CHANGELOG/환경변수 문서 갱신은 이 저장소의 기존 관례(하네스 전용 변경은 CHANGELOG.md 비대상, 순수 내부 리팩터는 SKILL.md/README 비대상)와 일치해 누락이 아니다.

## 위험도
MEDIUM
