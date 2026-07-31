# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `build_files_section` 하나의 함수에 예산 전략 3종(무예산 / header+diff 초과 분기 / 콘텐츠 예산 할당-예약-환불)이 누적돼 함수 길이·복잡도가 과도하다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587-772` (`build_files_section`, 약 186줄). 내부에 클로저 `_notice_cost`(:703), `_render`(:738)까지 중첩.
  - 상세: 이번 diff 가 추가한 "생략 안내(omission notice)도 예산에 포함시켜야 한다"는 로직이 세 분기(:644 `if base_size >= max_total_size`, :687 이하 콘텐츠 할당, :752 이후 집계 폴백) 각각에 별도로 손으로 재구현됐다. 특히 :693-736 구간의 "reserve upfront → refund per included file" 산술은 지역 변수 `remaining_budget`/`refund`/`available`/`note_reserve` 간의 부호·순서 의존이 촘촘해 한눈에 불변식을 검증하기 어렵다. 순환복잡도 추정 20 이상. 다만 각 비직관적인 줄마다 "왜"를 설명하는 주석이 붙어 있어 즉각적인 가독성 리스크는 상당히 완화돼 있다.
  - 이미 추적됨: `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "신규 후속 (defer) 3번" 이 정확히 이 구조를 지목하며 `_render_unbounded` / `_render_diff_only_overflow` / `_allocate_content_budget` 분리 + 예산 계상 공유 헬퍼를 제안하고, "3R CRITICAL 이 정확히 이 구조에서 재발했다"는 근거까지 남겨 뒀다. 새로 요청하는 항목이 아니라 기존 defer 결정에 대한 확인 차원의 재확인으로 받아들이면 된다.
  - 제안: 지금 당장 분리를 요구하지는 않되(이미 defer 결정 + rationale 존재), 다음 예산 전략 변경 PR 전에는 반드시 분리를 선행할 것. 세 분기의 "notice 길이도 cut/overflow 계상에 넣는다"는 공통 불변식만이라도 단일 헬�퍼(`_charge(overflow, note_len)` 류)로 뽑으면 향후 재발 가능성이 크게 줄어든다.

- **[WARNING]** fresh-interpreter 테스트 보일러플레이트(`_PREAMBLE` + `run_in_orchestrator`, 약 30~35줄)가 이번 PR 로 신규 파일 3개에 추가 복제됐다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:39-68`, `.claude/tests/test_prompt_omission_notice.py:41-89`, `.claude/tests/test_review_changeset_warning.py:44-72` — 기존 `.claude/tests/test_consistency_context_budget.py:49` 와 사실상 동일 구조(4번째 복제).
  - 상세: `subprocess.run([... "-c", _PREAMBLE + textwrap.dedent(snippet)], ..., timeout=30.0)` + `<<<...>>>` JSON 파싱 패턴이 4개 파일에 그대로 반복된다. `timeout=30.0` 옆 주석("Sibling suites set one too")까지 동일해, 정의상 "같은 이유로 반복되는 코드"임을 스스로 인정하고 있다.
  - 이미 추적됨: `plan/in-progress/harness-review-gate-ci-backstop.md` 신규 후속 7번이 `_harness.py` 로의 추출을 제안하며 "이번에 timeout 을 3곳에 각각 넣어야 했던 것이 그 비용의 실례"라고 스스로 비용을 기록해 뒀다. 의도적 defer.
  - 제안: 5번째 복제가 생기기 전에 `_harness.py` 에 `run_in_orchestrator(module_path, snippet, arg=None, *, timeout=30.0)` 형태로 추출 권장.

- **[INFO]** 경고 메시지의 "표시할 파일 개수 상한" 이 이름 없는 리터럴 `10` 으로 두 곳에 중복 등장.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1243` (`for f in missing[:10]:`), `:1245` (`if len(missing) > 10:`)
  - 상세: 두 리터럴이 반드시 같은 값이어야 하는데 상수로 묶여 있지 않아, 한쪽만 고치는 실수에 취약하다. `test_review_changeset_warning.py::test_long_lists_are_capped_but_counted` 가 `10`을 하드 픽스하고 있어 현재는 안전하지만 가독성상 개선 여지.
  - 제안: `_MISSING_LIST_CAP = 10` 같은 모듈 상수로 추출.

- **[INFO]** 새로 도입된 지역 변수 `_rank_changed`/`_rank_plan_text` 가 이 파일의 언더스코어 프리픽스 컨벤션과 어긋난다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:458-459`
  - 상세: 이 파일에서 leading underscore 는 지금까지 모듈-레벨 "private" 헬퍼(`_prioritized`, `_require_target`, `_branch_changed_rels`, `_is_catalog_bulk` 등)에만 쓰여 왔다. `collect_context` 함수 **내부** 지역 변수에 언더스코어를 붙인 것은 이번이 처음이라, 읽는 사람이 순간적으로 모듈 레벨 심볼로 착각할 여지가 있다. 기능에는 영향 없는 순수 네이밍 컨벤션 이슈.
  - 제안: `rank_changed`/`rank_plan_text` 로 프리픽스 제거(또는 이 함수 안에서 재사용되는 이유를 밝히는 주석 추가).

- **[INFO]** 두 orchestrator 간 git branch-diff 계산 로직이 구조적으로 중복(신규 코드가 기존 중복 패턴을 답습).
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:255-280` (`_branch_changed_rels`, 신규) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:997-1004` (`get_git_branch_diff_files`, 기존).
  - 상세: 두 함수 모두 `git diff --no-renames --name-only <ref>...` 를 동일한 rationale(three-dot, rename 미검출 의도)로 구현하며, 실패 시 반환 타입만 다르다(`set()` vs `[]`). `_branch_changed_rels` 의 docstring 이 "Mirrors ... — change both" 라고 명시적으로 교차 참조해 두어 drift 위험은 완화돼 있으나, 실제 코드 중복 자체는 남아 있다.
  - 이미 추적됨: `harness-review-gate-ci-backstop.md` 신규 후속 6번이 동일 지적을 하며 "`_lib` 네임스페이스 충돌 해소가 선행"이라는 이유로 defer 상태임을 명시.
  - 제안: 현 상태(교차 참조 주석)로 당장 충분. `_lib` 네임스페이스 통합이 이뤄지는 시점에 함께 처리.

## 긍정적으로 평가할 부분

- `evaluate_review(cwd=None, *, in_flight_ok=False)` 로 API 를 변경하며 새 파라미터를 **keyword-only** 로 만든 설계(`.claude/hooks/_lib/review_guard.py:862-864`)는 좋은 방어적 관례다 — push 게이트가 실수로 위치 인자를 넘겨 `in_flight_ok` 를 켜는 사고를 원천 차단한다.
- 이번 diff 로 신설된 헬퍼들(`prioritize_bundle_files`, `_is_catalog_bulk`, `_default_branch_ref`, `warn_if_committed_work_is_missing`, `_aggregate_omission_note`)은 각각 단일 책임·명확한 이름·"왜 이 로직이 필요한가"를 실측치와 함께 남기는 이 코드베이스의 기존 문서화 컨벤션을 잘 따른다. 특히 `prioritize_bundle_files` 의 4-tier 설명(:281-325)은 tier 간 우선순위 충돌(카탈로그 강등 vs plan 언급, 브랜치 변경 vs 카탈로그 강등)을 표로 정리하듯 명료하게 서술해 가독성이 좋다.
- 회귀 원인이 됐던 잘못된 docstring(`evaluate_review` 관련 "push guard still hard-gates"가 실제로는 거짓이었던 부분)을 이번 diff 에서 정확히 정정해, 코드와 주석의 불일치를 남기지 않았다(`.claude/hooks/_lib/review_guard.py:74-84`, `:142-151`, `:736-746`).

## 요약

이번 변경은 리뷰/일관성 게이트의 실제 결함(예산 초과 시 파일 누락 무통지, in-flight 억제가 push 게이트까지 여는 문제, 번들 우선순위 부재)을 고치는 데 집중돼 있고, 전반적으로 네이밍·문서화·API 설계 수준은 높다. 유일하게 실질적인 우려는 `build_files_section` 한 함수에 예산 전략 3종이 계속 누적되는 구조인데, 이는 팀이 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 에서 정확히 같은 지점을 근본 원인으로 지목하고 구체적 분리안(`_render_unbounded`/`_render_diff_only_overflow`/`_allocate_content_budget`)까지 세운 뒤 의도적으로 defer 한 상태다. 테스트 보일러플레이트 복제, 매직 넘버 `10`, 지역 변수 네이밍 등 나머지는 모두 사소하거나 이미 추적 중인 항목이라 이번 PR 을 막을 사유는 아니다.

## 위험도

LOW
