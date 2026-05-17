# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
검토 시각: 2026-05-17

---

### 발견사항

- **[WARNING]** `oauth_invalid_scope` 가 기존 `status_reason` 열거에 없음
  - target 위치: D1 §4.3, D5.5 (§10.4 에러 매핑)
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration.status_reason 정의
  - 상세: 데이터 모델의 `status_reason` 허용값 목록은 `error` 계열(`insufficient_scope`, `auth_failed`, `network`, `unknown`), `expired` 계열(`token_expired`, `install_timeout`), `pending_install` 계열(`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`)로 명시되어 있다. draft 의 D1 §4.3 과 D5.5 는 `oauth_invalid_scope` 를 `Integration.status_reason` 으로 기록한다고 기술하나, 이 값은 어느 `status` 버킷에 귀속되는지 명시하지 않으며 기존 데이터 모델 열거에도 없다. 특히 `pending_install` 계열 callback 실패 코드(`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`)와 어떻게 공존 또는 분리되는지 불명확하다.
  - 제안: D1 §4.3 의 상태 전이 명세를 보강해 `oauth_invalid_scope` 가 `status='pending_install'`(callback 실패) 인지, `status='error'`(connected 후 scope 거부) 인지 명시. `spec/1-data-model.md` §2.10 `status_reason` 열거에 `oauth_invalid_scope` 를 추가하거나(pending_install 계열 또는 error 계열), draft D5.5 에서 정확히 어느 버킷인지 규정.

- **[WARNING]** `details.requiresCafe24Approval` 필드 — `last_error` JSONB 스키마와의 관계 미정의
  - target 위치: D1 §4.3, D5.4 (§9.4 공통 응답 포맷)
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration.last_error `{ code, message, at }` 정의
  - 상세: 데이터 모델은 `last_error` 의 형태를 `{ code, message, at }` 로 고정한다. draft D1 §4.3 은 `last_error.details.requiresCafe24Approval: string[]` 를 기록한다고 명시하는데, 기존 스키마에는 `details` 키가 없다. 한편 D5.4 는 `INSUFFICIENT_SCOPE (403)` HTTP 응답의 `details.requiresCafe24Approval` 를 별도로 다루고 있어, DB 컬럼 `last_error` 와 API 응답 `details` 가 혼용되는지 분리되는지 불명확하다.
  - 제안: `last_error` JSONB 스키마를 `{ code, message, at, details?: object }` 로 확장하는 방향을 `spec/1-data-model.md` §2.10 에 반영하거나, DB 저장 시에는 `last_error.details` 를 생략하고 API 응답에서만 `details.requiresCafe24Approval` 를 추가한다는 계층 분리 정책을 draft 에 명시. 어느 쪽이든 데이터 모델 spec 과 동기 갱신 필요.

- **[WARNING]** `level='program'` 항목이 catalog `restricted` 컬럼 값 집합에서 누락
  - target 위치: D1 §3, D2.1 (restrictedApproval.level 정의), D3.1 (restricted 컬럼 정의)
  - 충돌 대상: D3.2 §4 검증 규칙 8, D3.1 §2 컬럼 정의 (동일 draft 내부)
  - 상세: `restrictedApproval.level` 은 `'scope' | 'operation' | 'program'` 세 값을 정의하지만, catalog `restricted` 컬럼은 `scope` / `op` / 빈칸 만 사용한다. D3.2 검증 규칙 8 은 "`level='program'` 은 본 catalog 와 별개로 다뤄진다" 고 후주를 달았으나, 이 경우 `level='program'` 을 가진 메타데이터 row 가 catalog 에 없을 때 `catalog-sync.spec.ts` 가 어떻게 처리하는지(무시? 경고? 오류?) 명시가 없다. 이는 동일 draft 내부의 검증 규칙과 메타데이터 level enum 사이의 긴장이다.
  - 제안: D3.2 검증 규칙 8 에 "level='program' 인 메타데이터는 catalog row 대응 검증 대상에서 제외한다" 는 명시적 예외 조항 추가. 또는 Analytics API placeholder 전용으로 `restricted='program'` 컬럼 값을 catalog 에도 허용하는 방향으로 컬럼 정의 확장.

- **[WARNING]** `INSUFFICIENT_SCOPE (403)` — 기존 에러 코드 어휘 확장 범위 모호
  - target 위치: D5.4 (§9.4 공통 응답 포맷)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §9.4 (기존 `INSUFFICIENT_SCOPE` 정의), `spec/1-data-model.md` §2.10 status_reason `insufficient_scope`
  - 상세: draft D5.4 는 `INSUFFICIENT_SCOPE (403)` 응답에 `details.missingScopes` 와 `details.requiresCafe24Approval` 두 필드를 동시에 담는다고 기술한다. 기존 spec 의 `INSUFFICIENT_SCOPE` 정의에 `details.missingScopes` 가 이미 명시되어 있는지, 혹은 이 필드도 신규 추가인지 draft 에서 명확하지 않다. `details.missingScopes` 가 기존 정의에 없다면 두 필드 모두 신규이며, 기존 spec 과의 충돌 범위가 draft 에 기술된 것보다 넓어진다.
  - 제안: `spec/2-navigation/4-integration.md` §9.4 의 현행 `INSUFFICIENT_SCOPE` 응답 형태를 draft 에 인용해, `details.missingScopes` 가 기존에 있었는지 신규 추가인지 명시. 신규라면 D5.4 의 diff 범위를 `+details.missingScopes` 포함으로 확장.

- **[INFO]** `category` enum 값 `pg_settings` — operation id 집합과 명명 비일관성
  - target 위치: D2.1 (`restrictedApproval.category` 정의), D1 §2 (operation 단위 표)
  - 충돌 대상: D4.4 (`store.md` 영향 row) — 동일 draft 내부
  - 상세: `restrictedApproval.category` 에 `pg_settings` 가 단일 enum 값으로 정의되어 있으나, D1 §2 의 operation 목록은 `Paymentgateway`, `Paymentgateway paymentmethods`, `Financials paymentgateway`, `Naverpay setting`, `Kakaopay setting` 등 여러 하위 영역을 포괄한다. `pg_settings` 라는 단일 범주가 `naverpay_setting`·`kakaopay_setting` 과 별도 category enum 으로 분리되어 있음에도 불구하고, `financials_paymentgateway_get` 을 `pg_settings` 에 묶는지 별도 값으로 두는지 불명확하다. 향후 메타데이터 row 를 작성할 때 category 값 선택 기준이 모호해질 수 있다.
  - 제안: `category` enum 각 값이 어느 operation id 집합에 대응하는지 D2.1 의 주석이나 별도 매핑 표를 추가. 특히 `pg_settings` 가 `paymentgateway_*`·`paymentgateway_paymentmethods_*`·`financials_paymentgateway_get` 을 모두 포괄하는지 명시.

- **[INFO]** `paymentmethods_paymentproviders_list` 누락 처리 방침 — 공식 문서 재검증 전까지 placeholder 표기 권장
  - target 위치: D4.4 (store.md 영향 row 목록 마지막 note)
  - 충돌 대상: 없음 (미래 drift 예방 목적)
  - 상세: draft 는 `paymentmethods_list` / `paymentmethods_paymentproviders_list` 에 대해 "사용자 자료에 명시되지 않았으므로 빈칸 유지" 라고 기술한다. 이는 합리적이나, 향후 `paymentgateway_paymentmethods_*` restricted 집합과 `paymentmethods_paymentproviders_list` 가 연관될 경우 catalog-sync 검증이 누락을 잡지 못할 수 있다.
  - 제안: 해당 row 에 `restricted` 컬럼 빈칸을 유지하되, store.md 에 `<!-- TODO: Cafe24 공식 문서에서 paymentmethods_paymentproviders_list restricted 여부 재확인 필요 -->` 형태의 인라인 주석을 추가해 리뷰 시점에 추적 가능하게 관리.

---

### 요약

이 draft 는 Cafe24 별도 승인 scope·operation 식별을 위한 새로운 메타데이터 레이어를 체계적으로 도입하며, 기존 spec 의 핵심 구조(Integration 엔티티, catalog 패턴, 통합 화면 에러 처리)와 큰 틀에서 정합하다. 다만 두 가지 WARNING 이 즉각 해소되어야 한다. 첫째, `oauth_invalid_scope` 를 `Integration.status_reason` 값으로 사용하려면 `spec/1-data-model.md` 의 공식 열거에 등재하고 어느 `status` 버킷에 귀속되는지 명확히 해야 한다 — 기존 `pending_install` 계열과 충돌 여지가 있다. 둘째, `last_error.details.requiresCafe24Approval` 기록 계획은 현행 `last_error { code, message, at }` 스키마를 벗어나므로, 데이터 모델 spec 갱신을 이번 draft 의 수정 파일 목록(`spec/1-data-model.md`)에 명시적으로 추가해야 한다. 나머지 WARNING/INFO 는 draft 내부 정합성 보강 수준으로, 기존 spec 과의 직접 모순은 아니다.

---

### 위험도

MEDIUM
