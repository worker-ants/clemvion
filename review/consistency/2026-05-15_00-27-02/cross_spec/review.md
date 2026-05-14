`spec/1-data-model.md`를 기준으로 제공된 관련 spec 문서들과의 cross-spec 일관성을 점검합니다.

---

## 발견사항

### **[INFO]** `(workspace_id, status)` 인덱스 — TTL 스캐너 용도로 비효율적

- **target 위치**: `spec/1-data-model.md` §3 인덱스 전략  
  ```
  Integration | (workspace_id, status) | … `pending_install` TTL 스캐너 조회 …
  ```
- **충돌 대상**: 없음 (스펙 내부 정합성 문제)
- **상세**: TTL 스캐너(`pending-install-ttl` job)는 모든 워크스페이스를 가로질러 `status='pending_install'` 행을 조회한다. `(workspace_id, status)` 는 leading column 이 `workspace_id` 이므로, workspace 지정 없는 전역 scan 시 PostgreSQL 이 index 를 loose scan 으로만 사용하거나 seqscan 으로 fallback 할 수 있다. `(token_expires_at)` 인덱스는 만료 스캐너 전용으로 별도 존재하는데, `install_token_issued_at` 에 대응하는 전용 인덱스가 없다.
- **제안**: `(status, install_token_issued_at) WHERE status = 'pending_install'` 형태의 부분 인덱스를 추가 검토하거나, 현재 인덱스 설명에서 TTL 스캐너 용도 기술을 제거하여 오해 방지. `integration-expiry-scanner.service.ts` 가 실제로 `workspace_id` 를 선행 조건으로 사용하면 현행 인덱스로 충분하나, 그 전제가 spec 에 명시되어 있지 않음.

---

### **[WARNING]** `mall_id` UNIQUE 제약 — public·private 동시 보유 불가 전제가 근거 없이 서술됨

- **target 위치**: `spec/1-data-model.md` §2.10 Integration `mall_id` 설명 및 §3 인덱스 전략  
  ```
  한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 (public 과 private 동시 보유 불가). V045
  ```
- **충돌 대상**: `spec/2-navigation/4-integration.md §5.8` (Cafe24) — 참조는 있으나 부분 UNIQUE 제약의 비즈니스 근거가 현 data-model spec 에 없음
- **상세**: Cafe24 Private App 과 Public App 은 서로 다른 `app_type` 을 가지며, 기술적으로는 동일 mall 에 대해 두 종류의 인증을 동시에 보유할 수 있다. 현 제약은 이를 SQL 레벨에서 원천 차단하는데, 이 결정의 Rationale(왜 동시 보유를 금지하는가)가 spec 어디에도 기술되어 있지 않다. 향후 Public App 지원 추가 시 제약을 해제해야 할 수도 있으며, 그 시점에 제약 근거가 없으면 의사결정이 어렵다.
- **제안**: `spec/1-data-model.md` §2.10 또는 Rationale 섹션에 "동일 workspace 내 동일 mall 에 대한 public/private 통합 동시 보유가 불필요하거나 혼란을 유발하기 때문에 단일 통합만 허용한다" 는 근거를 1줄 추가. `spec/2-navigation/4-integration.md §5.8` 에도 관련 언급 확인 필요.

---

### **[INFO]** `install_timeout` → `expired` 상태 전이 방향이 불명확

- **target 위치**: `spec/1-data-model.md` §2.10 Integration `status_reason` 필드  
  ```
  expired → token_expired / refresh_failed / install_timeout
  ```
- **충돌 대상**: `install_token_issued_at` 필드 설명 및 `integration-expiry-scanner.service.ts`
- **상세**: `install_timeout` 이 `expired` 상태 아래 분류되어 있어서, TTL 스캐너가 `pending_install → expired (install_timeout)` 전이를 수행함을 암시한다. 그러나 `install_token_issued_at` 필드 설명("TTL 스캐너가 `now - 24h` 와 비교해 만료 판단")에서 전이 대상 상태가 `expired` 임이 명시되지 않고 있다. `integration-expiry-scanner.service.ts` 에서 구현 시 `expired` 가 아닌 다른 상태(예: `error`)로 전이하는 실수가 생길 수 있다.
- **제안**: `install_token_issued_at` 설명에 "만료 시 `status = expired`, `status_reason = install_timeout` 으로 갱신" 한 줄 추가.

---

### **[INFO]** V044 이전 행의 `install_token_issued_at = NULL` fallback — 스캐너 구현 전제 명시 필요

- **target 위치**: `spec/1-data-model.md` §2.10 `install_token_issued_at` 설명  
  ```
  옛 (V044 이전) 행은 NULL — 스캐너가 `created_at` 으로 fallback
  ```
- **충돌 대상**: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` (수정됨)
- **상세**: `created_at` fallback 은 초기에 설치 요청이 많았다면 이미 만료된 `pending_install` 행들이 스캐너 배포 직후 일괄 `expired` 처리될 수 있다. 이것이 의도된 동작인지(오래된 pending_install 은 모두 만료 처리) 아니면 24h 이내 생성된 것만 남겨야 하는지가 spec 상 불명확하다.
- **제안**: fallback 동작에 대해 "V044 이전 행은 `created_at` 기준으로 동일하게 24h TTL 적용(배포 시점에 24h 초과면 즉시 expired 처리)" 또는 "V044 이전 행은 스캐너가 건드리지 않음" 중 어느 쪽인지 1줄 명시.

---

## 요약

`spec/1-data-model.md` 의 V044(`install_token_issued_at`)·V045(`mall_id`) 추가는 다른 영역 spec 과 직접적인 논리 모순은 없다. 동일 변경 세트에서 `spec/2-navigation/4-integration.md`·`spec/data-flow/integration.md` 도 함께 수정되어 cross-spec 정합성은 대체로 유지된다. 다만 `(workspace_id, status)` 인덱스가 TTL 스캐너의 전역 쿼리 패턴과 맞는지 구현 전 확인이 필요하고, `mall_id` 단일 통합 제약의 비즈니스 근거가 spec 어디에도 기술되지 않아 향후 의사결정 시 혼란을 유발할 수 있다. `install_timeout` 전이 대상 상태와 `created_at` fallback 동작도 구현 시 해석 오류 방지를 위해 한 줄씩 명시를 권장한다.

## 위험도

**LOW** — 구현 착수를 차단할 CRITICAL 위배 없음. WARNING 1건(mall_id 제약 근거)은 Rationale 1줄 추가로 해소 가능.