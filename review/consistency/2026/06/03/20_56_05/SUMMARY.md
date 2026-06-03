# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견이 있으나 구현 즉시 차단이 아닌 spec 보완 사항 (구현 Phase 1 착수 전 해소 강권)

## 전체 위험도
**MEDIUM** — Convention Compliance 에서 CRITICAL 1건(catalog sync 컬럼 체계 미정의) 발견; 구현 착수 이전 spec 보완 필요

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `makeshop-api-catalog/_overview.md` 에 구현 착수 시 추가할 `status` 컬럼 enum(`supported`/`planned`), `paginated` 등 컬럼 정의가 없어 단일 진실 원칙 위반 — 담당자가 구현 PR 시 Cafe24 카탈로그를 독립 참조해야 함 | `spec/conventions/makeshop-api-catalog/_overview.md` | `spec/conventions/cafe24-api-catalog/_overview.md §4 Sync Contract` | `makeshop-api-catalog/_overview.md` 에 "구현 착수 시 추가할 컬럼" 섹션을 추가하여 `status` enum, `paginated`, restricted 여부를 Cafe24 `_overview.md §3` 기준으로 사전 정의 |

> 참고: 이 CRITICAL 은 코드 모순이 아닌 spec 내 정보 분산으로 인한 단일 진실 원칙 위반입니다. 즉시 코드 차단 사유는 아니나 구현 Phase 1 착수 전 해소를 강권합니다. **BLOCK: NO** 로 판단.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `MAKESHOP_INVALID_SHOP_UID` 에러 코드가 §6 에 등재되나 §4 실행 로직에 shop_uid 형식 검증 단계(트리거 조건) 없음 | `spec/4-nodes/4-integration/5-makeshop.md §6` | 동일 문서 §4 step 1~12 | §4 에 shop_uid 형식 검증 단계 추가(step 3 또는 4 후) 또는 에러 코드를 INTEGRATION_INCOMPLETE 로 흡수하여 §6 에서 제거 |
| 2 | Cross-Spec | `0-common.md §4.2 D4` 결정 주석이 "Integration 4종"으로 고정 — §7 색인의 "+ MakeShop Planned" 표현과 같은 문서 내 비일관 | `spec/4-nodes/4-integration/0-common.md §4.2` | 동일 문서 §7 출력 구조 색인 | D4 주석을 "4종 + MakeShop (Planned)" 또는 "구현된 모든 Integration 노드" 로 일반화 |
| 3 | Cross-Spec | Send Email 성공 포트명 `'out'` 이 공통 규약 §3 예시 `"port": "success"` 및 §7 색인 기술과 불일치하나 공통 규약에서 명시적 설명 없음 | `spec/4-nodes/4-integration/3-send-email.md §3.2, §5.1` | `0-common.md §3, §7` | `0-common.md §7` Send Email 행에 "(port `out`)" 명시 추가; 또는 포트명 `'success'` 로 통일 검토 |
| 4 | Rationale Continuity | `database-query §5.8` 이 `INTEGRATION_NOT_FOUND` 를 D4 surface 코드로 열거하나, `0-common.md §4.2` 는 해당 코드가 현재 미존재(NotFoundException → `INTEGRATION_CALL_FAILED` 흡수)임을 명시 — send-email §5.3 은 올바르게 "미surface Planned" 로 분리 | `spec/4-nodes/4-integration/2-database-query.md §5.8` | `0-common.md §4.2` 주석 | §5.8 에서 해당 코드 제거하거나 send-email §5.3 패턴("현재 미surface — Planned")으로 구분 명기 |
| 5 | Rationale Continuity | `cafe24 §1` cursor 폐기 근거 "B-3-7, Rationale 참조" 인용하나 §9 Rationale 에 B-3-7 항목 없음 — 결정 추적 불가 | `spec/4-nodes/4-integration/4-cafe24.md §1` | 동일 문서 §9 Rationale 전체 | §9 에 B-3-7 항목 추가: Cafe24 Admin API cursor 미지원 근거 및 offset/limit 통일 결정 기록 |
| 6 | Convention Compliance | `5-makeshop.md` 및 `spec/conventions/makeshop-api-metadata.md` frontmatter `status: spec-only` 가 `spec-impl-evidence.md` 비표준 enum 값 | `spec/4-nodes/4-integration/5-makeshop.md` frontmatter, `spec/conventions/makeshop-api-metadata.md` | `spec/conventions/spec-impl-evidence.md` status enum | `status: spec-only` → `status: planned` 로 변경, 또는 `spec-impl-evidence.md` 에 `spec-only` 정식 등재 |
| 7 | Convention Compliance | `makeshop-api-catalog/` resource 파일 7개 모두 `status: spec-only` 비표준 + 구현 전 단계에서 Cafe24 구현 완료 파일 구조 패턴을 부자연스럽게 차용 | `spec/conventions/makeshop-api-catalog/shop.md` 외 6개 | `spec/conventions/spec-impl-evidence.md`, `cafe24-api-catalog/application.md` | (a) frontmatter 간소화/제거하여 `_overview.md` 와 정렬, 또는 (b) `status: planned` 로 통일 |
| 8 | Convention Compliance | `5-makeshop.md §5` 서두에 `> CONVENTIONS Principle 11 포맷.` 참조 주석 누락 — 기존 노드 문서(`1-http-request.md §5` 등) 모두 포함 | `spec/4-nodes/4-integration/5-makeshop.md §5` | `1-http-request.md §5`, `2-database-query.md §5`, `3-send-email.md §5` | §5 서두에 Principle 11 참조 주석 추가 |
| 9 | Convention Compliance | MCP operationId 하이픈·언더스코어 혼용(`get-cart_free_config` 등)으로 sanitize 충돌 위험 — 구현 전 전체 operationId 중복 검증 절차 미정의 | `spec/conventions/makeshop-api-catalog/shop.md` operationId 컬럼 | `spec/conventions/makeshop-api-metadata.md §7` MCP sanitize 정책 | `5-makeshop.md §8.1` 또는 `makeshop-api-metadata.md §7` 에 혼용 operationId sanitize 충돌 방지 정책 및 사전 중복 검증 절차 명시 |
| 10 | Plan Coherence | `spec-sync-integration-common-gaps.md` 의 "결정 필요" 3건(send-email summaryTemplate +N DSL 불가, Missing integration 배지 아키텍처, db-query 첫 줄 downscope)이 `0-common.md §5` 에 미결 상태로 기술되어 구현 지시처럼 읽힘 | `spec/4-nodes/4-integration/0-common.md §5` 캔버스 요약 표 | `plan/in-progress/spec-sync-integration-common-gaps.md §⚠ 재분류` | 3건 결정 먼저 확정(planner) 후 `0-common.md §5` 갱신; 또는 구현 plan 에 "결정 완료 항목만 구현" 명시 |
| 11 | Naming Collision | MakeShop 토큰 갱신용 BullMQ 큐명·스케줄러 ID·프로세서 클래스명이 spec 어디에도 정의되지 않아 구현 시 `cafe24-token-refresh` 큐 공용 vs 신규 큐 신설 결정 불명확 | `spec/4-nodes/4-integration/5-makeshop.md §4 step 6` | `spec/5-system/16-system-status-api.md`(cafe24-token-refresh 큐), `spec/data-flow/5-integration.md §5.2` | `5-makeshop.md §4 step 6` 또는 `spec/2-navigation/4-integration.md §5.9` 에 공용 큐(service_type 분기) vs 신규 `makeshop-token-refresh` 큐 신설 중 하나를 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `makeshop-api-metadata.md` method `GET\|POST` 2종 정의가 카탈로그와 일치 확인(delete 등은 경로 segment, HTTP 메서드 아님) | `spec/conventions/makeshop-api-metadata.md §2` | Wire format 절에 "delete 등은 경로 segment, HTTP 메서드 아님" 주석 1줄 추가 |
| 2 | Cross-Spec | `makeshop-api-metadata.md §4` Wire format 에 "POST/PUT body" 표현 — MakeShop 은 PUT 미사용 | `spec/conventions/makeshop-api-metadata.md §4` | "POST/PUT body" → "POST body" 로 수정 |
| 3 | Cross-Spec | `1-data-model.md §2.10` `mall_id` 비즈니스 규칙이 Cafe24 중복 금지만 명시 — MakeShop shop_uid 동일 규칙 미기술 | `spec/1-data-model.md §2.10` | MakeShop(Planned) 동일 중복 금지 규칙 대칭 기술 추가 |
| 4 | Rationale Continuity | `http-request §5.8` 도 `INTEGRATION_NOT_FOUND` 를 surface 코드처럼 열거(WARNING #4 와 동일 패턴) | `spec/4-nodes/4-integration/1-http-request.md §5.8` | send-email §5.3 비고 패턴 적용 또는 `0-common §4.2` cross-reference 명시 |
| 5 | Rationale Continuity | `0-common.md` 에 Rationale 섹션 없음 — `meta.durationMs` 통일 등 Breaking change 결정 근거 미기록 | `spec/4-nodes/4-integration/0-common.md` | Rationale 섹션 추가; `meta.durationMs` 통일 결정 이유·대안 기각 기록 |
| 6 | Rationale Continuity | `database-query §4` SSRF 차단 코드가 `INTEGRATION_CALL_FAILED` fallback 이나 "의도된 미정의" vs "구현 미완성" 구분 근거 없음 | `spec/4-nodes/4-integration/2-database-query.md §4` | Rationale 섹션 또는 §4 주석에 DB 도메인 전용 SSRF 코드 미신설 이유 간략 기재 |
| 7 | Convention Compliance | `0-common.md §4` 제목 "세멘틱" — `2-database-query.md §3.2` 의 "시맨틱" 과 혼용 | `spec/4-nodes/4-integration/0-common.md §4` | 전체 integration 문서에서 "시맨틱" 으로 통일 |
| 8 | Convention Compliance | `5-makeshop.md §5.1, §5.3` 출력 필드 표에 `타입` 컬럼 누락 (다른 노드 문서 4열 구조 불일치) | `spec/4-nodes/4-integration/5-makeshop.md §5.1, §5.3` | `타입` 컬럼 추가 |
| 9 | Convention Compliance | `makeshop-api-catalog/_overview.md` 제목 "Makeshop" (소문자 s) vs 공식 브랜드 "MakeShop" | `spec/conventions/makeshop-api-catalog/_overview.md` 첫 줄 | 제목을 `# CONVENTION: MakeShop API Catalog — Overview` 로 수정 |
| 10 | Convention Compliance | `5-makeshop.md §4 step 6` `token_expires_at` 에 `spec/1-data-model.md §2.10` 참조 링크 없음 | `spec/4-nodes/4-integration/5-makeshop.md §4 step 6` | `([데이터 모델 §2.10](../../1-data-model.md#210-integration))` 참조 링크 추가 |
| 11 | Plan Coherence | `spec-sync-integration-common-gaps.md` frontmatter `worktree: spec-sync-audit` 가 이미 정리된 worktree 를 가리킴 (PR #446 MERGED) | `plan/in-progress/spec-sync-integration-common-gaps.md` frontmatter | `worktree: (closed)` 로 수정 또는 제거 |
| 12 | Plan Coherence | stale worktree 6개(`spec-drift-resolve-efb608` 외 5개)가 active 디렉토리에 잔존 | `.claude/worktrees/` 하위 6개 | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 13 | Naming Collision | `MakeshopOperationMetadata` vs `Cafe24OperationMetadata` 비대칭 필드 구성 — 충돌 없음, 의도적 설계 | `spec/conventions/makeshop-api-metadata.md` | 현 설계 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `MAKESHOP_INVALID_SHOP_UID` 트리거 조건 미정의(W), D4 주석 "4종" 고정 비일관(W), Send Email 포트명 공통 규약 미명시(W) |
| Rationale Continuity | LOW | `INTEGRATION_NOT_FOUND` 미존재 invariant 위반(W×2: db-query+http-request), cafe24 B-3-7 Rationale 항목 없음(W) |
| Convention Compliance | MEDIUM | catalog sync 컬럼 정의 분산(C), `status: spec-only` 비표준(W×2), Principle 11 참조 누락(W), MCP operationId sanitize 충돌 미정의(W) |
| Plan Coherence | LOW | `0-common.md §5` 미결 3건이 구현 지시처럼 잔존(W), stale worktree 6개(I) |
| Naming Collision | LOW | BullMQ 큐명·스케줄러 ID 미정의(W), 나머지 신규 식별자 모두 충돌 없음 |

## 권장 조치사항

1. **[CRITICAL 해소 — 구현 Phase 1 착수 전]** `spec/conventions/makeshop-api-catalog/_overview.md` 에 "구현 착수 시 추가할 컬럼" 섹션 추가: `status` enum(`supported`/`planned`), `paginated` 컬럼 정의를 Cafe24 `_overview.md §4` 기준으로 사전 문서화.
2. **[구현 착수 직전]** `5-makeshop.md §4 step 6` 에 MakeShop 토큰 갱신 BullMQ 큐 전략 결정 명시 — 공용 큐(`cafe24-token-refresh`, `service_type` 분기) vs 신규 `makeshop-token-refresh` 큐 중 선택.
3. **[구현 착수 직전]** `spec-sync-integration-common-gaps.md` 의 "결정 필요" 3건(send-email summaryTemplate +N, Missing integration 배지, db-query 첫 줄 downscope) 결정 확정 후 `0-common.md §5` 갱신 또는 구현 건너뜀 plan 명시.
4. `5-makeshop.md §6` 의 `MAKESHOP_INVALID_SHOP_UID` 트리거 조건을 §4 실행 로직에 추가(step 4 후 형식 검증 단계).
5. `spec/conventions/makeshop-api-metadata.md §7` 에 MCP operationId 하이픈·언더스코어 혼용 sanitize 충돌 방지 정책 및 구현 전 전체 operationId 중복 검증 절차 추가.
6. `5-makeshop.md`, `makeshop-api-metadata.md`, `makeshop-api-catalog/` resource 파일 7개의 `status: spec-only` → `status: planned` 일괄 변경 (또는 `spec-impl-evidence.md` 에 `spec-only` 정식 등재).
7. `cafe24 §1` Rationale B-3-7 항목 추가, `0-common.md §4.2` D4 주석 "4종" → "+ MakeShop (Planned)" 포함으로 갱신.
8. `database-query §5.8`, `http-request §5.8` 의 `INTEGRATION_NOT_FOUND` 를 send-email §5.3 패턴("현재 미surface — Planned")으로 구분 명기.
9. `makeshop-api-metadata.md §4` "POST/PUT body" → "POST body" 수정; `_overview.md` 제목 "Makeshop" → "MakeShop" 수정; `0-common.md §4` "세멘틱" → "시맨틱" 통일.
10. stale worktree 6개 정리: `.claude/tools/cleanup-worktree-all.sh --yes --force` 실행 권장.