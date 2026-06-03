# Code Review 통합 보고서

## 전체 위험도

**LOW** — 기능 구현은 spec 과 line-level 로 일치하며 Critical 발견사항 없음. WARNING 1건(테스트 경계값 케이스)과 다수의 INFO 수준 보완 사항이 존재하나 운영 장애 위험은 낮음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `computeRecentFailed` 페이지 오프셋 경계 케이스 미검증 — 캡=페이지크기=실제job수 조합에서 `scanned >= scanCap` 종료 분기와 `jobs.length < limit` 분기가 동시에 발생하는 케이스가 테스트되지 않음. | `system-status.service.ts` `computeRecentFailed`; `system-status.service.spec.ts` | "캡=페이지크기=실제job수" 케이스 단위 테스트 추가하여 `scanned >= scanCap` 분기로 종료되는 동작 명시적 검증 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 제안 |
|---|----------|----------|------|
| 1 | Performance | `computeRecentFailed` 단일 큐 내 최대 N회 직렬 Redis round-trip | `counts.failed === 0` 단락 조건 추가 |
| 2 | Performance | `getOverview()` 에서 `Date.now()` 와 `new Date().toISOString()` 두 번 호출로 `cutoffMs`/`generatedAt` 미세 불일치 | `const now = Date.now()` 통일 |
| 3 | Requirement | 음수 env 미검증 | `Math.max(1, ...)` 양수 가드 |
| 4 | Requirement | e2e `recentFailed <= counts.failed` 비원자성 경쟁 조건 | `>= 0` 완화 또는 주석 |
| 5 | Requirement | "N+" 캡 표기 미구현 (spec 상 "허용") | 후속 plan |
| 6 | Maintainability | window 밖 job 도 `scanned++` 포함 이유 주석 부재 | 주석 추가 |
| 7 | Maintainability | `FAILED_SCAN_PAGE = 100` 고정 이유 미문서화 | JSDoc 추가 |
| 8 | Maintainability | `extractData` 이중 응답 처리 이유 주석 없음 | 주석 추가 |
| 9 | Maintainability | `totalFailed` i18n 키 dead 가능성 | 사용처 확인 후 정리 |
| 10 | Testing | `finishedOn` 없고 `timestamp` fallback / 둘 다 없음 케이스 테스트 부재 | 단위 테스트 추가 |
| 11 | Testing | 프론트엔드 신규 props 렌더링 테스트 없음 | RTL 테스트(후속) |
| 12 | Testing | getter 엣지 케이스 독립 테스트 없음 | constants 테스트 |
| 13 | Documentation | `.env.example` `SYSTEM_STATUS_FAILED_THRESHOLD` 항목에 의미변경 cross-ref 누락 | NOTE 추가 |
| 14 | Documentation | 사용자 가이드에 스캔 캡 하한값 안내 없음 | env 노트 추가 |
| 15 | Documentation | `computeRecentFailed` JSDoc 둘 다 없는 경우 미기재 | JSDoc 추가 |
| 16 | API Contract | `recentFailedCapped` 런타임 시그널 부재 | 후속/Swagger desc |
| 17 | API Contract | `recentFailed <= counts.failed` 불변식 Swagger 미기재 | `@ApiProperty` desc |
| 18 | Scope | 기존 `counts.failed` i18n 키 미사용 가능성 | 정리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | 재시도 필요 (output 부재) | — |
| performance | LOW | 직렬 페이지 루프, `counts.failed===0` 단락 기회 |
| requirement | LOW | 음수 env 미검증, e2e 비원자성, "N+" 미구현(허용) |
| scope | NONE | 12개 변경 파일 전부 plan Phase 2–5 와 1:1 대응 |
| side_effect | 재시도 필요 (output 부재) | — |
| maintainability | LOW | 흐름 주석 부족, dead i18n 키 |
| testing | LOW | WARNING 1건, timestamp fallback 테스트 없음 |
| documentation | LOW | `.env.example` cross-ref, 가이드 캡 하한 안내 |
| api_contract | LOW | `recentFailedCapped` 부재, 불변식 미기재 |
| user_guide_sync | LOW | i18n parity 충족, MDX KO/EN 완료 |

---

## 권장 조치사항

1. (WARNING) `computeRecentFailed` 캡=페이지=job수 경계 단위 테스트 추가.
2. (방어) getter 에 `Math.max(1, ...)` 양수 가드.
3. (e2e 안정성) `recentFailed <= counts.failed` 완화/주석.
4. (문서) `.env.example` `SYSTEM_STATUS_FAILED_THRESHOLD` cross-ref.
5. (문서) 사용자 가이드 스캔 캡 하한값 안내.
6. (테스트) `finishedOn`/`timestamp` fallback 3케이스.
7. (i18n 정리) dead key 확인 후 제거.
8. (성능) `counts.failed === 0` 단락 최적화.
9. (후속 기획) `recentFailedCapped` 플래그 — 별도 plan.
10. (완료 처리) plan Phase 5 체크 + spec `partial → implemented` 승격.

---

## 재시도 필요
- **security** (`security.md` 부재)
- **side_effect** (`side_effect.md` 부재)

## 라우터 결정
실행(10): security, performance, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync. 제외(4): architecture, dependency, database, concurrency.
