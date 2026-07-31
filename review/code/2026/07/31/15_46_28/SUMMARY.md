# Code Review 통합 보고서

## 전체 위험도

**HIGH** — 이번 diff 의 3개 커밋(natural sort 완성 · sentinel 기반 파일 경계 · `_charge_notice` 예산 통합) 자체는 의도한 결함을 정확히 고쳤고 뮤테이션 테스트로 검증됐으나(704/704 하네스 스위트 GREEN), **동일 함수(`build_files_section`) 안에서 리뷰 대상 세션 자체를 포함해 실사용 경로에서 재현되는 CRITICAL 결함을 리뷰 중 직접 재현·검증**했다 — 2단계 truncation 이 파일의 진짜 총 줄 수를 잘못 보고한다. 이 결함 자체는 이번 3개 커밋이 만든 회귀는 아니고(diff 로 확인 — 문제의 그 줄은 unchanged) 인접 기존 코드지만, 이번 PR 의 주제("harness 번들 정확성")와 정확히 같은 결함 클래스이며 대형 파일마다 활성 상태로 재현되므로 별도 후속 fix 가 필요하다. 아울러 이번 diff 가 구현한 natural sort 사실이 산문 4곳(plan 배너·plan 체크리스트·테스트 docstring·인접 주석) 중 정확히 1곳(체크리스트)에만 반영되고 나머지 3곳은 옛 상태를 서술한 채 남아, 같은 파일 안에서 자기모순이 발생한 점도 반복 재발 패턴으로 확인된다.

**라우터 안전장치 확인**: forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인 — 누락 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 2단계 truncation 이 1차 truncation 이 붙인 "안내문" 텍스트를 실제 코드 줄로 착각해 총 줄 수를 재계산 — reviewer 에게 파일의 진짜 총 줄 수보다 크게 적은 숫자를 보고한다(예: 실제 1531줄 파일이 "907/1148" 또는 재현 시 "400/792"로 보고되고, 진짜 총량 1531/1532 는 최종 프롬프트 어디에도 등장하지 않음). **본 리뷰에서 `build_files_section` 을 소규모 예산으로 직접 재호출해 동일 현상을 독립 재현·검증했다.** 문제의 `line_count = file_parts[i]["full_content"].count("\n") + 1` 줄 자체는 이번 diff 가 건드리지 않은 기존 코드(commit `ad9701b3e` diff 대조로 확인 — unchanged)이므로 이번 3커밋이 만든 회귀는 아니나, 이번 PR 의 주제와 동일한 결함 클래스이고 대형 파일 매 세션 실사용 경로에서 재현된다 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:637-640`(1차: 파일 단위 truncation) 및 `:746`, `:751-757`(2차: 프롬프트 총예산 truncation, `build_files_section`) | 1차 truncation 시점에 원본 파일의 실제 총 줄 수를 `file_parts[i]` 에 별도 필드(예: `full_content_total_lines`)로 저장하고, 2차 truncation 은 그 값을 재사용. "이미 안내문이 붙은 문자열"을 다시 스캔해 총량을 재도출하는 패턴 자체를 제거할 것 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | git 리비전 문자열(`--commit`/`--range`/`--branch`/`--diff-base`)이 `--` 구분자 없이 subprocess 인자로 전달 — argument injection(CWE-88) 가능성. 값이 `-`로 시작하면 git 이 리비전이 아니라 옵션으로 해석(예: `--output=<path>`로 둔갑해 `git diff` 결과를 임의 경로에 쓸 수 있음) | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:974,984,997,1007,1020,1030,1043` / `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:273,355` | 값이 `-`로 시작하면 거부하거나, 리비전 인자 앞에 `--end-of-options`(git 2.24+) 삽입 |
| 2 | 보안 | `--spec`/`--plan`/`--impl-prep`/`--impl-done`/`--files` 인자가 저장소 루트로 경로를 제한하지 않아, 임의 로컬 파일(예: `~/.ssh/id_rsa`) 내용이 git 커밋되는 review 산출물에 영구 유출될 수 있음 | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:493-529`(`_require_target`) / `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1339` | 대상 경로가 `os.path.realpath(root)` 하위인지 검사해 저장소 밖 경로 거부 |
| 3 | 아키텍처/범위/문서 | 리팩터(`_notice_cost`→`_notice_text`+`_charge_notice`) 도중 지워지지 않은 중복 rationale 주석 — 동일 설명이 739-742행(구)과 743-745행(신규)에 두 벌 남음(직접 소스 확인). 이번 PR 이 세우려는 "예산 산술 단일 출처" 원칙과 상충하며 3명의 reviewer 가 독립적으로 지적 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:739-745`(`build_files_section`) | 739-742행(구) 삭제, 743-745행만 유지 |
| 4 | 보안/부작용 | `_BUNDLE_FILE_SENTINEL`이 정적 리터럴이라 "본문이 위조 불가능"이라는 전제가 구조적으로 보장되지 않음 — 같은 PR 의 plan 문서(:124)가 이미 이 값을 산문으로 인용해 거의 재현될 뻔했음(직접 확인: 현재는 개행으로 감싸이지 않아 안전하나, 코드블록화되거나 다른 문서가 독립된 줄로 인용하면 이 PR 이 고치려던 "파일 경계 오인" 버그가 재발). 이 케이스(sentinel 리터럴이 파일 본문에 그대로 등장)에 대한 회귀 테스트 없음 | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:679`(정의) / `plan/in-progress/harness-consistency-summary-downgrade-rule.md:124` | 상수 옆에 "이 리터럴을 spec/plan 에 개행으로 둘러싸 그대로 적지 말 것" 방어 주석 추가 또는 세션별 랜덤 nonce 도입 + 회귀 테스트 추가 |
| 5 | 아키텍처/부작용 | sentinel 을 벗겨내는 코드가 없어 최종 checker 프롬프트(5개 sub-agent)에 `<!-- @bundle-file -->` 이 설명 없이 그대로 노출(추상화 누출) — 파일당 23자 순수 오버헤드가 이 코드베이스의 다른 실측·보정 관행(`_GUTTER_OVERHEAD`)과 달리 측정·보정 없이 방치됨(~230파일 코퍼스에서 약 5,300자/약 2% 오버헤드) | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:351,447`(생성처) / `:699-741`(`truncate_file_bundle`) | 최종 반환 직전 `text.replace(_BUNDLE_FILE_SENTINEL, "\n")` 로 벗겨내거나, 유지 시 실측 기반 예산 보정 추가 |
| 6 | 요구사항 | 신규 natural-sort 회귀 테스트가 전체 하네스 스위트(704 tests) 컨텍스트에서 드물게(6회 중 1회) flaky — 실패 시 정확히 "수정 전" 사전순 결과가 재현됨. 격리 실행 20/20 통과, `PYTHONDONTWRITEBYTECODE=1` 적용 시 4/4 통과 — 구현 로직 결함이 아니라 stale `__pycache__` 캐시 신뢰성 문제로 추정(프로젝트 기존 재발 클래스) | `.claude/tests/test_consistency_bundle_priority.py:183`(`test_ties_use_natural_order_not_lexicographic`) | 이번 PR 을 막을 사유 아님. 공유 fresh-interpreter 프리앰블에 `sys.dont_write_bytecode = True` 추가 또는 스위트 시작 시 대상 `__pycache__` 정리를 별도 후속으로 검토 |
| 7 | 유지보수성 | `build_files_section` 함수가 약 190줄로 지나치게 길고, 서로 다른 3가지 경로(예산 무제한/헤더+diff 만으로도 초과인 overflow/파일별 예산배분, 중첩 `_render` 클로저 포함)를 한 함수에 담아 순환 복잡도가 높음 — 위 CRITICAL 버그가 바로 이 함수의 가장 깊은 분기에 숨어 있었음 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:607-794` | overflow 전용 경로(664-703)와 예산배분의 재귀적 truncation 로직(738-759)을 이름 있는 함수로 분리 |
| 8 | 유지보수성/의존성/아키텍처 | 두 orchestrator 간 상태-버킷 관리 로직(`_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_emit_summary_state`/`_apply_status_update`)이 거의 그대로 중복돼 "Mirrors X. Change both." 주석으로 수동 동기화를 요구 — 이번 PR 이 추가한 `_charge_notice`(code-review 쪽)와 `_natural_key`/`_BUNDLE_FILE_SENTINEL`(consistency 쪽)도 상대편에 대응 구현 없이 각자 로컬로 늘어나 같은 drift 확장 패턴을 반복 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:183-374`(및 `:561` 신규) ↔ `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:87-192`(및 `:213`,`:679` 신규) | 두 orchestrator 가 공유하는 `lib/retry_state.py`(가칭)로 상태-버킷 함수를 이동. 신규 유틸도 3번째 사용처 발생 시 공유 lib 승격 검토 |
| 9 | 유지보수성 | `consistency_orchestrator.py` 의 `_reconcile_state_with_disk` 가 참조하는 `agents_skipped` 키가 이 파일 안 어디서도 set 되지 않는 죽은 코드(카피-페이스트 잔재) — 실행 결과는 항상 빈 집합이라 버그는 아니나 상태 머신 이해에 혼란을 줌(grep 으로 확인) | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:116` | 제거하거나 존치 사유(향후 라우터 도입 대비 등)를 주석으로 명시 |
| 10 | 유지보수성 | 신규 테스트 두 파일이 "fresh interpreter 서브프로세스" 패턴을 거의 그대로 복붙했는데, 한 파일 주석이 "형제 스위트도 이미 timeout 을 넣었다"고 서술하지만 실제로는 다른 파일에 `timeout` 자체가 없음(grep 0건) — hang 시 무한 대기 위험 + 오도하는 주석 | `.claude/tests/test_consistency_bundle_priority.py:56-63`(특히 61-62행 주석) vs `.claude/tests/test_consistency_context_budget.py:72-79`(timeout 없음) | 공용 fresh-interpreter 헬퍼로 통합해 `timeout`을 한 곳에 고정. 최소한 `test_consistency_context_budget.py` 에도 동일 `timeout=30.0` 추가 |
| 11 | 문서 | plan 상단 배너(:12-17)가 "natural sort 는 여전히 열린 후속"이라고 서술하지만, 같은 파일의 체크리스트(:105)는 이 리뷰 대상 커밋으로 이미 `[x]` 완료 처리됨(직접 대조로 검증) — 배너가 지목한 `test_ties_stay_alphabetical` 도 이 커밋에서 삭제되고 반대 단언의 `test_ties_use_natural_order_not_lexicographic` 로 교체돼 더 이상 존재하지 않음(grep 확인). 직전 리뷰 라운드가 정확히 이 자리를 반대 방향("배너가 코드를 앞서갔다")으로 이미 한 번 지적했던 것과 같은 결함 클래스(배너-체크리스트 drift)가 형태만 바뀌어 재발 | `plan/in-progress/harness-consistency-summary-downgrade-rule.md:12-17` vs `:105` | 배너 문단을 "2026-07-31 `_natural_key` 도입으로 구현 완료"로 정정하고, 삭제된 테스트명 참조 제거 |
| 12 | 문서/아키텍처 | 테스트 모듈 docstring(:7-9)이 "`collect_markdown_files` 는 사전순을 반환한다"고 현재시제로 서술하지만, 같은 커밋이 그 함수를 natural sort 로 변경(같은 파일 신규 테스트가 반대 사실을 단언). natural sort 반영 누락이 #11(배너)에 이어 이 docstring, 그리고 `prioritize_bundle_files` 인접의 "input is already alphabetical" 주석까지 — 이번 진단으로 확인된 natural-sort 관련 산문 4곳 중 정확히 체크리스트 1곳만 갱신되고 나머지 3곳이 옛 상태로 남아있음 | `.claude/tests/test_consistency_bundle_priority.py:7-9` / `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:339-340`(인접 주석) | "used to return plain alphabetical order (tie-break is now natural sort via `_natural_key`)" 식으로 과거형 정정, 인접 주석도 "already naturally sorted"로 갱신 |
| 13 | 테스트 | 신규 테스트 docstring 의 백틱에 불필요한 백슬래시(`` \` ``)로 인한 `DeprecationWarning: invalid escape sequence` — 향후 Python 버전에서 `SyntaxError` 로 승격되거나 `-W error` 설정 시 즉시 컴파일 실패 가능(직접 확인: `warnings.simplefilter('error')` 하에서 `compile()` 이 해당 줄에서 `SyntaxError`) | `.claude/tests/test_consistency_context_budget.py:103,105` | 백틱 앞 백슬래시 제거 또는 docstring 을 raw string(`r"""..."""`)으로 전환 |
| 14 | 성능 | `build_files_section` 이 reviewer 수(최대 14명)만큼 완전히 동일한 diff 주석/줄 번호 매기기 작업을 반복 계산 — 이번 diff 가 만든 회귀는 아니나 이번 PR 이 수정한 `_charge_notice` 로직이 바로 이 함수 내부에 있어 함께 지적. 1,200 files 스케일 실측치가 그대로 곱해지는 구조 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1103`(`prepare_session`)→`:797`(`build_agent_prompt_body`)→`:607`(`build_files_section`) | 파일별 주석·번호매기기 결과를 agent 루프 밖에서 한 번만 계산해 캐싱, agent 별 예산 배분만 반복 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 디버그 로그 경로가 공유 `/tmp` 에 고정 — symlink 공격 표면(CWE-377), 기존 코드로 이번 diff 대상은 아님 | `code_review_orchestrator.py:49`, `consistency_orchestrator.py:46` / 실제 open: `lib/session.py:16` | `tempfile.gettempdir()` 기반 사용자별 경로 또는 `os.O_NOFOLLOW` 로 오픈 |
| 2 | 성능 | `_natural_key` 가 파일 내 기존 정규식 사전컴파일 관례(`_CATALOG_BULK_RE` 등) 미준수 — 현재 스케일(수백~1천 파일)에서 체감 영향 없음 | `consistency_orchestrator.py:213` | 모듈 레벨 `_NATURAL_KEY_RE = re.compile(r"(\d+)")` 로 통일 |
| 3 | 성능 | `_charge_notice` 의 `*notes` 가변인자 언패킹이 제너레이터의 지연 평가를 무효화(피크 메모리 O(1)→O(k)) — 현재 배치 크기(50) 기준 무시 가능한 수준(수십 KB) | `code_review_orchestrator.py:561-578`, 호출부 `:726-728` | (선택) `*args` 대신 이터러블을 받아 내부에서 순회하도록 변경 |
| 4 | 아키텍처 | 두 orchestrator 가 "파일 묶음 예산 관리"를 구조적으로 다른 방식(구조화 dict 유지 vs 조기 문자열화 후 재파싱)으로 해결 — 이번에 고친 sentinel 결함의 근본 원인(stringly-typed 중간표현)이 구조적으로 잔존 | `code_review_orchestrator.py:607` vs `consistency_orchestrator.py:344`+`:699` | 지금 재설계 불요. 재발 시 구조화 리스트 반환 방식으로 통일 검토 |
| 5 | 테스트/문서 | 신규 테스트 docstring(및 plan 문서 동일 서술)이 3개 헤딩이 모두 한 spec 파일에 있다고 서술하지만 실제로는 2개 파일(`5-expression-language.md`, `4-execution-engine.md`)에 분산 — fixture 대표성은 유효, 기능적 결함 아님 | `test_consistency_context_budget.py:104-105`, `plan/in-progress/harness-consistency-summary-downgrade-rule.md:121` | "두 spec 파일에 흩어진 헤딩들"로 서술 완화 |
| 6 | 범위/테스트 | 신규 테스트 클래스 뒤 빈 줄이 파일 관례(top-level 클래스 사이 2줄)와 달리 1개뿐. flake8/ruff 설정 없어 CI 차단 대상 아님 | `test_consistency_context_budget.py:153-155` | 빈 줄 1개 추가 |
| 7 | 유지보수성 | `naming_collision` checker 의 다중 코퍼스(`related_specs`/`plan_in_progress`/`conventions`) 규칙이 두 함수(`_corpus_keys`, `_checker_corpus`)에 독립적으로 하드코딩돼 향후 drift 위험 | `consistency_orchestrator.py:745`, `:779-780` | 단일 매핑(`{"naming_collision": (...)}`)으로 통합해 두 함수가 참조 |
| 8 | 유지보수성 | git subprocess timeout 값이 파일 내 제각각(10/15/30)이고 설명 없음, truncation 포함 여부 임계값 `200` 도 매직 넘버(이 파일의 다른 상수는 보통 근거 주석을 갖춤) | `code_review_orchestrator.py:938,989,1012,1035,1045` / `:751` | 공용 상수(`_GIT_TIMEOUT_SEC` 등)로 통일하거나 차등 근거를 주석으로 남김 |
| 9 | 테스트 | `_charge_notice` 에 대한 직접 단위 테스트 부재(간접 커버리지만 존재) — 뮤테이션 검증으로 이미 실질적으로 상쇄됨 | `code_review_orchestrator.py` `_charge_notice` 정의부 | (선택) 2~3줄짜리 직접 단위 테스트 추가 |
| 10 | 요구사항 | `_charge_notice` docstring 이 "네 지점 모두를 라우팅"이라 서술하지만 실제로는 3곳만 거치고 네 번째(`_aggregate_omission_note`의 `room` 계산)는 여전히 인라인 뺄셈 — 산술적으로 동치라 동작 결함은 아님 | `code_review_orchestrator.py:561-578`, `:790-794` | (선택) `_charge_notice(max_total_size, body)` 로 스타일 통일 |
| 11 | 문서 | `.claude/tests/README.md` 의 `test_consistency_bundle_priority.py` 요약이 이번에 추가된 보장("tier 내부 tie-break 는 natural order")을 언급하지 않음(이번 diff 범위 밖 후속) | `.claude/tests/README.md:57` | 여유 있을 때 해당 문구 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | git 리비전 arg injection 패턴(W1), 경로 미제한(W2), sentinel 회귀테스트 부재(W4) — 긍정: `agents_forced` 화이트리스트는 견고한 통제로 확인 |
| performance | LOW | 14-reviewer 반복 계산(W14, diff 범위 밖), 정규식 미사전컴파일·제너레이터 언패킹(I2/I3) |
| architecture | LOW | 중복 주석(W3), sentinel 프롬프트 누출+미보정 비용(W5), 구조적 이원화(I4) |
| requirement | LOW | natural-sort 테스트 flaky(W6, `__pycache__` 추정) — 3개 커밋의 구현 로직 자체는 결함 없음 확인 |
| scope | LOW | 중복 주석(W3, 공유), 빈 줄 관례(I6) — 스코프 이탈 없음, 5파일 모두 하나의 주제로 수렴 확인 |
| side_effect | LOW | sentinel 전제 취약성(W4, 공유), 프롬프트 노출 설명 부재(W5, 공유) — 함수 시그니처·전역상태·I/O 변경 없음 확인 |
| maintainability | HIGH | **CRITICAL: 2단 truncation 총줄수 오보고(리뷰 중 직접 재현·검증)**, 함수 과대(W7), 상태관리 중복(W8), 죽은 코드(W9), 테스트 안전장치 불일치(W10) |
| testing | LOW | docstring 이스케이프 경고(W13) — 뮤테이션 3종 전부 정확히 RED 전환 확인, 704 tests 전체 GREEN |
| documentation | MEDIUM | plan 배너 자기모순+재발패턴(W11), 중복 주석(W3, 공유), 테스트 docstring stale(W12) |
| dependency | NONE | 새 외부 의존성 0건(표준 라이브러리만) — 손-미러링 패턴 확장 관찰(W8에 병합) |
| database | NONE | 해당 없음 — DB 계층 코드 전무 |
| concurrency | NONE | 해당 없음 — 동시성 프리미티브 도입·수정 없음 |
| api_contract | NONE | 해당 없음 — REST API/제품 코드 변경 없음 |
| user_guide_sync | NONE | 해당 없음 — doc-sync-matrix 20개 trigger 매칭 0건 |

## 발견 없는 에이전트

- database — DB 연결/쿼리/ORM/마이그레이션/트랜잭션 코드 전무
- concurrency — 스레드/프로세스/락/async 프리미티브 도입·수정 없음
- api_contract — REST API·제품 코드(`codebase/**`) 변경 없음
- user_guide_sync — `doc-sync-matrix.json` 20개 trigger(glob 15 + semantic 5) 전수 대조 매칭 0건

## 권장 조치사항

1. **[최우선]** `build_files_section`의 2단계 truncation 총 줄 수 오보고(CRITICAL) 수정 — 1차 truncation 시 원본 파일의 실제 총 줄 수를 별도 필드로 보존하고 2차 truncation 에서 재사용. 리뷰 중 직접 재현·검증된 활성 결함이므로 별도 후속 커밋으로 즉시 처리 권고.
2. natural sort 구현 완료 사실을 산문 3곳(plan 배너 `:12-17`, 테스트 모듈 docstring `test_consistency_bundle_priority.py:7-9`, `prioritize_bundle_files` 인접 주석 `:339-340`)에 반영 — 삭제된 `test_ties_stay_alphabetical` 참조 제거. 배너-체크리스트 drift 가 직전 라운드에 이어 재발한 패턴이므로 우선순위 상향.
3. `build_files_section`의 중복 rationale 주석(`:739-745`) 정리 — 3명의 reviewer(architecture/scope/documentation)가 독립적으로 지적한 저비용 정리.
4. git 리비전 인자 argument-injection 가드(`-` 접두 거부 또는 `--end-of-options`) 추가 + `--spec`/`--plan`/`--files` 경로를 저장소 루트로 제한하는 검증 추가.
5. `_BUNDLE_FILE_SENTINEL` 최종 프롬프트 유출 제거(`text.replace(...)` 로 벗겨내기) 또는 유지 시 실측 기반 예산 보정 + "sentinel 이 파일 본문에 등장" 케이스 회귀 테스트 추가.
6. 신규 테스트 두 파일의 `timeout` 안전장치 불일치 해소(`test_consistency_context_budget.py`에도 `timeout=30.0` 추가) + docstring 백틱 이스케이프(`\``→`` ` ``) 수정.
7. (여유 시) 두 orchestrator 간 상태-버킷 관리 로직(`_load_state`/`_save_state`/`_reconcile_state_with_disk` 등)을 공유 `lib/` 모듈로 승격해 "change both" 수동 동기화 의존 제거.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재) — 전체 reviewer(14명) 실행: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync.
- **제외**: 없음 (0명).
- **강제 포함(router_safety) 화이트리스트**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 확인(누락 없음).