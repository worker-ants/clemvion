## 발견사항

### [WARNING] DRAFT 3B와 DRAFT 1C 간 `pending_install` status_reason 표기 불일치

- **target 신규 식별자**: `pending_install` 상태의 `status_reason` 후보 코드  
- **DRAFT 1C (`spec/1-data-model.md §2.10`)**: `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found` — **snake_case 명시**  
  (※ 본 컬럼의 값은 DB 저장 컨벤션 전체가 `auth_failed`, `token_expired` 등 snake_case — Rationale 섹션에서도 동일하게 snake_case 강조)  
- **DRAFT 3B (`spec/data-flow/integration.md §3.2`)**: 예시값이 `OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `RESOURCE_NOT_FOUND` — **UPPER_SNAKE_CASE 사용**  
- **상세**: 두 DRAFT 가 동일한 식별자를 서로 다른 케이스 컨벤션으로 표기하고 있다. DRAFT 1C·Rationale·§10.4 모두 "DB 저장값은 snake_case, API 응답은 UPPER_SNAKE_CASE (의도적 분리)" 임을 명시한다. DRAFT 3B 의 UPPER_SNAKE_CASE 는 이 의도와 상충.  
- **제안**: DRAFT 3B 의 pending_install status_reason 예시를 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found` (snake_case) 로 교정.

---

### [INFO] `CAFE24_INSTALL_INVALID_HMAC` 의미 축소

- **target 신규 식별자**: `CAFE24_INSTALL_INVALID_HMAC` (403)  
- **기존 사용처**: `spec/2-navigation/4-integration.md §9.2` — 기존 정의: **"HMAC 불일치 또는 pending 미발견 포함 — 정보 노출 방지"** (두 케이스를 단일 403으로 합산)  
- **draft 의 새 의미**: HMAC 검증 실패만 (토큰 미존재는 `CAFE24_INSTALL_INVALID_TOKEN` 404 로 분리)  
- **상세**: 에러코드 식별자 자체는 재사용이지만 의미 범위가 좁아짐. Rationale 에서 이 분리를 명시적으로 설명하나, `§9.2` 표에서 기존 정의 텍스트를 실제로 교체하는 diff 가 DRAFT 2E 에 포함되어 있으므로 spec 적용 시 함께 처리되면 문제 없음. 다만 해당 에러코드를 참조하는 e2e 테스트·구현 위치가 있으면 "404 케이스를 더 이상 403으로 받지 않는다"는 변경을 함께 반영해야 함.

---

### [INFO] 큐 메시지 `reason` 필드 신규 값

- **target 신규 식별자**: `pending_install_timeout` (queue message reason)  
- **기존 사용처**: `spec/data-flow/integration.md §1.4 OAuth 만료 스캐너` — 기존 큐 메시지에 `reason` 필드가 정의되어 있는지 제공된 코퍼스 내에서 확인 불가 (§1.4 전체 본문이 코퍼스에 없음)  
- **상세**: DRAFT 3C-bis 가 `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` 형태를 제안. 기존 스캐너 큐 메시지가 `reason` 없이 `{ integrationId }` 만 담거나, 다른 reason 값을 이미 사용 중이면 확장 정합성 확인 필요.  
- **제안**: `spec/data-flow/integration.md §1.4` 원문 또는 실 구현 (`backend/src/modules/...integrations.../integration-expiry*`) 에서 기존 큐 메시지 스키마 확인 후, 필요시 backward-compatible 변경 여부 결정.

---

## 요약

DRAFT 내에 실질적인 명명 충돌은 없다. 다만 DRAFT 1C 와 DRAFT 3B 가 동일한 `pending_install` status_reason 코드를 각각 snake_case / UPPER_SNAKE_CASE 로 표기하는 불일치가 WARNING 수준으로 존재한다 — spec 내부 자체 모순이므로 적용 전 DRAFT 3B 의 표기를 snake_case 로 통일해야 한다. 나머지 신규 식별자(`install_token`, `pending_install`, `install_timeout`, `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_LEGACY_PATH`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 등)는 기존 코퍼스에 중복 사용처가 없어 충돌 없음.

## 위험도
**LOW**