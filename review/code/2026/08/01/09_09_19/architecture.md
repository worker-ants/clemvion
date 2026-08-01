# Architecture Review — round 9

대상: `.claude/_shared/block_integrity.py`, `.claude/_shared/retry_state.py`,
`.claude/agents/consistency-summary.md`, `.claude/hooks/_lib/failopen_state.py`,
`.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_push.py`,
`.claude/hooks/guard_review_before_stop.py`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/skills/consistency-checker/{SKILL.md,scripts/consistency_orchestrator.py}`,
`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`,
`.claude/tests/**`, `plan/in-progress/harness-review-gate-ci-backstop.md`.

프롬프트가 잘라낸 대용량 파일(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`,
`test_block_integrity.py`, `.claude/tests/README.md`)과 부분 절단된
`merge_coordinator_orchestrator.py` 는 모두 `Read` 로 전문을 직접 열어 확인했다.
아래 위치는 전부 실제 소스 파일의 1-기준 줄 번호(Read/grep 로 재확인함)이며,
프롬프트 조립 문서의 오프셋이 아니다.

## 발견사항

- **[WARNING]** 3개 orchestrator 가 공유해야 할 "state 머신" 계약이 하나만 불완전 이행 — 암묵적 인터페이스라 drift 가 code review 로만 잡힘
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:88-125`(주석+`_emit_summary_state`), `:535-544`(`--resume` 핸들러) — 대조군: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:197-198,1415`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:101-102,898`
  - 상세: `_shared/retry_state.py` 추출로 `_load_state`/`_save_state`/`_apply_status_update` 는 세 orchestrator 모두 동일 위임으로 정리됐다. 그러나 `reconcile_state_with_disk` 는 code-review·consistency 두 orchestrator만 `--resume`/`--summary-state` 경로에서 호출하고(디스크의 산출물로 자가 치유), `merge_coordinator_orchestrator.py` 는 `_emit_summary_state`(113-125행)에서 `_load_state` 만 부르고 reconcile 를 부르지 않으며, `--resume` 핸들러(535-544행)도 마찬가지다. 세 파일이 "같은 모양의 CLI 계약(`--resume`/`--summary-state`/`--update`)을 갖는 orchestrator" 라는 암묵적 인터페이스를 공유하는데, 이를 강제하는 ABC/Protocol 이 없어 한 구현만 약한 계약을 갖는 상태가 코드만 봐서는 드러나지 않는다. 실제로 이 파일 자신의 주석(91-94행)이 "이전 버전의 이 주석이 `_apply_status_update` 를 '다르다' 고 잘못 적었다" 고 자백하고 있어, 사람이 수작업 AST 대조로 계약 일치를 확인하는 방식 자체가 이미 한 번 틀렸다는 증거가 코드에 남아 있다. `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 #9 로 이미 추적·의도적 defer(별도 skill 의 동작 변경이라 이 브랜치 범위 밖) 되어 있어 은폐된 문제는 아니지만, 상태는 여전히 유효하다 — Agent tool 로 fan-out 한 merge-coordinator 세션은 `_retry_state.json` 이 prepare 스냅샷에 멈춘 채 SUMMARY 는 실제 성공을 보고할 수 있다.
  - 제안: `plan` 문서의 defer 대로 별도 PR 로 `merge_coordinator_orchestrator.py` 에도 `reconcile_state_with_disk` 위임을 추가할 것. 장기적으로는 세 파일이 반복하는 `_load_state`/`_save_state`/`_apply_status_update`/`_emit_summary_state` 래퍼 자체를 얇은 클래스(예: `RetryStateOrchestratorMixin` 또는 `typing.Protocol`)로 명시해, "이 세 orchestrator 는 이 메서드 집합을 반드시 구현한다" 는 계약이 AST 수작업 비교가 아니라 코드/테스트로 강제되게 할 것.

- **[WARNING]** `push_blocks` 를 공유하는 "게이트 판정" 계약이 duck-typing 뿐 — 동일 결함(누락 시 사일런트 fail-open)이 테스트에서 이미 2회 재발 확인됨
  - 위치: `.claude/hooks/_lib/review_guard.py:174-195`(`ReviewDecision.push_blocks`), `.claude/hooks/_lib/plan_guard.py:77-95`(`PlanDecision.push_blocks`), 호출부 `.claude/hooks/guard_review_before_push.py:809-883`(`_evaluate_over_targets`, 특히 874행 `result.push_blocks`)
  - 상세: `_evaluate_over_targets` 는 `evaluate_review`/`evaluate_plan` 중 어느 쪽이 오든 `result.push_blocks` 로 균일하게 판정한다(설계 의도 자체는 합리적 — `review_guard.py:190-193` 주석이 "필드명을 몰라도 되게" 라고 명시). 문제는 이 "게이트 판정" 계약(`blocked`/`reason`/`notes`/`push_blocks`) 이 `typing.Protocol`/ABC 로 선언돼 있지 않고 관례로만 공유된다는 것. `.claude/tests/test_block_integrity.py:612-623`(`PlanStubsMirrorTheRealInterfaceTest`)의 docstring 이 스스로 "Found twice, in two files, the same way" 라고 적어, 손으로 만든 `evaluate_plan`/`evaluate_review` 스텁이 `push_blocks` 를 빠뜨려 `AttributeError` → 최상위 `except Exception` 이 fail-open 으로 삼켜 테스트가 "잘못된 이유로" 통과한 사고가 이미 두 번 일어났다고 기록돼 있다. 지금은 이를 막기 위해 소스 텍스트를 `ast` 로 파싱해 모든 스텁 리터럴이 `push_blocks` 문자열을 포함하는지 감사하는 별도 테스트(`test_every_plan_stub_defines_push_blocks`)를 유지보수해야 하는 상태 — 타입 시스템이 잡아줄 수 있는 것을 수작업 감사 테스트가 대신하고 있다.
  - 제안: `GateDecision(Protocol)` 같은 최소 프로토콜(`blocked: bool` 또는 등가, `reason: str`, `notes: tuple[str, ...]`, `push_blocks: bool`)을 `_lib` 공용 위치에 선언하고 `ReviewDecision`/`PlanDecision`(및 테스트 스텁)이 이를 명시적으로 따르게 하면, 새 스텁이 `push_blocks` 를 빠뜨렸을 때 실행 시점(또는 정적 분석)에서 바로 드러나 `test_every_plan_stub_defines_push_blocks` 류의 AST 감사 테스트가 불필요해진다.

- **[WARNING]** `build_files_section` 하나가 예산 전략 3개를 담당 — 같은 불변식이 라운드마다 다른 분기에서 재발한 이력이 있는 정확히 그 구조 (이미 추적된 후속이나 재확인 가치 있음)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:509-709` (특히 무예산 분기 568-575행, header+diff 초과 분기 580-619행, 콘텐츠 배분 분기 621-709행)
  - 상세: 세 분기 모두 "안내문(omission notice)도 예산에 포함시켜야 한다" 는 동일 불변식을 각자 손으로 재구현한다(`_charge_notice` 헬퍼가 있지만 호출 시점·방식이 분기마다 다름 — 596행의 `overflow` 계산과 642-644행의 사전 예약+환불 패턴은 서로 다른 전략). `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 #1·#3 이 스스로 인정하듯, 정확히 이 함수의 다른 분기에서 같은 클래스의 결함(안내문 길이 미계상)이 최소 두 차례(3R, 그리고 diff-only 분기의 기존 결함) 재발했다 — "한 경로를 고쳤는데 다른 규모에서 같은 클래스가 다시 나옴" 이라는 서술 그대로다. 이는 함수 하나의 크기 문제가 아니라, 공유돼야 할 불변식이 구조적으로 강제되지 않고 각 분기의 기억에 의존한다는 SRP 위반의 직접적 증거.
  - 제안: 이미 후속 #3 에 적힌 대로 `_render_unbounded`/`_render_diff_only_overflow`/`_allocate_content_budget` 로 분리하고, "안내문도 예산에서 뺀다" 는 계상을 단일 헬퍼(예: 예산을 감싸는 작은 accumulator 객체)로 강제해 분기가 그 계상을 잊는 것 자체가 불가능하게 만들 것.

- **[INFO]** `.claude/hooks/_lib/` 와 `.claude/skills/_lib/` 가 같은 최상위 모듈명(`_lib`)을 가진 별개 패키지 — 이름 공간 충돌이 실제 코드 공유를 막는 구조적 원인
  - 위치: `.claude/hooks/_lib/__init__.py`(hook 전용: `branch_guard`/`plan_guard`/`review_guard`/`failopen_state`), `.claude/skills/_lib/__init__.py`(skill 전용: `project_config`) — 영향 사례: `.claude/hooks/_lib/review_guard.py:219-232`(`_default_branch`), `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1128-1149`(`_default_branch_ref`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `args.diff_base or "origin/main"` 리터럴 — 기본 브랜치 판정 로직이 4곳에 독립 구현된 것도 이 충돌이 뿌리(plan 문서 "신규 후속(defer)" 항목이 동일하게 지목).
  - 상세: 두 패키지가 동일 이름이라 `sys.path` 삽입 순서에 따라 어느 쪽이 import 되는지 갈리고, 이 프로젝트의 하네스 테스트 최소 4개(`test_review_changeset_warning.py` 주석이 명시, plan 문서 후속 #12 가 그 목록을 나열)가 이를 피하려고 `importlib.util.spec_from_file_location` + subprocess 기반 "fresh interpreter" 우회를 반복 구현해야 했다. `_shared/`(block_integrity.py, retry_state.py, report_paths.py) 는 이 충돌을 피하려고 `_lib`/`lib` 에 전혀 의존하지 않는 잎(leaf) 모듈로 설계돼 있다 — 이는 건전한 회피이지만 회피이지 해결은 아니며, hook 계층과 skill 계층 사이의 실제 코드 공유(예: 4곳에 흩어진 "origin 기본 브랜치 해석")를 여전히 가로막는다. 이번 diff 가 새로 만든 문제는 아니지만, 이번 diff 의 DRY 노력(`_shared/` 신설)이 정확히 이 제약 때문에 hook/skill 경계를 넘는 중복(기본 브랜치 해석 4중 구현)까지는 해소하지 못했다는 점에서 이 라운드의 아키텍처 평가에 직접 관련된다.
  - 제안: (plan 문서가 이미 별도 범위로 defer 함에 동의) 두 `_lib` 중 하나를 고유 이름(예: `hooks/_lib` → `hooks/_hooklib`)으로 개명하거나, 둘 다 `.claude` 를 루트로 하는 절대 패키지 경로(`claude._shared`, `claude.hooks._lib` 등)로 전환해 `sys.path` 삽입 순서에 의존하지 않게 할 것. 그 후에야 4중 구현된 기본 브랜치 해석을 하나로 합칠 수 있다.

- **[INFO]** `review_guard.py` 가 "리뷰 커버리지 판정" 외에 범용 glob 컴파일러를 내장 — 응집도 관점의 추출 후보
  - 위치: `.claude/hooks/_lib/review_guard.py:573-714` (`_MAX_GLOB_WILDCARDS`, `_glob_to_regex`, `_parse_frontmatter_code`, `_spec_code_patterns`, `_spec_linked_changes`)
  - 상세: 이 모듈은 이제 (1) checkout/rebase-immune 시각 계산, (2) 코드 리뷰 커버리지 게이트, (3) spec `code:` glob → regex 컴파일이라는 세 가지 성격이 다른 관심사를 1,045줄 한 파일에 담고 있다. glob 컴파일 부분은 지수 백트래킹까지 신경 써서 만든(8R CRITICAL 수정, `_MAX_GLOB_WILDCARDS=6` 상한) 독립적이고 재사용 가능한 유틸리티인데, "이 브랜치가 변경한 코드가 어떤 spec 표면을 구현하는가" 라는 질문에 답할 다른 게이트가 앞으로 생겨도 지금은 `review_guard.py` 내부에 갇혀 있다.
  - 제안: 급하지 않음(SRP 위반이 당장 결함을 유발하고 있지는 않음). `_glob_to_regex`/`_parse_frontmatter_code`/`_spec_code_patterns` 를 `_lib/spec_code_glob.py` 같은 별도 모듈로 옮기면 응집도가 오르고, 향후 동일 질문이 필요한 다른 게이트가 이를 재사용하기 쉬워진다.

- **[INFO]** 라운드 7/8 이차(quadratic) 정규식 수정의 완전성을 독립 검증 — 잔여 인스턴스 없음, 회귀 테스트도 vacuous 하지 않음
  - 위치: `.claude/_shared/block_integrity.py:97-102`(`_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`), 커밋 `54fff611f`; 회귀 테스트 `.claude/tests/test_block_integrity.py:470-546`(`VerdictParserStaysLinearTest`)
  - 상세: `git show 54fff611f -- .claude/_shared/block_integrity.py` 로 실제 diff 를 열어 확인한 결과, 7R 이 손대지 않고 남겼던 "BLOCK:" 리터럴 직후의 `\s*\**\s*`(무제한 quantifier 2개, 사실상 항상 비는 것 하나 사이에 낀 구조)가 8R 에서 `_BLOCK_AT_LINE_START`·`_BLOCK_AT_LINE_END` **두 패턴 모두** 동일하게 단일 quantifier `[ \t*]*` 로 교체돼, 같은 클래스의 잔여 인스턴스가 남아있지 않다. 회귀 테스트는 결함별로 서로 다른 입력 크기를 쓴다 — 선행 클래스(개행 넘는 `\s`)는 20,000줄, 내부 gap 클래스("BLOCK:" 뒤 공백 반복)는 45,000자 — 이며, 테스트 파일 자체 주석(487-495행)이 "한 결함에 맞춘 크기를 다른 결함에 재사용하면 그대로 vacuous 해진다" 는 8R 커밋 메시지의 자기반성을 그대로 코드 주석으로 남겨, 크기를 공유해 재발하는 것을 구조적으로 막고 있다. 세 서브테스트가 (a) `BLOCK:` 자체가 없는 입력 (b) `BLOCK:` 는 있고 판정이 없는 긴 gap (c) 판정 뒤 긴 trailing run 을 각각 겨냥해 START/END 두 패턴의 두 gap 을 모두 커버하며, 측정은 in-process 경과시간이 아니라 subprocess+hard timeout 방식이라(484행 주석) CPython C-level `re` 백트래킹이 시그널을 무시해 단언이 무력화되는 문제도 피한다.
  - 제안: 없음(확인 목적). 다만 향후 이 파일의 정규식을 다시 건드릴 때, `_LINES=20_000`/`_RUN=45_000` 두 상수를 새 결함에 그대로 재사용하지 말고 반드시 재측정할 것 — 이번 라운드가 검증한 바로 그 교훈이다.

## 요약

이번 변경은 세 orchestrator 가 손으로 맞춰 온 상태-머신 부기(`_shared/retry_state.py`)와 두 훅이 각각 구현하던 fail-open 관측(`_lib/failopen_state.py`), 그리고 "SUMMARY 의 `BLOCK:` 이 checker 의 `[CRITICAL]` 을 하향하는지" 를 코드로 대조하는 새 백스톱(`_shared/block_integrity.py`)을 도입한다. 세 모듈 모두 하위 계층(`_shared/`)이 상위 계층(`hooks/`, `skills/`)에 의존하지 않는 올바른 방향의 계층화를 유지하고, 순환 의존은 발견되지 않았다(`review_guard.py` → `branch_guard.py`/`_shared/*` 단방향 확인). 정규식 결함 수정(라운드 7/8)은 독립 검증 결과 두 패턴 모두 완전히 닫혔고 회귀 테스트도 결함별로 다른 크기를 실측해 vacuous 하지 않다. 다만 DRY 리팩터가 세 orchestrator 중 하나(`merge_coordinator`)에는 아직 완전히 적용되지 않았고(추적됨, defer 는 타당함), `push_blocks` 로 대표되는 "게이트 판정" 계약이 명시적 Protocol 없이 관례로만 공유돼 이미 두 차례 같은 방식으로(스텁 누락 → fail-open 오통과) 재발한 이력이 있으며, 파일 예산 조립 로직(`build_files_section`) 은 여러 라운드에 걸쳐 같은 불변식이 다른 분기에서 반복 위반된 SRP 취약점을 그대로 안고 있다(이미 후속 항목으로 등재). `hooks/_lib` 와 `skills/_lib` 의 이름 공간 충돌은 이번 diff 가 만든 문제는 아니지만 이번 DRY 노력이 hook/skill 경계를 완전히 넘지 못한 구조적 원인으로 계속 작용한다. 전반적으로 근거·실측이 충실하고 이미 발견된 구조적 부채는 문서(plan)로 잘 추적되고 있어, 신규로 열어야 할 위험은 낮다.

## 위험도

LOW
