# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — requirement reviewer 가, 직전 라운드(11_58_11)의 CRITICAL("생략 안내문 자체의 바이트 비용이 예산에 안 잡힘", 14개 파일·143,605자 cap 초과)을 고치려 도입한 바로 그 메커니즘(`build_files_section`의 예산 선반영/환급 전략)이 **파일 수가 늘어나면 동일 실패 클래스를 다시 재현한다**는 것을 실측 재현(n=200→1.01배, n=600→1.15배, n=1200→1.36배 초과)으로 새로 발견했다. 이번 diff 가 실제로 프로덕션 경로(`DEFAULT_MAX_PROMPT_SIZE`)에서 발생 가능한 시나리오다.

> forced(router_safety) 화이트리스트 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 정상 확보됐음을 확인했다 — 위 CRITICAL 은 프로세스/화이트리스트 미이행이 아니라 **순수 코드 결함**이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 로직 견고성 (requirement) | `build_files_section`의 예산 선반영(reservation) 전략 — "생략 안내 비용은 반드시 같은 예산 안에서 지불된다"는 자신의 설계 불변식을 파일 수가 많아지면 **다시 위반**한다. 직전 라운드 CRITICAL(14개 파일, cap 143,605자 초과)을 고치려 도입한 메커니즘이 규모가 커지면 동일 실패 클래스를 재발시킨다. 실측: n=200 파일→실제 142,785자(cap 141,557, 1.01배 초과) / n=600→162,583자(1.15배) / n=1200→192,249자(1.36배). n=200 은 프로덕션이 실제로 쓰는 `DEFAULT_MAX_PROMPT_SIZE` 그대로 사용한 재현. 자매 함수(`truncate_file_bundle`, consistency 쪽)는 반복 재검증 방식으로 이미 이 문제를 일반적으로 해결해 뒀다. 테스트 갭: `test_prompt_omission_notice.py`의 회귀 테스트는 20개 파일만 사용해 이 일반 불변식을 검증하지 못한다. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:693-708`(`_notice_cost` 선반영 주석), `:710-736`(`refund` 루프), `:738-749`(렌더 루프, 특히 `:743-747` 무조건 `_omitted_content_note` 삽입); 대조: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:650-691`(`truncate_file_bundle`); 테스트: `.claude/tests/test_prompt_omission_notice.py:149-174` | `truncate_file_bundle`과 동일한 **반복 재검증** 방식으로 통일 — 파일을 하나씩 포함/생략 결정할 때마다 "지금까지 확정된 전체 길이(포함 콘텐츠 + 이미 생략된 파일들의 고지 총합)"를 실측해 예산과 비교. 최소 안전판으로 최종 조립 후 `len(result) > max_total_size`이면 개별 나열 대신 "N개 파일 생략(경로는 하단 목록)" 압축 고지로 대체하는 폴백 추가. `test_prompt_omission_notice.py`에 수백~`DEFAULT_MAX_PROMPT_SIZE`급 파일 수 회귀 케이스 추가 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/아키텍처 (architecture, maintainability) | `build_files_section`이 서로 다른 3개의 예산 초과 대응 전략(무예산/header+diff 초과/콘텐츠 예산 할당)을 한 함수(약 163줄)에 누적하며 계속 길어진다. 세 경로 모두 "안내문 길이도 예산에 포함시켜야 한다"는 동일 불변식을 각자 손으로 재구현하는데, 바로 위 CRITICAL 이 이 구조에서 재발한 근본 원인 클래스다. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587-749`(함수 전체), 특히 `:632-685`(오버플로 처리), `:690-736`(예산 할당) | 세 경로를 이름 있는 헬퍼(`_render_unbounded`/`_render_diff_only_overflow`/`_allocate_content_budget`)로 분리하고, "안내문 후보 길이까지 포함해 예산 반영"을 단일 헬퍼로 공유시켜 위 CRITICAL 수정과 함께 처리 |
| 2 | 보안/거버넌스 (security) | "Critical 하향 금지 + planner 인계" 정책의 유일한 집행 지점이 코드가 아니라 LLM 프롬프트 준수 여부다 — `review_guard.py`의 `BLOCK:` 파서는 각 checker 리포트의 실제 `[CRITICAL]` 개수와 최종 `BLOCK:` 값의 모순을 전혀 대조하지 않는다. 동일 클래스 실패가 이미 한 차례 실측된 바 있다(`review/code/2026/07/25/22_58_00`). 이미 `plan/in-progress/harness-review-gate-ci-backstop.md`에 defer 로 추적 중. | `.claude/agents/consistency-summary.md:46-57`, `.claude/hooks/_lib/review_guard.py:140`(`_BLOCK_LINE`) | orchestrator 가 checker 산출물의 `[CRITICAL]` 개수를 세어 최종 `BLOCK:` 값과 모순되면 stderr 경고/반환 플래그를 내는 기계적 backstop 구현을 우선순위 상향 |
| 3 | 부작용 (side_effect) | 신규 `warn_if_committed_work_is_missing` advisory 가 `--staged` 명시 스코프에도 무조건 발동한다. SKILL.md 는 `--staged`를 `--commit`/`--range`/`--branch`와 동급의 명시적 스코프 옵션으로 문서화하는데, 그 셋과 달리 `--staged`만 이 경고에서 면제되지 않는다(실측 재현 확인: `staged=True`로 호출해도 경고 1회 발동). 관련 테스트(`DefaultPathIsWiredTest`)도 이 케이스를 다루지 않아 회귀 스위트로 걸러지지 않는다. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `collect_change_infos()`의 `else:` 분기, 호출부 1270행, 정의 1192행 | `else:` 분기의 호출을 `if not args.staged:`로 감싸 면제하거나, 의도적으로 포함시키려는 것이면 `DefaultPathIsWiredTest`에 관련 테스트를 추가해 계약으로 고정 |
| 4 | 문서 동기화 (documentation) | 신규 changeset 경고(`warn_if_committed_work_is_missing`)가 code-review-agents SKILL.md의 세션 준비 섹션에 반영되지 않았다 — "인자 없음 → git diff (staged+unstaged+untracked)" 한 줄뿐이라, 이 경로가 커밋 후 브랜치 diff 를 놓칠 수 있다는 caveat 를 SKILL.md 만 읽는 호출자는 알 수 없다(완화: 경고 자체가 stderr 로 remedy 를 안내함). | `.claude/skills/code-review-agents/SKILL.md:41` | §1 옵션 목록에 "커밋 직후엔 기본 경로가 브랜치 diff 를 놓칠 수 있음 — stderr 경고 시 `--branch <base>` 로 재실행" 한 줄 추가 |
| 5 | 테스트 (testing) | `_branch_changed_rels`(branch-changed 판정, tier 0 의 유일한 데이터 소스)가 실제 git 동작을 단언하는 테스트가 없다 — `CollectContextUsesPriorityTest`는 `prioritize_bundle_files` 자체를 람다로 완전히 대체해 `changed_rels` 인자를 받기만 하고 버리므로, 함수가 크래시 없이 실행되는지 정도의 스모크만 검증한다(별도 임시 git repo 로 직접 실행해 현재 구현 자체는 정상 동작함은 확인했으나, 회귀 방지력은 없음). | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`(`_branch_changed_rels`), 소비 지점 `:452`; 테스트 `test_consistency_bundle_priority.py:206` 이하 | `test_review_guard_hardening.RebaseAuthorDateTest`가 쓰는 임시 git repo 패턴을 재사용해 `_branch_changed_rels(base, root)`를 직접 호출·반환 집합을 단언하는 테스트 1~2개 추가(예: rename 케이스 `--no-renames` 확인) |
| 6 | 아키텍처 (architecture) | 브랜치 변경 파일 목록 계산 로직이 새 함수(`_branch_changed_rels`)로 복제됐다 — 기존 `get_git_branch_diff_files`와 사실상 동일 로직(git diff --name-only, 실패 시 반환 타입만 set/list 로 다름)이며, docstring 자신이 "Mirrors ... change both"라고 drift 위험을 인정한다. 기존 백로그("origin 기본 브랜치 해석 4곳 중복")는 이 함수 쌍(브랜치 diff 파일 목록 자체)을 명시하지 않아 스코프 밖에 새로 생긴 동일 결함 클래스다. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`(`_branch_changed_rels`) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:975`(`get_git_branch_diff_files`) | `plan/in-progress/harness-review-gate-ci-backstop.md`의 기존 defer 항목 스코프를 "git 기반 브랜치 diff 헬퍼 중복"으로 넓히거나 신규 후속 항목으로 등재 |
| 7 | 아키텍처 (architecture) | `evaluate_review()`가 push(hard block)/stop(soft nudge) 두 게이트의 서로 다른 보증 수준을 하나의 boolean 플래그(`in_flight_ok`)로 스위칭한다 — fail-safe 기본값(옵트아웃)과 양방향 seam 테스트로 현재는 안전하게 봉쇄돼 있으나, 향후 세 번째 호출부가 추가되면 다시 기본값에 의존하게 되는 flag-argument 구조적 취약점이 남는다. | `.claude/hooks/_lib/review_guard.py:862`(`evaluate_review(cwd=None, *, in_flight_ok=False)`) | `evaluate_review_for_push()`/`evaluate_review_for_stop()` 처럼 의도가 이름에 드러나는 얇은 wrapper 두 개(내부적으로 공용 로직 위임)로 분리해, opt-in 인자 누락 실수를 시그니처 레벨에서 원천 차단 |
| 8 | 테스트 견고성 (requirement) | 신규 `test_push_never_opts_into_the_in_flight_concession`이 실제 저장소의 `git worktree list` 상태에 의존해 드물게 flaky 할 수 있다(14회 반복 중 1회 실패 관측, 이후 13회+공식 러너는 통과 — 로직 결함은 아닌 것으로 판단되나 재현 실패로 100% 확정은 못함). `_run()` 헬퍼가 `subprocess.run`에 `cwd`를 넘기지 않아 호출 프로세스의 실제 checkout 을 그대로 상속하는 것이 원인으로 추정된다(형제 테스트 `test_stop_guard_failopen.py`는 `cwd=self.tmp` 명시). | `.claude/tests/test_guard_review_before_push_main.py:152-186`(`_run()`), 관련 신규 테스트 214-231행 부근 | `_run()`이 격리된 임시 git 저장소(또는 최소 `cwd=self.tmp`)를 넘기도록 수정해 다중 워크트리 상태와 무관하게 결정적으로 동작하게 할 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (security) | `_summary_block_is_no`의 `BLOCK:` 파싱이 문서 전체에서 첫 매치를 신뢰 — `_RISK_LEVEL`과 달리 섹션 경계 앵커가 없어, summary 에이전트가 템플릿을 벗어나 앞부분에 예시로 다른 "BLOCK: NO" 문자열을 인용하면 오판 가능(현재 정상 경로는 문제 없음). | `.claude/hooks/_lib/review_guard.py:140`, `:692-703` | 매칭 범위를 문서 맨 앞 N줄/첫 헤딩 섹션으로 한정 |
| 2 | 보안 (security) | `build_files_section`의 diff-only 오버플로 분기(header+diff 조차 예산 초과)에 절단량 계산 누락 결함이 남아있음 — 이번 PR 범위 밖이며 이미 `harness-review-gate-ci-backstop.md` 신규 후속 1로 추적 중(이번 PR 이 만들지도 악화시키지도 않음). | `code_review_orchestrator.py` `build_files_section` 내 `base_size >= max_total_size` 분기 | 후속 PR 에서 안내문 길이를 절단량에 포함하는 동일 처방으로 닫을 것 |
| 3 | 성능 (performance) | `prioritize_bundle_files`/`tier()`의 plan-mention 판정이 O(후보 파일 수 × plan 말뭉치 크기) 부분 문자열 탐색 — 이 저장소 현재 규모에서 실측 약 22ms(완전히 안전)이나, 두 코퍼스(plan 문서·spec/convention 파일) 모두 계속 성장 중이라 스케일에 비례해 나빠짐. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:311`, `:453-465`, `:581-582` | 필요 시 후보 경로/basename 을 정규식 alternation 1회 스캔으로 대체해 O(n×m)→O(n+m) 개선 가능 |
| 4 | 성능 (performance) | `build_files_section`에서 `_notice_cost`가 같은 인자로 두 번 계산됨(708행 예산 확보용 합산, 713행 refund) — 마이크로초 단위라 실질 영향 미미. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:703-716` | `{i: _notice_cost(i) for i in content_indices}`로 한 번만 계산해 캐싱 |
| 5 | 성능 (performance) | Stop 경로에서 `evaluate_review(in_flight_ok=True)` 한 번의 호출 안에 `review/code/**` 전체 순회가 두 번 일어남(~37ms, 이 저장소 세션 829개 기준) — 이번 diff 의 결함이 아니라 기존 상태이며, 오히려 push 경로는 이번 diff 로 단락평가 덕에 순회 1회로 줄었다. | `.claude/hooks/_lib/review_guard.py:730-767`, `:382-390`, `:517-547` | 후속 작업으로 두 순회를 하나의 `os.walk` 패스로 통합 |
| 6 | 아키텍처/유지보수성 (scope, maintainability, dependency) | "origin 기본 브랜치 해석" 로직이 이번 diff 로 4번째 독립 구현(`_default_branch_ref` 신설)이 됨 — `branch_guard._origin_default_branch`(정본)·`review_guard._default_branch`·`consistency_orchestrator.py`의 `diff_base` 리터럴과 반환 형태까지 서로 다름. `_lib` 네임스페이스 충돌 해소가 선행돼야 통합 가능하다는 이유로 이미 `harness-review-gate-ci-backstop.md`에 defer 로 명시 등재됨(새 발견 아님). | `code_review_orchestrator.py:1168`(`_default_branch_ref`) vs `branch_guard.py:73`, `review_guard.py:201`, `consistency_orchestrator.py:443` | 조치 불요 — `_lib` 네임스페이스 통합 후속 작업 때 4곳 함께 통합 대상에 포함 |
| 7 | 유지보수성 (maintainability) | 잘린 목록 상한 `10`이 이름 없는 매직 넘버로 두 곳에 반복(1R·2R 리뷰에서 이미 지적, 두 라운드 모두 보류 판정). 동작은 테스트로 고정돼 있어 버그는 아님. | `code_review_orchestrator.py:1221`, `:1224` | `_MAX_LISTED_MISSING_FILES` 모듈 상수로 추출(선택 사항) |
| 8 | 유지보수성 (maintainability) | `collect_context`의 신규 지역 변수 `_rank_changed`/`_rank_plan_text`가 이 파일의 언더스코어 프리픽스 컨벤션(모듈 레벨 바인딩/중첩 함수 전용)에서 벗어남(2R 리뷰에서 이미 지적, 미반영 유지). 동작 영향 없는 순수 스타일 편차. | `consistency_orchestrator.py:452-453` | `rank_changed`/`rank_plan_text`로 이름 조정(권장, 낮은 우선순위) |
| 9 | 유지보수성 (maintainability, performance, dependency) | fresh-interpreter 테스트 보일러플레이트(`_PREAMBLE`/`run_in_orchestrator`, ~35줄)가 4개 테스트 파일에 복제 — `harness-review-gate-ci-backstop.md`의 defer 후속 3번으로 이미 추적 중. | `test_consistency_bundle_priority.py:39-68`, `test_prompt_omission_notice.py:41-81`, `test_review_changeset_warning.py:44-72` (+ 기존 `test_consistency_context_budget.py`) | `.claude/tests/_harness.py`에 `run_in_fresh_interpreter()` 공용 헬퍼 추출(이미 계획된 후속) |
| 10 | 아키텍처 (architecture) | 두 orchestrator에 걸쳐 "예산 초과로 생략된 파일을 이름으로 알린다"는 동일 설계 원칙이 서로 다른 자료구조(`change_info` 딕셔너리 리스트 vs 마크다운 번들 텍스트) 위에서 독립적으로 재구현됨 — 강한 결합은 부적절하나 공유 유틸리티화 여지가 있음. 현재는 `_lib` 네임스페이스 충돌로 직접 코드 공유가 막혀 있음. | `code_review_orchestrator.py:561`(`_omitted_content_note`) / `consistency_orchestrator.py:628-647`(`OMITTED_FILES_HEADING`/`_omitted_notice`) | 조치 불요 — `_lib` 네임스페이스 통합이 선행되면 자연 해소 |
| 11 | 아키텍처 (architecture) | 주석 표현 드리프트 — `_code_review_in_flight()`의 옛 주석("suppress **the gate**")이 이번 수정으로 명확해진 "억제 대상은 nudge 뿐, gate 아님" 불변식과 어긋난 옛 표현을 그대로 남김. 기능 결함 아님. | `.claude/hooks/_lib/review_guard.py:758-760` | "suppress the gate" → "suppress the nudge"로 통일(1단어 수정) |
| 12 | 테스트 (testing) | `_default_branch_ref`의 다단계 해석 로직(origin/HEAD symbolic-ref → origin/main → origin/master 우선순위)의 정상 경로가 직접 테스트되지 않음 — 기존 테스트는 예외 흡수만 검증하거나 함수 자체를 스텁으로 완전 대체. Fail-safe 설계이고 로직이 단순해 우선순위는 낮음. | `code_review_orchestrator.py:1168`, `test_review_changeset_warning.py:122` 부근 | 임시 git repo에서 origin remote/HEAD symbolic-ref 유무 조합으로 우선순위 분기를 확인하는 테스트 1~2개 추가 |
| 13 | 테스트 (testing) | `_CATALOG_BULK_RE = re.compile(r"(^|/)[^/]*-api-catalog/")`의 `(^|/)` 대안 중 `^` 분기(카탈로그 디렉터리가 리포 루트에 바로 오는 경로)가 어떤 fixture 로도 실행되지 않음 — 기존 fixture 는 전부 `/` 분기만 거침. | `consistency_orchestrator.py:242`, 관련 테스트 `test_consistency_bundle_priority.py` | `test_catalog_bulk_sinks_below_everything` 옆에 루트-앵커 경로 케이스 1개 추가 |
| 14 | 테스트 (testing) | `DefaultPathIsWiredTest`가 "경고 미발생"을 `branch`/`range` 모드만 검증하고 `commit`/`files` 모드는 검증하지 않음 — 구조상(독립된 elif) 안전이 명백하나 직접 확인하는 테스트는 없음. | `test_review_changeset_warning.py:156`, `:187-193` | `test_explicit_commit_does_not_warn`/`test_explicit_files_does_not_warn` 2건 추가로 매트릭스 완성(우선순위 낮음) |
| 15 | 문서 동기화 (documentation) | `consistency-checker/SKILL.md` 말미의 `./README.md` 참조가 대상 파일 없이 매달려 있음(해당 디렉터리에 README.md 존재한 적 없음) — 이번 diff 밖의 기존 결함. | `.claude/skills/consistency-checker/SKILL.md:147` | 세션 디렉토리 스키마/디버그 로그 위치를 SKILL.md 본문에 직접 기술하거나 실제 문서로 링크 갱신 |
| 16 | 문서 동기화 (documentation) | plan 문서의 재발 횟수 서술("3회 재현" 헤딩)이 바로 아래 표(4행)와 불일치 — 회차 2는 다른 결함 축(diff 매칭 없는 scope 산정)이라 계수에서 제외된 것으로 보이나 그 사유가 표에 명시돼 있지 않음. 이번 diff 밖의 기존 결함. | `plan/in-progress/harness-consistency-summary-downgrade-rule.md:125` | 헤딩을 "4회 재현(그중 3회 동일 버그, 1회 별도 결함)"으로 정정하거나 회차 2행에 각주 추가 |
| 17 | 문서 동기화 (documentation) | `.claude/tests/README.md`의 `test_review_guard_hardening.py` 카탈로그 행이 이번 PR 의 핵심 신규 pin(Stop-only `in_flight_ok` 분리)을 명시하지 않고 기존 "in-flight suppression" 일반 문구만 유지. `test_tests_readme_catalog.py`는 행의 존재만 검증해 내용 staleness 는 못 잡음. | `.claude/tests/README.md:40` | 해당 행에 "Stop-only `in_flight_ok` opt-in — push 는 항상 opt-out" 구절 추가 |
| 18 | 변경 범위 (scope) | 서로 독립적인 5개 결함 수정(하향 금지+planner 인계 / 번들 우선순위 재배열 / omission-notice 예산 수정 / in-flight Stop-only 스코프 축소 / 기본 changeset 누락 경고)이 한 브랜치/리뷰 라운드에 번들됨 — 각각 plan 항목·전용 테스트가 있어 은폐된 확장은 아니나 리뷰 단위가 원자적이지 않음. | `plan/in-progress/harness-consistency-summary-downgrade-rule.md:9`, `plan/in-progress/harness-review-gate-ci-backstop.md:9` | 조치 불요(이번 건은 문제 없음) — 향후 유사 브랜치는 결함별 PR 분리 고려 가능 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 하향 금지 정책 기계적 backstop 부재(WARNING #2), `BLOCK:` 파싱 섹션 앵커 없음(INFO #1). in-flight 스코프 축소·커맨드 인젝션/경로 탐색/시크릿 없음 확인 |
| performance | LOW | O(n×m) plan-mention 탐색(INFO #3, 현재 안전), `_notice_cost` 중복 계산(INFO #4), Stop 경로 이중 순회(INFO #5, 기존 상태) |
| architecture | LOW | `evaluate_review` flag-argument 패턴(WARNING #7), 브랜치 diff 헬퍼 신규 중복 발견(WARNING #6), `build_files_section` 구조적 복잡도(WARNING #1 공동) |
| requirement | **CRITICAL** | `build_files_section` 예산 선반영 전략이 파일 수 증가 시 재발(CRITICAL #1); push 테스트 flaky 가능성(WARNING #8); 그 외 회귀 없음·spec 정합성 양호 확인 |
| scope | NONE | 5개 결함 번들(INFO #18, 문제 없음), 기존 중복(defer) 재확인 외 무관 변경 0건 |
| side_effect | LOW | `--staged` 면제 누락(WARNING #3); 이전 라운드 CRITICAL 1건·WARNING 2건 전부 해소 재확인 |
| maintainability | LOW | `build_files_section` 3중 예산전략 누적(WARNING #1 공동); 매직넘버/네이밍/보일러플레이트 중복 등 INFO 4건(대부분 1R/2R 기지정·defer) |
| testing | LOW | 뮤테이션 7건 전부 의도대로 RED 전환 확인; `_branch_changed_rels` 실동작 미검증(WARNING #5); 세부 분기 커버리지 갭 INFO 3건 |
| documentation | LOW | changeset 경고 SKILL.md 미반영(WARNING #4); 기존 문서 drift 3건(INFO #15-17, 이번 diff 밖) |
| dependency | NONE | 신규 외부 의존성 0건; 내부 중복(INFO #6)만 재확인 |
| database | NONE | 해당 코드 없음 |
| concurrency | LOW | in-flight 억제 공유 레이스가 이번 diff 로 정확히 스코프 분리됨을 뮤테이션/테스트로 확인(해결됨, 회귀 없음); 나머지는 단일 프로세스 동기 코드라 위험 없음 |
| api_contract | NONE | 해당 없음 — 제품 HTTP/REST API 표면 변경 없음 |
| user_guide_sync | NONE | 매트릭스 21행 전수 대조, 매칭 0건 |

## 발견 없는 에이전트

- database — 해당 코드 없음(위험도 NONE)
- api_contract — 제품 API 표면 변경 없음(위험도 NONE)
- user_guide_sync — doc-sync-matrix 21행 매칭 0건(위험도 NONE)

## 권장 조치사항

1. **[CRITICAL, 최우선]** `build_files_section`의 예산 선반영 전략을 `truncate_file_bundle`과 동일한 반복 재검증 방식으로 재작성 — 파일 포함/생략 결정마다 "지금까지 확정된 전체 길이"를 실측해 예산과 비교하고, 최종 조립 후에도 초과 시 압축 고지("N개 파일 생략")로 대체하는 폴백 추가. `test_prompt_omission_notice.py`에 수백~`DEFAULT_MAX_PROMPT_SIZE`급 회귀 케이스 추가.
2. 위 수정과 함께, `build_files_section`의 3개 오버플로 전략을 이름 있는 헬퍼(`_render_unbounded`/`_render_diff_only_overflow`/`_allocate_content_budget`)로 분리해 같은 클래스의 결함이 세 번째로 재발하지 않도록 구조 정리.
3. "Critical 하향 금지" 정책에 기계적 backstop(checker 별 `[CRITICAL]` 개수 vs 최종 `BLOCK:` 모순 검사) 구현 우선순위 상향.
4. `warn_if_committed_work_is_missing`을 `--staged` 명시 스코프에서 면제하거나(권장), 의도적이면 `DefaultPathIsWiredTest`에 테스트를 추가해 계약으로 고정.
5. `_branch_changed_rels`(tier 0 데이터 소스)의 실제 git 동작을 직접 단언하는 테스트 추가 — 임시 git repo 패턴 재사용.
6. `code-review-agents/SKILL.md` §1에 changeset 누락 경고 caveat 한 줄 문서화.
7. `_branch_changed_rels`/`get_git_branch_diff_files` 브랜치 diff 헬퍼 중복을 기존 백로그(`harness-review-gate-ci-backstop.md`)의 "origin 기본 브랜치 해석 중복" 스코프에 편입하거나 신규 후속 항목으로 별도 등재.
8. `evaluate_review()`의 `in_flight_ok` flag-argument 를 의도가 드러나는 두 wrapper 함수(`evaluate_review_for_push`/`_for_stop`)로 분리(장기 개선, 현재는 테스트로 충분히 방어됨).
9. `test_push_never_opts_into_the_in_flight_concession`의 `_run()`이 격리된 cwd(`self.tmp`)를 명시적으로 넘기도록 수정해 flaky 가능성 제거.

## 라우터 결정

- 라우터 미사용 (`routing=skipped`) — 전체 reviewer 실행됨.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 확인됨(누락 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |