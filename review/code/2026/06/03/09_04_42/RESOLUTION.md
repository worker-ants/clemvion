# RESOLUTION — system-status recentFailed 윈도우 지표 리뷰

대상 SUMMARY: `review/code/2026/06/03/09_04_42/SUMMARY.md` (RISK=LOW, CRITICAL=0, WARNING=1).
재실행한 security(NONE)·side_effect(LOW, 전부 in-scope 처리·장기 권장) 포함 Critical 0 확인.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | fix commit |
|---|---|---|---|
| W-1 | Testing | `computeRecentFailed` 캡==실제job수 경계 단위 테스트 추가(`scanned>=cap` 분기 종료 검증) | (본 리뷰 commit) |
| INFO-1·8 | Performance | `inspect()` 에서 `counts.failed===0` 이면 `getFailed()` 스캔 건너뛰는 단락 추가 — 정상 상태 Redis 비용 제거 (전용 테스트 추가) | 〃 |
| INFO-2 | Performance | `getOverview()` 단일 `now` 로 `cutoffMs`/`generatedAt` 일관화 | 〃 |
| INFO-3 | Requirement | `getFailedWindowMinutes`/`getFailedScanCap` 에 `Math.max(1, …)` 음수 가드 + getter 가드 테스트 | 〃 |
| INFO-6·7·15 | Maintainability | `computeRecentFailed` scanned++ / FAILED_SCAN_PAGE 고정 / 둘 다 없는 job 제외 주석·JSDoc 보강 | 〃 |
| INFO-10 | Testing | `finishedOn` 없을 때 `timestamp` 대체 / 둘 다 없으면 제외 케이스 단위 테스트 추가 | 〃 |
| INFO-12 | Testing | getter 엣지(빈/NaN/0/음수) 테스트 추가 | 〃 |
| INFO-13 | Documentation | `.env.example` `SYSTEM_STATUS_FAILED_THRESHOLD` 에 recentFailed 비교 cross-ref NOTE 추가 | 〃 |
| INFO-14 | Documentation | 유저 가이드(mdx KO/EN) env 노트에 스캔 캡 하한값 안내 추가 | 〃 |
| INFO-17 | API Contract | DTO `recentFailed` `@ApiProperty` 에 `recentFailed <= counts.failed` 불변식 명시 | 〃 |
| INFO-9·18 | Maintainability/Scope | dead i18n 키 `totalFailed`·`counts.failed` ko/en 양쪽 제거(parity 유지) | 〃 |

## 미조치(의도적) 항목

| SUMMARY # | 사유 |
|---|---|
| INFO-4 | e2e `recentFailed <= counts.failed` 비원자성 — 단락 최적화로 failed===0 시 결정적 0, e2e 큐는 idle 이라 안정. 의미 있는 불변식이라 유지. |
| INFO-5·16 | "N+" 캡 표기 / `recentFailedCapped` DTO 플래그 — spec §2.3 상 **"허용"(optional)** 항목. 별도 후속 enhancement 로 분리(아래 보류). |
| INFO-11 | 프론트엔드 RTL 렌더 테스트 — 후속 품질 개선(본 PR 범위 밖, 기존 page.tsx 도 RTL 미보유). |
| side_effect WARN | process.env try/finally 복원·private 시그니처 — reviewer 도 "현재 안전" 평가, 이 파일 기존 패턴과 동일. |

## TEST 결과

- **lint**: 통과 (`_test_logs/lint-20260603-091929.log`)
- **unit**: 통과 — system-status 23 케이스 포함 전체 green (`_test_logs/unit-20260603-092013.log`)
- **build**: 통과 (`_test_logs/build-20260603-092102.log`)
- **e2e**: 통과 — 143 케이스, system-status.e2e-spec.ts 신규 계약 단언 포함 (`_test_logs/e2e-20260603-092223.log`)

## 보류·후속 항목

- **`recentFailedCapped` 런타임 시그널 + UI "N+" 표기** (INFO-5/16): spec 상 optional. 캡(기본 1000)은 60분 내 1000건 실패라는 극단 상황에서만 도달. 필요 시 후속 plan 으로 DTO 플래그 추가 + UI 표기. 현재는 `recentFailed` 를 하한값 평문 표기(가이드에 명시).
