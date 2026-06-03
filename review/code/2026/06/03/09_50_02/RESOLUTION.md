# RESOLUTION — recentFailedCapped 후속 리뷰

대상 SUMMARY: `review/code/2026/06/03/09_50_02/SUMMARY.md` (원 RISK=HIGH, CRITICAL=2, WARNING=2).

## CRITICAL 2건 — 검증 결과 false positive (코드 수정 불필요)

documentation-reviewer 가 spec 의 **base(main)/stale 번들**을 읽어 발생. HEAD 실파일 검증:

| # | 주장 | 검증 (HEAD `16-system-status-api.md`) |
|---|------|------|
| 1 | §2 DTO 가 recentFailed/recentFailedCapped/totalRecentFailed/failedWindowMinutes 누락 | **거짓** — §2 DTO 블록(Overview·Queue 두 클래스)에 4개 필드 모두 존재. recentFailed/totalRecentFailed/failedWindowMinutes 는 759a7fa9, recentFailedCapped 는 11214e72 커밋. |
| 2 | §3 health 규칙 3 이 `counts.failed` 기준 | **거짓** — §3 규칙 3 = `recentFailed >= FAILED_DEGRADED_THRESHOLD` (759a7fa9). R-5 Rationale 존재. |

근거: reviewer 가 인용한 라인번호(45–62, 1194, 1641 등)가 실제 파일 크기(spec ~145줄)와 불일치 — 번들 오독. main 에는 이 spec 변경이 미머지라 base 기준으로는 "누락"으로 보임.

## WARNING 2건 — 반영

| # | 조치 | 위치 |
|---|------|------|
| 1 | spec §3 에 관련 env 4종 일람(THRESHOLD·DELAYED·WINDOW_MINUTES·SCAN_CAP) 추가 | `16-system-status-api.md §3` |
| 2 | e2e 상단 JSDoc 검증영역에 recentFailedCapped 추가 | `system-status.e2e-spec.ts` |

## INFO — 일부 반영

| # | 조치 |
|---|------|
| 1 | fallback(broken) 테스트에 `recentFailedCapped===false` + 집계 단언 추가 |
| 2 | 부분 capped(A=true,B=false → 집계 OR=true) 신규 테스트 추가 |
| 3 | timestamp-missing skip 경로에 `recentFailedCapped===false` 단언 추가 |
| 6 | `ZERO_RECENT` 상수 추출(삼항·catch 공용) |
| 7 | `RecentFailedResult` 인터페이스로 반환 타입 명명 |
| 10 | `.env.example` SCAN_CAP 에 합리적 상한(<=10000) 안내 |
| 4,8,12 | 프론트 RTL/헬퍼/JSDoc — 미반영(프로젝트 관행·경미) |
| 5 | `capped = !crossedWindow && !endOfSet` — 주석으로 충분, 유지 |
| 9 | role 가드 부재 — 기존 설계(spec §4 명시), 본 변경 무관 |
| 11 | spec partial→implemented — 완료 단계에서 재승격 |

## TEST 결과
- **lint**: 통과 (lint-20260603-095724)
- **unit**: 통과 — system-status 26 케이스 포함 전체 green (unit-20260603-095801)
- **build**: 통과 (build-20260603-095843)
- **e2e**: 통과 — 143 케이스, recentFailedCapped boolean 단언 포함 (e2e-20260603-095932)

## 보류·후속 항목
없음. (선행 plan 의 N+ optional 후속을 본 작업이 구현 완료.)
