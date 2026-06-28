# 신규 식별자 충돌 검토 결과

## 발견사항

### 요약 선행

target draft 가 도입하는 두 신규 식별자 (`INTEGRATION_INVALID_SERVICE` 에러 코드, `serviceType` DTO 필드)를 spec 코퍼스 전체와 대조한 결과, **CRITICAL 또는 WARNING 수준의 충돌 없음**. 단, 동일 endpoint(`POST /api/integrations/preview-test`)의 `service` 필드가 **다른 endpoint (`POST /api/integrations/oauth/begin`) 에서 같은 개념에 동명 필드로 계속 사용 중**임을 확인했으며, 이 비일관성은 target 변경 이전부터 존재하는 현상이고 target 변경 자체가 그것을 악화시키지는 않는다.

---

### 1. 에러 코드 `INTEGRATION_INVALID_SERVICE` — 충돌 없음 (INFO)

- **[INFO]** `INTEGRATION_INVALID_SERVICE` 가 §9.4 에러 카탈로그의 기존 코드들과 의미상 중복되지 않음
  - target 신규 식별자: `INTEGRATION_INVALID_SERVICE` (400)
  - 기존 사용처: `spec/2-navigation/4-integration.md` §9.4에는 `INTEGRATION_IN_USE` (409), `INTEGRATION_TEST_FAILED` (422), `INTEGRATION_INCOMPLETE`, `INTEGRATION_CREDENTIALS_UNREADABLE`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_CALL_FAILED` 가 이미 등재되어 있음
  - 상세: `INTEGRATION_INVALID_SERVICE` 는 "지원하지 않는 serviceType/authType 조합" 을 거부하는 guard 전용 코드로, 기존 코드들과 의미 영역이 겹치지 않는다. `INTEGRATION_TYPE_MISMATCH` 는 "노드가 참조한 Integration 의 service_type 이 노드 기대와 불일치"(§12.3)이며, `INTEGRATION_INVALID_SERVICE` 는 "create/preview-test 요청 자체의 serviceType+authType 조합이 service registry 에 미등록"이다 — 다른 계층·다른 맥락.
  - 제안: 충돌 없음. 등재 위치(§9.4)도 적절하다.

### 2. `serviceType` DTO 필드 — `service` 필드와의 혼동 가능성 (WARNING)

- **[WARNING]** `preview-test` body 필드가 `serviceType` 으로 변경되면, 동일 도메인 내 `oauth/begin` body 의 `service` 필드(동일 의미)와 명명이 달라 혼동 유발 가능
  - target 신규 식별자: `POST /api/integrations/preview-test` body 필드 `serviceType` (`PreviewTestDto`)
  - 기존 사용처: `spec/2-navigation/4-integration.md` §9.2 line 804 — `POST /api/integrations/oauth/begin` body `{ service, scopes[], mode, integrationId? }` 에서 `service` 필드가 동일한 "서비스 유형(예: cafe24, google)" 개념을 전달함. 같은 §9.2 블록 line 809 에서 `preview-test` 만 `serviceType` 으로 분기됨
  - 상세: `OAuthBeginDto.service` (= `oauth/begin`) 와 `PreviewTestDto.serviceType` (= `preview-test`) 은 의미상 동일한 "서비스 종류 식별자"를 전달하지만 필드명이 다르다. target 변경 자체는 코드 SoT(`PreviewTestDto` 실제 필드명 `serviceType`)에 spec 을 맞추는 것이므로 정당하다. 그러나 **같은 §9.2 API 표 안에서 두 endpoint 가 동일 개념에 다른 이름을 사용**하는 비일관성이 강조된다. 이 비일관성은 target 이 만든 것이 아니라 `OAuthBeginDto.service` 가 원래부터 `service` 를 썼던 것이 원인이며, target 이 `PreviewTestDto` 의 실제 필드명을 spec 에 반영하면서 이 차이가 spec 에 시각화될 뿐이다.
  - 제안: 현재 target 변경 자체는 승인 가능하다. 단, spec §9.2 `preview-test` 행 주석 또는 `OAuthBeginDto` 행 주석에 "※ `oauth/begin` 은 `service` 필드(OAuthBeginDto), `preview-test` 는 `serviceType` 필드(PreviewTestDto) — 동일 개념이나 두 DTO 가 독립적으로 발전해 필드명이 다름" 을 인라인 노트로 추가하면 이후 독자 혼동을 방지할 수 있다. `OAuthBeginDto.service` 를 `serviceType` 으로 rename 하는 것은 별도 breaking-change PR 이므로 본 변경 범위 밖.

### 3. API endpoint `POST /api/integrations/preview-test` — 충돌 없음 (INFO)

- **[INFO]** endpoint 자체(method + path)는 기존에 이미 정의된 것이며, target 은 신규 endpoint 를 추가하지 않는다
  - 상세: target 변경 2는 기존 endpoint 의 body 필드명 표기(`service` → `serviceType`)를 수정하는 것이며, 새 endpoint 를 추가하지 않는다. 기존 spec line 809에 이미 `POST /api/integrations/preview-test` 가 정의되어 있다. 충돌 없음.

### 4. `error-codes.md` 미등재 결정 — 충돌 없음 (INFO)

- **[INFO]** target 이 `INTEGRATION_INVALID_SERVICE` 를 `spec/conventions/error-codes.md` 에 등재하지 않기로 한 결정은 해당 문서의 자기 규정(명명 규율 전용, §3 = 원칙 위반 예외 레지스트리)과 정합함
  - 상세: `error-codes.md` §3 에는 명명 원칙(§1)을 따르지 않는 기존 historical artifact 코드만 등재된다. `INTEGRATION_INVALID_SERVICE` 는 의미 기반 `UPPER_SNAKE_CASE` 명명(§1)을 준수하는 정상 코드이므로 §3 등재 대상이 아니다. 기존 `INTEGRATION_*` 코드도 `error-codes.md` §3 에 없고 §9.4 에만 있으며 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 만 historical artifact 로 §3 에 있는 것과 일관된다. 충돌 없음.

### 5. 파일 경로 충돌 — 없음 (INFO)

- **[INFO]** target 변경이 적용되는 파일 `spec/2-navigation/4-integration.md` 는 기존 파일 경로 컨벤션(`N-name.md`) 을 유지하며, 신규 파일을 생성하지 않는다. 충돌 없음.

---

## 요약

target draft 가 도입하는 두 신규 식별자(에러 코드 `INTEGRATION_INVALID_SERVICE`, DTO 필드 `serviceType`)는 기존 spec 코퍼스와 의미 충돌이 없다. `INTEGRATION_INVALID_SERVICE` 는 §9.4 기존 INTEGRATION_* 코드들과 의미 영역이 명확히 분리되고, `serviceType` 은 `PreviewTestDto` 의 실제 코드 SoT 를 그대로 반영하는 것이다. 다만 동일 §9.2 API 표 안에서 `oauth/begin` 이 여전히 `service` 필드를 사용하는 반면 `preview-test` 만 `serviceType` 을 사용하게 되어, 독자가 두 필드명의 의미 동일성을 알기 어려울 수 있다. 이는 target 변경이 만든 새 충돌이 아니라 기존부터 존재하는 두 DTO 간 명명 불일치이며 target 이 코드 진실을 spec 에 반영하면서 가시화된 것이다. 블로킹 문제는 없으며, §9.2 표에 인라인 노트를 추가하면 혼동 위험을 예방할 수 있다.

## 위험도

LOW
