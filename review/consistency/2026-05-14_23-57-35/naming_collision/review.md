충분한 정보를 수집했습니다. 명명 충돌 검토를 작성합니다.

---

## Naming Collision Check 결과

**검토 대상**: `spec/data-flow/integration.md` (BullMQ 스케줄러 3분할 반영)
**검토 코퍼스**: spec/, plan/in-progress/, spec/conventions/

---

### 발견사항

#### **[WARNING]** `integration-expiry` vs `integration-expiry-scanner` — 큐 이름 spec-코드 불일치

- **target 신규 식별자**: `integration-expiry` (spec/data-flow/integration.md §1.4, §2.2 Redis 표, §1.1 inline 참조 등 5곳)
- **기존 사용처**:
  - `backend/src/modules/integrations/integration-expiry-scanner.service.ts:16` → `INTEGRATION_EXPIRY_QUEUE = 'integration-expiry-scanner'`
  - `spec/data-flow/0-overview.md:93` → `integration-expiry` (큐 목록 등재 — spec 쪽은 일치하지만 코드와 불일치)
- **상세**: spec 전체가 큐 이름을 `integration-expiry`로 기술하지만, 실제 BullMQ에 등록되는 Redis 큐 이름은 코드에서 `integration-expiry-scanner`이다. 이 둘은 Redis 상에서 서로 다른 키 공간이므로, 운영 중 BullMQ 큐 메트릭을 모니터링하거나 Redis CLI로 큐를 조회할 때 spec을 기준으로 잡으면 `integration-expiry` 큐가 존재하지 않는다. 기능 자체는 코드가 `INTEGRATION_EXPIRY_QUEUE` 상수를 일관되게 사용하므로 실행 오류는 없지만, spec이 현실과 다른 식별자를 기록하고 있다.

- **제안**:
  - (A — 권장) spec 문서 내 `integration-expiry` → `integration-expiry-scanner`로 수정 (§1.4 헤딩, §2.2 Redis 표, §1.1 inline, data-flow/0-overview.md §1.2 큐 목록 포함).
  - (B) 코드의 `INTEGRATION_EXPIRY_QUEUE = 'integration-expiry-scanner'` → `'integration-expiry'`로 변경 + `BullModule.registerQueue` 반영. 단, 이미 운영 환경에 `integration-expiry-scanner` 큐가 존재한다면 마이그레이션 주의 필요.
  - A가 코드 변경 없이 즉시 적용 가능해 리스크가 낮다.

---

#### **[INFO]** 새 job 이름 3종 — 충돌 없음 (확인 완료)

- `connected-expiry`, `pending-install-ttl`, `usage-log-prune` (spec §1.4) ↔ `JOB_CONNECTED_EXPIRY`, `JOB_PENDING_INSTALL_TTL`, `JOB_USAGE_LOG_PRUNE` (코드:28-30): 정확 일치.

#### **[INFO]** 스케줄러 ID 3종 — 충돌 없음 (확인 완료)

- `connected-expiry-daily`, `pending-install-ttl-daily`, `usage-log-prune-daily` (spec §1.4) ↔ `upsertJobScheduler('connected-expiry-daily', ...)` 등 코드 전체 일치.

#### **[INFO]** 레거시 스케줄러 `integration-expiry-daily` 제거 표기 — 충돌 없음

- spec과 코드 모두 동일하게 `removeJobScheduler('integration-expiry-daily')` 참조.

---

### 요약

target 문서가 도입하는 신규 식별자(job 이름 3종·스케줄러 ID 3종·레거시 제거 ID) 중 다른 spec이나 코드와 의미 충돌하는 것은 없다. 단 **큐 이름**만 spec 전반(`integration-expiry`)과 코드(`integration-expiry-scanner`)가 서로 다른 문자열을 사용 중이다. 기능 오류를 낳지는 않으나, 운영 모니터링·문서 참조 시 혼선을 유발하고 `spec/data-flow/0-overview.md`의 큐 목록도 현실과 다르게 기재된다.

### 위험도

**LOW** — 구현 자체는 코드 내부적으로 일관되어 실행 오류 없음. 단 spec-코드 명칭 불일치가 운영 관측성 문서와 엇갈려 혼란을 줄 수 있으므로, spec 수정(선택 A) 또는 코드 수정(선택 B) 중 하나로 구현 착수 전 또는 직후 정렬 권장.