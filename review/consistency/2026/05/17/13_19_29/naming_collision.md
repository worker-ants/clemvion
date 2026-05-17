# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/` 구현 착수 전 (--impl-prep)
검토 대상 신규 식별자: `autoRefresh`, `supportsTokenAutoRefresh`, `subLabel` (StatusView), `InfoRow.tooltip`, i18n 키 `integrations.tokenAutoRenews`

---

### 발견사항

- **[INFO]** `supportsTokenAutoRefresh` — ServiceDefinition 신규 옵션 필드, 기존 충돌 없음
  - target 신규 식별자: `ServiceDefinition.supportsTokenAutoRefresh?: boolean` (`backend/src/modules/integrations/services/service-registry.ts`)
  - 기존 사용처: `service-registry.ts` 의 `ServiceDefinition` 인터페이스(line 43~50)에 해당 필드 없음. `SERVICE_REGISTRY` 상수의 `google` / `cafe24` 항목에도 없음.
  - 상세: 기존 `ServiceDefinition` 타입에 `supportsTokenAutoRefresh` 라는 이름의 필드가 존재하지 않으므로 충돌 없음. `oauthProvider`, `scopes` 등 기존 optional 필드와 이름 겹침 없음.
  - 제안: 충돌 없음. 그대로 추가 가능.

- **[INFO]** `autoRefresh` — IntegrationDto derived 필드, 기존 충돌 없음
  - target 신규 식별자: `IntegrationDto.autoRefresh: boolean` (backend `integration-response.dto.ts`, frontend `integrations.ts`)
  - 기존 사용처: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 의 `IntegrationDto` 클래스(line 5~104)에 해당 필드 없음. `frontend/src/lib/api/integrations.ts` 의 `IntegrationDto` 인터페이스에도 없음(line 48~53 필드 목록 확인). 기존 DB 컬럼에도 없음(`spec/1-data-model.md §2.10` — "응답 DTO 전용 derived 필드"로 명시).
  - 상세: 기존 어디에도 `autoRefresh` 식별자가 없으므로 도입 안전. `credentialsStatus`, `statusReason` 등 기존 유사 파생 필드와 이름 겹침 없음.
  - 제안: 충돌 없음. 그대로 추가 가능.

- **[INFO]** `subLabel` — StatusView 인터페이스 신규 optional 필드, 기존 충돌 없음
  - target 신규 식별자: `StatusView.subLabel?: string` (`frontend/src/app/(main)/integrations/_shared/status-badge.tsx`)
  - 기존 사용처: `status-badge.tsx` line 14~19 의 `StatusView` 인터페이스에 `label`, `dotClassName`, `tone`, `detail?` 필드만 있으며 `subLabel` 없음.
  - 상세: `detail` 과 역할이 달라 혼동 가능성이 있으나, `detail` 은 에러/상태 사유 설명용 기존 필드이고 `subLabel` 은 "Auto-renews · next in …" 처럼 주 라벨 옆 보조 라벨로 용도가 구분된다. 이름이 다르므로 충돌은 없음.
  - 제안: 충돌 없음. 단, `detail` 과 의미 차이를 JSDoc 주석으로 명시하면 혼동 방지에 유리함.

- **[INFO]** `InfoRow.tooltip` — 기존 컴포넌트에 optional prop 추가, 충돌 없음
  - target 신규 식별자: `tooltip` prop (`frontend/src/app/(main)/integrations/[id]/page.tsx` 의 `InfoRow` 컴포넌트)
  - 기존 사용처: `page.tsx` line 351의 `InfoRow` 함수 시그니처는 `{ label: string; value: string }` 이며 `tooltip` 없음. 사용 측 호출부(line 263~320) 모두 `tooltip` 없이 사용 중.
  - 상세: 신규 optional prop 추가이므로 기존 호출부와 충돌 없음.
  - 제안: 충돌 없음. 그대로 추가 가능.

- **[INFO]** i18n 키 `integrations.tokenAutoRenews` — 신규 키, 기존 충돌 없음
  - target 신규 식별자: `integrations.tokenAutoRenews` (ko/en 양쪽 i18n dict)
  - 기존 사용처: `frontend/src/lib/i18n/dict/ko/integrations.ts`, `frontend/src/lib/i18n/dict/en/integrations.ts` 에 해당 키 없음(파일 내 grep 결과 없음).
  - 상세: 신규 키이므로 기존 키와 충돌 없음.
  - 제안: 충돌 없음. 그대로 추가 가능.

- **[WARNING]** `needsAttention()` 함수 — 본 PR 범위 밖이지만 `autoRefresh` 가드 누락 상태가 코드상 남아 있음
  - target 신규 식별자: `autoRefresh` (IntegrationDto 필드)
  - 기존 사용처: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` line 95~96 의 `needsAttention()` 함수. 현재 `connected` + `isExpiringSoon` 조건으로만 판정하며 `autoRefresh` 가드가 없음.
  - 상세: spec §2.3 / §2.4 / Rationale "자동 갱신 통합을 attention 술어에서 제외"에 따라 `autoRefresh=true` 인 통합은 만료 임박 분기에서 제외해야 한다. 본 PR 범위 밖(후속 별도 PR)으로 명시되어 있으나, `autoRefresh` 필드가 추가된 후에도 `needsAttention()` 이 갱신되지 않으면 짧은-수명 토큰(cafe24 access_token 2h, google) 에서 거짓 양성 attention 배너가 계속 발생한다. 식별자 충돌은 아니지만, `autoRefresh` 를 참조하지 않는 기존 함수와의 **의미 불일치**가 발생한다.
  - 제안: 후속 PR 계획이 plan에 명시적으로 등록되어 있는지 확인하고, 본 PR 머지 직후 바로 이어지도록 추적 항목을 추가한다. `cafe24-backlog-residual.md` C-3 와의 연동도 확인 권장.

- **[WARNING]** backend `EXPIRING_SOON_INTERVAL` 쿼리 — `autoRefresh` 가드 누락 상태가 코드상 남아 있음
  - target 신규 식별자: `autoRefresh` (IntegrationDto derived 필드 → backend query guard 필요)
  - 기존 사용처: `backend/src/modules/integrations/integrations.service.ts` line 251의 `EXPIRING_SOON_INTERVAL` 상수와 그 주변 쿼리(line 254~275). 현재 `token_expires_at` 임박 조건에 `AND NOT autoRefresh` 가드가 없음.
  - 상세: spec §9.1 Rationale "자동 갱신 통합을 attention 술어에서 제외"에 따라 backend 목록·사이드바 카운트 쿼리도 `AND NOT <autoRefresh 조건>` 을 추가해야 한다. `autoRefresh` 는 DB 컬럼이 아닌 derived 값이므로, 실제 구현은 `ServiceDefinition.supportsTokenAutoRefresh` 기반의 서비스 타입 집합을 WHERE 조건에 포함하는 형태가 될 것이다. 본 PR 범위 밖으로 명시되어 있으나 `autoRefresh` 식별자 추가 후 서버측 쿼리와의 **의미 불일치**가 생긴다.
  - 제안: 후속 PR 범위로 plan에 등록되었는지 확인. `integrations.service.ts:250` 의 `W-32` 공유 상수 추출 이슈와 병합 처리 권고(변경 의도 §본 PR 범위 밖 항목과 정합).

---

### 요약

target(`spec/2-navigation/`) 구현 착수를 위해 도입되는 신규 식별자(`supportsTokenAutoRefresh`, `autoRefresh`, `subLabel`, `InfoRow.tooltip`, `integrations.tokenAutoRenews`)는 기존 코드베이스 어디에도 동일한 이름으로 다른 의미로 사용되지 않으며, CRITICAL 또는 직접적인 충돌은 없다. 다만 `autoRefresh` 필드가 추가된 이후에도 `needsAttention()`(프론트엔드)과 `EXPIRING_SOON_INTERVAL` 쿼리(백엔드)가 갱신되지 않는 기간 동안 **의미 불일치** 상태가 발생한다. 두 항목은 본 PR 범위 밖(후속 PR)으로 명시되어 있으므로 WARNING 등급으로 처리하며, 후속 추적 항목이 plan에 정확히 등록되어 있는지 확인이 필요하다.

---

### 위험도

LOW
