# Architecture Review — harness-review-gate-fixes-1bd6aa (세션 2026/07/31 11_58_11)

## 조사 방법

프롬프트에 전체 내용이 실리지 않은 3개 파이썬 파일(`review_guard.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`)은 워크트리에서 `Read`/`grep` 로
직접 확인했다. `git diff origin/main...HEAD` 로 실제 변경분 15개 소스/plan 파일을 대조했고,
직전 라운드 산출물(`review/code/2026/07/31/11_07_48/architecture.md` + `RESOLUTION.md`)을 읽어
그 라운드가 낸 WARNING(예외 미흡·4곳 중복·in_flight_ok 플래그)이 이번 diff 에 실제로 반영됐는지
재확인했다(C2/W1/W6~W8 반영 확인됨). 이번 라운드는 그 스코프 밖에 있던
`.claude/agents/consistency-summary.md`/`SKILL.md` 의 "Critical 하향 금지 + planner 인계" 정책
추가분에 아키텍처 관점을 새로 적용했다.

## 발견사항

- **[WARNING]** `consistency-summary` 의 "Critical 하향 금지" 정책이 순수 prompt 지시일 뿐이고, 이를 기계적으로 대조하는 backstop 이 없다.
  - 위치: `.claude/agents/consistency-summary.md:46`-`58` (§요약 지침 3·4, "하향 금지"/"planner 인계"), `.claude/skills/consistency-checker/SKILL.md:113`-`121`. 대조 지점: `.claude/hooks/_lib/review_guard.py:140` (`_BLOCK_LINE = re.compile(r"BLOCK:\s*(YES|NO)", re.IGNORECASE)`), `:702` (`_BLOCK_LINE.search(text)`).
  - 상세: 이 정책이 고치려는 원 사건(`review/code/2026/07/25/22_58_00`)은 `consistency-summary` sub-agent 가 checker 의 `[CRITICAL]` 판정을 통합 단계에서 재량으로 WARNING 낮추고 `BLOCK: NO` 를 낸 것이었다. 이번 수정은 규약을 강화했다 — "하향 금지"를 못 박고 과거 사건을 근거로 남겼으며, 막다른 길을 피하려 "planner 인계" 표라는 탈출구도 함께 추가했다(설계 자체는 타당 — SKILL.md §4 BLOCK 처리에도 동일 논리가 미러링돼 doc-code 정합은 맞다). 그런데 실제 게이트는 여전히 SUMMARY.md 전체 텍스트에서 `BLOCK:\s*(YES|NO)` 패턴 하나를 `.search()` 로 찾을 뿐(`review_guard.py:140,702`, 섹션 구조 무관 — 그래서 이번에 "## planner 인계" 섹션을 새로 끼워 넣어도 이 정규식엔 영향 없음을 확인했다), 그 값이 각 checker 산출물의 `[CRITICAL]` 개수와 실제로 모순되지 않는지 대조하는 코드는 어디에도 없다. 즉 "통합 단계에서 하향하지 마라"는 불변식은 매 실행마다 `consistency-summary`(LLM)가 지시를 다시 따라야 유지되는 성질이고, 정확히 이 불변식이 깨진 사례가 이미 이 저장소에 실측 기록돼 있다. 이번 조치는 "일어나지 말아야 한다"는 서술을 강화했을 뿐 "일어나면 잡는다"는 층은 추가하지 않았다.
  - 제안: 지금 재설계가 필요한 정도는 아니다 — `plan/in-progress/harness-consistency-summary-downgrade-rule.md` frontmatter 에 사용자가 "(c) 하향 금지 + planner 즉시 인계"를 명시적으로 결정했다고 기록돼 있다. 다만 후속 과제로, orchestrator(`consistency_orchestrator.py`/summary 통합 직전)가 각 checker 의 inline 전문 또는 `output_file` 에서 `[CRITICAL]` occurrence 수를 세어, 최종 SUMMARY 의 `BLOCK:` 값이 그 개수와 모순되면(≥1 인데 `NO`) 최소한 stderr 경고나 반환값 플래그를 내는 안을 검토할 만하다 — 사람이 매 세션 감사하지 않아도 "에이전트가 규약을 어겼는지"가 드러난다.

- **[INFO]** "origin 기본 브랜치를 알아낸다"는 동일 책임의 독립 구현이 4곳으로 늘었다 — 이미 문서화·defer 된 부채이지만 이번 PR 이 그 표면을 넓힌 당사자다.
  - 위치: 신규 구현 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1126` (`_default_branch_ref`). 추적 기록: `plan/in-progress/harness-review-gate-ci-backstop.md:27`-`33`.
  - 상세: `branch_guard._origin_default_branch()`(정본) · `review_guard._default_branch()` · 이번에 신설된 `code_review_orchestrator._default_branch_ref()` · `consistency_orchestrator`의 `args.diff_base or "origin/main"` 리터럴 — 네 곳이 같은 질문("이 저장소의 기본 브랜치는?")에 각자 답하고 반환 형식도 다르다(로컬 `main` vs `origin/main`). 팀이 이미 plan 문서에 "hooks/skills `_lib` 네임스페이스 충돌 해소가 선행돼야 실제 코드 공유가 가능하다"는 구체적 이유로 defer 결정을 남겨 뒀고, 직전 라운드 아키텍처 리뷰(`review/code/2026/07/31/11_07_48/architecture.md` WARNING #2)에서도 이미 지적돼 새로운 발견은 아니다. 다만 이번 PR 이 그 표면(기존 2곳 → 4곳)을 넓힌 변경분이므로, 기본 브랜치 판정 정책이 바뀌면 네 곳을 모두 손으로 갱신해야 하는 drift 위험이 현재 실재한다는 점은 재확인해 둔다.
  - 제안: 추가 조치 불요(이미 티켓 등록·defer 확정). `_lib` 네임스페이스 충돌 해소가 선행 조건이라는 판단에 동의하며, 그 전까지는 각 구현부에 "다른 3곳과 반환 계약이 다르다"는 상호 참조 주석만 있으면 충분하다.

- **[WARNING]** 신규 테스트 3개가 기존 "fresh-interpreter subprocess" 헬퍼(`run_in_orchestrator` + `_PREAMBLE`)를 파일마다 재작성해, 동일 보일러플레이트가 이제 4개 테스트 파일에 존재한다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:56`, `.claude/tests/test_prompt_omission_notice.py:69`, `.claude/tests/test_review_changeset_warning.py:60` (신규 3개, 모두 이번 PR 추가) — 기존 `.claude/tests/test_consistency_context_budget.py:71`과 함수 바디가 사실상 동일.
  - 상세: 네 파일의 `run_in_orchestrator(snippet, arg=None)`은 docstring 유무를 빼면 완전히 같은 9줄 바디(`subprocess.run([sys.executable, "-c", _PREAMBLE + textwrap.dedent(snippet)], input=..., cwd=str(REPO_ROOT), capture_output=True, text=True)` → returncode 체크 → `<<<...>>>` 파싱)를 갖는다. `_PREAMBLE` 조립 방식(`importlib.util.spec_from_file_location` → `sys.modules["orch"]` 등록 → `emit`/`ARG` 헬퍼)도 대상 스크립트 경로(`ORCH`)만 다를 뿐 구조가 같다. "Fresh-interpreter convention" 이라는 이름으로 각 파일 docstring 에 의도적으로 문서화돼 있어 우연한 복붙은 아니지만, 이 저장소 스스로 "진짜 동일한 보일러플레이트만 추출한다"는 원칙을 갖고 있는 대상이기도 하다. `.claude/tests/_harness.py` 가 이미 이런 공용 테스트 유틸의 정본 위치이고 `load_module_by_path`(동일 프로세스 로더) 라는 유사 헬퍼가 있으나, subprocess 기반의 이 패턴은 아직 그쪽에 없다.
  - 제안: `run_in_orchestrator`의 몸통을 `preamble` 인자를 받는 형태로 `.claude/tests/_harness.py` 에 (예: `run_in_module(preamble, snippet, arg=None)`) 추출하고, 4개 파일은 자신의 `_PREAMBLE`(대상 스크립트 경로만 다름)만 유지한 채 그 공용 함수를 호출하도록 정리할 수 있다. 테스트 전용 코드라 당장 위험도는 낮지만, 이 패턴을 이후 손볼 일(예: timeout 추가, 에러 메시지 개선)이 생기면 4곳을 동기화해야 하는 부담이 지금부터 쌓인다.

## 확인된 건강한 설계 (참고, 조치 불요)

- `evaluate_review(cwd=None, *, in_flight_ok: bool = False)` (`review_guard.py:862`)는 키워드 전용·기본값 보존 파라미터로 새 호출자(Stop hook)에게만 관대한 동작을 열어주고 기존 호출자(push hook, 위치 인자만 사용)의 계약은 건드리지 않는 OCP 순응적 확장이다. 양방향 모두 "seam 이 실제로 그 kwarg 를 넘기는지"까지 단언하는 테스트(`test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest`, `test_guard_review_before_push_main.py::test_push_never_opts_into_the_in_flight_concession`, `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in`)로 고정돼, 결과만 보고 호출부를 건드려도 통과하는 vacuous 함정을 피했다.
- `prioritize_bundle_files`(정렬, `consistency_orchestrator.py:267`) / `format_file_bundle`(렌더) / `truncate_file_bundle`(절단+생략 고지) 세 함수가 책임을 명확히 분리하며, `code_review_orchestrator.py`의 `_omitted_content_note`(신규)도 같은 "생략을 침묵시키지 않는다"는 설계를 코드-리뷰 쪽에서 대칭으로 구현한다. catalog 강등은 경로 세그먼트 정규식(`_CATALOG_BULK_RE`)으로 매칭돼 카탈로그가 이동·증설돼도 코드 변경 없이 강등을 상속하는 등 확장성도 고려돼 있다.
- 레이어 경계 확인: `code_review_orchestrator.py`/`consistency_orchestrator.py`는 자신의 스킬-로컬 `lib`/`_lib` 만 임포트하고 `.claude/hooks/_lib`(enforcement 레이어)를 직접 참조하지 않으며, `review_guard.py`도 표준 라이브러리와 `_shared.report_paths` 외 임포트가 없다 — hooks(게이트 집행) ↔ skills(세션 준비) ↔ agents(prompt 정의) 3개 레이어 간 순환 의존이나 역방향 의존은 발견되지 않았다.

## 요약

이번 diff 는 직전 라운드(`review/code/2026/07/31/11_07_48`, CRITICAL 2·WARNING 6)의 수정이 실제로 반영된 이후 상태다 — `_default_branch_ref` 의 예외 처리 통일, catalog 강등보다 branch-changed tier 우선, `_branch_changed_rels` 1회 호출화 등을 재확인했다. 이번 라운드에서 새로 아키텍처 관점이 닿은 부분은 `consistency-summary.md`/`SKILL.md` 의 "Critical 하향 금지 + planner 인계" 정책이며, 설계 방향(재량 제거 + 탈출구 병행)은 타당하나 강제 수단이 여전히 prompt 지시뿐이라는 잔여 위험이 있다(이미 사용자가 승인한 절충이라 즉시 조치 대상은 아님). 그 외 `evaluate_review`의 OCP 순응적 확장, 번들 파이프라인의 정렬/렌더/절단 책임 분리, 레이어 간 무순환 의존은 구조적으로 건전하다. 새로 걸린 두 건(테스트 헬퍼 4중 복제, 기본 브랜치 해석 4곳 중복)은 모두 이미 알려졌거나 위험도가 낮은 유지보수성 이슈로, 이번 diff 를 막을 사유는 없다.

## 위험도

LOW
