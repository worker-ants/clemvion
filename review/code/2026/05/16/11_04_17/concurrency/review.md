# 동시성(Concurrency) 코드 리뷰

## 발견사항

### **[INFO]** BullMQ jobId dedup 경쟁 조건 수정 — 올바른 방향
- **위치**: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` (파일 40), diff 라인 `-if (source === 'background' && fresh.status !== 'connected')` → `+if (fresh.status !== 'connected')`
- **상세**: 기존 코드는 `source === 'background'` 일 때만 status 검증을 수행했다. BullMQ jobId dedup 특성상 `proactive` 잡이 먼저 enqueue 된 직후 `background` 잡이 동일 jobId 로 `add()` 되면, worker 는 기존 잡의 `source='proactive'` 데이터만 본다. 이 경우 `source !== 'background'` 이므로 status 검증이 우회되어, integration 이 `error`/`expired` 상태임에도 토큰 refresh 가 실행되는 경쟁 조건이 존재했다. 변경 후 source 와 무관하게 `status !== 'connected'` 이면 early-return 하므로 race-safe 해졌다.
- **제안**: 수정 방향이 올바르다. 다만 dedup window 내에 두 잡이 경합할 때 `data` 가 덮어써지지 않는다는 BullMQ 동작을 코드 주석에서 이미 설명하고 있어 가독성이 좋다. 추가 조치 불필요.

### **[INFO]** `CREATE INDEX CONCURRENTLY` 올바른 사용
- **위치**: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.sql` (파일 6), 라인 `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...`
- **상세**: 운영 중인 테이블에 인덱스를 추가할 때 `CONCURRENTLY` 옵션을 사용하여 테이블 잠금 없이 인덱스를 생성한다. `.conf` 파일의 `executeInTransaction=false` 설정도 `CONCURRENTLY` 와 함께 필수 조건이며 올바르게 설정되어 있다 (PostgreSQL 은 CONCURRENTLY 를 트랜잭션 블록 안에서 실행 불가).
- **제안**: 이미 올바르게 처리되어 있다. 추가 조치 불필요.

### **[INFO]** `IntegrationExpiryScannerService` DB 쿼리 변경 — 동시성 영향 없음
- **위치**: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` (파일 10), `enqueueCafe24BackgroundRefresh` 와 `findExpiredIntegrations` 메서드
- **상세**: `lastRotatedAt: Or(LessThan(cutoff), IsNull())` 와 `status: Not(In(['expired', 'error', 'pending_install']))` 쿼리 조건 변경은 각 쿼리가 독립적으로 DB 에서 snapshot 을 읽는 단일 SELECT 이므로 경쟁 조건을 유발하지 않는다. NestJS + BullMQ 아키텍처에서 이 서비스는 단일 스케줄러 컨텍스트에서 실행되며, 읽은 결과를 enqueue 하는 과정은 BullMQ 의 jobId dedup 으로 중복 보호된다.
- **제안**: 추가 조치 불필요.

---

## 요약

이번 변경에서 실질적인 동시성 이슈는 **파일 40의 BullMQ jobId dedup 경쟁 조건 수정** 하나이며, 이미 올바르게 수정되었다. 기존 코드에서 `source` 조건부로만 status 검증을 수행하던 로직이 dedup race 상황에서 reauthorize 흐름을 우회할 수 있었으나, 변경 후 source 무관 검증으로 race-safe 해졌다. `CREATE INDEX CONCURRENTLY` 와 `executeInTransaction=false` 조합도 PostgreSQL 동시성 요건을 충족한다. 나머지 변경(i18n 메시지 영문화, DTO/schema 수정, 마이그레이션 컬럼 추가)은 동시성과 무관하다. 신규 발견 결함은 없으며 기존 결함의 수정이 올바르게 이루어진 것을 확인한다.

## 위험도

LOW
