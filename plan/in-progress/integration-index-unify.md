---
name: integration-index-unify
worktree: integration-index-unify-2c7973
status: in-progress
created: 2026-06-04
owner: developer
---

# Plan: Integration store-identifier 인덱스 통일

## 배경 / 문제

cafe24·makeshop 처럼 외부 상점 식별자(`mall_id` 컬럼, cafe24=mall_id / makeshop=shop_uid 투영)를 갖는 통합마다 **service_type 하드코딩 partial 인덱스가 누적**된다:
- UNIQUE: `idx_integration_cafe24_workspace_mall` (V046), `idx_integration_makeshop_workspace_mall` (V071)
- lookup: `idx_integration_cafe24_mall_id_partial` (V051, `(mall_id) WHERE service_type='cafe24'`)

→ Shopify·Naver·마켓플레이스 추가 시마다 (UNIQUE 인덱스 + lookup 인덱스 + `throwIfUniqueViolation` 분기)가 늘어남. **확장 불가**.

사용자 결정(2026-06-04): **인덱스만 통일** (mall_id 컬럼명은 유지 — 리네임은 회귀 위험·범위 큼).

## 설계

**통일 인덱스 2개 (service_type 무관, 고정)**:
```sql
-- UNIQUE: (workspace, service_type, mall_id) — service_type 를 키 컬럼에 포함해
-- (workspace, service, mall_id) 단위 유일성을 단일 인덱스로 보장. 서로 다른 서비스가
-- 같은 mall_id 값을 가져도 무관(정상). V046 + V071 대체.
CREATE UNIQUE INDEX CONCURRENTLY idx_integration_workspace_service_mall
  ON integration (workspace_id, service_type, mall_id) WHERE mall_id IS NOT NULL;
-- lookup: (service_type, mall_id) — tryRecoverByMallId 류 mall_id 검색을 모든 서비스로
-- 일반화. V051 cafe24 전용 lookup 대체.
CREATE INDEX CONCURRENTLY idx_integration_service_mall
  ON integration (service_type, mall_id) WHERE mall_id IS NOT NULL;
```
앞으로 신규 통합 추가 시 **인덱스·마이그레이션 0건**.

**코드**: `integrations.service.ts#throwIfUniqueViolation` 의 인덱스명별 분기(cafe24/makeshop) → 통합 제약명 `idx_integration_workspace_service_mall` 단일 분기 + `Map<serviceType, {code,message}>` 레지스트리로 서비스별 already-connected 에러 매핑 (C-6 레지스트리 패턴 일관). serviceType 은 저장 대상 엔티티에서 전달.

## 산출물
- [x] `migrations/V072__integration_unify_store_identifier_index.sql` (+ .conf, non-transactional): DROP V046/V071 UNIQUE + V051 cafe24 lookup → CREATE 통합 UNIQUE + 통합 lookup
- [x] `integrations.service.ts` `throwIfUniqueViolation` 레지스트리화 (+ serviceType 전달)
- [x] `spec/1-data-model.md §3` 인덱스 표: 3 per-service 행 → 2 통합 행. §2.10 mall_id 비즈니스 규칙 wording 일반화 (+ `spec/data-flow/5-integration.md` 인덱스 정의 V072 갱신)
- [x] `spec/4-nodes/4-integration/4-cafe24.md`·`5-makeshop.md`·`spec/2-navigation/4-integration.md` 의 옛 인덱스명/`V045 partial UNIQUE` 참조 갱신
- [x] 테스트: integrations.service.spec (throwIfUniqueViolation 서비스별 매핑 + serviceType=undefined 케이스), race-backstop 단위 테스트 (cafe24.spec + makeshop.spec), e2e 168/168 통과 (commit 033d9323)
- [x] TEST WORKFLOW + `/ai-review` (ai-review resolution 완료) + `/consistency-check --impl-done`

## 주의
- DROP/CREATE INDEX CONCURRENTLY 는 트랜잭션 밖 — `.conf` `executeInTransaction=false` (V046/V051/V071 패턴).
- 기존 데이터 유일성 불변 보장: 통합 UNIQUE `(workspace, service_type, mall_id)` 는 per-service UNIQUE 들의 합집합과 동일 제약 → 마이그레이션 시 위반 없음.
