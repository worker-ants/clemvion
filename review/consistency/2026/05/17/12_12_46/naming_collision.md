# 신규 식별자 충돌 검토 — Cafe24 별도 승인 scope/operation 메타데이터

> target: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
> 검토 일시: 2026-05-17
> 점검 대상 식별자: `restrictedApproval`, `restricted`, `requiresCafe24Approval`, `oauth_invalid_scope`, `level` enum(`scope`/`operation`/`program`), `category` enum 8종, 신규 파일 경로

---

### 발견사항

- **[WARNING]** `oauth_invalid_scope` — `Integration.status_reason` 신규 값, 기존 값 명세와 상태 매핑 불일치 가능성
  - target 신규 식별자: `oauth_invalid_scope` (`Integration.status_reason` 의 새 값)
  - 기존 사용처: `spec/1-data-model.md §2.10` `status_reason` 컬럼 정의. 기존 명세에서 `status_reason` 값은 상태(`status`)별로 엄격하게 나뉜다 — `error` 상태의 사유 코드(`insufficient_scope` / `auth_failed` / `network` / `unknown`), `expired` 상태의 사유 코드(`token_expired` / `install_timeout`), `pending_install` 상태의 사유 코드(`oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired`), `connected` 상태 → NULL. 해당 필드 정의 어느 상태 버킷에도 `oauth_invalid_scope` 가 명시되어 있지 않다.
  - 상세: target D5.5 §10.4 에는 `oauth_invalid_scope` 가 `Integration.status_reason` 값으로 추가되며, D1 §4.3 에도 `Integration.status_reason='oauth_invalid_scope'` 로 기재된다. 그런데 데이터 모델(`spec/1-data-model.md`)의 `status_reason` 필드 정의는 이 값을 어떤 `status` 값에 대응시킬지 명시하지 않는다. target D5.5 본문은 "status 는 보존 (재인증으로 회복 가능)"이라 서술하지만, `error` / `expired` / `pending_install` 어느 버킷에 속하는지 불명확하다. `pending_install` 상태의 기존 콜백 실패 코드(`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`)와 명명 패턴은 유사하나, `oauth_invalid_scope` 는 OAuth 흐름 중 scope 거부로 발생하므로 의미 계층이 다르다. `data-model.md` 갱신 없이 spec/conventions 에만 도입되면 두 spec 간 불일치가 생긴다.
  - 제안: `spec/1-data-model.md §2.10` `status_reason` 컬럼 정의에 `pending_install` 또는 `error` 상태 버킷 안에 `oauth_invalid_scope` 를 명시적으로 추가해 status 매핑을 완성한다. target 에서 이미 "status 는 보존"이라 기술하고 있으므로, 재인증으로 회복 가능한 `pending_install` 계열 값으로 분류하거나, 별도 상태 버킷(`error` 안의 새 사유)으로 명시한다.

- **[WARNING]** `details.missingScopes` — `INSUFFICIENT_SCOPE` 에러 응답 신규 필드, 기존 spec 의 `details` 구조와 정합 확인 필요
  - target 신규 식별자: `details.missingScopes: string[]` (D5.4, `INSUFFICIENT_SCOPE (403)` 응답의 보강 필드)
  - 기존 사용처: `spec/2-navigation/4-integration.md §9.4` 에는 `INSUFFICIENT_SCOPE (403)` 기존 설명이 있으며, `spec/1-data-model.md §2.14 NodeExecution.error` 는 `{ code, message, stack? }` 구조로 정의되어 있다. 기존 `Integration.last_error` 는 `{ code, message, at }` 구조다.
  - 상세: target D5.4 에서 `details.missingScopes` 와 `details.requiresCafe24Approval` 을 `INSUFFICIENT_SCOPE` 응답에 추가하는데, 기존 에러 응답의 `details` 구조가 spec 어디에도 정식으로 정의되어 있지 않다. `NodeExecution.error` 는 `{ code, message, stack? }`, `Integration.last_error` 는 `{ code, message, at }` 이며 둘 다 `details` 하위 구조가 없다. `details` 라는 중간 레이어가 어떤 에러 코드에서 발생하는지, 그 스키마가 어디에 정의되는지 기존 spec 에서 찾기 어렵다. 반면 `requiresCafe24Approval` 는 D1 §4.3 에서 `last_error.details.requiresCafe24Approval` 로도 쓰이는데, 이는 `Integration.last_error` 의 `{ code, message, at }` 구조와 맞지 않는다.
  - 제안: `details` 하위 구조를 `spec/5-system/2-api-convention.md` 또는 `spec/2-navigation/4-integration.md §9` 에 공식 정의하거나, `Integration.last_error` 스키마를 `{ code, message, at, details?: Record<string, unknown> }` 로 확장한다는 명시를 `spec/1-data-model.md §2.10` 에 추가한다. `missingScopes` 는 이번에 spec 에 처음 등장하므로, `requiresCafe24Approval` 와 함께 에러 응답 `details` 의 카탈로그에 등재해야 한다.

- **[WARNING]** `category` enum 값 `pg_settings` — catalog/Rationale 의 실제 operation 그룹명과 불일치
  - target 신규 식별자: `restrictedApproval.category` enum 값 `'pg_settings'` (D2.1 인터페이스 정의)
  - 기존 사용처: target D1 §2 표 및 D6 §8.3 에서 실제로 열거되는 제한 operation 은 `Paymentgateway`, `Paymentgateway paymentmethods`, `Financials paymentgateway` 세 그룹으로 나뉜다. D6.2 §8.3 에서는 `paymentgateway_*`, `financials_paymentgateway_get` 을 모두 같은 범주로 묶지만, D2.1 의 `category` 열거에는 `pg_settings` 만 있어 `financials_paymentgateway_get` 의 귀속 범주가 명확하지 않다. catalog `store.md` 의 D4.4 에서도 `Financials paymentgateway` 는 별도 영역으로 열거된다.
  - 상세: `pg_settings` 가 `paymentgateway_*` 와 `financials_paymentgateway_get` 을 모두 포괄하는 값인지, 아니면 `paymentgateway_*` 만 가리키고 `financials_paymentgateway_get` 은 다른 `category` 값(예: `financials_pg`)이 필요한지 명확하지 않다. 이 모호함은 backend 메타데이터 구현 시 `category` 값 부여에 혼란을 줄 수 있다.
  - 제안: `pg_settings` 의 적용 범위를 주석에 명시하거나(`paymentgateway_* + financials_paymentgateway_get 포함`), `financials_paymentgateway_get` 을 별도 `category` 값(예: `financials_pg`)으로 분리한다. 또는 D1 §2 의 "Financials paymentgateway" 영역을 `pg_settings` category 에 포함되는 것으로 명문화한다.

- **[INFO]** `restricted` — catalog 표 컬럼명, 기존 `status` enum 관련 용어와 혼동 가능성
  - target 신규 식별자: `restricted` (catalog 표 컬럼명, 값: `scope` / `op` / 빈칸)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/_overview.md §3` `status` enum 의 내부 검토 기록에 "catalog 의 `status` enum 에 `restricted` 값 추가" 대안이 기각된 것으로 Rationale(D5.6)에 언급된다. 기각 대안으로 명기되어 `restricted` 가 `status` 값으로 오해될 소지가 있다.
  - 상세: target 자체적으로 "별도 컬럼이 정답"이라 설명하여 구분은 되어 있지만, catalog 파일을 처음 보는 개발자 또는 자동 파서가 `restricted` 컬럼을 `status` 의 추가 값으로 혼동하거나 `status: restricted` 로 잘못 기입할 여지가 있다. 특히 D3.3 `§4` 의 검증 규칙 7번("status 가 enum 중 하나: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail")의 `catalog-sync.spec.ts` 파서가 `restricted` 를 `status` 컬럼으로 오독하지 않는지 확인이 필요하다.
  - 제안: `_overview.md §3` status enum 정의 바로 위 또는 `§2` 컬럼 정의 내 `restricted` 항목 설명에 "이 컬럼은 `status` 와 직교(orthogonal)하며, `status` 의 값이 아니다"를 한 줄 명시한다. `catalog-sync.spec.ts` 파서가 `restricted` 컬럼을 `status` 컬럼과 분리하는 로직이 D3.2 검증 규칙 8에 추가되는 것은 적절하다.

- **[INFO]** `restrictedApproval` — `Cafe24OperationMetadata` 인터페이스 신규 필드, 기존 필드명 공간과 충돌 없음 (확인)
  - target 신규 식별자: `restrictedApproval` (D2.1, `Cafe24OperationMetadata` 인터페이스 optional 필드)
  - 기존 사용처: `spec/conventions/cafe24-api-metadata.md §2` 기존 필드는 `responseShape`, `paginated` 등이며, `restrictedApproval` 또는 이와 유사한 이름은 코퍼스 전체에서 발견되지 않는다.
  - 상세: 충돌 없음. optional 필드로 추가되어 기존 구현과 하위 호환된다. 단, `catalog-sync.spec.ts` 에서 `restrictedApproval` 존재 여부를 `restricted` 컬럼과 양방향 검증하는 규칙(검증 규칙 8)이 추가되므로, 기존에 이미 구현된 `paymentgateway_create`, `paymentgateway_update`, `paymentgateway_delete`, `paymentgateway_paymentmethods_list`(D4.4 에 `supported` 상태로 언급) 가 `restrictedApproval` 없이 `restricted: op` 로 표기되면 테스트가 즉시 실패하는 점을 구현 단계에서 유의해야 한다.
  - 제안: 구현 착수 시 `supported` 이면서 `restricted: op` 로 표기되는 기존 store operation 에 대해 backend 메타데이터의 `restrictedApproval` 필드를 동시에 채워야 한다는 점을 D7 영향 요약 또는 D4.4 본문에 명시적으로 강조한다.

- **[INFO]** `requiresCafe24Approval` — `last_error.details` 와 API 에러 응답 두 곳에서 사용, 컨텍스트별 스키마 구조 상이
  - target 신규 식별자: `requiresCafe24Approval` (D1 §4.3, D5.4, D5.5 에서 사용)
  - 기존 사용처: 기존 spec 어디에도 동일 식별자 없음.
  - 상세: 충돌은 없으나 `requiresCafe24Approval` 가 두 컨텍스트에서 동일 이름으로 쓰인다. (1) `Integration.last_error.details.requiresCafe24Approval: string[]` — OAuth callback 에러 기록용 (DB 저장), (2) `INSUFFICIENT_SCOPE` API 응답의 `details.requiresCafe24Approval: string[]` — 노드 실행 중 실시간 응답. 두 컨텍스트에서 같은 이름을 쓰는 것은 일관성 측면에서 좋으나, `Integration.last_error` 의 기존 스키마(`{ code, message, at }`)에 `details` 중첩 구조가 추가된다는 점이 명시되어야 한다(WARNING 2번 항목과 동일 맥락). 이름 자체의 충돌은 없다.
  - 제안: `spec/1-data-model.md §2.10` `last_error` 컬럼 정의에 `details` 하위 확장 스키마를 명시한다.

- **[INFO]** 신규 파일 `spec/conventions/cafe24-restricted-scopes.md` — 경로 및 명명 컨벤션 준수 여부 확인
  - target 신규 식별자: `spec/conventions/cafe24-restricted-scopes.md` (신규 파일 경로)
  - 기존 사용처: `spec/conventions/` 하위 기존 파일: `cafe24-api-metadata.md`, `cafe24-api-catalog/` (디렉토리), `node-output.md`, `conversation-thread.md` 등. 언더스코어 prefix 없는 평문 파일명이 기존 컨벤션에 부합한다 (`CLAUDE.md §명명 컨벤션` — `spec/conventions/*.md` 는 평문 명명).
  - 상세: 충돌 없음. 기존 `cafe24-api-metadata.md` 와 같은 `cafe24-` prefix 패밀리에 속하므로 일관성도 있다. 파일명 자체는 기존 파일과 겹치지 않는다.
  - 제안: 해당 없음.

---

### 요약

신규 식별자 충돌 관점에서 가장 주의가 필요한 사항은 두 가지다. 첫째, `oauth_invalid_scope` 는 `Integration.status_reason` 의 새 값으로 추가되지만, `spec/1-data-model.md §2.10` 의 status_reason 버킷 정의에 포함되어 있지 않아 데이터 모델 spec 과의 불일치가 발생한다. 해당 값을 어느 `status` 상태에 귀속시킬지 명확히 해야 한다. 둘째, `details.missingScopes` / `details.requiresCafe24Approval` 은 기존 `NodeExecution.error` 및 `Integration.last_error` 스키마에 `details` 하위 구조가 없었으므로, 이 확장을 데이터 모델 spec 에 공식화해야 한다. `pg_settings` category 값의 적용 범위 모호성은 구현 단계에서 메타데이터 오기입으로 이어질 수 있는 WARNING 수준의 명확화 필요 사항이다. 그 외 `restrictedApproval`, `restricted`, `requiresCafe24Approval`, 신규 파일 경로는 기존 식별자와 충돌하지 않으며 코퍼스 내 동일 식별자가 다른 의미로 쓰이는 사례가 없다.

---

### 위험도

MEDIUM
