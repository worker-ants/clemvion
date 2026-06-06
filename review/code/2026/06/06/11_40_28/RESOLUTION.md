# Resolution — review/code/2026/06/06/11_40_28

> 대상: `2bcc2a52` (+ 후속 fix 커밋). 리뷰 전체 위험도 **LOW**, Critical **0**.
> 본 문서는 SUMMARY 의 Warning/INFO 및 재실행한 security 리뷰의 Warning 처리 결과.

## 전체 위험도

**LOW** — 기능 결함 없음. 모든 항목은 코드 품질·테스트 커버리지·방어 심층(defense-in-depth)·문서화. 동작 오류 유발 없음.

## Critical

없음.

## Warning 조치 (review 7 + security 2)

| 출처 | 항목 | 조치 |
|---|---|---|
| maintainability W1 | `_summary_is_resolved` 의 `probe is not ln` 객체 동일성 비교 (CPython interning 의존) | **FIXED** — 인덱스 기반 `for j, probe in enumerate(lines[i:])` + `j > 0` 로 교체 |
| testing W2 | `_authoritative_code_time` all-dirty 경로 미테스트 | **FIXED** — `test_all_dirty_uses_only_mtime` 추가 (commit-time 쿼리에 `[]` 전달 검증) |
| testing W3 | `_glob_to_regex` trailing `**` 분기 미테스트 | **FIXED** — `test_trailing_double_star_matches_any_path` 추가 |
| testing W4 | dead code 제거 후 MEDIUM+행없음 → resolved 회귀 테스트 없음 | **FIXED** — `test_medium_with_no_rows_is_resolved` 추가 |
| testing W5 | `_throttle_token` detached HEAD / no-git 폴백 미테스트 | **FIXED** — `test_throttle_token_detached_head_returns_sha`, `..._no_git_returns_norepo` 추가 |
| side_effect W6 | `_marker_path(session_id=None)` 시 `nosession` 키 공유 | **확인(의도된 fail-safe)** — push guard 가 hard gate 이므로 안전 방향. 코드 주석에 명시. session_id 는 harness 가 항상 주입(`normalize_worktree_branch.py` 도 동일 payload 사용) |
| documentation W7 | `_code_review_in_flight::now` 파라미터 목적 미문서화 | **FIXED** — 독스트링에 "injectable for tests; production callers omit it" 추가 |
| security S1 | `_marker_path` 가 `session_id`/token 을 미검증 삽입 (경로 탈출 가능성) | **FIXED** — `_sanitize_component` (`[^A-Za-z0-9._-]`→`_`) 로 양 컴포넌트 위생 처리. `/` 제거로 traversal 차단. `test_marker_path_sanitizes_path_traversal` 추가 |
| security S2 | `_code_review_in_flight` 가 빈/무효 `meta.json` 도 신뢰 → soft gate 우회 벡터 | **FIXED** — `json.load` 로 파싱 가능 여부 검증 후에만 in-flight 인정 (`_is_impl_done_session` 과 일관) |

## INFO 조치

| 항목 | 조치 |
|---|---|
| perf #1 — `_dirty_set` 이중 호출 | **FIXED** — `evaluate_review` 진입부 1회 계산 후 `_newest_code_mtime`/`_newest_resolved_review_mtime`/`_newest_resolved_impl_done_mtime` 에 주입 (git status 호출 절감) |
| doc #11 — 모듈 독스트링 구식 mtime 설명 | **FIXED** — checkout-immune 방식(세션 dir timestamp + commit time + in-flight)으로 갱신 (※ 1차 커밋 시 main checkout 에 잘못 적용돼 누락됐던 것을 정정) |
| doc #12 — `bootstrap-session.sh` "Two responsibilities" | **FIXED** — "Three responsibilities" (GC 추가 반영) |
| maint #9 — mermaid timeout 값 중복 | **FIXED** — `_NODE_TIMEOUT = 20.0` 상수화, 메시지도 `{:g}` 참조 |
| maint #10 — `RiskLevelWindowTest` tempdir cleanup 누락 | **FIXED** — `addCleanup(shutil.rmtree, ...)` helper 로 통일 |
| maint #7 — `_newest_code_mtime` shim 독스트링 | **FIXED** — back-compat shim 독스트링 추가 |

## 의도적 보류 (이번 PR 범위 밖 — 별도 추적)

| 항목 | 사유 |
|---|---|
| security S3 — `RESOLUTION.md` 내용 미검증(존재만으로 resolved) | **기존(pre-existing) 동작**, 본 PR 이 도입한 로직 아님. resolved 판정 의미 변경은 게이트 강도에 영향 → 별도 결정 필요. 현행 유지 |
| 아키텍처 #4/#5 — `branch_guard._origin_default_branch` private import, `_run_git` 중복 | `_lib/_git.py` 공통 레이어 추출은 별도 리팩터 이슈. 본 PR 범위 밖 |
| perf #2 — `_spec_code_patterns` lru_cache | 단명 hook 프로세스라 프로세스 내 1회 호출 → 캐시 이득 미미. 보류 |
| arch #6 — `_path_session_time` naive datetime(로컬 TZ) | 동일 머신 내 비교라 실용 영향 없음. 독스트링에 가정 명시됨. UTC 표준화는 장기 과제 |
| maint #8 — `_section_has_rows` 헤딩 토큰 하드코딩 | 경미. 보류 |

## TEST 결과

- `.claude/tests` 전체 **99/99 green** (`python3 -m unittest discover`). 신규 27건(hardening) 포함.
- 정적: `py_compile` 4개 hook OK, `bash -n bootstrap-session.sh` OK.
- e2e: 해당 없음 — 본 변경은 `.claude/**` harness Python(코드 리뷰 게이트·Stop hook·lint·bootstrap)으로 `codebase/` 제품 코드 무관. TEST WORKFLOW = unit 계층.
- 실측 검증: `embedding-model-ux` worktree 에서 기존 checkout-mtime 오탐 제거 확인, 잔존 차단은 실제 신선 커밋(11:31 > 리뷰 10:47)에 의한 정당 차단.

## security 재실행 메모

라우터가 security 를 선별했으나 1차 Workflow 에서 `security.md` output 이 생성되지 않음(미실행). `security-reviewer` 를 단독 재호출하여 보완 — 결과 LOW, Critical 0, 위 S1/S2 Warning 반영.
