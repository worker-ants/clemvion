# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — 이 PR 자체의 3개 핵심 수정(`evaluate_review`의 Stop 전용 in-flight 스코프 축소, consistency 번들 4계층 우선순위 재배열, 기본 `--prepare` changeset 누락 경고)은 의도대로 정확히 배선되고 테스트(`.claude/tests` 전체 684건 통과, 다수 리뷰어가 직접 재현)로 뒷받침됩니다. 그러나 (1) **이번 리뷰 세션 자체에서** code-review-agents 오케스트레이터의 기존 프롬프트 조립 결함이 실제로 발현되어, 이 PR의 핵심 파일 2개(`review_guard.py`, `code_review_orchestrator.py` 자신 — 즉 diff 대상 그 자체)가 14명 리뷰어 전원의 프롬프트에서 아무 생략 표시 없이 완전히 누락되었고(다수 리뷰어가 `git diff` 직접 실행으로 우회해 이번엔 실질 리뷰 공백으로 이어지지는 않았으나, 완전히 우회되었다는 보장은 없음), (2) 이 PR이 신설한 `_default_branch_ref()`가 예외 처리 없이 크래시 가능한 경로를 남겨 자신이 지원하는 함수의 "무실패(advisory-only)" 계약을 위반합니다. 두 사안 모두 즉시 후속 조치가 필요합니다.

**참고**: 강제 포함(router_safety) 대상 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 화이트리스트 미이행 없음. 재시도 필요 항목 0건(14개 reviewer 전원 전문 확보).

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | harness 신뢰성 (프롬프트 조립) | `code_review_orchestrator.py`의 `build_files_section()`이 프롬프트 총예산 초과 시 가장 큰 파일(들)을 어떤 생략 표시도 없이 통째로 누락시킨다. 이번 리뷰 세션에서 실제로 발생 — 11개 파일을 크기 오름차순 정렬 시 `consistency_orchestrator.py`(938줄)에서 예산이 소진돼 부분 절단되고, 그보다 큰 `review_guard.py`(960줄)·`code_review_orchestrator.py`(1,357줄, 최대 파일)는 diff·전체 내용 모두 14개 reviewer 프롬프트 전부에서 완전히 비었다(security.md/documentation.md 등에서 바이트 단위로 대조 확인). diff 자체가 도입한 결함은 아니나(기존 코드, 이 PR의 변경 대상 아님), 이 PR이 바로 "reviewer가 대상을 못 본 채 BLOCK:NO"라는 실패 클래스를 consistency-checker 쪽에서 고치는 중이었다는 점에서 code-review-agents 쪽에 동일 결함이 남아있다는 실증. | `code_review_orchestrator.py` `build_files_section`(~561행 정의, ~643-673행 `remaining_budget` 소진 시 `break` 분기) | 예산 소진으로 `include_content`에 못 들어간 파일에도 `consistency_orchestrator.py`가 이번에 도입한 `OMITTED_FILES_HEADING`류 생략-표시 패턴을 이식. 최소한 기존 diff-truncation 분기(~638행)의 안내 문구를 full-content 분기에도 적용. |
| 2 | 안정성 (예외 처리) | 신설 `_default_branch_ref()`만 이 파일의 다른 9개 git 헬퍼(`get_git_diff_files` 등)와 달리 `_git()` 호출 2곳을 `try/except`로 감싸지 않았다. `git` 바이너리 부재(`FileNotFoundError`)나 타임아웃(`subprocess.TimeoutExpired`) 발생 시 예외가 `warn_if_committed_work_is_missing()` → `collect_change_infos()` → `main()`(상위 try/except 없음)까지 그대로 전파되어, 인자 없는 기본 `--prepare` 경로(가장 흔한 리뷰 준비 진입점) 전체가 크래시할 수 있다. 이는 `warn_if_committed_work_is_missing` 자신의 docstring이 명시한 "Advisory only ... Silent on any git failure" 계약과 정면으로 모순된다. 같은 커밋의 자매 함수 `consistency_orchestrator._branch_changed_rels`는 동일 상황을 `try/except`로 올바르게 처리해, 한 PR 안에서 한쪽 orchestrator는 맞고 다른 쪽은 틀린 상태다. 신규 테스트(`test_review_changeset_warning.py`)는 이 함수 전체를 `orch._default_branch_ref = lambda: ARG["base"]`로 스텁 처리해 실제 예외 경로를 검증하지 않는다. (4명의 리뷰어가 독립적으로 수렴: maintainability는 CRITICAL, architecture/requirement/side_effect는 WARNING으로 동일 근본원인을 지적) | `code_review_orchestrator.py:1092-1101`(`_default_branch_ref`), `:1104-1141`(`warn_if_committed_work_is_missing`), `:1182`(`collect_change_infos` 호출부), `:1337`(`main()`) | `_default_branch_ref()` 본문을 다른 9개 헬퍼와 동일하게 `try/except Exception as e: debug_log(...); return None`으로 통일. `subprocess.run`이 예외를 던지는 케이스(monkeypatch)를 실제로 검증하는 단위 테스트 추가. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 기능 정확성 (랭킹 로직) | `prioritize_bundle_files`의 `tier()` 판정에서 `_is_catalog_bulk`(카탈로그 강등) 체크가 `rel in changed`(브랜치 변경 여부) 체크보다 먼저 실행된다. docstring은 계층 우선순위를 "0. 브랜치가 변경 — 가장 강한 신호" > "1. plan 언급" > "2. 나머지" > "3. catalog bulk; last"로 명시하지만, 실제로는 카탈로그 강등이 브랜치-변경 신호보다 항상 우선 적용된다. 리뷰어가 직접 실행해 확인: 브랜치가 `spec/conventions/cafe24-api-catalog/product/fields.md`(카탈로그 하위 파일)를 실제로 변경해도 변경되지 않은 다른 파일들보다 뒤로 밀린다 — alphabetical 위치에 따라 `truncate_file_bundle`에 잘려나갈 수 있다. 테스트는 "plan 언급 vs 카탈로그" 조합만 있고 "브랜치 변경 + 카탈로그" 조합은 미검증. 이 PR이 고치려는 결함 클래스(사전순 대량 문서가 실제 작업 대상을 예산 밖으로 밀어냄, 8회 재발)가 카탈로그 하위 파일을 직접 수정하는 PR에 한해 여전히 재현될 수 있다는 뜻 — 이 PR 자신의 목적을 스스로 훼손하는 edge case. | `consistency_orchestrator.py:289-297`(`tier()` 클로저), docstring `:276-282` | 의도된 정책(카탈로그가 어떤 신호보다도 항상 최하위)이면 docstring에 명시 + "브랜치 변경 + 카탈로그" 조합 회귀 테스트 추가. 반대라면 `tier()`에서 `rel in changed` 체크를 `_is_catalog_bulk`보다 먼저 수행하도록 순서 변경. |
| 2 | 테스트 커버리지 (비대칭) | `evaluate_review(in_flight_ok=True)`의 핵심 불변식("push는 절대 `in_flight_ok=True`를 넘기지 않는다")을 Stop 쪽은 실제 프로세스로 kwarg 값을 기록·단언하는 seam 테스트(`test_stop_passes_in_flight_opt_in`)로 직접 고정하는 반면, 대칭인 push 쪽엔 이를 직접 단언하는 테스트가 없다. push 쪽 기존 stub(`test_guard_review_before_push_main.py`의 `_REVIEW_STUB`)은 `def evaluate_review():`로 파라미터가 아예 없어 실제 시그니처(`cwd=None, *, in_flight_ok=False`)와 괴리 — 향후 push 호출부가 실수로 `in_flight_ok=True`를 넘기면 `TypeError`가 나고 `_evaluate_over_targets`의 넓은 `except Exception`이 이를 삼켜 게이트가 fail-open 처리될 수 있는데, 원인이 진단되지 않는 형태로만 드러난다. | `guard_review_before_stop.py:344` vs `guard_review_before_push.py:846`, stub `test_guard_review_before_push_main.py:72` | `test_stop_passes_in_flight_opt_in`과 대칭인 seam 테스트를 push 쪽에도 추가(실제 시그니처를 반영한 stub으로 `in_flight_ok`가 `False`/미전달임을 직접 단언). |
| 3 | 테스트 커버리지 (vacuous 위험) | `prioritize_bundle_files`가 실제 적용된 4개 호출부(scope_files ×2, `related_specs`, `conventions`) 중 `related_specs`/`conventions`(2곳)는 `collect_context`를 통한 종단 효과 검증이 전무하다 — grep 전수 검색 결과 이 두 값을 검사하는 테스트가 harness 전체에 없음. 코드 판독 근거로, 이 두 줄을 반환값을 버리는 pass-through 뮤턴트로 되돌려도 현재 테스트 스위트는 GREEN을 유지할 것으로 추정된다(실제 뮤테이션 실행은 리뷰어 쓰기 권한 범위 밖이라 보류). 이 PR의 plan 문서 자신이 "첫 seam 테스트가 pass-through 뮤턴트에 뚫려 vacuous 했다"고 기록한 것과 같은 결함 형태가 이 두 호출부에는 아직 남아있다. | `consistency_orchestrator.py:557-558`(`other_spec_files`/`convention_files`) — 대조: 종단검증 있는 `:491`/`:504` | `CollectContextUsesPriorityTest`에 `ctx["related_specs"]`/`ctx["conventions"]`용 sentinel-순서 케이스 추가(기존 `_scope_order`와 동일하게 역정렬 스텁 사용). |
| 4 | 일관성 (문서-코드 drift) | `review_guard.py` 모듈 최상단 docstring(파일 맨 위, 가장 먼저 읽히는 자리)이 이번에 고친 불변식 오류("in-flight 억제가 gate 전체 즉 push까지 연다")를 여전히 원래 서술 그대로 담고 있다. 같은 파일의 다른 두 곳(`_IN_FLIGHT_TTL_SECONDS` 위 주석, `_code_review_in_flight`/`evaluate_review` docstring)은 "in_flight_ok opt-in 없이는 억제가 적용되지 않는다"로 정확히 정정됐는데, 모듈 최상단만 누락돼 독자가 이 문단만 보면 방금 고친 오류를 다시 믿게 될 소지가 있다. | `review_guard.py:72-75`(모듈 docstring) vs 정정된 `:138-147`, `:859-880` | 72-75행을 "Stop 가드가 opt-in(`in_flight_ok=True`)할 때만 nudge를 억제하며 push 게이트는 영향받지 않는다"는 취지로 정정. |
| 5 | 설계 (중복 구현) | "origin 기본 브랜치 판정" 로직이 이 저장소에 이미 3~4곳 손으로 독립 구현돼 있다: `branch_guard._origin_default_branch()`(정본), `review_guard._default_branch()`(위 함수 재사용 + 로컬명 폴백), 신규 `code_review_orchestrator._default_branch_ref()`(symbolic-ref + `origin/` prefix 별도 구현), `consistency_orchestrator.py`의 하드코딩 리터럴(`args.diff_base or "origin/main"`). 우선순위 전략과 반환 형식(로컬 `main` vs `origin/main`)이 각자 용도에 맞춰 다르긴 하나, 셋 이상이 같은 질문에 답하면서 자동 합치 테스트 없이 손으로 각각 유지된다 — 이 저장소가 이미 겪은 실패 유형(정책 중복 + 무동조 테스트로 조용히 갈라짐, `test_router_safety_policy_doc.py` 신설 전례)과 동일 계열. | `branch_guard.py:73`, `review_guard.py:197`, `code_review_orchestrator.py:1092`, `consistency_orchestrator.py:427`/`:512` | 최소한 git 해석 알고리즘(symbolic-ref → 후보 ref 검증) 부분만이라도 공유 헬퍼로 통합하거나 반환 계약 차이를 각 정의부에 명시. 여력이 되면 `_lib` 네임스페이스 충돌(hooks vs skills)을 해소해 실제 코드 공유로 전환. |
| 6 | 성능 (중복 호출) | `_branch_changed_rels()`가 `--impl-prep`/`--impl-done` 분기에서 scope 한정(pathspec 지정) 호출과 공통 코드의 전체 repo(pathspec 없음) 호출로 동일 커밋 범위를 두 번 git subprocess 조회한다. scoped 결과는 항상 unscoped 결과의 부분집합이므로 완전히 회피 가능한 중복이다. | `consistency_orchestrator.py:249`(정의), 호출부 `:493`/`:506`(scoped), `:555`(unscoped) | unscoped 결과를 먼저 한 번만 계산해 재사용하고, scope 한정 부분집합은 Python에서 prefix 필터로 파생. |
| 7 | 일관성/DRY | `prioritize_bundle_files(...)` 호출 블록이 `--impl-prep`/`--impl-done` 두 분기에 인자까지 완전히 동일하게 복제돼 있다. 같은 함수 하단(`other_spec_files`/`convention_files` 처리)은 동일 패턴을 `dict(...)`로 한 번 만들어 재사용하는 방식으로 이미 중복을 피했는데, 정작 먼저 나오는 두 분기에는 적용되지 않아 "중복 회피"와 "중복 방치"가 한 함수 안에 공존한다. | `consistency_orchestrator.py:491-495`(--impl-prep), `:504-508`(--impl-done), 대조 `:555-558` | `_prioritized(files, target_path_rel)` 내부 헬퍼로 추출해 두 분기가 호출만 하도록 통일. |
| 8 | 일관성 (변수 중복) | 동일 함수(`collect_context`) 안에서 완전히 같은 표현식(`args.diff_base or "origin/main"`)을 계산하는 변수 두 개(`_rank_diff_base`, `diff_base`)가 서로 다른 이름으로 공존한다. 지금은 우연히 항상 같은 값이지만, 향후 둘 중 하나만 바뀌면 원인 파악에 혼란을 유발한다. | `consistency_orchestrator.py:427`(`_rank_diff_base`), `:512`(`diff_base`) | 함수 최상단에서 한 번만 계산해 두 자리 모두 그 변수를 참조하도록 통합. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | harness 신뢰성 (회귀 확인) | 이전 리뷰 게이트 access-control 우회 결함(리뷰 세션 디렉터리만 만들면 최대 30분간 push까지 우회되던 문제)이 이번 diff로 정상 해소됨을 배선까지(`in_flight_ok` 위치 인자 전수 grep, push 경로 기본값 `False` 유지) 직접 확인. 양방향 회귀 테스트(`EvaluateInFlightShortCircuitTest`, `test_stop_passes_in_flight_opt_in`)로도 seam 수준까지 검증됨. | `review_guard.py:858,897`, `guard_review_before_stop.py:344`, `guard_review_before_push.py:788-853` | 조치 불요 — 향후 `evaluate_review` 호출부 추가 시 회귀 테스트 유지만 확인. |
| 2 | 보안 (낮은 우선순위) | 신규 `_branch_changed_rels()`의 `diff_base` 문자열이 `git diff` revision 인자로 그대로 보간됨. `subprocess.run`이 리스트 인자를 쓰고(셸 인젝션 경로 없음), `diff_base`는 로컬 CLI 플래그/하드코드 기본값(원격/미신뢰 입력 아님)이며, 기존 `_collect_code_diff()`도 이미 동일 패턴을 써 이번 diff가 새로 만든 위험이 아님. 실패 시 조용히 빈 set 반환이라 무해하게 저하될 뿐. | `consistency_orchestrator.py:254` | 우선순위 낮음 — 방어적으로 `-` prefix 검증 또는 `git rev-parse --verify` 선검증 고려 가능하나 필수 아님. |
| 3 | 성능 (반복 I/O) | `plan/in-progress/` 디렉터리를 매 호출마다 이중 순회(`os.walk` 2회) + 파일 내용 이중 read. 현재 규모(30개 파일, ~1.0MB)에서 체감 비용은 작지만 `plan/in-progress`가 상시 누적되는 코퍼스라는 점을 고려하면 성장에 비례해 비용도 늘어남. | `consistency_orchestrator.py:428-430`(`_rank_plan_text`), `:549`(`plan_files`) | 첫 walk에서 얻은 파일 목록·본문을 재사용해 두 번째 walk/read 생략. |
| 4 | 성능 (반복 스캔) | 랭킹 `tier()`가 파일마다 `plan_text`(~1MB) 전체를 substring 스캔하며, 이 스캔이 한 번의 `collect_context()` 호출에서 최대 3개 번들(scope_files, other_spec_files, convention_files)에 걸쳐 매번 처음부터 반복됨. 현재 규모에서는 수백ms 이내로 추정되나 `spec/`·`plan/in-progress/` 모두 상시 성장하는 코퍼스. | `consistency_orchestrator.py:267-301`(`prioritize_bundle_files`, `tier()` 클로저 `:289-297`) | 급하지 않음 — 필요해지면 `plan_text`에서 경로/basename 토큰을 한 번만 추출해 `set`으로 인덱싱. |
| 5 | 설계 (플래그 확장성) | `evaluate_review`의 `in_flight_ok` 불리언 플래그가 push/stop 두 호출자의 신뢰 수준 차이를 공유 함수 내부 분기로 인코딩. 지금은 테스트로 양방향이 잘 봉인돼 있으나, "관대함"이 함수 이름이 아니라 인자값으로만 드러나 세 번째 호출자가 생기면 타입 시스템이 강제하지 못하는 취약점이 될 수 있음. | `review_guard.py:858-859`, `:897` | 지금은 리팩터링 불요. 세 번째 호출자가 생기면 `evaluate_review()`(엄격)/`evaluate_review_allow_in_flight()`처럼 이름 있는 wrapper로 분리 고려. |
| 6 | 문서 정확성 (plan 자기서술 오차) | plan 문서 두 곳의 사소한 자기 서술 오차: (1) `harness-review-gate-ci-backstop.md`가 `test_review_changeset_warning.py`를 "9건"으로 기재했으나 실제 `def test_` 개수는 10개(실행 결과 "Ran 10 tests"로도 확인). 자매 문서(`harness-consistency-summary-downgrade-rule.md`)의 "10건" 기재는 실제와 일치. (2) 같은 문서가 stop 가드 호출부를 `guard_review_before_stop.py:340`으로 인용했으나 실제 `evaluate_review(in_flight_ok=True)` 호출문은 `:344`이고 340행은 그 위 설명 주석 시작줄. 둘 다 서술의 결론 자체(테스트 존재, 호출부 위치)는 맞고 코드 동작에 영향 없음. | `plan/in-progress/harness-review-gate-ci-backstop.md:92`, `:118-119` | 9→10, 필요시 :340→:344(또는 "340-344")로 정정. |
| 7 | spec 정합성 (해당 없음) | `evaluate_review`/`in_flight_ok`/`prioritize_bundle_files`/`warn_if_committed_work_is_missing`/`_default_branch_ref`를 `spec/` 전체에서 grep한 결과 0건 — 이 harness 영역을 규정하는 정식 spec 문서가 없어 spec fidelity 관점의 불일치도 없음(정상 케이스, CLAUDE.md 관례상 harness 내부 구현은 spec/ SoT 대상 아님). | 해당 없음 (11개 변경 파일 전체) | 조치 불요. |
| 8 | harness 신뢰성 (시그니처 안전성 검증) | `evaluate_review()` 시그니처 확장(`in_flight_ok` 키워드 전용 인자 추가)이 하위 호환임을 호출자 전수 grep으로 확인 — 저장소 전체에서 실제 호출자는 push/stop 둘뿐이며, `_accepts_cwd()`의 파라미터 종류 판별에도 영향 없음(KEYWORD_ONLY라 POSITIONAL 분류에 안 걸림). `.claude/tests` 전체 684건 통과. | `review_guard.py:858-859`, `guard_review_before_push.py:846`, `guard_review_before_stop.py:344` | 조치 불요. |
| 9 | 설계 (모드 확장 인지 필요) | `prioritize_bundle_files` 번들 재정렬이 `--spec`/`--plan` 모드에도 조용히 확장됨(이전엔 이 두 모드에서 `collect_context`가 git을 전혀 호출하지 않았음). plan 문서(`harness-consistency-summary-downgrade-rule.md`)가 "적용 지점: --impl-prep/--impl-done + related_specs + conventions"라 명시해 의도적 확장으로 보이나, 신규 테스트(`CollectContextUsesPriorityTest`)는 impl-prep/impl-done 두 모드만 직접 검증. `_branch_changed_rels`가 예외를 안전 흡수하므로 크래시 위험은 없음. | `consistency_orchestrator.py:427-430`, `:555-558` | 정보 제공 목적 — 조치 불요, 필요시 --spec/--plan 모드에 대한 명시적 테스트 케이스 추가 고려. |
| 10 | 유지보수성 (함수 비대화) | `collect_context`가 이미 길었던 함수(4개 모드 분기 + 공용 코퍼스 수집)인데 이번 diff로 순위 매김 관심사가 각 분기와 하단에 흩뿌려지며 더 길어짐(약 167줄→196줄). 기능적으로는 옳으나 순환 복잡도 지속 상승 중. | `consistency_orchestrator.py:412-608` | 당장 불요 — 다음 확장 전 모드별 분기를 각각의 함수로 추출 고려. |
| 11 | 유지보수성 (매직넘버) | 잘린 목록 개수 상한 `10`이 이름 없는 매직넘버로 두 번(`missing[:10]`, `len(missing) - 10`) 등장. 컨벤션 위반은 아니나 하나만 고치고 다른 하나를 놓치기 쉬운 자리. | `code_review_orchestrator.py:1133`, `:1136` | `_MAX_LISTED_MISSING_FILES = 10` 모듈 상수로 추출. |
| 12 | 성능/설계 (불필요한 즉시 계산) | `_rank_plan_text`가 `--spec`/`--plan` 모드 등 실제로 쓰이지 않는 모드에서도 함수 최상단에서 무조건 계산됨. 세션당 1회 실행이라 체감 비용은 미미하나 "항상 계산되는 값"처럼 보여 소비 지점 추적을 번거롭게 함. | `consistency_orchestrator.py:428-430` | 필요한 분기 안으로 lazy하게 늦추거나 주석에 미사용 모드를 명시. |
| 13 | 테스트 커버리지 (부분적) | `warn_if_committed_work_is_missing`이 "기본 경로에서만 발동"함을 보이는 회귀 테스트(`DefaultPathIsWiredTest`)가 4개 분기(`--commit`/`--range`/`--branch`/`--files`) 중 `--branch`/`--range` 2개만 커버. 네 분기 모두 같은 `if/elif` 구조라 회귀 위험은 낮음. | `code_review_orchestrator.py:1150-1176`, 테스트 `test_review_changeset_warning.py:160-165` | `test_commit_does_not_warn`/`test_files_arg_does_not_warn` 케이스 추가로 4분기 전수 커버. |
| 14 | 문서화 (사용자 문서 미반영) | 신설된 `warn_if_committed_work_is_missing` advisory 동작(기본 경로에서 커밋된 브랜치 작업이 changeset에서 빠지면 stderr 경고 + `--branch` 재실행 안내)이 SKILL.md 사용자 문서에는 반영되지 않음. 기존 서술의 사실성은 훼손되지 않았고 동작은 완전 자동(advisory-only)이라 필수 사항은 아님. | `.claude/skills/code-review-agents/SKILL.md` §1 옵션 | 우선순위 낮음 — §1 옵션 아래 한 줄 추가 검토. |
| 15 | 범위 (bundling 판단) | 세 개의 독립적 결함 수정(Stop 전용 in-flight 스코프 축소, consistency 번들 우선순위, 기본 changeset 누락 경고)이 한 브랜치에 묶여 있으나, 각각 커밋이 분리되고 전용 테스트를 동반하며 사전 등록된 plan 티켓의 체크리스트를 종결시키는 형태 — scope creep으로 보지 않음. | 브랜치 전체 | 조치 불요. |
| 16 | 의존성 (확인 완료) | 신규 외부 패키지/의존성 없음 — 신규 함수 전부 기존 stdlib import(`os`/`re`/`subprocess`/`sys`)와 기존 헬퍼만 사용, `.claude/tests/README.md`의 "harness Python은 third-party 의존성 0" 관례 유지. | 11개 변경 파일 전체 | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 이전 access-control 우회 결함 정상 해소 확인(배선까지 검증); 하드코딩 시크릿·인젝션·ReDoS 등 0건 |
| performance | LOW | `_branch_changed_rels` 중복 git 호출(scoped+unscoped, WARNING); plan/in-progress 이중 순회+read; tier() 반복 스캔 |
| architecture | LOW | `_default_branch_ref` 예외처리 컨벤션 이탈(WARNING); 기본 브랜치 판정 로직 3중 구현(WARNING); in_flight_ok 플래그 확장성(INFO) |
| requirement | MEDIUM | `_default_branch_ref` 무실패 계약 위반; `prioritize_bundle_files` tier 순서가 docstring과 불일치(카탈로그가 브랜치변경보다 우선); 이번 세션 자체의 build_files_section 누락 실측(메타) |
| scope | NONE | 범위 이탈 없음; 세 결함 수정 번들링은 타당(사전 등록 plan 티켓 종결) |
| side_effect | MEDIUM | `warn_if_committed_work_is_missing`/`_default_branch_ref` fail-silent 계약 위반; 나머지 시그니처 확장·번들 재정렬은 안전 확인 |
| maintainability | HIGH | `_default_branch_ref` 예외처리 컨벤션 위반(CRITICAL 승격); 모듈 docstring 미정정 3번째 자리; 기본 브랜치 판정 3중 구현; prioritize_bundle_files 호출 중복 |
| testing | MEDIUM | push측 in_flight_ok 대칭 seam 테스트 부재; related_specs/conventions 종단검증 부재(vacuous 위험); 684건 전체 통과 확인 |
| documentation | CRITICAL | build_files_section이 이 PR 핵심파일 2개를 14명 리뷰어 전원 프롬프트에서 통지없이 누락(이번 세션 실측); diff 자체의 문서화 품질은 높음 |
| dependency | NONE | 신규 외부 의존성 없음; evaluate_review 시그니처 확장은 하위호환 |
| database | NONE | DB 관련 코드 전무, 해당 없음 |
| concurrency | LOW | in-flight 억제 레이스 정상 스코프 분리 확인(회귀테스트로 봉쇄); 신규 코드는 단일스레드 동기 로직뿐 |
| api_contract | NONE | 네트워크 API 표면 변경 없음, 해당 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 매칭 0건, 해당 없음 |

## 발견 없는 에이전트

- **database** — 리뷰 대상 11개 파일 전부 harness 코드/plan 문서이며 SQL/ORM/마이그레이션/스키마 관련 코드 없음. 해당 없음.
- **api_contract** — REST/GraphQL 등 네트워크 API 표면(엔드포인트·컨트롤러·요청/응답 스키마) 변경 없음. 해당 없음.
- **user_guide_sync** — `doc-sync-matrix.json` 21개 trigger(glob/semantic) 전량 대조 결과 매칭 0건 — 변경분이 전부 `.claude/**`·`plan/in-progress/**`이고 `codebase/**`·`spec/**`를 포함하지 않아 유저 가이드 동반 갱신 의무 미발생. 해당 없음.

## 권장 조치사항

1. `code_review_orchestrator.py`의 `build_files_section()`을 수정해 예산 초과로 생략된 파일에도 명시적 생략 표시를 남긴다(`consistency_orchestrator.py`가 이번에 도입한 `truncate_file_bundle`/`OMITTED_FILES_HEADING` 패턴을 이식). 이 PR의 diff 범위 밖이지만, 이번 세션에서 실제로 이 PR의 핵심 파일 2개를 14명 리뷰어 전원에게서 숨긴 살아있는 결함이므로 최우선 후속 작업으로 착수.
2. `_default_branch_ref()`를 파일 내 다른 9개 git 헬퍼와 동일하게 `try/except Exception`으로 감싸 실패 시 안전한 기본값(`None`)을 반환하도록 수정하고, 실제 예외 유발 경로(subprocess 예외 monkeypatch)를 검증하는 단위 테스트를 추가한다.
3. `prioritize_bundle_files`의 `tier()`에서 `_is_catalog_bulk` 체크보다 `rel in changed` 체크를 먼저 수행하도록 순서를 바꾸거나, 카탈로그 항상-최하위가 의도된 정책이면 docstring과 "브랜치 변경 + 카탈로그" 조합 테스트로 명시한다.
4. push 가드가 `in_flight_ok=True`를 절대 넘기지 않는다는 것을 직접 단언하는 대칭 seam 테스트를 추가한다(현재는 Stop 쪽에만 있음).
5. `prioritize_bundle_files`의 `related_specs`/`conventions` 호출부(두 곳)에 대해서도 `collect_context` 종단 효과 검증 테스트를 추가해 pass-through 뮤턴트 노출을 없앤다.
6. `review_guard.py` 모듈 최상단 docstring을 갱신해 "in-flight 억제는 Stop opt-in 전용이며 push는 영향받지 않는다"를 반영한다.
7. (낮은 우선순위) "기본 브랜치 판정" 로직 3~4중 구현을 최소한 상호 참조 주석으로 연결하거나 공유 헬퍼로 통합; `_rank_diff_base`/`diff_base` 변수 통합; 매직넘버 `10` 상수화; plan 문서 오차(테스트 개수 9→10, 줄 번호 :340→:344) 정정.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: `--route=all`(명시적 파일 인자 지정에 따른 전체 실행; `documentation.md`가 인용한 `_retry_state.json`의 `routing_skip_reason`과 일치). 전체 14개 reviewer 실행됨.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |