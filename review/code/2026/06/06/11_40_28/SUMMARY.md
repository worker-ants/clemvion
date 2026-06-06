# Code Review 통합 보고서

> 대상 커밋: `2bcc2a52 fix(hooks): harden review-coverage guard — kill false Stop-hook firing + latent bugs`
> 세션: `review/code/2026/06/06/11_40_28`

---

## 전체 위험도

**LOW** — 기능 정확성 결함은 없음. 모든 Critical·Warning 은 코드 품질·테스트 커버리지 갭이며, 동작 오류를 유발하지는 않는다. security 리뷰어 파일이 존재하지 않아 해당 영역은 미검토 상태임을 명시한다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `_summary_is_resolved` 의 `probe is not ln` Python 객체 동일성 비교 — CPython string interning 에 암묵적으로 의존. 동일 내용 문자열이 다른 객체로 존재하면 첫 줄 skip 이 오작동할 수 있다 | `review_guard.py` L902, L910 | `for probe in lines[i + 1:]` 로 변경하거나 인덱스 오프셋(`j > 0`) 방식으로 교체 |
| 2 | 테스트 | `_authoritative_code_time` — 모든 파일이 dirty 일 때(`clean_paths=[]`) `_newest_commit_time` 이 빈 리스트로 호출되는 경로 테스트 없음 | `test_review_guard_hardening.py::AuthoritativeCodeTimeTest` | `test_all_dirty_uses_only_mtime` 케이스 추가 |
| 3 | 테스트 | `_glob_to_regex` — trailing `**`(슬래시 없음) 분기 테스트 없음. `**/` 분기는 커버되나 `codebase/**` 같은 패턴의 `else` 분기가 미검증 | `test_review_guard_hardening.py::GlobBoundaryTest` | `test_trailing_double_star_matches_any_path` 추가 |
| 4 | 테스트 | `_summary_is_resolved` — dead code 제거(`risk_level in (None,"MEDIUM") and has_actionable`) 후 MEDIUM+행없음 → resolved(True) 케이스를 확인하는 회귀 테스트 없음 | `review_guard.py` diff L423-428, `test_review_guard.py` | `test_medium_with_no_rows_is_resolved` 추가 |
| 5 | 테스트 | `_throttle_token` — detached HEAD(abbrev-ref="HEAD"→SHA 폴백) 및 git 미설치("norepo") 경로 테스트 없음 | `test_review_guard_hardening.py::StopThrottleTest` | `test_throttle_token_detached_head_returns_sha`, `test_throttle_token_no_git_returns_norepo` 추가 |
| 6 | 부작용 | `_marker_path(session_id=None)` 시 모든 호출이 `nosession__{token}` 키를 공유 — 동일 브랜치에서 session_id 없는 복수 세션이 동시에 실행되면 nudge throttle 이 교차 영향을 미침 | `guard_review_before_stop.py::_marker_path` | 의도된 fail-safe(안전 방향)임을 확인. session_id 가 항상 주입되는지 검증 권장 |
| 7 | 문서화 | `_code_review_in_flight` 의 `now: float \| None = None` 파라미터가 테스트 주입 목적임이 독스트링에 명시되지 않음 — 프로덕션 코드에서의 기본값 동작을 문서에서 확인 불가 | `review_guard.py` L1145 | 독스트링에 "The `now` parameter is for testing only — production callers omit it (defaults to time.time())." 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `_dirty_set` 이 `evaluate_review` 경로에서 최대 2회 호출 — git status subprocess 2회 기동 | `review_guard.py::_newest_resolved_review_mtime` + `_newest_resolved_impl_done_mtime` | `evaluate_review` 진입부에서 `dirty = _dirty_set(repo_root)` 1회 계산 후 주입 |
| 2 | 성능 | `_spec_code_patterns` — 매 호출마다 spec 파일 전체 재파싱, 캐싱 없음 | `review_guard.py::_spec_code_patterns` | `functools.lru_cache` 적용(단명 hook 프로세스라 무효화 불필요) |
| 3 | 성능 | `_code_review_in_flight` — `os.walk` 전체 순회. 현재 규모 무해하나 세션 수백 개 이상 누적 시 Stop hook 지연 | `review_guard.py::_code_review_in_flight` L1160 | 장기적으로 GC 정책 또는 세션 인덱스 파일 도입 고려 |
| 4 | 아키텍처 | `review_guard.py` 가 `branch_guard._origin_default_branch` (private symbol) 를 직접 import — 모듈 리팩터링 시 암묵적 결합 | `review_guard.py` L652-654 | `branch_guard` 에 공개 함수 노출 또는 `_lib/_git_utils.py` 공통 레이어 추출 |
| 5 | 아키텍처 | `_run_git` 래퍼가 `branch_guard`, `review_guard` 각자 중복 구현 | 양 파일 | 중기적으로 `_lib/_git.py` 공통화 |
| 6 | 아키텍처 | `_path_session_time` — naive datetime, 로컬 타임존 해석. 동일 머신 내 비교이므로 실용적 영향 없음 | `review_guard.py` L440-459 | 독스트링에 로컬 타임존 가정 명시. 장기적으로 UTC 표준화 검토 |
| 7 | 유지보수성 | `_newest_code_mtime` back-compat shim 존재 이유가 주석에만 있고 함수 독스트링 없음 | `review_guard.py` L367-368 | `"""Back-compat shim for tests/callers; delegates to _authoritative_code_time."""` 추가 또는 TODO 코멘트 |
| 8 | 유지보수성 | `_section_has_rows` 의 `"Critical"`, `"경고"` 헤딩 토큰 하드코딩 — 포맷 변경 시 2개소 동시 수정 필요 | `review_guard.py` L911-912 | `_CRITICAL_SECTION_TOKEN`, `_WARNING_SECTION_TOKEN` 모듈 상수로 분리 |
| 9 | 유지보수성 | `lint_mermaid_posttooluse.py` 의 timeout 값 `20.0` 이 코드와 에러 메시지 두 곳에 중복 | `lint_mermaid_posttooluse.py` L1568, L1575 | `_NODE_TIMEOUT = 20.0` 상수 선언 후 f-string 참조 |
| 10 | 유지보수성 | `RiskLevelWindowTest` 에서 `tempfile.mkdtemp()` 사용 후 cleanup 미등록 | `test_review_guard_hardening.py` L1902-1910 | `addCleanup(shutil.rmtree, d, ignore_errors=True)` 추가 또는 `TemporaryDirectory()` 컨텍스트 매니저로 통일 |
| 11 | 문서화 | `review_guard.py` 모듈 독스트링이 구식 mtime-기반 freshness 설명을 유지 — 실제 구현은 checkout-immune 방식으로 교체됨 | `review_guard.py` 모듈 독스트링 L617-635 | `_authoritative_code_time` + 세션 디렉터리 timestamp 파싱 방식으로 업데이트 |
| 12 | 문서화 | `bootstrap-session.sh` 헤더 주석 "Two responsibilities" 가 GC 추가 후 세 번째 책임 미반영 | `bootstrap-session.sh` L10-12 | "Three responsibilities:" 로 업데이트 |
| 13 | 범위 | `lint_mermaid_posttooluse.py` 수정이 review-guard 와 다른 도메인(mermaid lint)이지만 "hook hardening" 맥락에는 부합 | `lint_mermaid_posttooluse.py` 전체 | 작업 plan 에 "모든 hook subprocess timeout 강화" 포함 여부 확인. 해당되면 범위 내 |
| 14 | 동시성 | `_code_review_in_flight` 의 `os.walk` 중 외부 프로세스의 `SUMMARY.md` 동시 기록 시 TOCTOU 가능 — push guard가 hard gate 라 보안 위험 없음 | `review_guard.py::_code_review_in_flight` | 현행 fail-open 설계 유지 |
| 15 | 요구사항 | `_code_review_in_flight` 가 `review/code` 세션만 감지 — `review/consistency`(impl-done) 세션 in-flight 미처리. Gate 2 오발화 가능성 잔존하나 ai-review 레이스(주 타깃)는 해결됨 | `review_guard.py` L566-586 | 필요 시 후속 PR 에서 `_consistency_in_flight` 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | **미실행** (output_file 없음) | 파일 부재 — 결과 없음 |
| performance | LOW | `_dirty_set` 이중 호출, `_spec_code_patterns` 재파싱 캐싱 없음 |
| architecture | LOW | `branch_guard` private symbol 직접 의존, `_run_git` 중복 구현 |
| requirement | NONE | spec fidelity 불일치 없음 (harness-internal 영역) |
| scope | LOW | `bootstrap-session.sh` docstring 책임 수 미갱신, lint_mermaid 범위 경계 |
| side_effect | LOW | `session_id=None` 마커 키 공유(WARNING), tempdir cleanup 미등록 |
| maintainability | LOW | `probe is not ln` identity 비교(WARNING), tempdir cleanup 누락 |
| testing | LOW | `_authoritative_code_time` all-dirty, trailing `**`, MEDIUM+행없음, `_throttle_token` 폴백 미커버(모두 WARNING) |
| documentation | LOW | 모듈 독스트링 구식화(mtime→checkout-immune), `bootstrap-session.sh` 헤더, `_code_review_in_flight` `now` 파라미터(WARNING) |
| concurrency | NONE | 동시성 구조 신규 도입 없음, TOCTOU/비원자 쓰기 모두 허용 범위 |
| api_contract | NONE | HTTP/REST API 변경 없음 — 내부 hook 인프라만 변경 |

---

## 발견 없는 에이전트

- **api_contract**: 내부 hook 인프라만 변경, API 계약 무관
- **concurrency**: 동시성 구조 신규 도입 없음, 식별된 이론적 TOCTOU는 모두 허용 범위
- **requirement**: harness-internal 영역, spec 명세 대상 없음

---

## 권장 조치사항

1. **[WARNING #1 — 유지보수성]** `_summary_is_resolved` 의 `probe is not ln` → `for probe in lines[i + 1:]` 로 교체. CPython interning 에 의존하지 않는 명시적 구현.
2. **[WARNING #2~#5 — 테스트 커버리지]** 4개 엣지 케이스 단위 테스트 추가: (a) `_authoritative_code_time` all-dirty, (b) `_glob_to_regex` trailing `**`, (c) `_summary_is_resolved` MEDIUM+행없음 resolved, (d) `_throttle_token` detached HEAD·norepo.
3. **[WARNING #6 — 부작용]** `session_id=None` 경로가 프로덕션에서 실제 발생하는지 확인. Claude Code가 항상 session_id를 주입하면 방어적 코드로만 기능하므로 주석으로 명시.
4. **[WARNING #7 — 문서화]** `_code_review_in_flight::now` 파라미터 목적을 독스트링에 추가.
5. **[INFO #11 — 문서화]** `review_guard.py` 모듈 독스트링의 freshness 설명을 checkout-immune 방식으로 업데이트.
6. **[INFO #12 — 문서화]** `bootstrap-session.sh` 헤더 "Two → Three responsibilities" 업데이트.
7. **[INFO #1 — 성능]** `evaluate_review` 진입부에서 `dirty` 1회 계산 후 하위 함수에 주입(git subprocess 1회 절감).
8. **[INFO #10 — 유지보수성]** `RiskLevelWindowTest` tempdir cleanup 등록(`addCleanup` 또는 `TemporaryDirectory` 컨텍스트 매니저).
9. **[INFO #4,#5 — 아키텍처]** 중기적으로 `_lib/_git.py` 공통 git 유틸리티 추출, `branch_guard._origin_default_branch` 공개 API 노출 — 이번 PR 범위 밖, 별도 이슈 추적.
10. **[security 미검토]** security 리뷰어 output_file 이 존재하지 않아 보안 관점 점검이 수행되지 않았다. 별도 security 리뷰 수행을 권장한다.

---

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

**실행** (11명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract

**강제 포함(router_safety)** (6명): maintainability, requirement, scope, security, side_effect, testing

**제외** (3명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터 판단으로 제외 |
| database | 라우터 판단으로 제외 |
| user_guide_sync | 라우터 판단으로 제외 |

> 참고: security 는 router_safety 강제 포함 목록에 있었으나 output_file(`security.md`)이 세션 디렉터리에 존재하지 않아 결과를 읽을 수 없었다. 실행 중 실패하거나 출력이 기록되지 않은 것으로 추정된다.