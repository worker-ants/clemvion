# Code Review 통합 보고서

대상: `harness-block-backstop` 브랜치, `origin/main` 대비 14개 파일 변경(`.claude/_shared/block_integrity.py`, `.claude/_shared/retry_state.py` 신설 + 세 orchestrator/두 hook/agent 정의/테스트/plan 문서). 핵심 변경은 (1) Critical 하향 금지 정책의 기계적 backstop 신설, (2) 세 orchestrator 에 중복돼 있던 `_retry_state.json` bookkeeping 5종을 `_shared/retry_state.py` 로 추출하는 리팩터.

## 전체 위험도

**MEDIUM** — ⚠ **forced whitelist 포함 8/14 reviewer 가 결과를 전혀 내지 못했다**(no_status, 파일도 인라인 전문도 없음): `security`, `requirement`, `scope`, `side_effect`, `testing`, `documentation`(이상 6명은 router_safety 강제 포함 목록 소속), `performance`, `architecture`(이 2명은 forced 아님). 확보된 6개 리포트(maintainability/dependency/database/concurrency/api_contract/user_guide_sync)만 놓고 보면 Critical 0건·WARNING 7건으로 실측 위험도는 LOW 수준이지만, **특히 security 리뷰가 전혀 수행되지 않은 상태에서 이를 "안전"으로 확정하는 것은 forced 화이트리스트가 지키려는 바로 그 보장을 무너뜨리는 거짓 음성**이다. 따라서 코드 자체의 결함 심각도가 아니라 커버리지 결손을 반영해 보수적으로 MEDIUM 으로 판정한다. 재실행(특히 security)이 상단 최우선 조치다.

## Critical 발견사항

없음 — 확보된 6개 리포트 기준 Critical 발견사항 0건. (단, security 등 8개 리포트가 확보되지 않아 이 결과가 전체를 대표하지 못함 — 위 전체 위험도 참고)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | 동일 근거(사전 계산된 dict 대신 callable 로 받는 이유)를 설명하는 중복 주석 블록이 같은 자리에 두 번 연달아 존재 | `.claude/_shared/retry_state.py:124-133` | 130-133번째 줄 삭제, "Measured: …" 문장이 있는 124-129번째 줄만 남길 것 |
| 2 | Maintainability | 리팩터 부산물로 남은 미사용 import(`_report_paths_lib`) — 로직이 `_shared/retry_state.py` 로 이관되며 죽은 코드가 됨 | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:44` | 44번째 줄 import 제거 |
| 3 | Maintainability | 상태 bookkeeping 삭제와 같은 diff hunk 에서, 이번 PR 목적과 무관한 근거 주석(2026-07-23 세션에 router 가 강제 reviewer 7명 포함 전원 `selected=false` 를 낸 실제 사건 + "0/1명 선택 시 전체 fallback" 규칙이 #244 에서 의도적으로 폐기됐다는 기록)이 조용히 함께 삭제됨. 커밋 메시지에 언급 없어 의도적 정리인지 우발적 삭제인지 diff 만으로 판별 불가 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:277`(삭제된 줄 — `git show 7b54b088a` 로 확인. `.claude/tests/README.md` 의 `test_router_decision_trust.py` 행에 동일 근거 사본이 남아있어 정보 자체는 저장소에서 소실되지 않음) | 의도적 삭제였다면 커밋 메시지·`_routing_distrust_reason()` docstring 에 이관 위치(README) 명시. 우발적이었다면 원복 검토 |
| 4 | Maintainability | 공유 `Outcome` 클래스가 새 `notes` 필드를 `__init__` 에 정식 선언하지 않은 채 `getattr`/동적 부착(`outcome.notes = []`)으로만 존재. 로컬 fallback `_Outcome` 클래스에는 `self.notes` 가 정식 선언돼 있어, 정상 경로와 fallback 경로의 "공식 필드 목록"이 서로 다름 | `.claude/hooks/_lib/failopen_state.py:36-49`(`class Outcome`), 사용부 `.claude/hooks/guard_review_before_push.py:850-856` | `Outcome.__init__` 에 `self.notes: list[str] = []` 정식 추가 + docstring 필드 나열 갱신 |
| 5 | Dependency | 체커 5종 canonical 목록이 `_shared/block_integrity.ALL_CHECKERS` 와 기존 SSOT `role_instructions.CHECKER_INSTRUCTIONS` 두 곳에 독립적으로(손으로) 유지되며, 둘을 묶어 검증하는 테스트가 없음 — 현재는 내용·순서가 일치하지만 향후 6번째 체커 추가/개명 시 한쪽만 갱신해도 기존 테스트 전부 통과. 이 PR 이 다른 축("체커 리포트 판독")에서 막으려는 것과 같은 종류의 조용한 drift 표면을 "체커 등록" 축에 새로 열어둔 셈 | `.claude/_shared/block_integrity.py:72-78`(`ALL_CHECKERS`), `.claude/skills/code-review-agents/lib/role_instructions.py:215`(`CHECKER_INSTRUCTIONS` 키) | `test_block_integrity.py`(또는 `test_agent_consistency.py`)에 `set(BI.ALL_CHECKERS) == set(role_instructions.CHECKER_INSTRUCTIONS)` 동치성 테스트 1건 추가(import 방향은 바꾸지 않음) |
| 6 | Concurrency | `_retry_state.json` 에 대한 락 없는 read-modify-write — 병렬 `--update` 호출(문서화된 sub-agent fan-out 경로) 시 lost update 발생 가능. 게이트가 참조하는 `agents_success`/`agents_pending`/`agents_fatal` 버킷은 다음 읽기 시 디스크 리포트 존재 여부로 재계산돼 자가 치유되지만, `agent_history`(감사 추적)와 `rate_limit_episodes`/`last_reset_hint_sec`(`/loop` backoff 스케줄링 입력)는 자가 치유 경로가 없어 경쟁 시 조용히 영구 유실 가능 | `.claude/_shared/retry_state.py:141-171`(`apply_status_update`), `:55-93`(`reconcile_state_with_disk`), `:41-52`(`load_state`/`save_state`) | read-modify-write 구간에 `fcntl.flock` advisory lock 추가, 또는 최소한 `failopen_state.report` 처럼 "Known residual (accepted)" 로 명시 문서화 |
| 7 | Concurrency | `save_state()` 가 임시파일+`os.replace` 없이 대상 파일을 즉시 truncate 후 `json.dump` — 동시 reader 가 쓰기 도중 열면 잘린/빈 JSON 을 볼 수 있음. `load_state()` 는 "파일 없음"은 `sys.exit(1)`+메시지로 우아하게 처리하지만 바로 다음 줄 `json.load(f)` 는 `try/except` 로 감싸지 않아 `JSONDecodeError` traceback 과 함께 그대로 크래시(비대칭 처리) | `.claude/_shared/retry_state.py:41-47`(`load_state`), `:50-52`(`save_state`) | 같은 디렉터리에 임시파일(`f"{state_file}.tmp.{os.getpid()}"`)로 먼저 쓰고 `os.replace()` 로 원자적 치환 — 락 불필요, torn-read 크래시를 구조적으로 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `_evaluate_over_targets` docstring 이 "두 불변식(bridges two invariants)"이라 서술하나, 이번 diff 로 세 번째 책임(여러 target 의 `result.notes` 를 중복 제거하며 누적)이 추가돼 개요와 실제 책임 수가 어긋남 | `.claude/hooks/guard_review_before_push.py:809-827` | docstring 도입부를 "세 가지"로 갱신 |
| 2 | Maintainability | `evaluate_review()` 에서 수집된 `notes` 가 Gate 2 의 두 차단(blocked) 경로에는 전달되지 않고 최종 ALLOW 반환에만 붙음. 한 경로(`best_dir` 공백)는 무해하나 다른 경로(stale 세션 재차단)는 `notes` 가 실제로 채워져 있을 수 있는데도 버려짐 | `.claude/hooks/_lib/review_guard.py:964-998` | 의도적이라면 한 줄 코멘트 추가해 이 모듈의 다른 판단들과 설명 밀도를 맞출 것 |
| 3 | Maintainability | 스트림 선택(`stderr`/`stdout`) 로직을 두 함수가 각자 계산 — 서로의 docstring 에서 "같은 규칙"이라 인용하지만 코드로는 공유되지 않는 사소한 중복 | `.claude/hooks/guard_review_before_push.py:745`, `:768` | 우선순위 낮음 — 필요 시 `_stream_for_exit_code(exit_code)` 헬퍼로 추출 |
| 4 | Maintainability | "AST 비교로 4/5 함수가 동일했고 `_emit_summary_state` 만 달랐다"는 동일 측정 근거가 3개 파일에 문구만 바꿔 반복 서술됨(중복 제거가 목표인 PR 치고 근거 설명 자체는 세 벌 복제) | `code_review_orchestrator.py:184-189` 부근, `consistency_orchestrator.py:82-87` 부근, `.claude/_shared/retry_state.py:1-29`(모듈 docstring) | 낮은 우선순위 — 각 orchestrator 쪽은 한 줄 요약 + `_shared/retry_state.py` 참고로 축약 검토 |
| 5 | Maintainability | `contradiction_note()` 에서 `.md` 접미사 길이(3)를 `k[:-3]` 로 하드코딩(바로 위 주석이 `removesuffix` 미사용 이유는 충분히 설명) | `.claude/_shared/block_integrity.py:138` | `k[:-len(".md")]` 로 치환(선택 사항) |
| 6 | Dependency / Concurrency | `merge_coordinator_orchestrator.py` 는 `_shared/retry_state.py` 의 5개 함수 중 3개(`_load_state`/`_save_state`/`_apply_status_update`)만 위임하고 `reconcile_state_with_disk`(디스크 기반 자가 치유)는 없음 — 위 WARNING #6 의 lost-update 경쟁에 세 orchestrator 중 상대적으로 가장 취약. `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 #9 항목으로 이미 별도 PR 분리가 명시적으로 결정돼 있어 이번 PR 범위의 신규 결함으로는 집계하지 않음 | `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`, `plan/in-progress/harness-review-gate-ci-backstop.md`(후속 #9) | 추가 조치 불요(추적 중) — 후속 PR 에서 완전 통일 시 WARNING #6/#7 수정과 함께 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | 결과 없음(재시도 필요) | **forced** — no_status, 파일/인라인 모두 없음. 보안 관점 검토 전혀 미수행 |
| performance | 결과 없음(재시도 필요) | no_status, 파일/인라인 모두 없음 |
| architecture | 결과 없음(재시도 필요) | no_status, 파일/인라인 모두 없음 |
| requirement | 결과 없음(재시도 필요) | **forced** — no_status, 파일/인라인 모두 없음. spec 정합성 검토 전혀 미수행 |
| scope | 결과 없음(재시도 필요) | **forced** — no_status, 파일/인라인 모두 없음 |
| side_effect | 결과 없음(재시도 필요) | **forced** — no_status, 파일/인라인 모두 없음 |
| maintainability | LOW | forced, 결과 확보. WARNING 4건(중복 주석·미사용 import·근거주석 삭제·Outcome.notes 미선언) + INFO 5건 |
| testing | 결과 없음(재시도 필요) | **forced** — no_status, 파일/인라인 모두 없음. 테스트 커버리지 검토 전혀 미수행 |
| documentation | 결과 없음(재시도 필요) | **forced** — no_status, 파일/인라인 모두 없음 |
| dependency | LOW | 신규 외부 의존성 0건. WARNING 1건(체커 canonical 목록 이중관리, 동치성 테스트 부재) + INFO 1건 |
| database | NONE | 발견 없음 — DB 관련 코드 변경 전무(harness 상태는 파일시스템 JSON) |
| concurrency | LOW | WARNING 2건(`_retry_state.json` 락 없는 RMW로 lost update, `save_state` 비원자적 쓰기로 torn-read 크래시). 데드락·스레딩/asyncio 사용은 0건으로 확인 |
| api_contract | NONE | 발견 없음 — 제품 REST API 코드 변경 전무, harness 내부 CLI/훅 계약만 존재 |
| user_guide_sync | NONE | 발견 없음 — `codebase/**`·`spec/**` 변경 0건, doc-sync-matrix 21행 중 매칭 0건 |

## 발견 없는 에이전트

- **database** — DB 관련 코드(SQL/ORM/마이그레이션/커넥션 풀) 변경 전무.
- **api_contract** — 제품 REST API(`codebase/backend`/`codebase/frontend`) 코드 변경 전무.
- **user_guide_sync** — `codebase/**`·`spec/**` 변경이 전혀 없어 doc-sync-matrix 21개 trigger 중 매칭 0건.

## 권장 조치사항

1. **(최우선)** security 를 포함한 6개 forced reviewer(`security`, `requirement`, `scope`, `side_effect`, `testing`, `documentation`)와 2개 일반 reviewer(`performance`, `architecture`) — 총 8/14 — 가 결과를 전혀 내지 못한 원인을 조사하고 재실행할 것. 특히 **security 리뷰 없이는 이 브랜치를 낮은 위험도로 확정할 수 없다.**
2. `.claude/_shared/retry_state.py` 의 동시성 결함 2건 수정: `apply_status_update` 의 read-modify-write 구간에 advisory lock(`fcntl.flock`) 추가 또는 known-residual 로 명시 문서화, `save_state()` 를 임시파일 + `os.replace` 원자적 쓰기로 전환.
3. `_shared/block_integrity.ALL_CHECKERS` 와 `role_instructions.CHECKER_INSTRUCTIONS` 의 동치성을 고정하는 테스트 1건 추가(체커 목록 이중관리 drift 방지).
4. Maintainability WARNING 4건 정리: `retry_state.py` 중복 주석 통합, `consistency_orchestrator.py` 미사용 import 제거, `code_review_orchestrator.py` 에서 삭제된 근거 주석의 의도 여부 확인(커밋 메시지 보강 또는 원복 검토), 공유 `Outcome` 클래스에 `notes` 필드 정식 선언.
5. (낮은 우선순위) INFO 항목들 — docstring 책임 목록 갱신, Gate 2 blocked 경로의 `notes` 미전달 근거 명시, 스트림 선택 헬퍼 추출, 반복 주석 축약, 매직넘버 치환 — 여유 있을 때 정리.

## 라우터 결정

- **라우터 미사용** (`routing=skipped`) — `meta.json` 확인 결과 `route_mode="all"`, `agents_explicit=false` — 정책상 14명 전원이 실행 대상.
- **실행(ran)**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외(skipped)**: 없음
- **강제 포함(router_safety, forced)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
- **⚠ forced 인데 결과 없음**: documentation, requirement, scope, security, side_effect, testing (forced 7명 중 6명 — maintainability 만 유일하게 forced 이면서 결과 확보)

| 결과를 확보하지 못한 reviewer | forced 여부 | 비고 |
|------------------------------|:-----------:|------|
| security | forced | no_status, 파일·인라인 전문 모두 없음 — 보안 관점 완전 공백 |
| requirement | forced | no_status, 파일·인라인 전문 모두 없음 — spec 정합성 관점 완전 공백 |
| scope | forced | no_status, 파일·인라인 전문 모두 없음 |
| side_effect | forced | no_status, 파일·인라인 전문 모두 없음 |
| testing | forced | no_status, 파일·인라인 전문 모두 없음 |
| documentation | forced | no_status, 파일·인라인 전문 모두 없음 |
| performance | 아니오 | no_status, 파일·인라인 전문 모두 없음 |
| architecture | 아니오 | no_status, 파일·인라인 전문 모두 없음 |