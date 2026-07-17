# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 신설 `_forced_coverage_missing` 게이트 자체(리포트 파일 존재만 확인)와 경로 오탐 fix 는 4개 리뷰어(requirement/scope/side_effect/testing)가 독립적으로 재현 확인할 만큼 견고하나, **`consistency-checker/SKILL.md`(+공유 문서 `subagent-call-contract.md`)가 실제로는 구현되지 않은 "자동 self-heal" 을 서술**하는 문서-구현 불일치가 4개 리뷰어에서 중복·재현 확인됐고, 신설 `_reconcile_state_with_disk` 가 상시 읽기 경로(`--resume`/`--summary-state`)에 연결되며 `agents_fatal` 이중 멤버십 버그도 재현됐다. 다만 실제 push/stop 차단 판정(핵심 보안 속성)은 `SUMMARY.md` 의 `BLOCK:` 줄에만 의존해 이 문제들로 무력화되지 않는다. **강제(forced) 리뷰어 7/7 전원 결과 확보 완료 — 이번 세션 자체는 커버리지 게이트 관점에서 gap 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서-구현 불일치 | `consistency-checker/SKILL.md`(+`subagent-call-contract.md` §7 공유 문구)가 "`--summary-state`/`--resume` 가 읽을 때 디스크로 자가 reconcile" 한다고 서술하지만, 이번 diff 의 self-heal 로직(`_reconcile_state_with_disk`)은 `code_review_orchestrator.py` 에만 구현됐고 `consistency_orchestrator.py` 는 전혀 손대지 않아 여전히 stale 상태를 보고함. **4개 리뷰어(requirement/scope/side_effect/testing) 가 각자 독립적으로 직접 재현**: `--summary-state` 호출 시 산출물이 디스크에 있어도 `pending=2 success=0` 을 보고. 이 PR 이 근절하려는 "산문 의무가 압력 속에 무너진다" 패턴을 자매 서브시스템에 그대로 재도입하는 셈이며, 대응 회귀 테스트도 0건 | `.claude/skills/consistency-checker/SKILL.md:94`, `.claude/docs/subagent-call-contract.md:120-121`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:95-102,599-611`(미변경) | (a) `consistency_orchestrator.py` 에도 `_reconcile_state_with_disk`/`_report_paths` 상당 로직 이식(가급적 공유 헬퍼로 추출), 또는 (b) 두 문서의 서술을 code-review-agents 전용으로 명확히 좁히고 consistency-checker 절은 `--sync-from-disk` 류 수동 동기화 필요로 되돌릴 것. 어느 쪽이든 `consistency_orchestrator.py` 상태-머신 회귀 테스트 최소 1건 추가 |
| 2 | 상태 버그 | `_reconcile_state_with_disk` 가 `agents_fatal` 이었던 리뷰어를 리포트 미존재 시 `agents_pending` 에도 동시 편입시켜 이중 멤버십 발생(`agents_pending=["security"]` 이면서 `agents_fatal=["security"]` 도 잔류). 기존 `_sync_from_disk` 잠재 결함이나, 이번 diff 로 `--resume`/`--summary-state` 라는 **상시 읽기 경로**에 연결되며 노출 빈도 급증. 신규 테스트는 `rate_limit_episodes` 보존만 검증하고 `agents_fatal` 케이스는 미검증 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:158-186`(`_reconcile_state_with_disk`, `missing` 계산이 `agents_fatal` 을 제외 목록에 넣지 않음) | fatal 을 reconcile 후에도 유지할지 pending 재시도로 되돌릴지 정책 결정 후 회귀 테스트 추가 |
| 3 | 상태 버그 | 같은 함수의 `changed` 판정 비교 튜플(`agents_success`, `agents_pending`)이 자신이 갱신하는 세 번째 필드 `agents_fatal` 을 누락 — 특정 조합(success/pending 은 그대로, fatal 목록만 변경)에서 메모리상 `state` 는 올바르게 고쳐지지만 `changed=False` 판정으로 `_save_state` 가 스킵되어 디스크에 반영 안 될 수 있음 | `code_review_orchestrator.py:158-186` | 비교 튜플에 `agents_fatal` 포함, 또는 저장 비용이 낮으므로 조건부 스킵 자체를 제거 |
| 4 | 부작용 | `--summary-state`/`--resume` 가 원래 "읽기 전용 조회"(순수 상태 확인)였는데, `_reconcile_state_with_disk` 연결로 조건부 `_retry_state.json` 재작성 부작용을 새로 갖게 됨 — 이미 git 커밋된 과거 세션을 감사/디버깅 목적으로 조회만 해도 워킹트리가 dirty 해질 수 있음. push/stop 훅은 이 CLI 를 호출하지 않아 자동 게이트 경로에는 전파되지 않음(사람이 직접 CLI 호출하는 경로로 국한) | `code_review_orchestrator.py:158-199`(`_reconcile_state_with_disk`/`_emit_summary_state`), `:1017-1023`(`--resume`) | 실제 변경 시 stderr 가시적 로그 남기기, 또는 조회 전용 `--no-write`/dry-run 옵션 추가 검토 |
| 5 | 유지보수성 | report-path 해석 로직("세션 디렉토리 + `output_file` basename 재anchor")이 `review_guard.py`(`_forced_coverage_missing`)와 `code_review_orchestrator.py`(`_report_paths`)에 상호 참조 없이 독립적으로 두 벌 구현됨. 이 정책은 push/stop 훅과 `--verify-coverage`/`--sync-from-disk` CLI 라는 **두 강제 지점**이 공유해야 하는 핵심 로직이라, 향후 파일명 규칙이 바뀌면 두 판정이 조용히 어긋날 위험 | `.claude/hooks/_lib/review_guard.py:355-390`, `code_review_orchestrator.py:213-232` | 최소한 양쪽 docstring 에 "함께 수정" 상호 참조 주석 추가, 가능하면 알고리즘 형태(dict 기반)를 통일. 완전한 공유는 패키지 이름 충돌 제약상 별도 아키텍처 작업 필요 |
| 6 | 견고성/보안 | 강제 커버리지 게이트가 `_retry_state.json` 부재(`OSError`)·손상(`ValueError`) 시 **fail-open** — manifest 를 삭제하거나 애초에 만들지 않으면 `agents_forced` 화이트리스트 검증 자체가 통째로 스킵되고 기존의 더 약한 기준(RESOLUTION.md 존재 또는 위험도 NONE/LOW)만으로 "해소" 판정됨. 이 기능의 도입 계기(security 리뷰어가 open-redirect 방어 diff 에서 스킵된 사고)와 동일 유형의 회피 경로가 여전히 열려 있음 | `.claude/hooks/_lib/review_guard.py` `_forced_coverage_missing()` (약 648-656행) | 로컬 개발 하네스 위협모델상 완전 fail-closed 는 과할 수 있으나, 최소 fail-open 발생 시 로그를 남기거나 push 가드처럼 되돌리기 어려운 지점에서는 범위 축소 검토. 현재는 테스트(`test_a_corrupt_manifest_fails_open` 등)로 의도가 명시된 트레이드오프 |
| 7 | 견고성/보안 | 커버리지 판정이 리포트 파일의 "존재" 만 `os.path.isfile()` 로 확인하고 "내용" 은 전혀 검증하지 않음 — 빈 placeholder 파일(`touch security.md`)로도 게이트를 통과시킬 수 있어 "실제로 리뷰가 수행됐는가" 를 보장하지 못함 | `review_guard.py` `_forced_coverage_missing()`(약 671행), `code_review_orchestrator.py` 동일 패턴(`_report_paths`/`_reconcile_state_with_disk`/`_verify_coverage`) | `_summary_is_resolved` 가 이미 쓰는 최소 구조 검증(비어있지 않음, 특정 섹션 헤더 포함 등)을 강제 리포트 파일에도 적용 검토. git 히스토리 사후감사로 일부 완화됨 |
| 8 | 문서 정확성 | `review_guard.py` 모듈 최상단 docstring 의 "Fresh, resolved review" 정의가 이번 diff 로 신설된 forced-coverage 조건(3번째 필수 조건)을 반영하지 못해 낡음 — 파일 헤더만 보는 유지보수자가 "위험도만 낮으면 forced coverage 없이도 통과" 로 오해할 수 있음 | `.claude/hooks/_lib/review_guard.py:38-42`(diff 범위 밖, 갱신 누락) | "Fresh, resolved review =" 블록에 "coverage: every `agents_forced` reviewer left a report on disk" 조건 추가 |
| 9 | 문서 정확성 | `_summary_is_resolved` 갱신 docstring 의 불리언 로직이 평면 글머리 목록(`- X, AND - Y, OR - Z`)으로 그루핑 없이 서술돼, 표준 연산자 우선순위(AND 가 OR 보다 먼저 묶임)로 읽으면 실제 코드(`X AND (Y OR Z)`)와 반대인 `(X AND Y) OR Z` 로 오독 가능 — 정확히 이 PR 이 막으려는 결함("위험도만 낮으면 커버리지 무시")과 같은 모양의 오독이라 위험도가 낮지 않음 | `.claude/hooks/_lib/review_guard.py:405-417`(`_summary_is_resolved` docstring) | 그루핑을 명시적 번호목록/들여쓰기로 표기 (예: "True when BOTH: 1. coverage, AND 2. EITHER RESOLUTION.md OR risk 낮음+무행") |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 견고성 | `_retry_state.json` 필드의 예상 밖 타입(예: `agents_forced`/`subagent_invocations` 가 리스트가 아닌 경우)에 대한 방어적 검증 부재 — malformed-but-valid JSON 이 주어지면 문자열 순회 등 예기치 않은 동작 가능. push/stop 훅의 상위 `try/except Exception` 이 실제 차단으로 이어지는 것은 막아줌 | `review_guard.py` `_forced_coverage_missing()`, `code_review_orchestrator.py` 상태 로더 | `isinstance(forced, list)` 등 최소 타입 체크 추가 권장(필수는 아님) |
| 2 | 견고성 (이론적) | basename 기반 경로 재해석 시, 서로 다른 두 forced 에이전트의 `output_file` basename 이 우연히 같으면 한쪽 산출물 존재가 다른 쪽 커버리지까지 충족시킬 수 있음. 현재 명명 규칙(`<agent-name>.md`) 하에서는 실질 위험 낮음 | `code_review_orchestrator.py` `_report_paths()` | 세션 내 basename 중복 감지 로그 고려(낮은 우선순위) |
| 3 | 설계/blast radius | `_summary_is_resolved` 강화가 저장소 전역 판정에 소급 적용되어 기존 "해소됨" 세션 570→464(약 106건 감소). plan 문서에 "사용자 결정: 전면 적용" 으로 명시돼 있고 가드는 "가장 최신 세션" 만 보므로 소급 파괴는 없음이 검증됨 | `review_guard.py` `_summary_is_resolved()` | 조치 불필요(설계 의도). 필요시 롤아웃 공지만 고려 |
| 4 | 부작용 확대 | `_load_state`/`_save_state` 의 잠금 없는 read-modify-write 를 수행하는 커맨드 표면이 이번 PR 로 `--summary-state`/`--resume` 까지 확대됨 — 동일 세션에 대한 동시 호출 시 나중 쓰기가 이전 갱신을 덮어쓸 이론적 가능성 | `code_review_orchestrator.py:144-186` | 조치 불필요, 참고 기록 (실무상 동시 호출 희소) |
| 5 | 문서 중복 | "상태 기록은 이제 자동" 서술이 `subagent-call-contract.md`, `code-review-agents/SKILL.md`, `consistency-checker/SKILL.md` 3곳에 각각 다른 문구로 중복 서술 — 메커니즘이 또 바뀌면 세 곳을 손으로 맞춰야 하는 drift 위험 | 위 3개 문서 | 향후 변경 시 hub 문서(`subagent-call-contract.md`)를 canonical 로 하고 두 SKILL.md 는 인용만 하도록 정리 |
| 6 | 복잡도 추세 | `_summary_is_resolved` 가 이번 diff 로 4번째 책임(coverage 확인)을 흡수해 순환복잡도 약 9~10 수준으로 증가 추세 | `review_guard.py:405-465` | 지금 조치 불필요. 다음 조건 추가 시 "커버리지 판정"과 "내용 판정" 헬퍼 분리 고려 |
| 7 | 테스트 갭 | cross-session "가장 최신 resolved 리뷰 선택"(`_newest_resolved_review_mtime`) 로직이 실 파일 기반 통합 테스트 없이 전부 mock 처리됨 — plan 문서가 근거로 든 실사례(01_27_10→08_17_35)를 검증하는 자동화 테스트 없음(이번 diff 이전부터의 기존 공백) | `.claude/tests/test_review_guard.py`(`_newest_resolved_review_mtime` 전부 mock) | 미충족·충족 세션 2개로 구성한 tempdir 통합 테스트 1건 추가 권장 |
| 8 | 테스트 갭 | `_forced_coverage_missing` 의 fallback 분기(`agents_forced` 이름이 `subagent_invocations` 에 없을 때 `f"{name}.md"` 기본값)가 스위트 전체에서 한 번도 실행되지 않음 | `review_guard.py:662-670` | 경량 테스트 1건 추가(우선순위 낮음) |
| 9 | 테스트 위생 | 신규 `ForcedCoverageTest._session()` 이 `tempfile.mkdtemp()` 를 쓰고 cleanup 이 없어 OS temp 에 세션 디렉토리 누적(정확성 문제는 아님, 기존 파일의 동일 패턴 답습) | `.claude/tests/test_review_guard.py:120-141` | 다음에 만질 때 `tempfile.TemporaryDirectory()` 또는 `addCleanup` 으로 통일 |
| 10 | 테스트 갭 | reconcile 후 라우터가 스킵한 에이전트가 산출물을 갖게 되는 경우 `agents_success`/`agents_skipped` 중복 가능성이 미검증(기존 `_sync_from_disk` 부터의 동작, 회귀 아님) | `_reconcile_state_with_disk` | 낮은 우선순위, 참고만 |
| 11 | 문서 정확성 | `_forced_coverage_missing` 의 "consistency dir that never had one" 부연 예시가 실제 호출 경로(`review/code/**` 전용)와 어긋나 도달 불가능한 시나리오를 가리킴 | `review_guard.py` `_forced_coverage_missing()` 주석 | "hand-written/pre-manifest session" 등으로 단순화 |
| 12 | 문서 공백 | README.md("세부 운영 가이드")가 이번 diff 의 핵심 동작 변화(forced 커버리지 push/stop 차단, `--verify-coverage`/`--sync-from-disk`/self-heal)를 전혀 언급하지 않음(grep 0건) — SKILL.md/`subagent-call-contract.md` 는 정확히 반영됐으므로 기능적 공백은 아니나 안내 경로 어긋남 | `.claude/skills/code-review-agents/README.md` §Router safety policy | Router safety 섹션 말미에 push/stop 차단 + self-healing 한 줄씩 추가 |
| 13 | 문서 뉘앙스 | `--sync-from-disk` CLI 의 `--help` 문구가 self-heal 도입 후에도 "필수 절차" 뉘앙스 그대로(함수 docstring 은 "Mostly redundant now" 로 갱신됨과 대조) | `code_review_orchestrator.py:972-976` | help 문구에 self-heal 사실 한 구절 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 강제 커버리지 게이트가 manifest 부재/손상 시 fail-open + 파일 존재만 확인(내용 미검증) — 인지·문서화된 트레이드오프. Path traversal 방어(`basename` 재anchor)는 양호 확인 |
| requirement | MEDIUM | `consistency-checker` SKILL.md 가 미구현 자동 self-heal 을 주장(직접 재현); 핵심 게이트(Gate A) 자체는 plan 과 line-level 일치, 하네스 232 테스트 통과 재확인 |
| scope | MEDIUM | 동일 문서-구현 괴리 — code-review-agents 로 한정된 실제 구현 범위를 문서가 consistency-checker 까지 확장 약속; 8개 변경 파일은 plan 범위와 정확히 일치, 무관한 변경 없음 |
| side_effect | MEDIUM | 동일 문서-구현 괴리 + `--summary-state`/`--resume` 의 신규 쓰기 부작용; 핵심 로직은 읽기 전용 훅 경로에 부작용 미전파 |
| maintainability | LOW | report-path 로직 두 파일 독립 중복 + `_reconcile_state_with_disk` 의 `changed` 판정이 `agents_fatal` 누락; 신규 코드 가독성·문서화 관례는 우수 |
| testing | MEDIUM | 동일 문서 불일치 실측 재현(대응 테스트 0건) + `agents_fatal` 이중 멤버십 버그 재현; 핵심 버그(경로 오탐/꾸민 성공/forced 미충족) 재현 테스트는 촘촘하고 정확 |
| documentation | MEDIUM | 모듈 docstring stale + `_summary_is_resolved` 불리언 로직 오독 위험(WARNING 2건); 그 외 함수 단위 docstring·SKILL.md 서술은 전반적으로 정확 |

## 발견 없는 에이전트

없음 — 7개 에이전트 전원이 WARNING 이상의 발견사항을 최소 1건 이상 보고함. 단, Critical 은 전 에이전트에서 0건.

## 권장 조치사항

1. **(최우선, 4개 리뷰어 중복 확인)** `consistency-checker/SKILL.md` 및 `subagent-call-contract.md` §7 의 "자동 self-heal" 서술을 실제 구현과 일치시킬 것 — `consistency_orchestrator.py` 에 `_reconcile_state_with_disk`/`_report_paths` 상당 로직을 이식(가급적 공유 헬퍼로 추출)하거나, 당장 어렵다면 두 문서 서술을 code-review-agents 전용으로 명확히 좁히고 consistency-checker 절은 수동 동기화 필요로 되돌린다. 어느 쪽이든 `consistency_orchestrator.py` 상태-머신 회귀 테스트를 최소 1건 추가한다.
2. `_reconcile_state_with_disk` 의 `agents_fatal` 이중 멤버십 버그(fatal 유지 vs pending 재시도 정책 미결정)를 수정하고 회귀 테스트를 추가한다. 같은 함수의 `changed` 비교 튜플에 `agents_fatal` 을 포함시키거나 조건부 저장 스킵을 제거한다.
3. `--summary-state`/`--resume` 의 신규 디스크 쓰기 부작용에 가시적 로그를 남기거나, 커밋된 세션을 순수 조회할 때를 위한 dry-run 옵션을 검토한다.
4. `review_guard.py` 모듈 docstring("Fresh, resolved review" 정의)과 `_summary_is_resolved` 함수 docstring(불리언 그루핑)을 실제 로직과 일치하도록 정정한다 — 특히 후자는 이 PR 이 막으려는 결함과 동형의 오독 위험이 있어 우선순위가 낮지 않다.
5. `review_guard.py`/`code_review_orchestrator.py` 에 독립 중복 구현된 report-path 해석 로직에 최소한 상호 참조 주석을 추가한다(장기적으로 공유 헬퍼 추출 고려).
6. (낮은 우선순위) 커버리지 판정에 최소 콘텐츠 검증 추가, manifest fail-open 시 로그 남기기, README.md·`--sync-from-disk` help 문구 갱신, cross-session 통합 테스트 실 파일 기반 1건 추가, 필드 타입 방어 체크 보강.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 7명 (아래 표)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 — 강제 전원과 실행 전원이 동일, 즉 이번 세션의 실행 리뷰어 전원이 router_safety 에 의해 강제됨). **강제 7/7 전원 결과(success) 확보 완료 — 커버리지 gap 없음.**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | diff 가 `.claude/hooks`·`.claude/skills/**/scripts`(내부 거버넌스 훅/CLI) 및 문서·plan 변경으로, 런타임 성능(지연시간/처리량) 영향 경로 해당 없음(라우터 판단, 세부 사유 미첨부) |
  | architecture | 신규 아키텍처 계층·모듈 경계 변경 없이 기존 훅/오케스트레이터 내부에 함수 추가 수준(라우터 판단, 세부 사유 미첨부) |
  | dependency | 신규 외부 패키지·의존성 변경 없음(`json` 등 표준 라이브러리만 사용) (라우터 판단, 세부 사유 미첨부) |
  | database | DB 스키마/쿼리 변경 없음(`codebase/` 미변경) (라우터 판단, 세부 사유 미첨부) |
  | concurrency | 신규 동시성 프리미티브(락/스레드/비동기) 변경 없음(라우터 판단, 세부 사유 미첨부 — 단 side_effect 리뷰어가 락 없는 RMW 확대를 INFO 로 별도 지적) |
  | api_contract | 외부 REST/공개 API 계약 변경 없음(`.claude/` 내부 CLI 인자 표면은 argparse 구조 자체는 불변) (라우터 판단, 세부 사유 미첨부) |
  | user_guide_sync | 사용자 대상(`codebase/`) 기능·UI 변경이 아닌 내부 리뷰 하네스 거버넌스 변경 (라우터 판단, 세부 사유 미첨부) |

  (참고: 위 "이유" 열은 본 요약 작성 시 워크플로 매니페스트에 개별 사유가 첨부되지 않아, 7개 reviewer 실행 보고서가 공통으로 서술한 "이번 diff 는 `.claude/**`+`plan/**` 문서·스크립트 한정, `codebase/` 미변경" 근거로 일괄 추정 기재한 것이며 router 원문 사유는 아님.)