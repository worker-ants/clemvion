# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 14개 reviewer 중 11개가 독립적으로 지목한 미배선 orphan 파일(1,304줄, 이 PR 이 고치는 결함의 pre-fix 스냅샷)에 더해, 이 PR 의 핵심 주장("8회 재발 결함군을 완전히 닫았다")과 직접 모순되는 실제 코드 갭(`plan_in_progress` 번들 미정렬, architecture 리뷰어 단독 발견이나 본 요약 작성 중 코드 직접 대조로 검증 완료) 및 이 저장소가 스스로 강제하는 표준 테스트 실행에서 재현 가능한 CI 타임아웃(testing 리뷰어, 2/2 재현 + cProfile 근본원인 확정)까지 3건의 CRITICAL 이 확인됨. 각 항목의 수정 비용은 낮음(파일 삭제 1건 + 코드 1줄 + 테스트 스텁 1줄)이나 병합 전 반드시 처리 필요.

> **주의 — 리뷰어 간 상충 주장 발견, 검증 완료**: requirement 리뷰어는 "`plan_in_progress` 번들은 의도적으로 범위 밖(plan 문서에 열린 후속으로 명시)"이라 기술했으나, 본 요약 작성 중 `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 와 `plan/in-progress/harness-review-gate-ci-backstop.md` 를 직접 grep/Read 로 대조한 결과 **그런 명시는 어디에도 없다** — 해당 문서가 명시적으로 "열린 후속"이라 표기한 항목은 오직 natural sort(같은 tier 내 정렬) 하나뿐이며, "적용 지점" 목록(`harness-consistency-summary-downgrade-rule.md:147`)은 `--impl-prep`/`--impl-done` 의 scope 번들 + `related_specs` + `conventions` 만 명시하고 `plan_in_progress` 제외 사유는 어디에도 없다. 코드(`consistency_orchestrator.py:574,580-581,586`)도 architecture 리뷰어의 주장과 정확히 일치함을 직접 확인했다. 즉 이 갭은 "이미 추적된 defer" 가 아니라 **살아있는 CRITICAL**이다 — requirement 리뷰어의 체크리스트 주장을 근거로 이 항목을 넘기지 말 것.
> **강제 화이트리스트(router_safety) 이행 확인**: forced 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope/저장소위생 | 이 PR 이 고치는 버그(예산 초과 시 파일이 안내 없이 통째로 누락)의 **pre-fix 스냅샷**이 신규 파일로 그대로 커밋됨. `git rev-parse origin/main:.../code_review_orchestrator.py` 와 `git rev-parse HEAD:.../_probe_main.py` 가 **완전히 동일한 blob 해시**(`8aedb8eb8f1a4f19cc0d15bafd7aedee7ee530f0`, 본 요약 작성 중 재검증 완료)를 반환 — 이번 3R 수정(`_omitted_content_note`/`_aggregate_omission_note`/`warn_if_committed_work_is_missing`/`_default_branch_ref`)이 전혀 반영 안 된 옛 코드다. 저장소 전체에 참조 0건(SKILL.md·테스트·문서 어디에도 없음, 이번 리뷰 세션 메타파일 제외)이지만 `if __name__=="__main__":main()` 을 갖춘 완전한 실행형 CLI라 실수로 실행되면 이미 고친 결함이 그대로 재현된다. 로컬 `.pyc` 캐시가 남아있어 실제 실행 이력 정황도 있음(testing 리뷰어 확인). diff 순증가분(2,749줄)의 약 47%를 차지. **14개 reviewer 중 11개가 독립 지목**(CRITICAL 7: requirement/scope/side_effect/maintainability/testing/documentation/dependency, WARNING 3: security/performance/architecture, INFO 1: concurrency) — 이번 세션 최다 중복 발견. | `.claude/skills/code-review-agents/scripts/_probe_main.py` (신규 파일 전체, 1,304줄) | `git rm .claude/skills/code-review-agents/scripts/_probe_main.py`. 비교용으로 필요했다면 저장소 밖 scratch 디렉터리로 옮기고 커밋 범위에서 제외. |
| 2 | Architecture | `prioritize_bundle_files` 4-tier 재배열이 `plan_in_progress` 번들에는 적용되지 않아, 이 PR 이 "닫았다"고 서술하는 바로 그 결함 클래스가 `plan_coherence`/`naming_collision` 경로에 그대로 남음. 코드 직접 대조로 검증: `collect_context()` 에서 `other_spec_files`/`convention_files` 는 `_prioritized()` 를 거치지만(:580-581) `plan_files` 는 그렇지 않음(:574,586). `plan_coherence` 의 유일 corpus, `naming_collision` 의 corpus 3개 중 하나가 정확히 `plan_in_progress`(`_corpus_keys()`:696-699, `CHECKER_INSTRUCTIONS["plan_coherence"]["context_key"]="plan_in_progress"`). 실측: 현재 `plan/in-progress/` 30개 파일·1.0MB 가 `plan_coherence` 예산 배분(262144×0.40÷1키≈104,857자)의 약 10배 — 즉 이 저장소 현재 상태에서 관련 checker 호출 시 알파벳순 tail-drop 절단이 사실상 상시 발생. plan 문서 자신의 "3회 재현" 표 4번째 사례가 정확히 이 번들·이 checker 조합이었는데도 이번 수정 스코프에서 빠졌고, 근거 주석도 없어 의도적 축소가 아니라 누락으로 판단됨. `test_consistency_bundle_priority.py` 의 4개 케이스도 `plan_in_progress` 는 검증하지 않음. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:574`(`plan_files = collect_markdown_files(...)`, `_prioritized()` 미호출), `:580-581`(대조군), `:586`(`plan_in_progress = format_file_bundle(plan_files, ...)`), `:696-699`(`_corpus_keys`), `:717-724`(`budget_substitutions`) | `collect_context()`의 `plan_files = collect_markdown_files(...)` 직후 `plan_files = _prioritized(plan_files)` 한 줄 추가(다른 두 지점과 동일 패턴). `test_consistency_bundle_priority.py` 에 5번째 sentinel-order 케이스(`plan_in_progress` 대상) 추가. |
| 3 | Testing | 신규 n=1,200 테스트가 검증 대상과 무관한 이유로 **표준 테스트 실행에서 재현 가능하게 타임아웃 실패**. 픽스처 빌더 `change_info()` 가 `build_cli_change_info(path, diff_content="", ...)` 로 호출하는데, `diff_content=""` 가 falsy 취급되어(`code = diff_content or ""`) `if not code and full_file_content:` 분기로 빠져 존재하지 않는 가짜 경로 1,200개 각각에 대해 `get_git_diff_content()` 가 실제 git subprocess 를 2회씩(총 2,400회) 실행함. cProfile 실측: `build_cli_change_info`×1200 = 29.35초, 정작 테스트 대상인 `build_files_section` 자체는 0.166초 — 런타임의 99% 이상이 검증과 무관한 subprocess 폭주. 문서화된 표준 실행 커맨드(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`)를 편집 없이 연속 2회 실행한 결과 **2회 모두** `subprocess.TimeoutExpired` 로 실패 — 이 저장소가 매 fix 후 강제하는 TEST WORKFLOW 게이트 자체가 회귀와 무관하게 거짓 RED 를 낼 수 있는 상태. (requirement 리뷰어도 동일 증상을 WARNING 으로 별도 관측했으나 근본원인 미특정 — 이 항목이 근본원인 확정+재현 확인을 포함하는 상위 판정) | `.claude/tests/test_prompt_omission_notice.py:176`(테스트), `:190`(fixture), `:52-55`(`change_info` 헬퍼), `:77`(`timeout=30.0`). 근본원인: `code_review_orchestrator.py:1043`(`code = diff_content or ""`), `:1053`(분기), `:937`(`get_git_diff_content`) | 테스트 프리앰블에서 `orch.get_git_diff_content = lambda p: ""` 스텁 처리(같은 파일의 자매 스위트 `test_review_changeset_warning.py` 가 이미 쓰는 패턴과 동일). |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 이번 라운드에 **신규 작성**된 plan 문서 블록의 헤더 개수와 실제 나열 항목 수가 어긋남 — 헤더는 "신규 후속 **3건**(defer)" 이라 쓰지만 바로 아래 번호 목록은 1~7번(7개) + 번호 없는 8번째 항목까지 존재. | `plan/in-progress/harness-review-gate-ci-backstop.md:27`(헤더) vs `:29-63`(번호 목록), `:65-71`(8번째) | "3건" → 실제 개수(7건 + 별도 8번째)로 정정. |
| 2 | Documentation | 신규 `_CATALOG_BULK_RE`(`r"(^|/)[^/]*-api-catalog/"`) 정규식이 근거로 인용하는 `spec-impl-evidence.md` R-7 보다 매칭 범위가 넓음 — R-7 은 **중첩 경로**(`<resource>/**`, 222개 파일)만 "정식 spec 아님"으로 규정하는데, 실제 정규식은 R-7 이 "정식 spec"이라 부르는 **최상위 인덱스 파일**(`product.md`, `_overview.md` 등 19개)까지 함께 tier 3(최후순위)로 강등시킴. 이는 주석/문서 정합성 문제를 넘어 실제 우선순위 계산 동작에 영향(정식 spec 19개가 예산 부족 시 최우선 절단 대상이 됨). 관련 테스트 전부 중첩 경로만 fixture 로 사용, 최상위 인덱스 비-강등 방향은 미단언. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:236-242`(정의+주석), `:311`(사용처) | 의도가 "카탈로그 트리 전체 강등"이면 주석/R-7 인용을 그렇게 정정. R-7 원 구분을 따르고 싶다면 정규식을 `r"(^|/)[^/]*-api-catalog/[^/]+/"` 로 좁히고 최상위 인덱스 비-강등 테스트 추가. |
| 3 | Maintainability/Documentation | 신규 테스트 3개 파일이 "fresh-interpreter subprocess" 보일러플레이트(`_PREAMBLE`+`run_in_orchestrator`, ~30줄)를 각각 복제(기존 `test_consistency_context_budget.py` 포함 4곳째). `harness-review-gate-ci-backstop.md` 신규 후속 7번이 이미 `_harness.py` 추출을 등재했으나, `.claude/tests/README.md` "Conventions for new tests" 섹션은 이 패턴 자체를 전혀 언급하지 않아 다음 작성자가 5번째 사본을 만들 위험이 여전함(코드 중복 제거와 문서화는 별개 절반). | `.claude/tests/test_consistency_bundle_priority.py:39-68`, `test_prompt_omission_notice.py:41-81`, `test_review_changeset_warning.py:44-72`; `.claude/tests/README.md:62-84` | (defer 유지, 이번 PR 차단 사유 아님) `_harness.py` 추출 시 README "Conventions for new tests" 에 이 패턴과 사유(`_lib` 네임스페이스가 프로세스 전역이라 in-process 로더로 못 피함)를 항목으로 추가. |
| 4 | Maintainability | `build_files_section` 한 함수(587-771줄, ~185줄)가 예산 전략 3가지(무예산/헤더+diff 초과/콘텐츠 배분+2단계 렌더)를 병렬로 재구현 — 이번 라운드 CRITICAL 수정으로 22줄 더 길어짐. 이미 `harness-review-gate-ci-backstop.md` 신규 후속 3번에 "3R CRITICAL 이 정확히 이 구조에서 재발" 로 기록되고 `_render_unbounded`/`_render_diff_only_overflow`/`_allocate_content_budget` 분리가 후속으로 등재돼 있음 — 구조 자체는 이번에도 해소 안 됨. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587-771` | (defer 유지) 같은 클래스 결함이 2라운드 연속 재발했으므로 다음 라운드 우선순위 상향 권장. |
| 5 | Maintainability | git "기본 브랜치" 해석 로직이 이번 PR 로 **4번째** 독립 구현이 됨(`branch_guard._origin_default_branch()`, `review_guard._default_branch()`, `consistency_orchestrator` 의 `args.diff_base or "origin/main"` 리터럴에 이어 신규 `_default_branch_ref()`) — 반환 계약도 서로 다름(로컬 `main` vs `origin/main`). `harness-review-gate-ci-backstop.md` 에 "`_lib` 네임스페이스 충돌 해소 선행" 조건부 defer 로 이미 등재됨. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1190-1211`(`_default_branch_ref`, 신규) | (defer 유지) 최소한 기존 3개 구현을 가리키는 "change together" 주석 추가 권장. |
| 6 | Maintainability | `collect_context()` 가 기존 ~155줄 함수에 이번 랭킹 준비 로직(`_rank_changed`/`_rank_plan_text`/`_prioritized` 클로저, :452-465)까지 인라인으로 얹혀 ~170줄로 증가 — 독립적 책임(우선순위 계산 준비)인데 분리되지 않음. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:428-598` | 랭킹 입력 계산 + `_prioritized` 클로저 생성을 별도 팩토리 함수(예: `_make_bundle_prioritizer(...)`)로 추출 검토. 블로킹 사유 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/Concurrency/Testing 등(공통 확인) | `evaluate_review(in_flight_ok: bool=False)` — 리뷰 세션 in-flight 완화가 push(하드게이트)/Stop(소프트 nudge)에 무조건 공유되던 access-control 결함을 opt-in 파라미터로 정확히 스코프 축소. push 가드는 위치인자만 넘겨 기본값 유지, Stop 가드만 명시 opt-in. 함수 레벨(양방향 결정) + seam 레벨(전달 kwarg 값 자체 기록) 이중 테스트로 봉쇄 확인 — 5개 리뷰어(security/side_effect/concurrency/testing/requirement)가 독립적으로 동일 결론. | `.claude/hooks/_lib/review_guard.py:862-903`, `guard_review_before_stop.py:344`, `guard_review_before_push.py:845-846` | 조치 불요. 향후 신규 호출부 추가 시 "안전한 기본값+명시적 opt-in+seam 단언" 패턴 유지 권장. |
| 2 | Side Effect | `consistency_orchestrator.collect_context()` 의 `diff_base`(git diff subprocess) 계산이 `--impl-done` 전용에서 전 모드(`--spec`/`--plan`/`--impl-prep`/`--impl-done`) 공통으로 확장 — 번들 우선순위 산정에 필요한 의도된 확장. SKILL.md 에 정확히 반영, 실패 시 fail-safe(빈 set) 확인. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249,275,452` | 조치 불요. |
| 3 | Performance | `_notice_cost()` 가 예산 계상 시 동일 인덱스에 대해 2번 계산(사전 합산 1회 + 루프 내 재계산 1회, 캐싱 없음) — n=1,200 규모에서 문자열 생성 비용 불필요하게 2배. 정상 배치 크기(50)에서는 체감 없음. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:703-716` | `{i: _notice_cost(i) for i in content_indices}` 로 1회만 계산해 재사용. |
| 4 | Performance | 예산 초과+생략 파일 존재 분기에서 `_render()` 가 전체 파일 목록을 2번 조립하고 첫 결과를 폐기 — n=1,200 같은 대규모 시나리오에서 정확히 2배 비용 발생하나 절대 비용은 LLM 호출 대비 무시할 수준(추정 수십~수백ms). | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:738-771` | 급하지 않음. 필요 시 렌더 전 산술적으로 모드 결정 후 1회만 렌더하도록 개선 가능. |
| 5 | Maintainability | 매직넘버 `10`(누락 파일 나열 상한)이 한 함수 안에서 3번 리터럴 반복. 테스트가 값을 고정해 동작은 안전하나 유지보수 시 3곳 동시 수정 필요. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1243,1245,1246` | `_MAX_LISTED_MISSING_FILES = 10` 모듈 상수로 추출. |
| 6 | Maintainability | 지역 변수 `_rank_changed`/`_rank_plan_text` 에 언더스코어 프리픽스 — 이 파일에서 프리픽스는 보통 모듈-전역 private 함수용이라, 지역 변수에 쓰이면 "모듈 상태냐"는 순간적 오독 유발 가능. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:452-453` | 프리픽스 제거(`rank_changed`/`rank_plan_text`). |
| 7 | Maintainability | `evaluate_review(in_flight_ok: bool=False)` boolean 플래그로 push/stop 두 보증 수준을 스위칭 — 현재는 양방향 테스트로 안전하나 3번째 호출부가 생기면 "기본값이 안전한 쪽"이라는 암묵적 가정에만 의존하게 됨. 이미 plan 후속(신규 후속 5번)으로 등재됨. | `.claude/hooks/_lib/review_guard.py:862-864` | (defer 유지) `evaluate_review_for_push()`/`evaluate_review_for_stop()` 얇은 wrapper 검토. |
| 8 | Concurrency | (사전 존재, 이번 diff 무관) Stop nudge "세션당 1회" 마커가 check-then-act(`_already_nudged`→`_mark_nudged`)로 비원자적 — 서로 다른 세션은 마커가 겹치지 않고 한 세션 내 Stop 훅도 순차 실행이라, 발현하려면 `session_id` 가 `"nosession"` 으로 겹치는 서로 다른 프로세스의 진짜 동시 실행이 필요(드묾). 발현해도 결과는 nudge 중복 표시뿐. | `.claude/hooks/guard_review_before_stop.py:208-209,212-218,231-240` | 조치 불요(활성 위험 아님). 여유 있으면 `os.O_CREAT|O_EXCL` 로 원자화 검토. |
| 9 | Documentation | 신규 `BranchChangedRelsAgainstRealGitTest._repo()` 가 README 명시 격리 컨벤션(`GIT_CONFIG_GLOBAL=/dev/null` 등, 같은 PR 의 `test_review_guard_hardening.py` 는 이미 준수)을 따르지 않아 호스트의 전역 git 설정(서명/훅)을 물려받을 잠재 소지. | `.claude/tests/test_consistency_bundle_priority.py:215-236` | `_git()` 헬퍼에 `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM=os.devnull` 추가 권장. |
| 10 | Dependency | 신규 외부 패키지 없음 — 변경된 모든 `.py` 파일의 import 전수 대조 결과 stdlib + 기존 내부 모듈 뿐, 매니페스트(`package.json`/`requirements.txt` 등) 변경 0건. `.claude/tests/README.md` 의 "hooks 는 bare python3 에서만 실행" 관례 유지 확인. | 변경 파일 전체 | 조치 불요. |
| 11 | Requirement | (사전 존재, 이번 diff 미악화) `build_files_section` diff-only 오버플로 분기가 안내문 길이를 계상에 반영하지 않아 여전히 상한 초과 가능, n=3000 규모에서 헤더만으로도 상한 초과 등 — `harness-review-gate-ci-backstop.md` 신규 후속 1·3·4번에 원인·재현치·defer 사유 이미 명시됨. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`(diff-only 오버플로 분기) | (조치 불요, 이미 추적 중) 별도 후속 PR. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | orphan 파일 WARNING(파일명 유사로 인한 향후 오인 실행 위험); in-flight 스코프 축소·하향금지 정책 등 access-control 개선 전부 정확히 배선·검증됨 |
| performance | LOW | orphan 파일 WARNING(자기 자신이 이 PR 이 고치는 예산 낭비 문제를 리뷰 세션에서 재현); `_notice_cost`/`_render` 소폭 중복계산 INFO |
| architecture | HIGH | **`plan_in_progress` 번들 미정렬 CRITICAL(신규 발견, 코드 검증 완료)**; orphan 파일 WARNING |
| requirement | HIGH | orphan 파일 CRITICAL; n=1200 테스트 타임아웃 WARNING(근본원인은 testing 이 확정); `plan_in_progress` 를 "의도적 defer"로 오판(본 요약에서 반증) |
| scope | HIGH | orphan 파일 CRITICAL(diff 순증가분의 47% 차지, 이 PR 의도된 범위 밖) |
| side_effect | CRITICAL | orphan 파일 CRITICAL(blob 해시 완전 일치로 pre-fix 스냅샷 증명) |
| maintainability | HIGH | orphan 파일 CRITICAL; `build_files_section` 3전략·git 브랜치해석 4중복·테스트 보일러플레이트 등 기존 추적 부채 WARNING 다수 |
| testing | CRITICAL | **n=1200 테스트 타임아웃 CRITICAL(근본원인 cProfile 확정, 2/2 재현)**; orphan 파일 CRITICAL(커버리지 0%, 고쳐진 결함의 생존 사본) |
| documentation | HIGH | orphan 파일 CRITICAL; plan 헤더 개수 불일치·`_CATALOG_BULK_RE` 범위 과다 WARNING(신규 발견) |
| dependency | HIGH | orphan 파일이 내부 의존 그래프 전체를 포크한 미아 모듈로 CRITICAL; 신규 외부 패키지는 0건(NONE) |
| database | NONE | 변경 대상 전부 harness 코드/문서, DB 계층 코드 없음 |
| concurrency | LOW | in-flight 레이스 스코프 축소 정확히 검증(INFO); orphan 파일은 죽은 코드라 활성 동시성 위험 0(INFO) |
| api_contract | NONE | REST/HTTP API 계약 대상 코드 변경 없음 |
| user_guide_sync | NONE | `doc-sync-matrix.json` 21개 trigger 전수 대조, 매칭 0건 |

## 발견 없는 에이전트

- **database** — 적용 대상 코드 없음(harness 전용 변경, DB 계층 무관)
- **api_contract** — REST/HTTP API 계약 변경 없음(`codebase/**` 변경 0건)
- **user_guide_sync** — `doc-sync-matrix.json` trigger 무매치(변경 전부 `.claude/**`/`plan/**`)

## 권장 조치사항

1. **`_probe_main.py` 삭제** — `git rm .claude/skills/code-review-agents/scripts/_probe_main.py`. 14개 reviewer 중 11개가 독립 지목한 최다-중복 CRITICAL, blob 해시로 pre-fix 스냅샷임이 확정 검증됨. 단일 명령으로 즉시 해소.
2. **`consistency_orchestrator.py` 의 `plan_in_progress` 번들에 4-tier 우선순위 배선** — `collect_context()` 의 `plan_files = collect_markdown_files(...)` 직후 `plan_files = _prioritized(plan_files)` 한 줄 추가(다른 두 지점과 동일 패턴) + `test_consistency_bundle_priority.py` 에 회귀 테스트 추가. **"이미 defer 된 항목"이라는 requirement 리뷰어의 체크리스트 주장은 plan 문서 재검증 결과 근거 없음** — 이번 PR 이 실제로 놓친 살아있는 CRITICAL 로 취급할 것.
3. **`test_prompt_omission_notice.py` 의 `change_info()` 헬퍼 수정** — 프리앰블에서 `orch.get_git_diff_content` 를 스텁 처리해 표준 테스트 실행에서 재현되는 타임아웃(2/2 재현 확인됨) 제거.
4. (우선순위 중) plan 문서 `harness-review-gate-ci-backstop.md:27` 헤더 "신규 후속 3건" → 실제 개수(7~8건)로 정정, `_CATALOG_BULK_RE` 의 R-7 인용 범위와 실제 매칭(최상위 인덱스 19개 포함 여부) 정합화.
5. (낮은 우선순위, 이미 defer 등재됨 — 이번 PR 차단 사유 아님) `build_files_section` 3전략 통합, git 기본 브랜치 해석 4중복 통합(`_lib` 네임스페이스 정리 선행), 테스트 보일러플레이트 `_harness.py` 추출 + README 컨벤션 문서화, `evaluate_review` boolean-flag wrapper화 — 다음 라운드에서 우선순위 상향 검토 권장(같은 클래스 결함이 이미 2라운드 연속 재발).

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유 미기재(prompt 에 `routing_skip_reason` 값 없음). 전체 reviewer(14명) 실행됨.
- **router_safety 강제 화이트리스트**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인, 화이트리스트 미이행 없음.
- 제외된 reviewer: 없음(routing 자체가 스킵되어 전원 실행).