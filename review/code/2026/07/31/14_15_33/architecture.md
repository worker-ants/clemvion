# Architecture Review

## 발견사항

- **[WARNING]** `evaluate_review()` 가 push(hard block)/Stop(soft nudge) 두 개의 서로 다른 보증 수준을
  boolean flag 하나(`in_flight_ok`)로 스위칭한다.
  - 위치: `.claude/hooks/_lib/review_guard.py:862-864` (시그니처 `def evaluate_review(cwd=None, *, in_flight_ok=False)`), `:901` (`if in_flight_ok and _code_review_in_flight(repo_root):`)
  - 상세: 같은 함수를 push guard(`guard_review_before_push.py`, kwarg 미전달 → 기본값 `False`)와 Stop guard(`guard_review_before_stop.py:344`, `in_flight_ok=True` 명시 전달) 양쪽이 호출한다. 두 guard 가 요구하는 보증 수준(하드 차단 vs 넛지)이 정반대인데, 그 차이가 타입/시그니처가 아니라 **호출자가 기본값을 기억하는지**에 의존한다 — 실제로 이 PR 이 고친 버그 자체가 "이 suppression 이 무조건이어서 push 게이트까지 30분간 열렸다"였다. `EvaluateInFlightShortCircuitTest`(양방향)와 `test_push_never_opts_into_the_in_flight_concession`/`test_stop_passes_in_flight_opt_in` seam 테스트로 현재는 봉쇄돼 있고 기본값도 안전한 방향(엄격)이라 당장 위험하지는 않지만, 세 번째 호출부가 생기면 다시 "기본값을 안 잊었는지"에 의존하게 된다. 이 PR 자신의 후속 plan(`plan/in-progress/harness-review-gate-ci-backstop.md` 항목 5)도 정확히 이 문제를 지적하며 `evaluate_review_for_push()`/`_for_stop()` 얇은 wrapper 로 시그니처 레벨에서 차단할 것을 제안하고 defer 상태다.
  - 제안: 이미 tracked 된 backlog 항목 그대로 — 두 개의 명시적 진입점(`evaluate_review_for_push`/`evaluate_review_for_stop`)으로 분리하고 내부에서만 공유 로직을 호출. 최소한 우선순위를 당겨서 다음 라운드에 반영 검토.

- **[WARNING]** `build_files_section` 한 함수가 예산 전략 4갈래(무제한/헤더+diff 초과/콘텐츠 예산 배분/집계 fallback)를 누적하며 이번 PR 에서 115→186줄(+62%)로 더 커졌다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587-773`
  - 상세: 4개 분기(632-639 무제한, 644-685 diff-only overflow, 687-736 콘텐츠 예산 배분, 738-771 집계 fallback)가 각각 "생략 안내문 자체도 예산에서 차감해야 한다"는 같은 불변식을 서로 다른 산술로 따로 구현한다(662행 `overflow = base_size + len(global_note) - max_total_size`, 708행 `remaining_budget -= sum(_notice_cost(i) ...)`, 754-771행 별도 재렌더링). 이 구조는 이 PR 자신이 작성한 후속 plan(`plan/in-progress/harness-review-gate-ci-backstop.md` 항목 1, 3)에서 "3R CRITICAL 이 정확히 이 구조에서 재발했다"고 이미 자인하고 `_render_unbounded`/`_render_diff_only_overflow`/`_allocate_content_budget` 분리 + 예산 계상 단일 헬퍼 공유를 제안했으나, 이번 라운드(정확히 이 확장을 도입한 라운드)에서도 추출을 적용하지 않았다 — 추적된 부채가 그 부채를 늘리는 바로 그 커밋에서도 해소되지 않은 상태다.
  - 제안: 최소한 "안내문 길이를 예산에서 뺀다"는 계상 로직만이라도 헬퍼 하나(`_charge_notice(remaining, note)` 류)로 뽑아 4곳의 중복 산술을 제거. 전체 함수 분리는 다음 라운드로 미루더라도 이 계상 중복만은 이번에 닫는 편이 향후 회귀(3R 처럼) 재발 확률을 낮춘다.

- **[WARNING]** "기본 브랜치/base ref 해석"이 이 PR 로 최소 3곳(문서상 4곳)에 독립 구현된 채 늘어났다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1190-1201` (신설 `_default_branch_ref()`) vs `.claude/hooks/_lib/review_guard.py:201-214` (`_default_branch()`) vs `.claude/hooks/_lib/branch_guard.py:73` (`_origin_default_branch()`); `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:449` 의 인라인 리터럴 `args.diff_base or "origin/main"` 도 사실상 5번째 변형.
  - 상세: 세 함수의 반환 계약이 다르다 — `_default_branch_ref()`/consistency 쪽은 `origin/main` 형태의 fully-qualified ref, `review_guard._default_branch()`는 로컬 `main`/`master` 이름. 이번 PR 은 이 중복을 줄이는 대신 `code_review_orchestrator.py` 에 새 구현을 하나 더 추가해 늘렸다. 이미 같은 plan 문서("신규 후속 (defer)" 섹션)가 "기본 브랜치 정책이 바뀌면 4곳을 모두 고쳐야 하는 drift 위험" 으로 지목하고, `_lib` 네임스페이스 충돌 해소가 선행돼야 한다는 이유로 defer 해 두었다.
  - 제안: 기존 defer 결정 유지하되, 앞으로 5번째 변형이 추가되지 않도록 최소한 "새 base-ref 해석 로직을 짤 때는 반드시 기존 3곳을 먼저 확인" 하는 코드 주석/컨벤션 문서화를 권장.

- **[WARNING]** git 브랜치-diff 파일 목록 헬퍼가 두 orchestrator 에 사실상 동일 코드로 중복된다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:255-278` (신설 `_branch_changed_rels`) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:997-1004` (기존 `get_git_branch_diff_files`)
  - 상세: 둘 다 `git diff --no-renames --name-only <ref>...` 을 실행해 변경 파일 목록을 얻는, 목적과 플래그가 동일한 함수다. `_branch_changed_rels` 의 docstring 이 "Mirrors `code_review_orchestrator.get_git_branch_diff_files` — change both" 라고 스스로 명시하는데, 이는 이 저장소가 이미 한 번 겪은 실패 패턴이다 — `.claude/_shared/report_paths.py` 의 모듈 docstring 자체가 "두 곳이 각자 사본을 들고 'change both' 주석 뒤에 숨었다가 실제로 한 PR 안에서 어긋났다"는 사례를 근거로 그 파일을 만든 이유를 설명한다. 이번 PR 은 정확히 같은 패턴(주석으로 동기화를 약속하는 두 번째 사본)을 branch-diff 헬퍼에 재생산했다.
  - 제안: `report_paths.py` 처럼 `.claude/_shared/` 아래 공유 헬퍼로 승격 검토. 당장 `_lib` 네임스페이스 충돌 때문에 어렵다면, 최소한 이번 PR 의 두 함수 docstring 에 있는 "change both" 주석을 실제 diff 리뷰 체크리스트(예: PROJECT.md 변경 시 동반 갱신 매트릭스)에 등록해 두 곳이 실제로 함께 리뷰되도록 강제하는 편이 안전하다.

- **[INFO]** 위 두 중복(#3, #4)의 공통 근본 원인 — 동일 이름 `_lib` 패키지가 저장소에 병존한다.
  - 위치: `.claude/hooks/_lib/` 와 `.claude/skills/_lib/` (참고: `.claude/workflows/_lib/` 는 JS 라 무관)
  - 상세: 이 PR 이 신설한 테스트 3개(`test_consistency_bundle_priority.py`, `test_prompt_omission_notice.py`, `test_review_changeset_warning.py`) 모두 각자의 모듈 docstring 에서 "importing the orchestrator in-process collides on the name `_lib`" 를 이유로 subprocess 기반 fresh-interpreter 격리(`run_in_orchestrator`/`_PREAMBLE`, 약 35줄)를 채택했다고 명시한다 — 기존 관례(`test_consistency_context_budget.py`)를 복제한 것으로, 이번 PR 로 그 보일러플레이트 사본이 최소 4개 파일로 늘었다(같은 plan 문서 항목 7 에 정확히 이 숫자로 기록돼 있다). `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 가 `sys.path.insert(0, CODE_REVIEW_SKILL)` 로 `code-review-agents/lib` 를 직접 참조하는 기존 커플링(이 PR 범위 밖, pre-existing)도 같은 네임스페이스 제약 아래서 "두 스킬이 독립이어야 하는데 한쪽이 다른 쪽의 암묵적 라이브러리 provider 가 되는" 구조를 강화한다.
  - 제안: 이 PR 의 범위는 아니지만(의도적으로 defer 된 선행 조건), 위 #3/#4 중복을 근본적으로 닫으려면 이 네임스페이스 충돌 해소가 실제 선행 과제라는 점을 재확인. 우선순위를 올릴 만한 시점 — 워크어라운드 사본이 이미 4곳으로 늘었다.

- **[WARNING]** "Critical 하향 금지 + 권한 밖 인계" 불변식이 프롬프트 지침으로만 존재하고, 기계적 게이트에는 대응하는 교차검증이 없다.
  - 위치: 정책 정의 — `.claude/agents/consistency-summary.md:46-57` (§요약 지침 3·4), `.claude/skills/consistency-checker/SKILL.md:113-121` (§4 BLOCK 처리). 기계적 게이트 — `.claude/hooks/_lib/review_guard.py:140` (`_BLOCK_LINE` 정규식), `:692-703` (`_summary_block_is_no`, `BLOCK:` 한 줄만 파싱).
  - 상세: 이 PR 의 핵심 목적 자체가 "`consistency-summary` 가 Critical 을 재량으로 하향해 `BLOCK: NO` 를 냈고, 그게 실제로 게이트를 통과시켰다"(`review/code/2026/07/25/22_58_00`)는 사고를 재발 방지하는 것이다. 이번 수정은 "무엇을 해야 하는가"(하향 금지 + planner 인계)를 명문화했지만, 집행 계층(`review_guard.py`)은 여전히 `BLOCK:` 한 줄만 신뢰하고 각 checker 리포트의 `[CRITICAL]` 개수와 최종 `BLOCK:` 값이 모순되는지 대조하지 않는다. 즉 이번 수정이 닫은 것은 "정책이 문서화 안 됨" 갭이고, "정책을 안 지켜도 게이트가 못 알아챔" 갭은 그대로 남는다 — 다음에 같은 재량(혹은 다른 튜닝의 summary 에이전트)이 다시 하향하면 여전히 통과한다. 저자 스스로도 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 2 에서 "하향 금지 정책에 기계적 backstop 이 없다"고 정확히 같은 지점을 지목하고 defer 해 두었다.
  - 제안: 같은 plan 문서가 제안한 대로 — orchestrator(`consistency-summary` 를 소비하는 쪽, 혹은 `review_guard.py`)가 각 checker 리포트의 `[CRITICAL]` 개수를 세어 최종 `BLOCK:` 값과 모순되면 최소한 stderr 경고/반환 플래그를 내도록 우선순위를 올릴 것. 프롬프트 지침만으로 게이트 무결성을 지키는 현재 구조는, 바로 이 PR 이 대응하려는 실패 클래스(에이전트 재량에 게이트 결과가 좌우됨)의 축소판이 여전히 남아 있다는 뜻이다.

## 요약

이번 변경은 리뷰/일관성 게이트 하네스의 신뢰성을 실제로 개선한다 — `evaluate_review`의 in-flight suppression 을 Stop 전용으로 좁혀 push 게이트가 30분간 열리던 결함을 닫았고, 코드 리뷰·컨시스턴시 양쪽에서 "예산 초과로 파일이 조용히 누락"되던 8회 재발 결함을 우선순위 재배열 + 누락 안내로 구조적으로 완화했으며, "Critical 하향 금지 + 권한 밖 인계" 절차를 문서화해 에이전트 재량에 게이트 결과가 좌우되던 문제를 절차적으로 봉쇄했다. `ReviewDecision`/`PlanDecision` 이 공유하는 `push_blocks` 프로퍼티, `_shared/report_paths.py` 단일 진실 추출 등 기존의 건강한 레이어 분리(정책 계층 `_lib/review_guard.py` / 프로토콜 어댑터 hook / 오케스트레이션 스크립트 / 에이전트 계약 markdown)도 그대로 유지된다. 다만 아키텍처 관점에서는 반복되는 패턴이 하나 뚜렷하다 — 발견된 이슈 대부분이 이 PR 이 직접 작성한 두 plan 문서(`harness-review-gate-ci-backstop.md`, `harness-consistency-summary-downgrade-rule.md`)에 이미 자인·추적돼 있는 결함이며, 그럼에도 이번 라운드가 정확히 그 부채를 늘리는 방향(`build_files_section` 추가 성장, 기본 브랜치 해석 신규 사본, git branch-diff 헬퍼 신규 사본)으로 진행됐다는 점이다. 각 항목은 fail-safe 기본값·양방향 seam 테스트·defer 근거 문서화 등 나름의 완화책을 갖추고 있어 즉각적인 위험은 낮지만, "이미 추적됨"이 "고치지 않아도 됨"의 근거가 되어 부채가 라운드마다 누적되는 패턴은 architecture 관점에서 주시할 필요가 있다. 특히 "Critical 하향 금지"의 기계적 backstop 부재는, 이 PR 이 대응하는 실패 클래스(에이전트 재량 의존 게이트)의 축소판이 여전히 남아 있다는 점에서 다음 라운드 우선순위로 권장한다.

## 위험도
MEDIUM
