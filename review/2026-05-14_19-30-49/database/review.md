## 발견사항

### [WARNING] `install_token` UNIQUE 제약 미결정 — DB 레벨 보장 부재
- **위치**: `spec/1-data-model.md §3` 인덱스 전략, DRAFT 1D
- **상세**: `install_token`에 대한 UNIQUE 제약 결정이 "운영 시점"으로 defer되어 있고, 현재 스펙에는 부분 인덱스(`WHERE install_token IS NOT NULL`)만 정의됨. 32바이트 hex 랜덤값이라 충돌 확률은 천문학적으로 낮으나, 동시 `oauth/begin` 요청이 동일 값을 발급할 경우 애플리케이션 레벨에서만 감지됨. DB 레벨 보장 없이 `path` 기반 단일 row 조회(`install_token`으로 조회)에 의존하는 구조.
- **제안**: V042 또는 후속 migration에서 `UNIQUE` 제약을 확정할 것. 운영 데이터 기준으로 판단한다면 해당 결정을 plan에 체크박스로 추적해야 함 (현재 누락 상태로 consistency check에서도 지적됨).

---

### [WARNING] `status` Enum에 `pending_install` 추가 — PostgreSQL DDL 주의
- **위치**: `spec/1-data-model.md §2.10`, V042 migration
- **상세**: PostgreSQL에서 `ENUM` 타입에 새 값을 추가하는 `ALTER TYPE ... ADD VALUE`는 **트랜잭션 내에서 실행 불가** (PostgreSQL 12 이하) 또는 제약이 있어 마이그레이션 스크립트 작성 시 주의가 필요함. V042가 이미 적용됐다는 cross_spec 리뷰 내용으로 보아 현재는 처리된 상태이나, spec 문서에는 DDL 제약 관련 주의사항이 없음.
- **제안**: `spec/conventions/migrations.md`에 Enum 확장 시 트랜잭션 분리 원칙을 명시할 것 (이미 적용된 V042는 문제 없음).

---

### [WARNING] `status_reason` 컬럼 의미 범위 확장 — 기존 NULL 가정 코드 영향
- **위치**: `spec/1-data-model.md §2.10 status_reason`
- **상세**: 기존에는 `status='error'`일 때만 `status_reason`이 값을 가졌으나, 이번 개정으로 `status='expired'`(`install_timeout`, `token_expired`, `refresh_failed`)와 `status='pending_install'`(`oauth_token_exchange_failed` 등)에도 적용됨. `status != 'error'`이면 `status_reason IS NULL`을 가정하는 기존 쿼리나 애플리케이션 로직이 있다면 동작이 달라질 수 있음.
- **제안**: 마이그레이션 시 기존 `expired` 상태 행의 `status_reason` 값 확인 필요. `pending_install` 행은 신규이므로 무해하나, 기존 `expired` 행에 `install_timeout`이 소급 적용되지 않도록 주의.

---

### [INFO] V041 `provider_meta` 컬럼 적용 여부 미확인
- **위치**: DRAFT 3D — `spec/data-flow/integration.md §2.1`, consistency review `2026-05-14_18-38-32/cross_spec`
- **상세**: `integration_oauth_state.provider_meta (encrypted JSONB, V041)` 컬럼이 spec에 추가됐으나, V042는 이미 적용된 반면 V041 적용 여부가 여러 consistency check에서 미확인으로 반복 지적됨. 구현에서 `provider_meta`를 사용할 경우 V041이 미적용이면 컬럼 부재로 런타임 오류 발생.
- **제안**: 구현 착수 전 `backend/migrations/V041__*.sql` 파일 존재 및 적용 여부 확인 필수.

---

### [INFO] `(workspace_id, status)` 인덱스 다목적 활용 — 선택성 확인 권장
- **위치**: `spec/1-data-model.md §3` 인덱스 전략
- **상세**: 기존 배지 카운트 용도에서 `pending_install` TTL 스캐너 조회 + 중복 방지 lookup까지 3가지 쿼리 패턴이 동일 인덱스를 공유함. `workspace_id`가 고선택성이라면 문제 없으나, TTL 스캐너 쿼리(`status='pending_install' AND created_at < now - 24h`)는 `(workspace_id, status, created_at)` 복합 인덱스가 더 효율적일 수 있음.
- **제안**: 워크스페이스 당 `pending_install` 행 수가 많지 않다면 현행 인덱스로 충분. 스캐너 쿼리가 전체 workspace를 대상으로 한다면 `(status, created_at)` 또는 `(status, install_token)` 인덱스 추가를 검토.

---

### [INFO] `install_token` 부분 인덱스 — 적절한 설계
- **위치**: `spec/1-data-model.md §3`
- **상세**: `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스는 Cafe24 Private 전용 컬럼이라 대다수 행이 NULL임을 고려한 올바른 설계. 인덱스 크기 최소화 및 조회 효율 모두 양호.

---

### [INFO] `resource_not_found`는 DB에 기록 불가 — 명시적으로 올바르게 처리
- **위치**: `spec/1-data-model.md §2.10 status_reason`
- **상세**: `resource_not_found`가 DB 후보값에서 명시 제외됨 — row가 사라진 케이스에서 UPDATE 불가하므로 올바른 설계. Consistency check CRITICAL C1이 해당 불일치를 DRAFT 3B에서 정정했음.

---

## 요약

데이터베이스 관점에서 가장 중요한 이슈는 두 가지다. 첫째, `install_token`의 UNIQUE 제약이 "운영 시점 결정"으로 defer되어 DB 레벨 중복 방지 보장이 없는 상태이며, 이 결정이 어느 plan에도 추적되지 않아 조용히 누락될 위험이 있다. 둘째, `integration_oauth_state.provider_meta` (V041)의 실제 적용 여부가 여러 consistency check에서 반복 지적됐으나 미확인 상태로, 구현 착수 전 migration 파일 존재 여부 확인이 필수다. `status_reason` 컬럼의 의미 범위 확장(error 전용 → 다상태 지원)은 기존 코드의 NULL 가정에 영향을 줄 수 있으므로 기존 `expired` 행 데이터 점검이 권장된다. 전반적으로 인덱스 설계(부분 인덱스 활용, 단일 row 조회로 O(N) 스캔 제거)는 적절하며 Critical 수준의 DB 위협은 없다.

## 위험도

**LOW**