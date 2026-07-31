# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 등급 발견은 없고 핵심 기능(하향 감지 백스톱, `retry_state.py` 통합)은 문서화된 예시·724개 하네스 테스트로 정상 동작이 확인됐으나, 신규 백스톱 자체의 실효성을 스스로 훼손할 수 있는 설계 결함(stderr 전용 스트림이 ALLOW 경로에서 모델에 미노출·`BLOCK:` 첫매치 오추출이 실제 문서 1건에서 이미 재현됨)과, 이 PR이 근절하려던 "N-사본 drift" 패턴의 재발(3번째 orchestrator 누락, checker 목록 3중 하드코딩, BLOCK 파서 이중 구현)이 다수의 독립 reviewer에게서 반복 확인됨.

커버리지 확인: 14개 reviewer 전원 success, forced 화이트리스트(documentation/maintainability/requirement/scope/security/side_effect/testing) 전원 결과 확보 — 강제 리스트 미이행으로 인한 거짓 "clean" 판정 위험 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

이번 리뷰에서 Critical 등급 발견사항 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SIDE-EFFECT | 신규 downgrade 경고(`_block_integrity.contradiction_note`)가 `sys.stderr`에만 하드코딩 출력되는데, push 훅 자신이 문서화한 설계는 "ALLOW(exit 0) 시 모델은 stdout만 보고, stderr는 BLOCK(exit 2)일 때만 읽힌다"이다. 이 백스톱이 잡으려는 사례(현재 push와 무관한 과거/다른 세션의 하향)는 정확히 push가 ALLOW로 끝나는 경우이므로, 경고가 만들어진 이유가 되는 바로 그 상황에서 모델에 전달되지 않을 개연성이 크다. | `.claude/hooks/_lib/review_guard.py:728-733`(print), `:131`(import) | contradiction 정보를 반환값(예: warnings 리스트)으로 올려 각 호출자가 자신의 exit-code 계약에 맞는 스트림으로 내보내게 하고, ALLOW 경로에서도 노출되는지 확인하는 통합 테스트 추가 |
| 2 | SECURITY | `BLOCK:` 판정을 문서 전체에서 "첫 매치"로 추출하는 방식(`_BLOCK_LINE.search()`)이 이 저장소의 실제 SUMMARY.md 관행(직전 판정을 회고하는 서술)과 충돌한다. 실측: `BLOCK:` 토큰 2개 이상 파일 242개 중 값이 섞인 파일 34개(`--impl-done`만 11개), 이미 뒤집힌 실제 사례 1건 확인(`review/consistency/2026/07/05/19_27_28/SUMMARY.md` — 실제 판정 BLOCK:NO 인데 첫 매치는 BLOCK:YES). 이 함수가 이번 diff의 다운그레이드 백스톱과 Gate 2 판정에 쓰인다. | `.claude/_shared/block_integrity.py:42,66-69`, `.claude/hooks/_lib/review_guard.py:141,693-704` | 구조적으로 앵커된 추출(지정 헤딩 아래 첫 줄, 또는 "최종/확정" 표식이 붙은 마지막 occurrence)로 교체 |
| 3 | ARCHITECTURE / PERFORMANCE / REQUIREMENT | Critical-하향 감지가 순수 시간-계산 함수(`_newest_resolved_impl_done_mtime`) 내부에 부수효과로 얹혀, 게이트 판정에 실제 채택되는지와 무관하게 `review/consistency/**` 전체 이력을 매 push/Stop 훅마다 재스캔·재경고한다(SRP 위반, "cries wolf"). 실측: `--impl-done`+`BLOCK:NO` 세션 323개 중 8개가 매번 재경고(+0.39초). 또한 이미 읽은 SUMMARY.md를 재차 열고 체커 리포트 5개를 추가로 열어 세션당 I/O가 2회→최대 8회(4배)로 증폭됨. | `.claude/hooks/_lib/review_guard.py:707-740`(특히 `:716-733`), `.claude/_shared/block_integrity.py:79,83-84` | 모순 탐지를 시간-계산 루프에서 분리해 (a) 게이트가 실제 채택하는 `best` 세션에만 한정하거나 (b) 세션별 1회 캐싱으로 재경고 억제, 이미 읽은 텍스트 재사용으로 중복 I/O 제거 |
| 4 | ARCHITECTURE / DEPENDENCY / TESTING | `_shared/retry_state.py` 추출의 근거("두 orchestrator가 각자 사본을 들고 있었다")가 실제로는 `merge_coordinator_orchestrator.py`라는 세 번째 사본을 빠뜨렸다. 이 파일의 `_load_state`/`_save_state`/`_apply_status_update`는 로직이 완전히 동일하고 자기 주석("Mirror code_review_orchestrator")까지 갖고 있으며, 다른 두 orchestrator에 적용된 `reconcile_state_with_disk` 자기치유가 반영되지 않아 동일 클래스의 프로덕션 버그(두 산출물이 서로 모순)에 그대로 노출된다. | `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:82-140` | 이 orchestrator도 `_shared/retry_state.py`로 이관(`extra_fields` 콜백으로 `branches`/`base` 처리)하고 reconcile 자기치유 적용. 의도적 제외라면 사유를 docstring에 기록 |
| 5 | MAINTAINABILITY / ARCHITECTURE / REQUIREMENT / TESTING | `CHECKER_REPORTS`(신규, `block_integrity.py`)가 `ALL_CHECKERS`(기존, `consistency_orchestrator.py`)와 공유 소스도 동기화 테스트도 없이 독립 하드코딩되어 있다. 지금은 값이 일치하지만, 향후 체커가 추가/개명되면 갱신 누락 시 그 체커의 CRITICAL 하향을 이 백스톱이 조용히 놓친다 — 이 기능이 막으려는 바로 그 실패 양상의 재현. 기존 4-place drift guard(`test_agent_consistency.py`)의 감시 범위 밖. | `.claude/_shared/block_integrity.py:44-50` vs `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:50-56` | `CHECKER_REPORTS`를 `ALL_CHECKERS`에서 파생시키거나, 두 목록 일치를 단언하는 동기화 테스트 추가 |
| 6 | MAINTAINABILITY / TESTING | `BLOCK:` 판정 정규식·판정 로직(`summary_block_verdict` 신규 vs `_summary_block_is_no` 기존)이 두 파일에 바이트 단위로 동일하게 중복 구현되어 있다. 이번 PR이 바로 옆에서 "Change both" 패턴(`retry_state.py`)을 없애면서 같은 diff 안에서 동일 패턴을 하나 더 만들었고, 두 구현의 일치를 검증하는 agreement 테스트도 없다. | `.claude/_shared/block_integrity.py:42,66-69` vs `.claude/hooks/_lib/review_guard.py:141,693-704` | `_summary_block_is_no`가 `_block_integrity.summary_block_verdict(text) == "NO"`를 호출하도록 통합해 정본을 하나로 합칠 것 |
| 7 | ARCHITECTURE | `downgraded_criticals()`가 체커 리포트 경로를 `os.path.join(session_dir, name)`으로 직접 조합해, "리포트 위치는 `report_paths.py` 한 곳에서만 결정한다"는 기존 계약(2026-07-17 실제 사고 이후 도입)을 우회한다. 지금은 파일명이 항상 고정이라 결과가 같지만, `report_path()`가 존재하는 이유 자체가 "output_file이 항상 그 규칙을 따른다고 가정하지 말라"는 것이다. | `.claude/_shared/block_integrity.py:79,84` | 경로 계산을 `report_paths_lib.report_path()`/`has_report()`로 위임(시그니처에 `state` 인자 추가 필요) |
| 8 | SECURITY | 리뷰/체커 프롬프트에 원문 파일·diff를 감싸는 단일 ` ``` ` 펜스가 내용 자체에 포함된 백틱 3연속 시퀀스에 무방비하다(마크다운 펜스 breakout). `_neutralize_sentinel()`은 경계 sentinel만 무력화할 뿐 파일 본문의 bare 펜스는 처리하지 않는다. 실측: `spec/` 338개 파일, `plan/in-progress/` 39개 파일이 실제로 줄 시작 bare 펜스를 포함. code-review 쪽 diff/`full_content`는 `line_anchors`의 줄-번호 게이트로 우연히 보호되지만 `old_code` 필드는 동일 보호가 없다. | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:282,507`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:503` | 임베드 원문의 최장 백틱 연속보다 긴 펜스를 선택하거나 `line_anchors`류 줄-프리픽스 처리를 consistency 쪽·`old_code` 경로에도 동일 적용 |
| 9 | TESTING | 신규 백스톱이 명시하는 핵심 계약("모순을 발견해도 경고만 하고 세션을 skip/block하지 않는다")이 테스트에서 반환값이 아니라 stderr 문자열만으로 pin되어 있다. 향후 누군가 "모순이 있으면 세션을 신뢰하지 말자"며 `continue`를 추가해 이 계약을 깨도(fail-open 위반, 사실상 재도입되는 차단) 기존 테스트는 여전히 GREEN이다. | `.claude/tests/test_block_integrity.py:126,137-139`, `.claude/hooks/_lib/review_guard.py:707-741` | `_run_gate` 헬퍼가 stderr 문자열과 함께 반환값(`best > 0.0`, 즉 세션이 여전히 resolved로 집계됨)도 함께 단언하도록 보강 |
| 10 | CONCURRENCY | `_retry_state.json`의 read-modify-write(`load_state`→메모리 갱신→`save_state`)가 프로세스 간 잠금(`fcntl.flock`)도 원자적 교체(temp+`os.replace`)도 없이 이뤄진다. 여러 reviewer가 한 턴에 병렬 fan-out되는 fallback 경로(CLAUDE.md가 명시 허용)에서 동시 `--update` 호출 시 lost update 가능. `agents_success`/`pending`은 디스크 리포트로 자가치유되지만, `agents_fatal`·`rate_limit_episodes`·`agent_history`는 재도출 불가해 레이스로 유실되면 영구 실패 reviewer가 재시도 대상으로 되돌아가거나 감사 로그가 축소된다. | `.claude/_shared/retry_state.py:41-47,50-52,55-93,138-167` | 임계구역을 `fcntl.flock`으로 감싸거나 최소한 `save_state`를 temp+`os.replace` 원자적 쓰기로 전환, `load_state`도 손상 파일에 `(OSError, ValueError)`를 잡도록 통일 |
| 11 | SCOPE | 서로 무관한 두 작업(Critical 하향 백스톱 신설 + orchestrator 상태 bookkeeping 5종 DRY 리팩터링)이 한 브랜치에 묶여 있다. 전자는 `plan/in-progress/harness-review-gate-ci-backstop.md` 백로그 항목 2번과 정확히 대응하지만, 후자(294줄, 2파일)는 어떤 plan 문서에도 등재돼 있지 않다. 같은 문서의 "두 orchestrator 중복" 성격 항목 2건은 오히려 defer 처리돼 있어 선택 기준이 리뷰 범위 안에서 드러나지 않는다. | 커밋 `7b54b088a` 전체(`.claude/_shared/retry_state.py` 신설 + 두 orchestrator delegate 치환) | 리팩터링 자체 품질은 문제 없으므로 별도 PR로 분리하거나, 최소한 plan에 "왜 이번 세션에 함께 처리했는지" 한 줄 기록 |
| 12 | DOCUMENTATION / REQUIREMENT | `plan/in-progress/harness-review-gate-ci-backstop.md`의 "신규 후속(defer)" 2번 항목이 여전히 "하향 금지 정책에 기계적 backstop이 없다"고 서술하며 미착수 상태로 남아 있는데, 이번 diff가 정확히 그 항목(체커 리포트 `[CRITICAL]` 카운트 대조 + stderr 경고)을 구현했다. 자매 plan(`harness-consistency-summary-downgrade-rule.md`)은 관련 완료를 상단 배너에 기록했으나 이 항목은 갱신에서 빠졌다. | `plan/in-progress/harness-review-gate-ci-backstop.md:36-41` | 이 항목을 완료로 갱신하고 구현 커밋(`30cc0f738`)/파일 경로를 근거로 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | 리뷰 게이트의 커버리지 판정이 산출물(파일 존재·비어있지 않음·텍스트 패턴)만으로 이뤄져 reviewer Agent가 실제 실행됐다는 증거는 없음(기존 설계, `BYPASS_REVIEW_GUARD=1`과 같은 결의 문서화된 트레이드오프). | `.claude/hooks/_lib/review_guard.py:400,438` | 현행 유지 — 필요 시 실행 증적 추가만 검토 |
| 2 | SECURITY | `review_guard.py` 전반이 내부 오류(git 실패/JSON 파싱 실패 등) 시 "허용"으로 fallback하는 fail-open 설계(기존, 문서화된 의도: "a guard must never wedge the session"). | 모듈 docstring, `_run_git`(181-192) | 현행 유지 |
| 3 | SECURITY | `code_review_orchestrator.py`의 `--files`/디렉토리 CLI 경로가 저장소 루트로 제한되지 않아 이론상 임의 경로를 읽어 프롬프트에 임베드 가능(로컬 오퍼레이터는 이미 동급 권한 보유, 신규 권한상승 아님). | `:941,951,1227` | 심층방어로 저장소 루트 하위 제한 검증 추가 |
| 4 | PERFORMANCE | 위 Warning #3이 얹히는 기반 자체가 캐시 없는 전수 `os.walk` 스캔 구조(기존, 이번 diff가 만든 결함 아님). | `.claude/hooks/_lib/review_guard.py:383-391,672-680` | 이력이 계속 커지면 세션별 판정을 기록해두는 사이드카 인덱스 검토 |
| 5 | SIDE-EFFECT | retry_state 추출 커밋이 목적과 무관한 라우팅-신뢰 rationale 코멘트(~26줄, `_routing_distrust_reason` 배경 설명)를 collateral 삭제. 내용은 `test_router_decision_trust.py`/`router_safety.py`에 일부 남아 있어 완전 유실은 아님. | `code_review_orchestrator.py`(`_routing_distrust_reason` 직전, 구 377-401행) | 별도 커밋으로 원위치 복원하거나 커밋 메시지에 명시 |
| 6 | MAINTAINABILITY | 신규 `from _shared import block_integrity as _block_integrity`만 저장소 관례(`as _xxx_lib`)를 따르지 않음. | `review_guard.py:130-131` | `_block_integrity_lib`로 통일 |
| 7 | MAINTAINABILITY | 같은 PR에서 신설된 두 `_shared` 모듈 간 타입 힌트 스타일 불일치(`retry_state.py`는 verbatim 이동이라 힌트 없음, `block_integrity.py`는 완전 힌트). | `retry_state.py` 전역 vs `block_integrity.py` 전역 | 차기 수정 시 통일 |
| 8 | MAINTAINABILITY | `emit_summary_state`의 `extra_fields` 해석 한 줄(삼항+fallback+순회 압축)이 가독성 다소 희생. | `retry_state.py:130-131` | 중간 변수로 분리 |
| 9 | TESTING | `_shared/retry_state.py`를 직접 import해 단위 테스트하는 파일이 없고 전 커버리지가 subprocess 간접 테스트뿐(`report_paths.py`는 직접+agreement 두 층위 보유와 대비). `emit_summary_state`의 plain-mapping `extra_fields` 분기는 현재 어떤 호출자도 거치지 않는 죽은 분기. | `test_retry_state_shared.py` 전체 | `_harness.load_module_by_path`로 직접 로드하는 테스트 클래스 추가 |
| 10 | TESTING | SUMMARY.md는 있으나 `BLOCK:` 라인이 파싱 불가한 케이스(형식 어긴 자유서술)가 명시적으로 테스트되지 않음. | `test_block_integrity.py:58-67` | 해당 케이스 테스트 1개 추가 |
| 11 | TESTING | `retry_state.load_state`의 `sys.exit(1)`(파일 없음) 경로가 그 함수를 통해 도달하는 테스트가 없음(리팩터 이전부터의 기존 갭). | `retry_state.py:41-47` | 우선순위 낮음, 여유 있을 때 추가 |
| 12 | DOCUMENTATION | 리팩터 중 `_apply_status_update`가 갖고 있던 한 줄 독스트링이 AST-비교(독스트링 제외) 과정에서 조용히 소실. | `retry_state.py:138` | 원문 한 줄 복원 |
| 13 | DOCUMENTATION | `block_integrity.py` 모듈 독스트링이 하향이 "발생한" 세션(`review/consistency/2026/07/25/22_28_51`)과 "보고한" 코드리뷰 세션(`review/code/2026/07/25/22_58_00`)을 하나로 뭉뚱그려 인용. | `block_integrity.py:8-9` | 두 세션을 구분 표기 |
| 14 | DOCUMENTATION / MAINTAINABILITY | `review_guard.py` 모듈 독스트링이 이번에 추가된 stderr 경고 부수효과를 아직 반영하지 않음(인라인 주석에는 있으나 모듈 상단에는 없음). | `review_guard.py:46-49` vs `:707-712,722-733` | "Fresh impl-done" 절에 한 줄 추가 |
| 15 | DOCUMENTATION | `.claude/tests/README.md`의 `test_block_integrity.py` 행이 "배선(호출부) 자체를 검증"하는 `GateSurfacesTheContradictionTest`의 존재 이유를 요약에서 누락. | README.md 해당 행 | "and that review_guard actually calls it" 문구 추가 |
| 16 | DEPENDENCY | `block_integrity.py`의 `k.removesuffix('.md')`가 harness 전체에서 처음으로 Python 3.9+ 전용 stdlib API 사용, 최소 버전 암묵 상향(fail-open 경로라 크래시 위험은 낮음). | `block_integrity.py:95` | 최소 Python 버전 명문화 또는 버전-무관 표현으로 대체 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | `BLOCK:` 첫매치 추출 순서의존성(실제 뒤집힌 사례 확인), 마크다운 펜스 breakout 무방비 |
| performance | LOW | 하향 감지 로직이 SUMMARY 재읽기+체커 리포트 5종 재오픈으로 세션당 I/O 4배 증폭 |
| architecture | MEDIUM | `retry_state.py`가 3번째 소비자(merge-coordinator) 누락, 백스톱이 시간계산 함수에 SRP 위반으로 얹힘, 체커목록 3중 하드코딩 |
| requirement | LOW | 백스톱 경고가 게이트 판정과 무관하게 이력 전체를 무제한 재출력("cries wolf"), plan 문서 stale |
| scope | LOW | 무관한 리팩터링(retry_state 추출)이 백로그 근거 없이 동일 브랜치에 포함 |
| side_effect | MEDIUM | 신규 경고가 stderr 전용이라 ALLOW 경로에서 모델에 미노출 개연성, 무관 코멘트 collateral 삭제 |
| maintainability | LOW | `BLOCK:` 파싱/체커목록이 이중·삼중 구현(이 PR이 없애려던 패턴을 스스로 재현) |
| testing | MEDIUM | "경고만 하고 스킵 안 함" 핵심 계약이 반환값 기준 미검증, 체커목록/BLOCK 파서 동기화 테스트 없음 |
| documentation | LOW | 이미 구현된 backstop이 관련 plan 백로그 항목을 미갱신(stale) |
| dependency | LOW | `retry_state.py`의 3번째 소비자 누락(architecture와 교차 확인), `removesuffix` Python 3.9+ 첫 사용 |
| database | NONE | 해당 없음 — DB 연동 코드 없음 |
| concurrency | LOW | `_retry_state.json` read-modify-write 잠금 없음, lost update 가능 |
| api_contract | NONE | 해당 없음 — API 표면 없음(harness-only 변경) |
| user_guide_sync | NONE | 해당 없음 — doc-sync-matrix trigger 0/20 매칭 |

## 발견 없는 에이전트

- database — DB 연동 코드 없음(harness JSON/마크다운 파일 상태 관리만)
- api_contract — REST/GraphQL 등 API 표면 없음(harness-only 변경, `codebase/` 변경 0건)
- user_guide_sync — `doc-sync-matrix.json` 20개 trigger 행 전수 대조 결과 매칭 0건

## 권장 조치사항

1. downgrade 경고를 `sys.stderr` 직접 print 대신 반환값(예: warnings 리스트)으로 전달해, 각 호출자가 자신의 exit-code 계약에 맞는 스트림으로 노출하도록 배선 변경 — 현재 설계는 백스톱이 필요한 바로 그 상황(ALLOW 경로)에서 경고가 묻힐 수 있음 (WARNING #1).
2. `BLOCK:` 판정 추출을 구조적으로 앵커링(지정 헤딩 아래 첫 줄 또는 "최종/확정" 표식의 마지막 occurrence)해 회고성 서술로 인한 오추출을 방지 (WARNING #2).
3. 하향 감지를 순수 시간-계산 함수에서 분리하고, 게이트가 실제로 채택하는 세션에만 한정하거나 세션별 캐싱으로 "cries wolf" 재경고·I/O 증폭 제거 (WARNING #3).
4. `_shared/retry_state.py` 마이그레이션을 `merge_coordinator_orchestrator.py`에도 적용해 세 번째 사본과 자기치유 미적용 갭을 해소 (WARNING #4).
5. `CHECKER_REPORTS`를 `ALL_CHECKERS`에서 파생시키거나 두 목록 동기화 테스트 추가 (WARNING #5).
6. `BLOCK:` 파싱 이중 구현을 `block_integrity.summary_block_verdict()` 재사용으로 통합 (WARNING #6).
7. `downgraded_criticals()`의 리포트 경로 조합을 `report_paths.py`로 위임해 공유 계약 우회를 해소 (WARNING #7).
8. 마크다운 펜스 breakout 방지(가변 길이 펜스 선택 또는 줄-프리픽스 게이팅을 consistency 쪽·`old_code` 경로에도 적용) (WARNING #8).
9. 백스톱의 "경고만, 스킵 안 함" 계약을 테스트에서 반환값 기준으로도 고정 (WARNING #9).
10. `_retry_state.json` read-modify-write 구간에 `fcntl.flock` 또는 원자적 쓰기(temp+`os.replace`) 적용 (WARNING #10).
11. retry_state 리팩터링의 스코프 근거를 plan에 기록하거나 별도 PR로 분리 (WARNING #11).
12. `plan/in-progress/harness-review-gate-ci-backstop.md`의 backstop 항목을 완료로 갱신 (WARNING #12).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재), 전체 14개 reviewer 실행. 라우터가 개입하지 않았으므로 이번 세션에서 "router 제외"된 reviewer는 없음(skipped 목록 없음).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음).
- **실행**: 위 14명 전원 (`security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`)
- **제외**: 없음