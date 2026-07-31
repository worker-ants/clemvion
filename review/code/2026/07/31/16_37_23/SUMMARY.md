# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 이번 PR 이 스스로 도입한 "sentinel 위조 방지"(`_neutralize_sentinel`) 불변식이 `target_doc` 4개 생산 경로 중 2곳(`--spec`/`--plan` 원시 문서, `--impl-done`의 git diff)에는 적용되지 않아, 검토 대상 본문이 sentinel 리터럴을 포함하면 실제 내용이 조용히 삭제되고 존재하지 않는 파일명이 "생략된 파일" 목록에 날조됨을 2명의 리뷰어가 각각 독립 PoC 로 재현했다(requirement, side_effect — 모두 CRITICAL). 별도로 testing 리뷰어는 같은 PR 이 CRITICAL 로 표시한 "2단계 절단 총 줄 수 오보고" 수정에 회귀 테스트가 전혀 없음을 mutation 테스트(수정 원복 → 56 tests 전부 GREEN 유지)로 실측 확인했다. 세 건 모두 이번 diff 의 신규 회귀가 아니라 기존 설계·인접 로직과의 상호작용에서 나오는 커버리지 갭이지만, 이 PR 자체의 핵심 목표("생략은 반드시 이름으로 명시된다", "회귀는 테스트로 고정된다")가 정확히 이 갭에서 깨진다.

**커버리지 확인**: 14개 reviewer(강제 화이트리스트 7명 documentation/maintainability/requirement/scope/security/side_effect/testing 포함) 전원 결과 확보 — forced 미이행이나 결과 누락 없음. 아래 판정은 거짓 음성 없이 전체 결과에 기반한다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 정확성(하네스 프롬프트 무결성) | `--spec`/`--plan` 모드의 원시 `target_doc`(`read_text_file(target_abs)` 직접 대입)이 신설된 sentinel 위조 방지(`_neutralize_sentinel`)를 거치지 않음. 검토 대상 문서 자체가 sentinel 리터럴(`\n<!-- @bundle-file -->\n`)을 포함하면 `truncate_file_bundle`이 이를 파일 경계로 오인해 문서 뒷부분을 조용히 삭제하고, 존재하지 않는 파일명("가짜파일.md")을 "생략된 파일" 목록에 날조함 — PoC로 직접 재현(side_effect). 이 프로젝트가 이미 한 번 그 경계 문자열을 산문으로 인용한 전례가 있어(plan 문서 자신), 이 기능을 설명하는 문서가 `--spec`/`--plan` 대상이 되는 것은 실제로 부딪힐 수 있는 경로다. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:550-562`(특히 554·561행) / 대조: `:213-226`(`_neutralize_sentinel`), `:698`(sentinel 정의), `:718-759`(`truncate_file_bundle`) | 해당 경로에도 `_neutralize_sentinel()` 적용, 또는 `truncate_file_bundle`/`budget_substitutions` 진입점에서 모든 `target_doc` 소스에 일괄 무해화. `--spec`/`--plan` 전용 회귀 테스트(`test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary`와 대칭) 추가. |
| 2 | 요구사항/보안(하네스 프롬프트 무결성) | `--impl-done`의 git diff(`diff_section`)도 동일하게 sentinel 위조 방지가 미적용. `target_doc = _head_basis_notice(...) + spec_bundle + diff_section`으로 조립되며 diff 가 sentinel 없이 마지막 spec 파일 청크와 결합돼, 예산 초과 시 `truncate_file_bundle`이 리스트 끝(=diff 포함 청크)부터 통째로 버림 — "이름 없이" 삭제. 조작된 diff PoC 로 실제 spec 파일 드롭 + 가짜 경로(`FAKE/INJECTED.md`)가 "생략된 파일" 목록에 등재되는 것을 requirement 와 security 가 각각 독립 재현(requirement=CRITICAL, security=WARNING). architecture·testing 도 동일 근본 원인(4개 진입점 중 2곳만 보호)을 지적. 5개 checker 전원이 동일 `target_doc`을 받으므로 영향은 세션 전체 — "BLOCK: NO"가 실은 diff 없이 판정된 결과일 수 있음. | `consistency_orchestrator.py:584-598`(`diff_section` 조립·`target_doc` 합류), 대조: `:718-759`(`truncate_file_bundle`, 특히 `:741` `rel_of()`·`:754` `dropped.insert(0, kept.pop())`) | `diff_text = _neutralize_sentinel(_collect_code_diff(...))`로 무해화하거나, 의사 파일명을 부여해 diff 를 독립 청크로 만들어 tail-drop 시에도 이름으로 생략되게 함. `--impl-done` 전용 회귀 테스트 추가. |
| 3 | 테스팅 | 이번 커밋이 "CRITICAL"로 자평한 2단계 절단(1차 파일크기 cap → 2차 전체 prompt cap) 총 줄 수 오보고 버그 수정(`total_lines`/`source_lines` 분리)에 회귀 테스트가 전혀 없음 — mutation(수정을 원복)으로 실측, 관련 스위트 56 tests 전부 GREEN 유지 확인(testing). 원인: 기존 테스트가 전부 `max_file_size=10_000_000`을 넘겨 1차 절단 자체가 발동하지 않아, 버그가 실제로 있던 경로("이미 1차로 잘린 문자열에서 2차로 다시 줄을 세는" 경로)를 어떤 테스트도 밟지 않음. 같은 커밋 안에서 sentinel 중화는 "mutation 확인" 문구를 남겼지만 이 항목은 그런 확인이 없어 회귀 방지 기준이 불균등하게 적용됨. | `code_review_orchestrator.py:633-663`(`source_lines`/`total_lines` 필드 보존), `:745-772`(2차 절단 `else` 분기) | `test_prompt_omission_notice.py`에 `max_file_size`를 작게(예: 8000) 설정해 1차+2차 절단이 모두 발동하는 fixture 추가, 최종 노트의 총 줄 수가 파일의 진짜 총 줄 수와 일치함을 단언. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 내부 파싱 전용 sentinel(`_BUNDLE_FILE_SENTINEL`)이 벗겨지지 않고 최종 checker 프롬프트에 그대로 노출(추상화 경계 누출, 이전 라운드 지적·아직 미해결). 파일당 23자 순오버헤드가 발생하며, `_GUTTER_OVERHEAD`류의 실측 기반 예산 보정도 없음(예: ~230개 파일 카탈로그 번들에서 ~5,300자, 예산의 약 2% 소모). | `consistency_orchestrator.py:362`(`format_file_bundle`), `:449`(`extract_rationale_sections`), `:698`(정의), `:718`(`truncate_file_bundle`) | `truncate_file_bundle` 반환 직전 sentinel 을 `"\n"`으로 치환해 벗겨내거나, 최소한 실측 기반 캡 보정 추가. |
| 2 | 아키텍처/유지보수성 | `build_files_section`(201줄)이 4가지 서로 다른 절단 전략(무제한 통과 / overflow diff 트리밍 / 콘텐츠 예산배분 / 집계 생략 폴백)을 한 함수에 겸임 — 순환 복잡도 과다. 이번 diff 의 `_charge_notice` 추출은 "예산 산술이 두 분기에서 각각 다르게 틀렸던" 증상만 봉합했을 뿐, 근본 원인(네 알고리즘이 한 함수에 혼재해 각 분기를 독립적으로 추론·테스트하기 어려움)은 그대로. 근거 주석 없는 매직넘버 `200`도 포함. | `code_review_orchestrator.py:607-807`(특히 `:678-717`, `:719-772`, 매직넘버 `:761`) | overflow 경로와 콘텐츠 예산배분 경로를 각각 이름 있는 별도 함수로 추출. `200`은 이름 있는 상수 + 선정 근거 주석. |
| 3 | 유지보수성 | `collect_context`(176줄)도 동일 계열 문제 — diff_base 계산, ranking 준비, 중첩 함수 정의, 4개 모드(`--spec`/`--plan`/`--impl-prep`/`--impl-done`) 분기, 보조 번들 조립을 한 함수가 전부 처리. 지역 변수가 많아 흐름 추적에 위아래를 계속 오가야 함. | `consistency_orchestrator.py:473-648` | "모드별 target 확정"과 "보조 번들(spec/conventions/plan) 조립"을 최소 두 단계 함수로 분리. |
| 4 | 유지보수성 | `_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_apply_status_update`/`_emit_summary_state`가 두 orchestrator 파일에 사실상 동일 코드로 중복 구현되어 "Change both" 주석에만 의존. 같은 파일이 바로 몇 줄 위에서 정확히 이 패턴("두 벌 유지 + change-both 주석")이 실제 divergence 를 낸 전례(`report_paths.py`를 `_shared/`로 추출한 사유)를 스스로 기록하고 있어, 잠재 위험이 가설이 아니라 실증된 상태. | `code_review_orchestrator.py:183-374`(특히 `_reconcile_state_with_disk` 197-242, `_apply_status_update` 340-374) ↔ `consistency_orchestrator.py:87-192`(동일 함수군, 101-140, 163-192) | `report_paths.py` 선례처럼 `_shared/retry_state.py`(가칭)로 공통 로직 추출. 호출자별 라벨 차이는 파라미터로 흡수. |
| 5 | 테스팅 | `collect_markdown_files`의 natural-sort(`_natural_key`) 적용 자체를 직접 검증하는 테스트가 없음 — mutation(해당 줄을 `files.sort()`로 되돌림)해도 관련 45 tests 전부 GREEN(현재는 `prioritize_bundle_files`가 항상 재정렬해 이 줄의 효과가 dead effect). | `consistency_orchestrator.py:266` | `collect_markdown_files`를 직접 호출해 반환 순서를 단언하는 테스트 추가, 정말 불필요하면 해당 줄 제거. |
| 6 | 테스팅 | `extract_rationale_sections`는 `format_file_bundle`과 동일한 sentinel 방어 로직(`_neutralize_sentinel`)을 쓰지만 이를 검증하는 테스트가 전혀 없음(저장소 전체 grep 0건) — 향후 두 호출부가 divergence(예: 한쪽만 neutralize 누락)를 일으켜도 감지되지 않음. | `consistency_orchestrator.py:449-470` | `format_file_bundle` 테스트와 동일 패턴(본문에 sentinel 리터럴을 포함하는 rationale 섹션 픽스처)의 짝 테스트 추가. |
| 7 | 테스트 위생 | 신설 테스트(`test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary`)가 서브프로세스 스니펫 안에서 `tempfile.mkdtemp()`로 만든 디렉터리를 정리하지 않아, 실행할 때마다 고아 임시 디렉터리가 누적됨(실측 확인 후 직접 정리함). 같은 diff 의 형제 테스트(`test_consistency_bundle_priority.py`의 `_repo()`)는 동일 패턴에 `addCleanup(shutil.rmtree, ...)`를 붙여 정리하므로 이번 신설 테스트만 관례를 놓침. | `.claude/tests/test_consistency_context_budget.py:163-190`(특히 176-177행) | 스니펫 안에 `try/finally`로 `shutil.rmtree(d, ignore_errors=True)` 추가, 또는 `tempfile.TemporaryDirectory()` 컨텍스트 매니저로 교체. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안(방어심층) | Git 서브프로세스 인자(`diff_base`/`commit`/`range`/`branch`)에 값 검증이 없음(CWE-88) — `-`로 시작하는 값이 git 옵션으로 오인될 수 있음(예: `--output=<path>`). 리스트 기반 `subprocess.run`이라 셸 인젝션은 아니며, 로컬 CLI 도구라 실질 위험은 낮음. | `consistency_orchestrator.py:302-303,390`; `code_review_orchestrator.py`의 git helper 절 | `-`로 시작하는 값 거부, 또는 `git rev-parse --verify --end-of-options <ref>`로 선검증. |
| 2 | 보안(방어심층) | `--spec`/`--plan`/`--impl-prep`/`--impl-done` 경로 인자에 저장소 루트 컨파인먼트 검증이 없음. 호출 주체(로컬 harness/개발자)가 이미 동등한 파일 접근 권한을 보유하므로 권한 상승 효과는 없음. | `consistency_orchestrator.py:512-548`(`_require_target`) | 필요시 `os.path.commonpath` 기반 검증 추가(우선순위 낮음). |
| 3 | 보안(방어심층) | 예측 가능한 고정 경로 디버그 로그 파일(`/tmp/*-log.txt`) — 다중 사용자 환경에서 심볼릭 링크 선점 등 일반적 패턴(CWE-377)에 취약할 수 있음. 단일 개발자 워크스테이션 전제면 실질 위험 낮음. | `code_review_orchestrator.py:49`, `consistency_orchestrator.py:46` | 필요시 `tempfile` 기반 사용자별 경로로 전환. |
| 4 | 성능 | `total_lines` 계산이 지연 계산에서 즉시 계산으로 바뀌어, 실제 소비 지점(세션당 최대 1개 파일)과 무관하게 모든 파일에 대해 무조건 스캔이 추가됨 — reviewer(agent) 13~14개가 동일 `change_infos`를 매번 재가공하는 구조 위에서 그만큼 곱해짐. | `code_review_orchestrator.py:633-634,662-663,756` | 실제 소비 지점(2차 절단이 필요한 시점)에서 그 자리에 계산하도록 되돌리기. |
| 5 | 성능 | `_notice_text(i)`가 예약분 계산과 환불 계산에서 동일 `i`에 대해 2회 재조립됨(캐싱 여지, 체감 영향은 미미). | `code_review_orchestrator.py:735-748` | 루프 진입 전 `{i: _notice_text(i)}` 캐시를 만들어 양쪽에서 재사용. |
| 6 | 성능(diff 범위 밖, 참고) | `prioritize_bundle_files`의 tier 판정이 파일마다 전체 plan 코퍼스에 대한 부분 문자열 검색을 수행 — O(파일수×plan코퍼스길이). 이번 diff 는 이 로직 자체를 변경하지 않음. | `consistency_orchestrator.py:341-354` | 필요시 플랜 문서별 파일명 `set` 멤버십 검사로 대체(현재는 불필요). |
| 7 | 성능(diff 범위 밖, 참고) | `truncate_file_bundle`의 파일-드롭 루프가 반복마다 O(k) 재계산(전체적으로 O(k²) 형태). 이번 diff 는 이 로직을 변경하지 않았고, sentinel 도입으로 청크 수가 오히려 실제 파일 수에 더 가까워져 이전보다 개선됨. 실사용 규모(~230파일)에서는 체감 지연 낮음. | `consistency_orchestrator.py:746-754` | 필요시 누적 길이 변수화 + `collections.deque` 사용(우선순위 낮음). |
| 8 | 아키텍처 | 두 orchestrator가 "문서 묶음 예산 관리"를 구조적으로 다르게 해결(구조화 데이터 유지 vs 조기 문자열화+재파싱) — 이번 sentinel 결함 계열의 근본 원인. sibling 모듈(`code_review_orchestrator.py`)은 sentinel 없이 이미 이 문제를 구조적으로 회피하고 있음. | `code_review_orchestrator.py:607`(`build_files_section`) vs `consistency_orchestrator.py:362,718` | 지금 재설계는 불필요(현재 테스트로 충분히 고정됨). 이 계열 결함 재발 시 `(rel_path, content)` 구조화 리스트 방식 재설계 검토. |
| 9 | 아키텍처 | 신규 공용 유틸(`_natural_key`, `_charge_notice`)이 기존 공유 lib(`report_paths.py` 등) 대신 각 orchestrator 로컬로 계속 증식 — `_load_state`류 상태관리 함수 중복과 같은 확산 패턴의 반복. | `_natural_key`(`consistency_orchestrator.py:229`), `_charge_notice`(`code_review_orchestrator.py:561`) | 지금은 조치 불필요(사용처 각 1곳). 3번째 사용처가 생기면 공유화 검토. |
| 10 | 아키텍처 | `prioritize_bundle_files`의 tier 판정이 하드코딩된 if/elif 체인 — plan 문서가 이미 다음 신호(`spec_impact` frontmatter 우선 포함) 도입을 예고한 상태. | `consistency_orchestrator.py:341-354` | 다음 신호 추가 시 "predicate → tier 번호" 순서 목록 방식으로 전환 검토. |
| 11 | 요구사항 | `budget_substitutions`의 per-checker 몫 계산(정수 내림)이 아주 작은 `max_context_size`에서 정확히 0이 될 수 있고, `truncate_file_bundle`/`session.truncate_to_budget` 모두 `budget<=0`을 "무제한"으로 해석 — 기본값(262144)에서는 도달 불가능한 영역. | `consistency_orchestrator.py:770-793`, `:718-733` | 계산된 몫이 0이면 최소 양의 하한으로 clip. |
| 12 | 요구사항 | `_neutralize_sentinel`의 남은 좁은 틈: 파일이 정확히 sentinel로 끝나고 말미 개행이 없는 경우 neutralize 시점엔 미치환되지만, 템플릿 조립 시 고정 개행이 뒤에 붙어 sentinel이 재구성될 수 있음(발생 조건이 좁아 실제 트리거 가능성 낮음). | `consistency_orchestrator.py:210-226,362-370` | neutralize를 템플릿 조립 후 전체 청크에 대해 수행하거나 trailing newline 정규화(우선순위 낮음). |
| 13 | 유지보수성 | 매직 넘버 `20`(라우터 파일목록 미리보기)과 `8192`(이진 파일 스니핑 청크)가 이름 없이 반복 — 이 파일이 다른 상수(`_GUTTER_OVERHEAD` 등)에는 실측 근거를 남기는 관례와 대비됨. | `code_review_orchestrator.py:902-903`(20), `:117`(8192) | `_ROUTER_FILE_LIST_PREVIEW`/`_BINARY_SNIFF_BYTES` 등으로 상수화. |
| 14 | 유지보수성 | 테스트 하네스 보일러플레이트(`ORCH`/`_PREAMBLE`/`run_in_orchestrator`)가 최소 3개 테스트 파일에 거의 그대로 중복되고, 변수명도 상이(`ROOT` vs `REPO_ROOT`) — "복사 후 갈라짐"의 전형적 징후. | `test_consistency_bundle_priority.py:35-69` ↔ `test_consistency_context_budget.py:45-86`(+`test_line_anchors.py`) | 공용 헬퍼(예: `_harness.run_in_fresh_interpreter(...)`)로 통합하고 변수명 통일. |
| 15 | 문서화 | `.claude/tests/README.md`의 두 테스트 요약 행이 이번 작업으로 추가된 신규 보장(sentinel 위조방지 테스트 클래스, 자연정렬 tie-break)을 반영하지 못함. | `.claude/tests/README.md:56-57` | 각 행에 한 문장씩 추가(선택 사항, CI 가드 대상 아님). |
| 16 | 문서화 | plan의 열려있는 체크리스트 문구(`spec_impact` frontmatter 우선 포함 요청)가 같은 문서 하단에 이미 기록된 tiering/자연정렬 완료 사실을 반영하지 못해 "아직 아무 조치 없음"처럼 읽힘. 진짜 남은 갭(`spec_impact` frontmatter 자체를 구조화 신호로 소비)은 여전히 유효한 요청. | `plan/in-progress/harness-consistency-summary-downgrade-rule.md:104-105` | 문구를 "tier 1(plan 본문 언급)·자연정렬은 이미 처리, `spec_impact` frontmatter 는 아직 직접 읽지 않음"으로 갱신. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `--impl-done` diff 경로가 sentinel 위조 방지를 우회함을 PoC로 확인(Critical #2 corroborate). 그 외 CWE-88/경로 컨파인먼트/로그 경로는 방어심층 INFO 3건 |
| performance | LOW | 새로운 성능 저하 없음. `total_lines` 즉시계산 등 미미한 낭비만 INFO 4건 |
| architecture | LOW | sentinel 보호가 4개 진입점 중 2곳만 적용(WARNING #1,#2 corroborate), `build_files_section` god-function(WARNING #2) |
| requirement | HIGH | `--impl-done` diff 가 sentinel 없이 마지막 spec 파일과 통째로 삭제됨 — PoC 재현(Critical #2) |
| scope | NONE | 스코프 이탈 없음(5파일 1:1 일치, 포맷팅/설정/무관 파일 변경 없음). 마지막 커밋의 자진신고 PR-외 버그 수정(2단계 절단, Critical #3 최초 수정) 1건 확인 — 관행과 일치해 문제 아님 |
| side_effect | HIGH | `--spec`/`--plan` 원시 문서가 sentinel 위조에 무방비 — PoC 재현(Critical #1). 신설 테스트 tempdir 미정리(WARNING #7) |
| maintainability | MEDIUM | 상태관리 함수 5종이 두 orchestrator 파일에 중복(WARNING #4), `build_files_section`/`collect_context` god-function(WARNING #2,#3) |
| testing | HIGH | 2단계 절단 CRITICAL 수정에 회귀 테스트 전무 — mutation 검증(Critical #3). natural-sort/`extract_rationale_sections` 테스트 공백(WARNING #5,#6) |
| documentation | LOW | 직전 라운드 WARNING 3건 전부 해소 확인. 파생 문서(README/plan) 2건 미반영만 INFO |
| dependency | NONE | 신규 외부 의존성 없음, 기존 표준 라이브러리(`re`,`os`)만 사용 |
| database | NONE | 해당 없음(DB 쿼리/트랜잭션/마이그레이션 코드 없음) |
| concurrency | NONE | 해당 없음(스레드/비동기/락/공유 가변 상태 없음) |
| api_contract | NONE | 해당 없음(API 엔드포인트/스키마/인증 변경 없음) |
| user_guide_sync | NONE | 해당 없음(doc-sync-matrix 21개 row 전부 미매칭, 유저 가이드 무관) |

## 발견 없는 에이전트

scope, dependency, database, concurrency, api_contract, user_guide_sync — 6개 에이전트는 실질적 결함 없음("해당 없음"/"문제 없음"으로 확인 완료).

## 권장 조치사항

1. `_neutralize_sentinel()`을 나머지 2개 `target_doc` 생산 경로 — (a) `--spec`/`--plan` 원시 문서, (b) `--impl-done`의 `diff_section` — 에도 적용하거나, `truncate_file_bundle`/`budget_substitutions` 진입점에서 모든 소스에 일괄 무해화(Critical #1, #2).
2. `code_review_orchestrator.py`의 2단계 절단(`total_lines`/`source_lines`) 버그 수정에 대해 `max_file_size`를 작게 설정해 1차+2차 절단이 모두 발동하는 회귀 테스트 fixture 추가(Critical #3).
3. `extract_rationale_sections`(sentinel 방어)와 `collect_markdown_files`(natural-sort)에 대해 각각의 동작을 직접 겨냥하는 짝 테스트 추가(WARNING #5, #6).
4. `_BUNDLE_FILE_SENTINEL`이 최종 LLM 프롬프트에 그대로 노출되지 않도록 `truncate_file_bundle` 반환 직전 벗겨내거나, 최소한 실측 기반 예산 보정 추가(WARNING #1).
5. `build_files_section`/`collect_context` god-function을 전략별로 분해하고, `_load_state`류 상태관리 함수를 `_shared/retry_state.py`(가칭)로 공유화(WARNING #2, #3, #4).
6. (낮은 우선순위) 신설 테스트의 임시 디렉터리 정리(WARNING #7), 매직넘버 명명, 테스트 하네스 중복 통합, README/plan 문서 갱신(INFO 항목들).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행됨(사유 명시 없음, 세션 메타데이터상 라우팅 단계 자체를 건너뜀).
- **강제 포함(router_safety) 화이트리스트**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 라우터 스킵과 무관하게 상시 강제 대상이며, 전원 결과 확보됨.
- **제외된 reviewer**: 없음(0명) — 14개 reviewer 전원 실행·전원 결과 확보.