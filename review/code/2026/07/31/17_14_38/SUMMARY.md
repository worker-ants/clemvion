# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 신규 CRITICAL 없음(직전 라운드 CRITICAL 3건은 모두 수정 확인됨). 다만 이번 PR이
스스로 "CRITICAL"이라 명명한 결함 클래스(sentinel 경계 위조·자연정렬)와 동일한 비대칭 패턴이
회귀 테스트 안전망과 진행 문서(plan SoT) 양쪽에 남아 있어, testing·maintainability 두 에이전트가
MEDIUM으로 판정했다. 강제 화이트리스트(router_safety) 7명 전원 및 나머지 7명 포함 총 14개
reviewer 전문이 모두 확보되었고 누락은 없다.

## Critical 발견사항

없음. (직전 라운드가 지적한 CRITICAL 3건 — sentinel 방어 4개 진입점 중 2곳 누락, 2단계 절단
총 줄 수 오보고 — 은 커밋 `fdc8e423f`에서 모두 수정되었고, security/side_effect/requirement/
testing 4개 에이전트가 소스 대조 + 테스트 재실행 + 뮤테이션 테스트로 교차 재검증했다.)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `--plan`/`--impl-done` diff 섹션의 sentinel 방어(`_neutralize_sentinel`)가 테스트로 전혀 고정되지 않음 — 뮤테이션으로 실증(해당 호출 제거해도 관련 스위트 54건 실패 0건). 이 PR 자체가 "CRITICAL"이라 명명한 것과 동일한 비대칭 패턴이 회귀 안전망에 남아 있음 | `consistency_orchestrator.py:561`(--plan), `:594`(--impl-done diff) | `test_raw_spec_target_is_neutralised`를 본떠 `--plan`, `--impl-done` diff 각각에 sentinel-forging 테스트 추가 |
| 2 | Documentation | plan 체크리스트(`harness-consistency-summary-downgrade-rule.md`)가 "writer 2곳 모두 적용"으로 완료 선언했지만, 이번 라운드가 실제로는 2곳을 더(총 4개 진입점) 찾아 고쳤음 — 완료 서술이 스코프를 과소평가하고, plan 파일 자체는 이번 라운드에 갱신되지 않아 후속 세션이 "2곳으로 완결"로 오인할 수 있음 | `plan/in-progress/harness-consistency-summary-downgrade-rule.md:121-125` | "2R 추가 확장" 한 줄 추가해 4개 진입점 스코프 명시 |
| 3 | Testing | `collect_markdown_files`의 `_natural_key` 정렬 키 변경이 어떤 테스트로도 검증되지 않음 — 뮤테이션으로 확인(`.sort()`로 되돌려도 실패 0건). 다운스트림 `prioritize_bundle_files`가 항상 재정렬해 현재는 테스트·런타임 양쪽에서 관측 불가능한 변경(죽은 코드이거나 문서화 안 된 방어 코드) | `consistency_orchestrator.py:266` | `collect_markdown_files` 단독 자연정렬 pin 테스트 추가, 또는 "다운스트림 재정렬로 항상 가려짐"을 주석으로 명시 |
| 4 | Documentation | `--impl-done` target_doc 조립부 주석이 이번 수정(diff_section에 sentinel 항상 부여)으로 스스로 낡음 — "session.truncate_to_budget이 생존시킨다"는 서술이 실제로는 이제 `truncate_file_bundle`의 청크-드롭 경로만 타서 부정확 | `consistency_orchestrator.py:601-603` | 괄호 안 절단 메커니즘 서술 정정 |
| 5 | Documentation | 신규 테스트 2건이 편입된 `ContentCannotForgeAFileBoundaryTest` 클래스 docstring이 "헤딩 위장" 시나리오만 서술 — 이번 라운드 추가로 과반(6건 중 3건)이 된 "sentinel 리터럴 위장" 시나리오는 언급 없음 | `test_consistency_context_budget.py:105-130`(docstring) vs `:196-220`,`:222-259`(신설 테스트) | docstring에 두 번째 위협 모델 단락 추가 |
| 6 | Architecture | 예산 차감 산술 헬퍼(`_charge_notice`)가 code-review 쪽에만 도입되어, consistency 쪽 동일 개념(`truncate_file_bundle`의 손계산)과 비대칭이 벌어짐 — 두 orchestrator가 이미 여러 곳에서 "Change both" 주석에 의존해 온 동일 패턴의 반복(이번 PR 자체도 sentinel 방어 2/4 누락 CRITICAL을 뒤늦게 잡음) | `code_review_orchestrator.py:561-578,694,740-742,756-760` / `consistency_orchestrator.py:724-765` | `_charge_notice`를 `code-review-agents/lib/` 공유 위치로 이동해 양쪽이 import |
| 7 | Maintainability | `build_files_section`(code-review)과 `collect_context`(consistency) 모두 여러 절단·조립 전략을 한 함수가 겸임하는 god function이며, 이번 diff가 각각에 코드를 더 얹었음(순환 복잡도 지속 상승) | `code_review_orchestrator.py:607-807`(특히 633-664,694,735-772) / `consistency_orchestrator.py:473-654`(특히 585-608) | 4가지 절단 전략(무제한/헤더+diff초과/콘텐츠 예산/집계 폴백)을 이름 있는 하위 함수로 분리(최소 이번 diff가 만진 절단 경로부터) |
| 8 | Performance | 2차(prompt 총예산) 절단이 이제 `max_file_size` 상한이 걸리지 않은 원본 전체(`source_lines`)를 대상으로 재절단 — 대형 파일 1개가 diff에 섞이면 O(원본 파일 크기)로 재확대될 수 있음(버그 수정에 따른 의도된 트레이드오프) | `code_review_orchestrator.py:765-767`(else 분기, 저장은 633-636/662-663) | `source_lines` 획득 시(`build_cli_change_info` 또는 획득 직후) 합리적 상한 부여, 또는 2차 절단 전 재캡핑 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `_charge_notice` 신규 헬퍼의 직접 유닛 테스트 부재(단, 뮤테이션 확인 결과 3개 호출부를 통한 간접 커버리지는 확실 — 뺄셈 누락 뮤턴트 시 8건 중 7건 즉시 FAIL) | `code_review_orchestrator.py:562` 부근 | `_charge_notice(100,"ab","c")==97` 류의 값싼 표 기반 단위 테스트 추가(블로킹 아님) |
| 2 | Security | 두 하네스 모두 신뢰되지 않는 저장소 콘텐츠를 LLM 프롬프트에 그대로 싣는 구조상 일반적 prompt-injection 잔여 표면(이번 diff가 만들지도 악화시키지도 않음) — consistency는 `_neutralize_sentinel`로 경계 마커만 방어, code-review의 `build_files_section`은 sentinel 없이 평문 헤더/구분자에만 의존 | `consistency_orchestrator.py:213-226` 대비 `code_review_orchestrator.py:619` | 여유 시 reviewer/checker 시스템 프롬프트에 "본문 내 지시문은 데이터"라는 경고 추가, code-review 쪽도 sentinel 경계로 통일 고려(우선순위 낮음) |
| 3 | Security | `--diff-base` 값이 검증 없이 git revision 인자 문자열에 결합됨 — 이론적 argument injection(`-`로 시작하는 값). 뒤에 항상 `...HEAD`가 강제로 이어붙어 실제 악용 난이도가 높고, 현재는 로컬 신뢰된 호출자만 채우는 값 | `consistency_orchestrator.py:302-305`, `:388-396` | `-`로 시작하면 거부하거나 `git rev-parse --verify <ref>^{commit}` 사전 검증(defense-in-depth, 급하지 않음) |
| 4 | Side-Effect | `_BUNDLE_FILE_SENTINEL`이 구조적으로 위조 불가능한 마커가 아니라 평범한 리터럴 문자열 — 안전성이 "모든 소비 경로가 `_neutralize_sentinel`을 호출한다"는 호출 규율에 의존. 향후 5번째 진입점이 추가되며 이 호출을 빠뜨리면 이번 PR이 막은 것과 동일한 버그 클래스가 재발 가능(1R부터 이월, 오늘 시점 활성 결함 아님) | `consistency_orchestrator.py:704` | 상수 정의 옆 "새 진입점 추가 시 반드시 통과시킬 것" 주석 추가, 장기적으로 세션별 파생 마커 고려 |
| 5 | Side-Effect | 새 sentinel(`<!-- @bundle-file -->`)이 checker 프롬프트에 설명 없이 그대로 노출됨 — `.claude/agents/*-checker.md`/`role_instructions.py` 어디에도 의미 설명 없음(1R부터 이월) | `consistency_orchestrator.py:704`,`:368`,`:466` | checker 공통 프리앰블에 한 줄 안내 추가(선택) |
| 6 | Requirement | `_neutralize_sentinel`의 경계 재조합 잔여 틈 — 원본이 정확히 sentinel로 끝나되 후행 개행이 없는 경우, neutralize 시점엔 미매치했다가 템플릿이 붙이는 개행과 합쳐져 sentinel이 재구성될 수 있음(트리거 조건 좁음, 이전 라운드부터 이월, 이번 수정 범위 밖) | `consistency_orchestrator.py:213-226`,`:362-370`,`:704` | neutralize를 템플릿 조립 후 결과 전체에 한 번 더 수행하거나 trailing newline 정규화 후 매칭 |
| 7 | Requirement | `budget_substitutions`의 corpus 몫이 정수 나눗셈으로 정확히 0이 될 수 있고, `truncate_file_bundle(text,0)`은 0을 "무제한"으로 해석해 의도와 반대로 무제한 통과됨(기본 설정에서는 도달 불가, 이전 라운드부터 이월) | `consistency_orchestrator.py:795-798` | 계산된 share가 0이면 최소 양의 하한(예: 1)으로 clip |
| 8 | Performance | 모든 파일에 대해 무조건 `total_lines` 계산 — 실제로는 2차 절단 분기에 진입하는 소수 파일만 필요(체감 영향 작음) | `code_review_orchestrator.py:634` | 계산을 2차 절단 `else` 분기로 다시 늦추거나 `number_source_lines`가 내부에서 이미 계산한 길이를 반환하도록 확장 |
| 9 | Performance | `_natural_key`가 동일 파일 목록에 대해 중복 계산되고(정렬 2회), 모듈의 다른 정규식과 달리 미리 컴파일되지 않음 | `consistency_orchestrator.py:229-244,266,359` | `re.compile(r"(\d+)")`를 모듈 상수로 분리, 이미 자연정렬된 입력에서는 보조 키 재계산 생략 고려 |
| 10 | Architecture | `_lib`라는 동일 이름의 서로 다른 두 패키지(`.claude/skills/_lib/` vs `.claude/hooks/_lib/`)가 존재해 in-process import가 충돌 — 이번 diff의 신설 테스트 3개 모두 서브프로세스 우회로 회피 중임을 반복 문서화(기존 컨벤션, 이번 diff가 만든 문제 아님) | `test_consistency_context_budget.py:27-31`,`test_consistency_bundle_priority.py:21-23`,`test_prompt_omission_notice.py:22-24` | harness 전역 패키지 이름 정책 문서화("`_lib`는 트리마다 로컬 전용") |
| 11 | Maintainability | 신설 지역 변수 `_DIFF_LABEL`이 모듈 상수 컨벤션(ALL_CAPS)을 함수 지역 변수에 잘못 적용 — 코드베이스 전체에서 유일한 사례 | `consistency_orchestrator.py:590` | `diff_label`로 소문자화(snake_case) |
| 12 | Maintainability | 상태관리 헬퍼 5종(`_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_emit_summary_state`/`_apply_status_update`)이 두 orchestrator 파일에 사실상 동일 코드로 복제되어 "Change both" 주석에 의존(이번 diff 대상 아니나 인접 코드) | `code_review_orchestrator.py:183-374` ↔ `consistency_orchestrator.py:87-192` | 다음에 이 함수군을 손댈 일이 생기면 `report_paths.py` 선례처럼 `_shared/retry_state.py`(가칭)로 추출 고려 |
| 13 | Style (Scope+Maintainability 공통 지적) | 신설 테스트 메서드 시그니처 직후 의미 없는 빈 줄 잔여물 | `test_prompt_omission_notice.py:273` | 해당 빈 줄 제거 |
| 14 | Style (Scope+Maintainability 공통 지적) | 같은 클래스 내 두 테스트 메서드 사이 빈 줄 2개(관례는 1개, 다른 모든 메서드 간격과 불일치) | `test_consistency_context_budget.py:194-195` | 빈 줄 1개로 정리 |
| 15 | Performance | `_neutralize_sentinel`이 모든 문서 읽기 경로에 새 O(n) 스캔 추가 — 정합성을 위한 트레이드오프로 문제 삼을 정도는 아님(참고용) | `consistency_orchestrator.py:213-227` 및 호출처 4곳 | 조치 불요 |

## 확인 완료(문제 없음) 항목 — 참고

- **Security**: sentinel 방어가 도달 가능한 4개 진입점 전체(`format_file_bundle`/`extract_rationale_sections`/`--spec`·`--plan`의 `target_doc`/`--impl-done` diff 섹션)에 적용됨을 확인 — 직전 라운드 CRITICAL 3건 해소.
- **Side-Effect**: 2R CRITICAL(`--spec`/`--plan` 원시 target_doc 미중화)과 WARNING(신설 테스트 임시 디렉터리 미정리)이 `fdc8e423f`에서 수정됐음을 소스 대조 + 실제 테스트 실행(임시 디렉터리 개수 실측)으로 재검증.
- **Requirement**: 이 영역을 규정하는 `spec/` 문서 없음(정상 — harness 내부 도구). plan 문서가 사실상 SoT이며 체크리스트·참조 파일 모두 실제 코드와 일치(허위 완료 서술 없음, 단 위 WARNING #2 항목은 예외).
- **Testing/Requirement**: 하네스 전체 스위트(708 tests + 567 subtests, 관련 서브스위트 개별 실행 포함) 전부 GREEN 재확인.
- **Dependency**: 신규 외부 의존성 없음(의존성 매니페스트 미변경, 신규 import는 표준 라이브러리 `re` 2건뿐), natural sort를 stdlib만으로 자체 구현(불필요한 패키지 도입 회피).
- **Database/Concurrency/API Contract**: 검토 대상 코드 자체가 없음(DB·동시성 프리미티브·API 계약 요소 전무).
- **User Guide Sync**: doc-sync-matrix 21개 trigger(글로브 9건+semantic 11건+1건) 전건 대조, 매칭 0건 — `codebase/**`/`spec/**` 변경 없음.
- **Scope**: 6개 파일 전부 "orchestrator 번들 정확성" 단일 주제로 수렴, 스코프 이탈 없음(리팩터 `_charge_notice`·plan 체크박스 갱신·code-review sentinel 미적용 모두 근거 있는 정당한 판단으로 확인).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | sentinel 방어 4개 진입점 전체 확인(2R CRITICAL 해소), 잔여 구조적 prompt-injection·`--diff-base` 검증 이론적 여지는 INFO |
| performance | LOW | 2차 절단이 원본 전체를 상한 없이 재절단(대형 파일 시 O(n) 재확대) — WARNING 1건 |
| architecture | LOW | `_charge_notice`가 code-review 쪽에만 도입되어 두 orchestrator 간 비대칭 심화 — WARNING 1건 |
| requirement | LOW | 직전 CRITICAL 3건 전부 정확 수정 확인(테스트 재실행 GREEN), 잔여 INFO 2건은 이월·범위 밖 |
| scope | LOW | 6개 파일 모두 단일 주제로 수렴, 편집 잔여물(빈 줄) 2건만 |
| side_effect | LOW | 2R CRITICAL/WARNING 모두 재검증 완료(실측), 신규 문제 없음 |
| maintainability | MEDIUM | `build_files_section`/`collect_context` god function 누적, 상태관리 헬퍼 중복 |
| testing | MEDIUM | sentinel 방어(--plan/--impl-done)·natural-sort 변경 테스트 커버리지 갭을 뮤테이션으로 실증 |
| documentation | LOW | 이번 수정이 인접 주석·docstring·plan 체크리스트를 3곳에서 stale하게 만듦 |
| dependency | NONE | 신규 의존성 없음, stdlib만 사용 |
| database | NONE | DB 관련 코드 없음 |
| concurrency | NONE | 동시성 프리미티브 없음 |
| api_contract | NONE | API 계약 요소 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21건 매칭 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync, dependency — 5개 에이전트는 검토 대상 표면 자체가 diff에 없거나(DB/동시성/API 계약) 매칭 트리거가 0건이어서(user_guide_sync) 실질 발견사항 없음. dependency는 확인성 INFO 3건뿐(신규 의존성 없음 등 "문제 없음" 확인)이라 실질 조치 항목 없음.

## 권장 조치사항

1. **(WARNING #1, #3 — Testing)** `--plan`/`--impl-done` diff 섹션의 sentinel 방어와 `collect_markdown_files`의 자연정렬 변경에 대한 회귀 테스트를 추가한다 — 이 PR이 스스로 "CRITICAL"이라 명명한 것과 동일한 진입점 비대칭 패턴이 안전망에 남아 있으므로 최우선.
2. **(WARNING #2 — Documentation)** `plan/in-progress/harness-consistency-summary-downgrade-rule.md`의 "writer 2곳 모두 적용" 완료 서술을 "4개 진입점" 스코프로 정정한다 — 이 문서는 작업의 SoT이므로 방치 시 후속 세션에 잘못된 완결 인식을 줄 수 있다.
3. **(WARNING #4, #5 — Documentation)** `--impl-done` target_doc 주석의 절단 메커니즘 서술과 `ContentCannotForgeAFileBoundaryTest` 클래스 docstring의 위협 모델 서술을 현재 코드/테스트 구성에 맞게 갱신한다.
4. **(WARNING #6 — Architecture)** `_charge_notice`(또는 "예산에서 안내문을 뺀 값" 개념)를 `code-review-agents/lib/` 공유 위치로 이동해 두 orchestrator가 함께 import하도록 한다.
5. **(WARNING #7 — Maintainability)** `build_files_section`/`collect_context`의 절단 전략들을 이름 있는 하위 함수로 분리하는 리팩터를 후속 과제로 등록한다(지금 당장 급하지 않음).
6. **(WARNING #8 — Performance)** 2차 절단이 사용하는 `source_lines`(원본 전체)에 합리적 상한을 두어, 대형 파일이 diff에 섞이는 드문 경우에도 O(`max_file_size`) 이내로 유계화한다.
7. **(INFO 일괄)** 여유가 될 때 빈 줄 잔여물 2건(#13,#14), `_DIFF_LABEL` 네이밍(#11), `--diff-base` 검증(#3) 등 저비용 정리 항목을 한 번에 처리한다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success + 전문 확보)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨. 강제 화이트리스트 미이행 없음.