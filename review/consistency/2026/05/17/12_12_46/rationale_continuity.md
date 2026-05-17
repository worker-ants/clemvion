# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
검토 기준: `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md` 및 관련 Rationale 발췌

---

### 발견사항

- **[INFO]** `oauth_invalid_scope` status_reason 신규 값 — 기존 snake_case 컨벤션 정합 확인
  - target 위치: D1 §4.3 / D5.5 §10.4 에러 매핑
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Cafe24 Private 의 callback 실패는 왜 status 를 보존하나" 및 "status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분"
  - 상세: 기존 Rationale 는 `status_reason` 저장값을 `snake_case` 로 표기한다고 명문화하고 있고(`auth_failed`, `token_expired`, `install_timeout`, `oauth_token_exchange_failed` 등), `oauth_` prefix 를 domain 구분용으로 의도적으로 도입했다. target 이 신규로 추가하는 `oauth_invalid_scope` 는 이 컨벤션을 그대로 따른다. 형식 정합에는 문제가 없다.
  - 제안: 현행 그대로 진행 가능. 다만 §10.4 에러 매핑 표에서 기존 `oauth_token_exchange_failed` 와 `oauth_invalid_scope` 가 나란히 보이도록 진입 경로 구분을 한 줄 더 명시하면 미래 검토자의 혼동을 줄일 수 있다.

- **[INFO]** `details.requiresCafe24Approval` 보강 필드 — 신규 에러 코드 없음 원칙 명시 필요
  - target 위치: D1 §4.4 "신규 코드 추가 없음" / D5.4 §9.4 보강 / D6 draft Rationale D5.6·D6.4
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale 내 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명 유지 결정 (의미보다 하위 호환성 우선) 및 `INSUFFICIENT_SCOPE (403)` 처리 경로
  - 상세: target D1 §4.4 가 "신규 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다" 라고 명시하고, D5.6 기각 대안 (B) 로 `CAFE24_APPROVAL_REQUIRED` 신규 에러 코드를 명시적으로 거부한다. 이는 기존 Rationale 의 하위 호환 우선·코드명 변경 최소화 기조와 완전히 일치한다. 추가로 target D5.4 의 `details.missingScopes` 와 `details.requiresCafe24Approval` 두 필드가 `INSUFFICIENT_SCOPE` 에 함께 실리는데, `details.missingScopes` 가 기존 spec 어디에 정의돼 있는지 본 draft 는 명시하지 않는다. 기존 spec 에 이미 있는 필드라면 표기 일관성 확인이 필요하다.
  - 제안: D5.4 에서 `details.missingScopes` 가 기존부터 있던 필드임을 한 줄 명시(혹은 원래 spec 섹션 링크)하면 draft 가 "보강만" 임을 더 명확히 보증한다.

- **[INFO]** catalog `status` enum 과 `restricted` 컬럼의 직교성 — Rationale 에 기각 사유 명시됨
  - target 위치: D3.1 §2 표 컬럼 정의, D7 기각된 대안
  - 과거 결정 출처: D7 "기각된 대안" + D5.6 기각 대안 (C) "catalog 의 `status` enum 에 `restricted` 값 추가"
  - 상세: target 자체가 "supported / planned / deprecated 와 직교 차원이라 enum 확장은 의미 오염" 임을 명시적 기각 사유로 적시한다. 기존 Rationale 에는 `status` enum 확장 거부 판례가 직접 박혀있지 않으나, 기존 컨벤션이 `status` 를 lifecycle 상태로만 쓰는 선례를 따르고 있다. 별도 컬럼 신설은 그 원칙의 자연스러운 연장이다.
  - 제안: target 에 이미 기각 사유가 적시되어 있어 Rationale 정합 보강은 불필요하다. 정상.

- **[INFO]** endpoint 명단 인라인 열거 회피 원칙 — D6.4 Rationale 9.11 에서 재확인됨
  - target 위치: D6.4 Rationale 9.11
  - 과거 결정 출처: `spec/conventions/cafe24-api-metadata.md` §3 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책
  - 상세: D6.4 는 "명단을 직접 enumerate 하지 않는 이유는 drift 방지 (cafe24-api-metadata.md §3 의 정책과 동일)" 라고 명시해 기존 합의 원칙을 능동적으로 인용한다. 충돌 없음.
  - 제안: 불필요. 이 항목은 검토 통과.

- **[INFO]** `level='program'` — Analytics API placeholder 처리 방식 검토
  - target 위치: D1 §3, D2.1 `restrictedApproval.level: 'scope' | 'operation' | 'program'`
  - 과거 결정 출처: 관련 Rationale 에 Analytics API 관련 기존 기각/채택 결정 없음
  - 상세: `level='program'` 은 "현재 직접 호출 경로를 구현하지 않으며 placeholder" 라고 명시한다. D3.2 의 검증 규칙 8 에서도 "`level='program'` 은 본 catalog 와 별개로 다뤄진다" 라고 범위를 한정한다. 기존 Rationale 어디에도 이 analytics 트랙에 대한 명시적 폐기 결정이 없어 재도입 여부를 판단하기 어렵다. 다만 "향후 도입을 위한 placeholder" 이므로 아직 결정 전 상태이며, 채택도 기각도 아닌 보류로 보는 것이 타당하다. 위험은 낮다.
  - 제안: §3 하단에 "본 Analytics placeholder 는 Cafe24 측 계약 후 별도 spec 으로 상세화한다" 한 줄을 추가해 미완 상태임을 명확히 하면 향후 consistency-check 에서 불필요한 CRITICAL 을 방지한다.

---

### 요약

target draft 는 기존 spec Rationale 에서 명시적으로 기각된 결정을 재도입하지 않는다. 핵심 기각 대안 세 가지(차단 정책, 신규 에러 코드 `CAFE24_APPROVAL_REQUIRED`, `status` enum 확장)가 draft 자체의 Rationale 에 재확인·기록되어 있으며, 하위 호환 우선 원칙과 endpoint 명단 비인라인 원칙도 모두 존중된다. `oauth_invalid_scope` 신규 status_reason 값은 기존 `snake_case` + `oauth_` prefix 컨벤션에 정합하고, `details.requiresCafe24Approval` 보강 필드는 신규 에러 코드 없음 방침과 일치한다. 미비 사항은 `details.missingScopes` 출처 명시 누락, Analytics placeholder 의 미완 상태 표기 부재 등 소규모 INFO 수준이며, 설계 원칙이나 합의된 invariant 를 위반하는 항목은 발견되지 않았다.

### 위험도

LOW
