실제 코드베이스 상태를 확인했습니다. 보고서를 작성합니다.

---

## Naming Collision Check 결과

**검토 모드**: spec draft (--spec)  
**대상**: `plan/in-progress/spec-draft-cafe24-pending-polish.md`

---

### 발견사항

#### [WARNING] DRAFT 1C ↔ DRAFT 3B 내부 불일치: `resource_not_found` status_reason 포함 여부

- **target 신규 식별자**: `resource_not_found` (pending_install callback 실패 분기 코드)
- **충돌 위치**: draft 내부 두 섹션 간 모순
  - **DRAFT 1C** (`spec/1-data-model.md §2.10` 패치): `pending_install` 후보값 목록에서 `resource_not_found` **명시적 제외** — "row 자체가 사라진 케이스라 status_reason 갱신이 불가능 — 본 컬럼 후보값에서는 제외"
  - **DRAFT 3B** (`spec/data-flow/integration.md §3.2` 패치): `pending_install` 매핑에 `resource_not_found` **포함** — "`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found` (모두 snake_case...)"
- **상세**: 두 spec이 적용되면 data-model spec과 data-flow spec이 같은 컬럼의 유효값 목록에서 충돌한다. DRAFT 1C의 논리가 정확하다 — row가 사라진 케이스에서는 DB 갱신 대상이 없으므로 `resource_not_found`는 status_reason 컬럼에 저장될 수 없다. DRAFT 3C의 시퀀스 다이어그램 역시 이 케이스에서 DB UPDATE를 표시하지 않아 DRAFT 1C와 정합.
- **제안**: DRAFT 3B의 `pending_install` status_reason 목록에서 `resource_not_found`를 제거. DRAFT 1C의 표현 "§10.4 표에서 '변경 불가' 로만 다루고 본 컬럼 후보값에서는 제외" 기준으로 통일.

---

#### [WARNING] BullMQ 큐 메시지 스키마 변경: `reason` 필드 신규 추가 — 기존 소비자 영향

- **target 신규 식별자**: `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }`
- **기존 사용처**: `spec/data-flow/integration.md:98` — 현재 `integration-expiry` 큐 메시지 스키마는 `{ integrationId }` 단일 필드
- **상세**: DRAFT 3C-bis가 도입하는 `reason` 필드는 기존 큐 소비자(`integration-expiry-scanner.service.ts`)가 처리하지 않는 신규 필드다. `reason` 없이 들어온 기존 잔여 메시지나 스키마 변경 전 enqueue된 메시지를 소비자가 어떻게 처리할지 — 기본값 fallback(`'token_expiring'`) 또는 분기 없이 처리 — 가 draft에 명시되어 있지 않다.
- **제안**: DRAFT 3C-bis 본문에 "기존 `reason` 없는 메시지는 `'token_expiring'` 분기로 fallback" 또는 "V043 이후 메시지부터 `reason` 필드 필수" 중 선택해 명시. 큐 스키마 단절 여부는 구현 단계에서 migration plan으로 처리.

---

#### [INFO] `pending_install` — 코드에는 존재, spec에 미등재

- **위치**: `backend/src/modules/integrations/entities/integration.entity.ts:20` — `IntegrationStatus` 타입에 `pending_install` 이미 존재
- **draft 처리**: DRAFT 1A가 `spec/1-data-model.md §2.10`에 정확히 추가
- **충돌 없음**: 코드와 spec 동기화 작업으로 올바름.

---

#### [INFO] `CAFE24_INSTALL_REPLAY`, `CAFE24_INSTALL_INVALID_HMAC` — 코드에 이미 존재

- **위치**: `backend/src/modules/integrations/integration-oauth.service.ts:680, 712`
- **draft 처리**: 두 코드 모두 보존. `CAFE24_INSTALL_INVALID_HMAC`는 의미를 "HMAC 불일치만"으로 축소하고 토큰 미존재 케이스는 신규 `CAFE24_INSTALL_INVALID_TOKEN`(404)으로 분리. 올바른 분리.
- **충돌 없음**.

---

#### [INFO] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` — 기존 유사 코드들과 명명 패턴 확인

- **기존 유사 식별자**: `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED` (line 170), `CAFE24_PRIVATE_APP_USE_TEST_RUN` (line 181) — `integration-oauth.service.ts`
- **신규**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`
- **의미 차별화**: credentials 누락 / test run 안내 / 중복 연결 차단 — 각각 다른 조건, 충돌 없음. 명명 패턴(`CAFE24_PRIVATE_APP_*`) 일관성 유지.

---

### 요약

외부 식별자 충돌(기존 코드·spec과의 명명 충돌)은 발견되지 않았다. 신규 도입 식별자 — `install_timeout`, `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_LEGACY_PATH`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`, `pending_install_timeout`, `token_expiring` — 는 모두 코드베이스 전체에서 0건으로 충돌 없이 도입 가능하다. 단, **draft 내부에서 `resource_not_found`를 status_reason 후보값으로 포함할지 여부가 DRAFT 1C와 DRAFT 3B 사이에 모순**되어 있으며, 정합성을 위해 DRAFT 3B에서 제거가 필요하다. BullMQ 스키마 변경은 명명 충돌이 아니라 하위 호환성 이슈로 구현 단계 처리 사항이나 draft에 명시 권장.

### 위험도

**LOW** — 외부 충돌 없음. 내부 draft 불일치 1건(DRAFT 3B `resource_not_found` 포함) 수정 권장.