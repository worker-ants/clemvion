# Code Review 통합 보고서 (recentFailedCapped 후속)

## 전체 위험도
원 보고: HIGH (CRITICAL 2). **단 CRITICAL 2건은 false positive — main 검증 결과 spec 은 이미 정확**(아래 조치 참조). 실코드 결함 없음.

## Critical 발견사항 (검증 결과 false positive)

| # | 카테고리 | 발견사항(원문) | 검증 결과 |
|---|----------|----------|------|
| 1 | 문서화 | spec §2 DTO 블록이 recentFailed/recentFailedCapped/totalRecentFailed/failedWindowMinutes 누락 | **오탐** — HEAD `16-system-status-api.md` §2 DTO 블록에 4개 필드 모두 존재(커밋 759a7fa9·11214e72). reviewer 가 base(main) 또는 stale 번들을 읽음(인용 line 45–62/1194 등 실제 파일과 불일치). |
| 2 | 문서화 | spec §3 health 규칙 3이 `counts.failed` 기준 | **오탐** — HEAD §3 규칙 3 = `recentFailed >= FAILED_DEGRADED_THRESHOLD`(커밋 759a7fa9). R-5 도 존재. |

## 경고 (WARNING) — 반영

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | 문서화 | env `SYSTEM_STATUS_FAILED_SCAN_CAP`·`WINDOW_MINUTES` 가 §3 env 표에 없음(§2 prose 엔 있음) | §3 env 매핑 노트에 두 변수 추가 |
| 2 | 문서화 | e2e 상단 JSDoc 검증영역에 recentFailedCapped 누락 | JSDoc 갱신 |

## 참고 (INFO) — 일부 반영

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | 테스트 | fallback 시 recentFailedCapped 미검증 | 단언 추가 |
| 2 | 테스트 | 부분 capped(A=true,B=false) OR 집계 시나리오 부재 | 테스트 추가 |
| 3 | 테스트 | timestamp-missing skip 경로 recentFailedCapped 미검증 | 단언 추가 |
| 4 | 테스트 | 프론트 N+ 컴포넌트 테스트 없음 | 미반영(프로젝트 관행, page RTL 부재) |
| 5 | 유지보수 | `capped = !crossedWindow && !endOfSet` 이중부정 | 주석으로 충분 — 유지 |
| 6 | 유지보수 | `{recent:0,capped:false}` 리터럴 이중 관리 | `ZERO_RECENT` 상수 추출 |
| 7 | 유지보수 | computeRecentFailed 익명 반환 타입 | `RecentFailedResult` 인터페이스 추출 |
| 8 | 유지보수 | `{capped?"+":""}` 중복 | 현 규모 수용 — 유지 |
| 9 | 보안 | role 가드 없는 인프라 노출 | 기존 설계(spec §4 명시), 본 변경 무관 — 무반영 |
| 10 | 보안 | scan cap 극단값 비용 | .env.example 에 합리적 상한 안내 |
| 11 | 요구사항 | spec worktree vs main 불일치 | 의도된 flow, merge 후 partial→implemented 재승격 |
| 12 | 문서화 | OverallHeader JSDoc 없음 | 미반영(경미) |

## 에이전트별
- documentation HIGH(오탐 2 + WARNING 2), security/maintainability/testing LOW(INFO), requirement/scope/side_effect/api_contract NONE.
