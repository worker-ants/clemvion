---
worktree: cafe24-data-model-strengthen-464de9
started: 2026-05-15
owner: developer
---

# Cafe24 Pending Install 데이터 모델 강화 (사용자 결정 3 + 4)

## Context

PR #18 의 follow-up 중 그룹 B (데이터 모델·동시성 강화) 의 두 항목을 한 PR 로 진행. 사용자가 명시적으로 (a) `installTokenIssuedAt` 컬럼 신설 / (b) `mall_id` plain 컬럼 분리 + partial UNIQUE 인덱스 두 옵션 모두 채택.

이 plan 은 `cafe24-pending-polish-followup.md` 그룹 B 의 첫 두 항목을 흡수하며, `cafe24-pending-polish.md` 의 변경 3/4 follow-up 체크박스 중 advisory lock / decrypt 비용 / mall_id plain 컬럼 등 관련 항목을 완료 처리한다.

## 변경 사항

### 결정 3 — `installTokenIssuedAt` TTL 기준 분리

- [x] **V044 마이그레이션**: `integration.install_token_issued_at TIMESTAMPTZ NULL` 추가.
- [x] **Entity**: `installTokenIssuedAt: Date | null` 필드. spec 주석에 "credentials.mall_id 의 plain projection" 와 "옛 행은 NULL → 스캐너 COALESCE fallback" 명시.
- [x] **`createPrivatePendingIntegration`**: 신규 / 재사용 모두 `installTokenIssuedAt = new Date()` 로 갱신.
- [x] **`handleCallback` 성공 분기**: `installTokenIssuedAt = null` 로 install_token 과 함께 클리어.
- [x] **TTL 스캐너 (`expirePendingInstalls`)**: WHERE 절을 `COALESCE(install_token_issued_at, created_at) < cutoff` 로 변경. 옛 행 graceful fallback.

### 결정 4 — `mall_id` plain 컬럼 + partial UNIQUE

- [x] **V045 마이그레이션**: `integration.mall_id VARCHAR(50) NULL` 컬럼 추가 + `COMMENT ON COLUMN`. 트랜잭션 default (`.conf` 없음).
- [x] **V046 마이그레이션**: `CREATE UNIQUE INDEX CONCURRENTLY ON integration (workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL`. `.conf` 에 `executeInTransaction=false`. V045 와 분리 — Flyway 10 은 한 마이그레이션 안에 트랜잭션 + 비트랜잭션 statement 혼재를 금지 (V043 때 동일 패턴 적용).
- [x] **Entity**: `mallId: string | null` 필드 + 주석.
- [x] **`createPrivatePendingIntegration`**: 신규 / 재사용 모두 `mallId = meta.mall_id` 저장. 옛 행 backfill (재사용 분기에서 NULL 이었으면 메우기).
- [x] **`handleCallback` 성공 분기**: cafe24 row 의 `mallId` 가 NULL 이면 `credentials.mall_id` 에서 backfill.
- [x] **In-memory 중복 가드**: `row.mallId ?? row.credentials?.mall_id` fallback 으로 V045 이전 행에도 정확한 비교.
- [x] **SQL UNIQUE 위반 catch**: PG error code 23505 + constraint 이름 매칭으로 동시 INSERT race 를 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 로 변환.

### Spec 갱신

- [x] `spec/1-data-model.md` §2.10: `install_token_issued_at`, `mall_id` 필드 행 추가.
- [x] `spec/1-data-model.md` §3: V045 partial UNIQUE 인덱스 행 추가.
- [x] `spec/2-navigation/4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED mall_id 비교 경로" 를 V045+ 경로로 갱신, "install_token TTL 24h" 단락에 TTL 기준 변경 보강.
- [x] `spec/data-flow/integration.md` §1.4 스캐너 pseudocode (그리고 §2.1 스키마 매핑) 의 TTL 쿼리를 `COALESCE(install_token_issued_at, created_at)` 로 갱신.

### 테스트

- [x] `integration-oauth.service.cafe24.spec.ts`: `installTokenIssuedAt` 설정 / 재사용 시 갱신 / `mallId` plain 컬럼 저장 / 23505 → 409 변환 케이스 추가.
- [x] `integration-oauth.service.spec.ts`: `handleCallback` 성공 시 cafe24 backfill / `installTokenIssuedAt=null` 클리어 케이스.
- [x] `integration-expiry-scanner.service.spec.ts`: TTL 스캐너의 WHERE 절이 COALESCE 사용하는지 검증.

### 운영 참고

- V044 / V045 는 트랜잭션 안에서 실행되는 일반 ALTER (.conf 불필요). V046 은 CREATE INDEX CONCURRENTLY 라 `executeInTransaction=false` `.conf` 동봉. V045 와 V046 분리 사유: Flyway 10 은 한 마이그레이션 안에 트랜잭션 statement (ALTER / COMMENT) 와 비트랜잭션 statement (CONCURRENTLY) 가 섞이면 `Detected both transactional and non-transactional statements within the same migration` 으로 거부한다 (V043 분리 때 동일 학습).
- V045 / V046 배포 시 기존 `pending_install` / `connected` cafe24 행은 `mall_id` 가 NULL — 부분 UNIQUE 인덱스가 비교 대상에서 제외하므로 운영 충돌 없음. ORM save 가 발생할 때 plain 컬럼이 점진적으로 backfill 된다.

## 연관 plan

- `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 B 의 첫 두 항목 흡수 완료.
- `plan/in-progress/cafe24-pending-polish.md` 변경 3/4 의 advisory lock·decrypt 비용·UNIQUE 제약 follow-up 체크박스 완료 처리.
- 사용자 결정 2 (install_token → short-lived JWT) 는 본 PR 의 다음 별도 PR 로 분리.
