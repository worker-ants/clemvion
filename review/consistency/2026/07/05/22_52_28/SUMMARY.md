# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — SSRF 메시지 일반화(HTTP Request) 자체는 전 영역 정합적이나, 형제 문서/코드 간 잔존 불일치 3건(WARNING)이 발견됨

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | Cafe24 문서가 CONVENTIONS Principle 7 D1(config echo spread 금지)을 여전히 위반 서술 중 — 형제 문서(http-request.md)는 이미 명시 enumeration 으로 정정됨 | `spec/4-nodes/4-integration/4-cafe24.md` §4 step 2 | `spec/conventions/node-output.md` Principle 7 D1, `spec/4-nodes/4-integration/1-http-request.md` §4 step 2 | (a) cafe24 handler/spec 을 명시 enumeration 으로 정렬, 또는 (b) 예외 사유를 D1 옆에 Rationale 로 성문화 |
| 2 | convention_compliance | `INVALID_PARAMETERS` 에러 코드가 도메인 prefix 컨벤션(`DB_` 그룹화) 이탈 + 중앙 `ErrorCode` enum 미등록 | `spec/4-nodes/4-integration/2-database-query.md` §5.3(866행)·§6.2(910-913행); 코드 `database-query.handler.ts:552,558` | `spec/conventions/error-codes.md` §1 도메인 prefix 원칙, `error-codes.ts:25-32` 형제 코드군 | `DB_INVALID_PARAMETERS` 로 정정하거나 §3 historical-artifact 예외로 명문화 + 중앙 enum 등록 |
| 3 | plan_coherence | DB SSRF 차단 "원본 host 는 서버 활동 로그(logUsage)에 남는다" 서술이 실제 코드와 불일치(원본 host 는 어디에도 보존 안 됨) | `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 문단 및 §Rationale | 코드 `database-query.handler.ts:223-231`, `1-http-request.md §8.3`, `plan/in-progress/http-ssrf-all-auth-followups.md` | target 문장 정정 또는 plan 링크 명시 |

> **본 PR(G-1-P product metadata) 관련성**: WARNING 3건은 전부 형제 문서(database-query / http-request SSRF / error-codes)의 pre-existing 불일치로, 본 세션 diff(`product.ts` cafe24 metadata)와 무관하다 (naming_collision INFO #3 이 diff 범위를 명시 확인). 각 SSRF/error-code 트랙에서 별도 처리 대상.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | product.ts 메타데이터 대량 확장이 spec 본문 field 개수 언급과 stale 가능성 — 직접적 위험 미확인 | `spec/4-nodes/4-integration/4-cafe24.md` | 조치 불요. 향후 다른 resource 확장 시 재확인 권장 |
| 2 | convention_compliance | `0-common.md` 류 5/7 문서에 `## Rationale` 섹션 부재 — 기존 패턴, 신규 이탈 아님 | `spec/4-nodes/4-integration/0-common.md` 등 | 비긴급 |
| 3 | naming_collision | 검토 대상 diff 는 `product.ts` cafe24 metadata 전용 — payload target 문서와 실 diff 범위 불일치 | `codebase/backend/.../metadata/product.ts` | 정확한 diff 경로 재전달 권장 |
| 4 | naming_collision | `category_no`(category PK) vs `category`(product 필터) — 이름 다름, 충돌 없음, 의미 혼동 가능 | `codebase/backend/.../metadata/product.ts` | description 부연(낮은 우선순위) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 정합. 코드-spec 실물 대조 완료 |
| rationale_continuity | LOW | cafe24 D1 잔존 gap(형제 문서 무관) |
| convention_compliance | LOW | `INVALID_PARAMETERS`(DB, 무관) |
| plan_coherence | LOW | DB SSRF 문서 서술 불일치(무관) |
| naming_collision | NONE | 실 diff(cafe24 metadata) 신규 식별자 충돌 없음 |

## 권장 조치사항 (본 PR 외 트랙)
1. `2-database-query.md` SSRF 서술 정정 (WARNING #3, SSRF 후속 트랙)
2. `INVALID_PARAMETERS` → `DB_INVALID_PARAMETERS` (WARNING #2, error-codes 트랙)
3. Cafe24 config echo D1 정렬/성문화 (WARNING #1, 별도 후속)
