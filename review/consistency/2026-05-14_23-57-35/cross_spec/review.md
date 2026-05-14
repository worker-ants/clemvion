이제 충분한 정보를 확보했습니다. Cross-spec 일관성 검토를 수행합니다.

---

## 발견사항

---

### 1. **[WARNING]** BullMQ 큐 이름 불일치: `integration-expiry` vs `integration-expiry-scanner`

- **target 위치**: `spec/data-flow/integration.md §1.4` 제목 (`BullMQ \`integration-expiry\``) 및 `§2.2 Redis` 테이블 키 (`integration-expiry`)
- **충돌 대상**: `backend/src/modules/integrations/integration-expiry-scanner.service.ts:16` — `INTEGRATION_EXPIRY_QUEUE = 'integration-expiry-scanner'`
- **상세**: spec §1.4과 §2.2 Redis 테이블은 큐 이름을 `integration-expiry`로 표기하고 있으나, 코드에서는 `integration-expiry-scanner`로 등록·소비한다. spec을 기준으로 구현하면 job이 어떤 worker도 listening하지 않는 큐로 enqueue되어 영구 미처리 상태가 된다.
- **제안**: `spec/data-flow/integration.md §1.4` 제목과 §2.2 Redis 테이블의 큐 이름을 `integration-expiry-scanner`로 정정한다.

---

### 2. **[WARNING]** `connected-expiry` job 알고리즘: spec 두 문서는 "refresh → expire" 기술, 코드는 "threshold 알림 → 0d expire"로 구현

- **target 위치**: `spec/data-flow/integration.md §1.4` mermaid — `alt refresh_token 존재 / Scan->>Prov: refresh token ... else 만료 처리만 / UPDATE status='expired', status_reason='token_expired'`
- **충돌 대상**: 
  - `spec/2-navigation/4-integration.md §6` 전이 테이블 — `connected → expired | 매일 스캐너 또는 노드 실행 중 토큰 갱신 실패 (refresh fail)` → refresh 시도 전제
  - `backend/.../integration-expiry-scanner.service.ts` `run()` 메서드 — OAuth Provider 호출 없음; 대신 `7d/3d/0d` threshold 분류 → `IntegrationExpiryDispatch` 중복 방지 → 알림 발송 → 0d 시 `status='expired'`로 전이 (refresh 없음)
- **상세**: `spec/data-flow/integration.md`의 mermaid와 `spec/2-navigation/4-integration.md §6`은 서로 일치하여 "refresh 시도 후 실패 시 expired 전이"를 기술한다. 그러나 실제 코드는 refresh를 전혀 시도하지 않고 threshold 기반 사전 알림(7d/3d) + 만료 시점(0d) 자동 전이 방식을 구현한다. spec대로 구현하면 기존 threshold 알림 체계가 완전히 소실되는 별도 시스템이 만들어진다.
- **제안**: 두 spec 중 하나를 선택해 정렬한다. 코드가 정답이라면 `spec/data-flow/integration.md §1.4` mermaid를 threshold(7d/3d/0d) + 알림 발송 + 0d 만료 흐름으로 재작성하고, `spec/2-navigation/4-integration.md §6`의 `connected → expired` 설명에서 "(refresh fail)"을 제거한다. 반대로 refresh 로직이 필요하다면 코드를 먼저 수정하고 spec을 확정해야 한다.

---

### 3. **[WARNING]** `IntegrationExpiryDispatch` 엔티티 미문서화 — spec §2.1 Schema 매핑과 `spec/1-data-model.md` 양쪽에서 누락

- **target 위치**: `spec/data-flow/integration.md §2.1 Postgres` — `integration`, `integration_usage_log`, `integration_oauth_state` 3개 테이블만 기술
- **충돌 대상**: `backend/.../entities/integration-expiry-dispatch.entity.ts` — `integration_expiry_dispatch` 테이블 실존; UNIQUE `(integration_id, threshold, token_expires_at)` 제약으로 알림 중복 발송 방지; `spec/1-data-model.md`에도 정의 없음
- **상세**: scanner의 `claimThreshold()` 로직은 `IntegrationExpiryDispatch` INSERT의 23505(유니크 위반)를 이용해 동일 threshold + 만료시각에 대한 중복 알림을 원자적으로 방지한다. 이 테이블 없이 구현하면 스캐너 재실행 시 동일 사용자에게 알림이 중복 발송되며, 재시도(BullMQ `attempts=3`) 시에도 매번 알림이 나간다. spec이 이를 문서화하지 않아 구현자가 해당 테이블의 존재를 모를 수 있다.
- **제안**: `spec/data-flow/integration.md §2.1`에 `integration_expiry_dispatch` 테이블과 UNIQUE 제약을 추가하고, `spec/1-data-model.md`에도 엔티티 정의를 추가한다.

---

### 4. **[WARNING]** `statusReason` 불일치: spec 두 문서는 `token_expired`, 코드는 `null`

- **target 위치**: `spec/data-flow/integration.md §3.2 status_reason 매핑` — `expired → token_expired, refresh_failed, install_timeout`; `§1.4 mermaid` — `UPDATE integration SET status='expired', status_reason='token_expired'`
- **충돌 대상**: 
  - `spec/1-data-model.md §2.10` Integration 엔티티 — `status_reason: expired → token_expired / refresh_failed / install_timeout`
  - 코드 `run()` method 224~227행: `integration.status = 'expired'; integration.statusReason = null`
- **상세**: `spec/data-flow/integration.md §3.2`와 `spec/1-data-model.md §2.10`는 모두 스캐너가 connected → expired 전이 시 `status_reason='token_expired'`를 기록해야 한다고 명시한다. 그러나 코드는 0d threshold에서 `statusReason = null`을 설정한다. 이로 인해 스캐너 만료 후 사용자가 에러 원인을 판단하는 UI(`status_reason` 표시) 경로가 spec과 다르게 동작한다.
- **제안**: 코드가 정답이라면 spec §3.2와 §1.4 mermaid에서 스캐너 경로의 `status_reason='token_expired'`를 `null`로 수정한다. 반대로 `token_expired`가 의도라면 `run()` 0d 처리 분기에 `statusReason = 'token_expired'`를 추가해야 한다.

---

### 5. **[INFO]** `connected-expiry` 조회 조건: spec `status='connected'` vs 코드 `NOT IN ('expired', 'error')`

- **target 위치**: `spec/data-flow/integration.md §1.4` Job 역할 설명 — `status='connected' AND token_expires_at < now+Δ`
- **충돌 대상**: 코드 `run()` — `Not(In(['expired', 'error']))` (즉 `pending_install` 포함)
- **상세**: 코드의 필터가 더 넓어 `pending_install` 상태 행도 스캔 대상에 포함된다. 실질적 영향은 낮다 — `pending_install` 행은 통상 `tokenExpiresAt`이 null이라 `continue` 처리된다. 그러나 spec과의 명시적 차이가 존재한다.
- **제안**: spec §1.4 조건을 코드와 일치하도록 `status NOT IN ('expired', 'error')` 로 수정하거나, 코드에서 `status='connected'` 필터를 추가해 spec과 일치시킨다.

---

## 요약

`spec/data-flow/integration.md`는 BullMQ 큐 이름(§2.2), `connected-expiry` job의 refresh 알고리즘(§1.4 mermaid), `statusReason` 값(§3.2) 세 곳에서 현행 코드와 상충한다. 이 중 알고리즘 불일치(Finding 2)는 `spec/2-navigation/4-integration.md §6`과도 함께 얽혀 있어 두 spec이 refresh 흐름을 기술하는 반면 코드는 threshold 알림 흐름을 구현하고 있다는 점에서 cross-spec 정합 문제이기도 하다. 또한 `integration_expiry_dispatch` 테이블(Finding 3)이 spec/data-flow와 spec/1-data-model 모두에서 빠져 있어 구현자가 중복 알림 방지 로직을 놓칠 위험이 있다. 구현 착수 전 알고리즘 의도(refresh 도입 여부)를 결정하고, 큐 이름과 schema 매핑 두 곳의 spec을 코드 현실에 맞게 정정해야 한다.

## 위험도

**MEDIUM** — 큐 이름 오류는 즉각적 기능 단절을 유발하고, 알고리즘 불일치는 구현 결과물이 기존 코드와 다른 시스템이 될 수 있다. schema 누락은 재시도 시 중복 알림 버그로 이어진다.