# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 하네스 자신의 회귀 테스트(`test_prompt_stays_within_the_size_cap`)가 이 브랜치에서 **현재 실제로 FAIL** 한다(693 tests 중 1 FAIL). 원인은 신규 "생략 안내"(`_omitted_content_note`)가 자기 자신의 바이트 비용을 예산 계산에 넣지 않아 `build_files_section`이 스스로 약속한 `max_total_size` 예산 계약을 위반하는 것 — requirement/side_effect/testing 3개 reviewer 가 독립적으로 재현했고 수치(143,620 vs 143,605 cap, 생략 고지 14건×~146자=2,042자)까지 일치한다. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 7명 전원 결과 확보됨 — 강제 리스트 관련 누락은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 하네스 회귀 (requirement·side_effect·testing 공통 확인) | `_omitted_content_note` 자신의 바이트 비용이 `build_files_section`의 예산 계산에서 빠져 있어, 생략 안내가 여러 건 누적되면 문서가 스스로의 `max_total_size` 상한을 실제로 초과한다. 하네스 자신의 사전 존재 회귀 테스트 `test_prompt_stays_within_the_size_cap`가 **이 브랜치에서 결정적으로 재현되게 FAIL** 함(`AssertionError: 143620 not less than or equal to 143605`). testing 은 A/B 베이스라인(worktree add origin/main, 같은 커밋 `0279f4333`으로 통제 비교)으로 원인을 이 diff 로 직접 귀속시켰다: 베이스라인 141,578자/생략 0건 → 이 브랜치 143,620자/생략 14건, 차이 2,042자는 안내문 14건×~146자와 정확히 일치. 자매 함수 `truncate_file_bundle`(`consistency_orchestrator.py:642`)은 이미 이 정확한 실패 형태를 겪고 "안내문 길이도 매 반복 예산 재검증"하는 수정을 마쳤고, `_omitted_content_note`의 docstring 은 "Mirrors the same fix"라 주장하지만 실제로는 그 수정의 절반("생략을 알린다")만 이식되고 절반("안내문 자신도 예산에 넣는다")은 빠졌다. 신규 테스트 `test_prompt_omission_notice.py`는 작은 fixture(`SMALL/BIG/BIGGER`, `max_total=2000`)만 써서 이 회귀를 못 잡았다. `plan/in-progress/harness-review-gate-ci-backstop.md` 상단 배너는 이 항목을 "수정 완료"로 선언하는데, 그 근거로 인용한 RESOLUTION.md 의 "693 tests OK" 는 그 검증이 이 실패를 유발하는 커밋이 픽스처 대상이 되기 **전** 시점의 결과였을 뿐이다. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561-584`(`_omitted_content_note` 정의), `:672-694`(예산 소진 루프 — `remaining_budget`/`include_content`), `:696-707`(렌더 루프, 특히 `:701-705` `elif fp["full_content"]: section += _omitted_content_note(...)`). 회귀 테스트: `.claude/tests/test_line_anchors.py::PromptPayloadIntegrationTest::test_prompt_stays_within_the_size_cap` | 생략-안내 분기에서도 안내문 길이를 예산 차감에 포함시킬 것(안내 대상 파일 수를 먼저 추정해 `remaining_budget`에서 선반영하거나, `truncate_file_bundle`처럼 반복마다 재검증). 최소한 최종 조립 후 `len(result) > max_total_size`이면 안내를 압축(파일별 나열 대신 개수 요약)하는 안전판 추가. `test_prompt_omission_notice.py`에 "생략 대상 파일이 충분히 많아 안내문 누적만으로 예산을 넘기는" 케이스를 추가해 회귀 고정 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 하네스 회귀 (requirement·maintainability·testing 공통) | `build_files_section`의 **두 번째** 예산-초과 분기(`if base_size >= max_total_size:` — header+diff 만으로 이미 예산을 넘는 경우)는 이번 PR이 전혀 손대지 않아, 이 PR 자신이 없애려던 "예산 밖 파일이 아무 표시 없이 통째로 누락" 결함이 그대로 재현된다. 이 분기는 `full_content`를 참조조차 하지 않고, `FULL_CONTEXT_HEADING`도 신규 `_omitted_content_note`도 렌더링하지 않는다. 직접 프로브(합성 change_info, diff 큰 다중 파일)로 재현: `FULL_CONTEXT_HEADING`/생략-고지 0건. `test_prompt_omission_notice.py`의 유일한 fixture(`diff_content=""`)는 이 분기를 밟지 않아 테스트 커버리지도 없다. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:644-670`(분기 전체, 특히 `:654`/`:669` `sections = [fp["header"] + fp["diff"] for fp in file_parts]`) | 이 분기에서도 diff 절단 후 여유가 있으면 `_omitted_content_note`(또는 축약형)를 붙이거나, 최소한 "diff 도 절단됐고 원본 내용도 전혀 없다"는 별도 고지 추가. `test_prompt_omission_notice.py`에 큰 diff+full_content 다중 파일로 `base_size >= max_total_size`를 강제하는 케이스 추가 |
| 2 | plan 문서 정합성 (requirement·documentation 공통) | `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 상단 배너가 "번들 예산 결함(8회 재발) — 수정 완료"라 선언하지만, 그 근거로 지목한 §관련 관측 안의 미체크 항목 5개(특히 "정렬이 사전순 — natural sort 로 교체")가 실제로는 미구현 상태로 남아 있다. 코드 확인: `prioritize_bundle_files`의 동일 tier 내 정렬은 여전히 `sorted(file_paths, key=lambda p: (tier(p), p))`로 순수 사전순이고, 신규 `test_ties_stay_alphabetical`이 이를 "의도된 현재 동작"으로 명시 고정한다. 대상 파일이 branch-changed 도 아니고 plan 에도 언급 안 되는 세션에서는 8회 재발했던 사전순 버그 패턴이 여전히 재현될 수 있다. | 배너: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:9-23`(특히 12행) vs 미체크 항목 `:94,97,99,107,111`. 코드: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:309` | 배너의 "수정 완료" 범위를 "8회 기록된 특정 재발 증상(대상이 tier 0/1로 승격되는 경우)"으로 좁혀 쓰고, natural sort 항목은 여전히 열린 후속임을 배너에도 반영 |
| 3 | plan 문서 실측치 drift (documentation; testing 은 동일 사실을 INFO 로 기재) | 두 plan 문서의 "테스트 N건" 인용이 같은 1R 후속 수정으로 테스트가 추가되며 다시 어긋났다: `test_consistency_bundle_priority.py` 문서 "10건" vs 실측 **13건**, `test_review_changeset_warning.py` 문서 "9건" vs 실측 **11건**(직전 라운드가 이미 "실제 10건"이라 지적했음에도 격차가 더 벌어짐 — 재발). | `plan/in-progress/harness-consistency-summary-downgrade-rule.md:143`, `plan/in-progress/harness-review-gate-ci-backstop.md:108` | 두 곳을 실측치(13건/11건)로 정정하거나, 향후 재어긋남을 피하려면 완화된 표현("다수의 테스트")으로 변경 |
| 4 | 부작용 / API 계약 드리프트 (side_effect) | `--diff-base`의 문서화된 스코프("for `--impl-done`")가 이번 diff 로 전 모드(`--spec`/`--plan`/`--impl-prep`)에 조용히 확장됐다 — `diff_base` 계산과 `_branch_changed_rels()` 호출이 모드 분기 밖(함수 최상단)으로 이동해 4개 모드 공통 실행되고, `other_spec_files`/`conventions` 번들 순서에도 영향을 준다. 실행 자체는 안전(예외 흡수, 빈 set 폴백)하지만 CLI `--help` 텍스트와 `SKILL.md`는 여전히 `--impl-done` 전용으로만 설명해 공개 계약과 실제 동작이 어긋난다. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:435`(`diff_base = args.diff_base or "origin/main"`, 모드 분기 밖), `:444`(`_branch_changed_rels` 4모드 공통 호출), `:573-574`, `:858`(argparse help 텍스트) | `--diff-base` help/`SKILL.md`에 "번들 우선순위 산정에도 사용됨(전 모드 공통)" 반영, 또는 원래 의도대로 `--impl-done` 전용으로 스코프 제한 |
| 5 | 아키텍처 — 강제 불가능한 정책 | `consistency-summary`의 "Critical 하향 금지 + planner 인계" 정책이 순수 prompt 지시일 뿐, 이를 기계적으로 대조하는 backstop 코드가 없다. 실제 게이트(`_BLOCK_LINE` 정규식)는 `BLOCK:` 값이 각 checker 의 `[CRITICAL]` 개수와 모순되지 않는지 대조하지 않으며, 정확히 이 불변식이 깨진 사례(`review/code/2026/07/25/22_58_00`)가 이미 이 저장소에 실측 기록돼 있다. (참고: 사용자가 plan frontmatter 에 "(c) 하향 금지 + planner 즉시 인계"를 명시적으로 결정한 사안이라 즉시 재설계 요구는 아님) | `.claude/agents/consistency-summary.md:46-58`, `.claude/skills/consistency-checker/SKILL.md:113-121`, `.claude/hooks/_lib/review_guard.py:140,702`(`_BLOCK_LINE` 정규식) | 후속 과제로, orchestrator 가 각 checker 의 `[CRITICAL]` occurrence 수를 세어 최종 `BLOCK:` 값과 모순되면 stderr 경고/반환값 플래그를 내는 안 검토 |
| 6 | 유지보수성 — 관례 누락 | 신설된 `_branch_changed_rels()`가 기존 `get_git_branch_diff_files()`(다른 파일)와 사실상 동일한 git 연산(`--no-renames --name-only`, 3-dot)을 재구현하면서, 이 저장소가 이미 확립한 "Mirrors X — change both" 상호 참조 관례를 빠뜨렸다. (참고: 같은 커밋의 `_omitted_content_note`는 이 관례를 지켰음) | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`(`_branch_changed_rels`) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:933`(`get_git_branch_diff_files`) | 두 함수 중 한쪽 docstring 에 "Mirrors `<다른 파일>.<함수>` — change both" 상호 참조 추가 |
| 7 | 유지보수성 — 테스트 보일러플레이트 중복 (architecture: WARNING / maintainability: INFO — 심각도 판정 상이, 보수적으로 WARNING 채택) | 신규 테스트 3개(`test_consistency_bundle_priority.py`, `test_prompt_omission_notice.py`, `test_review_changeset_warning.py`)가 기존 `test_consistency_context_budget.py`의 "fresh-interpreter subprocess" 헬퍼(`run_in_orchestrator` + `_PREAMBLE`, ~35-40줄)를 파일마다 독립적으로 재작성해, 동일 보일러플레이트가 이제 4개 테스트 파일에 존재한다. `_lib` 네임스페이스 충돌을 피하기 위한 의도된 격리 장치이지만 우회 메커니즘 자체는 글자 그대로 동일하다. | `test_consistency_bundle_priority.py:56`, `test_prompt_omission_notice.py:69`, `test_review_changeset_warning.py:60` (기존 `test_consistency_context_budget.py:71`) | `.claude/tests/_harness.py`에 `run_in_module(preamble, snippet, arg=None)` 형태 공용 헬퍼를 추출해 4개 파일이 자신의 `_PREAMBLE`(대상 스크립트 경로만 다름)만 유지하도록 정리 |
| 8 | 동시성 — 테스트 인프라 한정 | 신규 테스트 헬퍼 3곳(`run_in_orchestrator()`)의 `subprocess.run`에 `timeout`이 없어, 대상 코드가 향후 hang 하면 개별 테스트가 무기한 블로킹된다. 같은 diff 의 형제 테스트(`test_guard_review_before_push_main.py` `timeout=10`, `test_stop_guard_failopen.py` `timeout=30.0`)는 명시적 timeout 을 지키고 있어 이 3개만 관례에서 벗어난다. | `.claude/tests/test_consistency_bundle_priority.py:57`, `.claude/tests/test_prompt_omission_notice.py:70`, `.claude/tests/test_review_changeset_warning.py:61` | 형제 테스트와 동일 수준(예: `timeout=30.0`) 추가. 3곳에 복제된 헬퍼를 공용 모듈로 뽑으면 한 곳만 수정하면 됨 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 이전 라운드 CRITICAL(리뷰 세션 in-flight 억제가 무조건 적용돼 빈 세션 디렉터리만 만들면 최대 30분간 push 하드 게이트까지 우회되던 access-control 결함)이 `in_flight_ok` opt-in 파라미터로 정확히 닫혔음을 전체 `.claude/hooks/` grep + 배선 추적으로 확인 — 조치 불요 | `.claude/hooks/_lib/review_guard.py:862,901`, `.claude/hooks/guard_review_before_stop.py:344`, `.claude/hooks/guard_review_before_push.py:811,845-853` | 없음 |
| 2 | 보안 | `diff_base` 문자열이 `git diff` revision 인자로 그대로 보간되나(`consistency_orchestrator.py`/`code_review_orchestrator.py` 2곳), 리스트 기반 `subprocess.run`(`shell=False`)+로컬 신뢰 입력(원격/미신뢰 경로 없음)이라 실질 위험 낮음 | `consistency_orchestrator.py:249,432`, `code_review_orchestrator.py:1126,1150` | 우선순위 낮음 — 방어적으로 `-` prefix 검증 고려 가능 |
| 3 | 보안 | 게이트의 fail-open 설계(기존 아키텍처)와 `warn_if_committed_work_is_missing`의 advisory-only 성격(changeset 자체를 넓히지 않음)은 이번 PR 이 만든 결함이 아니라 `harness-review-gate-ci-backstop.md`가 이미 추적 중인 의도적 잔여 갭 | `review_guard.py` 모듈 docstring, `guard_review_before_stop.py:308-320`, `code_review_orchestrator.py:1150-1177` | 이번 PR 범위 밖 — 별도 plan 이 소유 |
| 4 | 성능 | `plan/in-progress/**`를 같은 호출에서 2회 walk+read(현재 58파일/674KB 기준 ~3.5ms+2.4ms, 무해), tiering 이 전체 plan 코퍼스 선형 재스캔(383파일 기준 ~20ms), 기본 `--prepare` 경로 git spawn 수 3→7 증가(고정 상수 증가, N+1 아님) — 모두 현재 규모에서 무해, 스케일 시 참고용 | `consistency_orchestrator.py:445-447,567,578`(중복 read), `:292-303,309`(tiering), `code_review_orchestrator.py:1126,1150-1169`(git spawn) | 급하지 않음 — 체감 지연 발생 시 캐싱/사전 토큰화 검토 |
| 5 | 아키텍처 / 의존성 | "origin 기본 브랜치 해석" 로직이 이제 4곳(`branch_guard`(정본)/`review_guard`/신규 `_default_branch_ref`/`consistency_orchestrator`의 `"origin/main"` 리터럴)에 중복 — plan 문서가 `_lib` 네임스페이스 충돌 해소를 선행 조건으로 명시하며 이미 defer 등재, 반환 형식도 로컬 `main` vs `origin/main`으로 서로 다름 | `code_review_orchestrator.py:1126`(신규), `plan/in-progress/harness-review-gate-ci-backstop.md:27-33` | 즉시 조치 불요(이미 defer 확정) — 향후 `_lib` 통합 작업 스코프에 4곳 통합 포함 권장 |
| 6 | 동시성 | `evaluate_review()`의 in-flight 완화가 push/stop 두 호출자에 무조건 공유되던 실제 경쟁 조건이 `in_flight_ok` 키워드 전용 opt-in(기본값 False)으로 정확히 스코프됨 — 양방향 seam 단언 테스트(반환값이 아니라 실제 전달된 kwarg 값 기록)로 견고히 확인 | `review_guard.py:862,901`, `test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest` | 없음 — 향후 유사 opt-in 추가 시 이 패턴 유지 권장 |
| 7 | 부작용 | `evaluate_review(cwd=None, *, in_flight_ok=False)` 시그니처 확장은 호출자 전수 확인 결과 안전(키워드 전용이라 `_accepts_cwd()`의 POSITIONAL 판별에 영향 없음) | `review_guard.py:862`, `guard_review_before_push.py:846`, `guard_review_before_stop.py:344` | 없음 |
| 8 | 부작용 | `consistency-summary.md` 신설 "planner 인계" 섹션 제목에 "Critical" 문자열이 포함되나, `_summary_block_is_no`가 `.search()`로 찾는 첫 매치는 항상 그 앞의 실제 상태줄이라 현재는 안전 — 다만 문서 순서에 의존하는 다소 취약한 전제 | `.claude/agents/consistency-summary.md:74`, `review_guard.py:692-703` | 없음(현재 안전) — 향후 포맷 통합 시 "첫 매치"가 아닌 최상단 전용 앵커로 좁히는 편이 안전 |
| 9 | 유지보수성 | `_branch_changed_rels`의 `subpath` 매개변수가 어디서도 호출되지 않는 죽은 코드(스코프 좁히기는 실제로 `_prioritized()` 내부 prefix 필터로 처리됨); 파일 상한 매직넘버 `10`이 이름 없이 2곳(`missing[:10]`, `len(missing)-10`) 반복; 신규 지역변수(`_rank_changed`, `_rank_plan_text`)의 언더스코어 프리픽스가 이 코드베이스의 기존 컨벤션(모듈레벨/private 함수 전용)과 다른 새 패턴 | `consistency_orchestrator.py:249,444-445`, `code_review_orchestrator.py:1179,1182` | 급하지 않음 — 여력 있을 때 정리 |
| 10 | 문서화 | `guard_review_before_push.py`의 `evaluate_review` 호출부에 "왜 `in_flight_ok`를 안 넘기는지" 인라인 주석이 없음(짝인 stop 쪽엔 4줄 있음); `SKILL.md`가 `warn_if_committed_work_is_missing` stderr 어드바이저리를 미언급(직전 라운드가 이미 저우선순위로 지적한 재확인); `harness-review-gate-ci-backstop.md`의 줄번호 인용이 실제 호출줄(:344)이 아닌 설명주석 시작줄(:340) — 범위 안이라 완전히 틀린 인용은 아님 | `guard_review_before_push.py:846`, `code-review-agents/SKILL.md:41`, `harness-review-gate-ci-backstop.md:134-135` | 우선순위 낮음 — 다음 편집 때 반영 권장 |
| 11 | 의존성 | 신규 외부 패키지 없음(stdlib only, `.claude/tests/README.md`의 "zero third-party dependencies" 규약 그대로 준수); `_branch_changed_rels`와 같은 파일의 기존 `_collect_code_diff`가 유사한 git-diff subprocess 골격이나 목적이 달라(파일 경로 집합 vs diff 텍스트) 단순 중복 대상은 아님 | `.claude/tests/README.md:14-17`, `consistency_orchestrator.py:249,323` | 없음 — 향후 리팩터 시 공유 헬퍼 추출은 선택적 개선 |
| 12 | 요구사항 | 이 변경 영역(`.claude/` 하네스 도구)에는 대응 `spec/` 문서가 없음(제품 spec 은 `codebase/` 대상, 이 PR 대상 밖) — 핵심 요구사항 4가지(`in_flight_ok` opt-in 분리, 하향 금지+planner 인계, 기본 changeset 누락 경고, 4-tier 번들 우선순위)는 코드·테스트·문서 삼자가 항목 번호까지 정확히 일치함을 확인 | plan 두 문서 vs 코드/테스트 전반 | 없음 |
| 13 | 범위 | 성격이 다른 5개 수정(in-flight TTL 스코프 축소, consistency 번들 우선순위, changeset 누락 경고, 리뷰 프롬프트 생략 명시, Critical 하향 금지+planner 인계)이 한 브랜치에 묶여 있으나, 전부 이 브랜치가 사전 소유한 2개 plan 티켓의 체크리스트를 종결하는 형태이고 각 fix 가 전용 커밋·전용 테스트로 명확히 분리됨 — scope creep 아님 | 브랜치 전체 커밋 이력 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 이전 access-control 우회 CRITICAL 이 정확히 닫혔음 확인; 신규 결함 없음 |
| performance | LOW | 경미한 중복 I/O·전체 재스캔 3건, 전부 현재 규모에서 무해 |
| architecture | LOW | Critical 하향금지 정책이 backstop 없는 prompt-only(WARNING); 기본분기 4중복·테스트헬퍼 4중복(둘 다 기존에 알려졌거나 저위험) |
| requirement | CRITICAL | 예산 미계상으로 하네스 자체 테스트 FAIL; 두 번째 예산분기 미수정; plan 배너 "완료" 선언 범위 과장 |
| scope | NONE | 5개 이종 수정이 묶였으나 scope creep 아님, 전부 사전 등록 티켓 대응 |
| side_effect | CRITICAL | 동일 예산 미계상 결함 재확인(실행 검증 포함); `--diff-base` 스코프 조용한 전모드 확장(WARNING) |
| maintainability | LOW | build_files_section 2번째 분기 미수정(WARNING); `_branch_changed_rels` mirror 주석 누락(WARNING); 사소한 INFO 다수 |
| testing | CRITICAL | 693 tests 실행, 1 FAIL 확정 재현(A/B 베이스라인 비교로 diff 귀속); 2번째 분기 무표시 재현·테스트 없음 |
| documentation | LOW | plan 문서 테스트개수 인용 drift 재발(WARNING); "수정완료" 배너-체크박스 불일치(WARNING) |
| dependency | LOW | 신규 외부 의존성 없음; 내부 기본브랜치 해석 4중복은 이미 defer 확인된 것 재확인 |
| database | NONE | 검토 대상 코드 없음(DB 요소 전무) |
| concurrency | LOW | in-flight 경쟁조건이 정확히 스코프됨 확인; 신규 테스트 3곳 timeout 누락(WARNING) |
| api_contract | NONE | HTTP API 표면 없음, 해당 없음 |
| user_guide_sync | NONE | doc-sync-matrix trigger 매칭 0건, 동반갱신 대상 없음 |

## 발견 없는 에이전트

database, api_contract, user_guide_sync — 실질 발견사항 없음(검토 대상 코드/트리거 부재로 해당 없음).

## 권장 조치사항

1. **[병합 차단]** `build_files_section`의 `_omitted_content_note` 길이를 예산 계산에 포함시켜 `test_prompt_stays_within_the_size_cap` FAIL 을 해소할 것 — 현재 이 브랜치에서 결정적으로 재현되는 실패(Critical #1).
2. 같은 함수의 두 번째 예산-초과 분기(diff 자체가 이미 예산 초과)에도 생략 고지를 확장 적용하고 회귀 테스트를 추가할 것(WARNING #1) — 그렇지 않으면 이 PR 이 고치려던 결함이 다른 입구로 재발한다.
3. `harness-consistency-summary-downgrade-rule.md` 상단 배너의 "수정 완료" 선언 범위를 실제 코드 상태(natural sort 미구현)에 맞게 좁혀 정정할 것(WARNING #2).
4. 두 plan 문서의 테스트 개수 인용을 실측치(13건/11건)로 정정하거나 완화된 표현으로 바꿀 것(WARNING #3).
5. `--diff-base`의 CLI help/`SKILL.md` 설명을 실제 동작(전 모드 영향)에 맞게 갱신하거나 원래 의도대로 스코프를 제한할 것(WARNING #4).
6. (부수, 급하지 않음) `_branch_changed_rels`에 "Mirrors X" 상호 참조 주석 추가, 신규 테스트 3곳 `subprocess.run`에 timeout 추가, 4중 복제된 테스트 헬퍼를 `_harness.py`로 추출(WARNING #6~#8).

## 라우터 결정

- `routing_status=skipped` — 프롬프트에 별도 `routing_skip_reason` 텍스트는 제공되지 않았으며 `routing: skipped`로만 명시됨. **전체 reviewer 14명 실행**됐고 그중 forced 화이트리스트(router_safety) 7명 — `documentation, maintainability, requirement, scope, security, side_effect, testing` — 도 모두 포함되어 전원 결과가 확보됐다(누락 없음).
- 제외된 reviewer: 없음(skipped 목록 없음).