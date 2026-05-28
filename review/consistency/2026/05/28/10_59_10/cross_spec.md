# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
**검토 일시**: 2026-05-28
**검토자**: cross-spec consistency checker

---

## 발견사항

### [CRITICAL] WH-SC 요구사항 ID 재정의 충돌 — WH-SC-04 / WH-SC-05 의미 변경

- **target 위치**: draft §2, "2.4 §3.2 인증 요구사항 표 — 4 행으로 확장"
- **충돌 대상**: `spec/5-system/12-webhook.md §3.2` (현행), `spec/5-system/15-chat-channel.md:408`
- **상세**:
  - 현행 `spec/5-system/12-webhook.md §3.2` 에서 ID 는 다음과 같이 정의되어 있다.
    - `WH-SC-04` = "인증 실패 시 `401 Unauthorized` 응답"
    - `WH-SC-05` = "Rate limiting (트리거당 분당 최대 요청 수)"
  - draft 의 새 표는 8행으로 확장하면서 동일 ID 에 **다른 의미**를 부여한다.
    - `WH-SC-04` = "AuthConfig.type=`api_key` → 헤더 검증"
    - `WH-SC-05` = "AuthConfig.type=`basic_auth` → Basic 검증"
    - `WH-SC-06` = "인증 실패 시 401 AUTH_FAILED"
    - `WH-SC-07` = "AuthConfig.last_used_at 갱신"
    - `WH-SC-08` = "Rate limiting"
  - `spec/5-system/15-chat-channel.md:408` 은 `WH-SC-04` 를 "인증 실패 시 `401 Unauthorized`" 의미로 **현재** 명시적으로 cross-reference 하고 있다. draft 가 WH-SC-04 의 의미를 api_key 검증으로 바꾸면 chat-channel spec 의 참조가 즉시 오해를 발생시킨다.
  - `spec/conventions/chat-channel-adapter.md:391` 도 `WH-SC-02` 를 cross-reference 하고 있어, ID 번호 체계가 바뀌면 WH-SC-02 의 의미 이동도 연쇄 영향을 준다.
- **제안**:
  - 기존 WH-SC-01~WH-SC-05 를 그대로 보존하고, 신규 행에는 WH-SC-06 이후 (새 번호부터) 부여하거나, 기존 표를 **전면 재정의**로 명시한 뒤 `spec/5-system/15-chat-channel.md` 와 `spec/conventions/chat-channel-adapter.md` 의 cross-reference 를 동시 갱신해야 한다.
  - WH-SC-04 ("인증 실패 → 401") 의 의미는 새 체계에서도 필수이므로, 새 WH-SC-06 으로 병행하여 관리하거나, 기존 WH-SC-04 를 상위 포괄 요구사항으로 유지하고 WH-SC-06 이후로 세부 확장하는 방식을 권장한다.

---

### [CRITICAL] `2-trigger-list.md §2.3.1` 필드 매트릭스와 draft 의 v1 격상이 충돌

- **target 위치**: draft §5.1 — "기존 v1.1 후속 표기였던 'Auth Config | authConfigId | edit (v1.1 후속)' 행을 v1 활성화로 격상 (본 PR)"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §2.3.1` 필드 권한 매트릭스 (현행), `spec/2-navigation/2-trigger-list.md §3` API 표
- **상세**:
  - 현행 `2-trigger-list.md §2.3.1` 매트릭스는 `Auth Config (외부 auth_config 연결) | authConfigId | edit (v1.1 후속)` 으로 명기되어 있다. 이 항목의 비고 열은 "v1 은 Webhook Configuration 의 인라인 `authType` 으로 충분" 이라고 설명한다.
  - draft 는 §5.1 에서 "인라인 4행을 제거하고 Auth Config 행을 v1 으로 격상" 하는데, 이는 현행 매트릭스의 inline `authType` / `hmacHeader` / `hmacSecret` / `bearerToken` 4개 edit 행을 삭제하는 것을 의미한다.
  - 또한 §3 API 표의 PATCH 본문 설명(마지막 블록 참조)은 "`config.authType` / `config.hmacHeader` / `config.hmacSecret` / `config.bearerToken`" 를 부분 갱신 키로 명시하고 있다. draft §5.3 은 이 토큰들을 제거하고 `config.authConfigId` 로 대체한다고 하나, 현행 spec 본문과의 직접 모순이 된다.
  - draft §5.2 에서 `/auth/rotate-secret` endpoint 를 deprecate 하며 "410 GONE" 처리를 명시하지만, 현행 `2-trigger-list.md §3` 은 해당 endpoint 를 "v1.1 예약 (실제 endpoint 신설은 별 spec PR)" 이자 `plan/in-progress/eia-secret-rotation-revoke-api.md` 합의 후 확정으로 처리하고 있다. 즉 아직 미신설 endpoint 를 deprecate 하는 것이 논리적으로 성립하는지, `eia-secret-rotation-revoke-api.md` 계획과 충돌이 없는지 확인이 필요하다.
- **제안**:
  - `2-trigger-list.md §2.3.1` 매트릭스에서 인라인 4행 삭제 + Auth Config 행 격상 변경을 target draft 에 명시적으로 포함하고 갱신한다.
  - `2-trigger-list.md §3` PATCH 본문 설명의 inline 키 참조를 동시 제거하고 `authConfigId` 참조로 교체한다.
  - `/auth/rotate-secret` deprecate 처리를 위해 `plan/in-progress/eia-secret-rotation-revoke-api.md` 관련자에게 영향을 공지하거나, 해당 plan 의 미결 결정 사항이 본 PR 에서 해소됨을 명시한다.

---

### [CRITICAL] `spec/data-flow/10-triggers.md §1.2` 시퀀스 다이어그램과 draft 변경 사이 불일치

- **target 위치**: draft §6.1 — "§1.2 Webhook 진입 sequence diagram 인증 분기 단순화"
- **충돌 대상**: `spec/data-flow/10-triggers.md §1.2` (현행 시퀀스 다이어그램)
- **상세**:
  - 현행 `data-flow/10-triggers.md §1.2` 의 시퀀스에서 `auth_config_id 설정 OR ip_whitelist` 조건은 두 조건을 or 로 묶어 인증 분기 진입을 결정한다. 또한 현행은 `is_active` 체크를 시퀀스 흐름상 SELECT 시 `AND is_active` 로 필터링한다.
  - draft 의 §6.1 변경안은 `trigger.auth_config_id IS NOT NULL` 만 조건으로 두고 `ip_whitelist` 체크를 AuthConfig 내부 분기 ("+ ip_whitelist") 로 이동시키는데, 기존 시퀀스는 `ip_whitelist` 를 상위 조건(OR)으로 처리했다. 이 변경이 명시적으로 "ip_whitelist 만 있고 auth_config_id IS NULL 인 경우"를 어떻게 처리하는지 draft 가 기술하지 않는다 — ip_whitelist-only trigger 는 새 흐름에서 인증 검증이 우회된다.
  - 현행 시퀀스의 응답은 `200 { executionId }` 이지만, webhook spec §WH-RS-01 은 `202 Accepted` 이다. 이는 기존 data-flow spec 내부의 선행 오류이지만, draft 변경안이 이를 수정하지 않으면 불일치가 잔존한다.
- **제안**:
  - `ip_whitelist` 만 있고 `auth_config_id IS NULL` 인 trigger 의 처리 경로를 draft 에 명시한다 (auth_config_id 와 별개 ip_whitelist 분기 보존 여부).
  - draft §6.1 의 변경안에서 `200` → `202` 수정도 포함한다.

---

### [WARNING] `spec/1-data-model.md §2.17` AuthConfig.type 에 `none` 이 현재 없지만 Integration.auth_type 에는 `none` 이 있어 혼동 가능

- **target 위치**: draft §1 — "type 행 갱신: `none` 제거"
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration.auth_type` (현행)
- **상세**:
  - 현행 `spec/1-data-model.md §2.17 AuthConfig.type` 은 `api_key / bearer_token / basic_auth` 로 정의되어 있고 `none` 은 이미 없다. draft 의 "none 제거"는 실제로는 DTO 레이어 정리(백엔드 코드 내 `AUTH_CONFIG_TYPES` 에 `'none'` 이 있다는 전제)임을 명확히 해야 한다 — spec 상으로는 이미 `none` 이 없으므로 "spec 에서 제거"가 아니라 "구현 DTO 정리"가 정확한 표현이다.
  - `spec/1-data-model.md §2.10 Integration.auth_type` 은 `oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none` 을 포함한다. AuthConfig 의 `none` 제거가 Integration 의 `none` 과 혼동될 수 있다. 두 엔티티의 `none` 의미가 다르므로 (Integration.auth_type `none` = 인증 없는 공용 서비스, AuthConfig.type `none` = 의미 없는 row 자체) 명명이 혼동될 여지가 있어 cross-reference 명시가 필요하다.
- **제안**:
  - draft §1 Rationale 에 "spec/1-data-model.md §2.17 에는 이미 `none` 이 없음 — 이 갱신은 DTO·service 레이어 정리" 라고 명시한다.
  - Integration.auth_type 의 `none` 과 별개임을 각주로 추가한다.

---

### [WARNING] `spec/2-navigation/6-config.md §A.2 Bearer Token` 섹션의 "만료 시간" 필드와 draft 마스킹 정책 간 불일치

- **target 위치**: draft §4.3, §4.2 ("Basic Auth sub-section 보강") 및 §1 ("§2.17.1 JSONB 스키마")
- **충돌 대상**: `spec/2-navigation/6-config.md §A.2 Bearer Token` (현행)
- **상세**:
  - 현행 `6-config.md §A.2 Bearer Token` 표에는 "만료 시간 | 토큰 유효 기간 설정 (선택)" 필드가 존재한다.
  - draft §1 의 `§2.17.1 JSONB 스키마` 에서 `bearer_token` config 는 `{ token: string }` 으로 정의하며 만료 시간 필드가 없다.
  - 두 정의가 불일치한다. draft 채택 시 6-config.md 의 "만료 시간" 행은 삭제 또는 명시적 제거가 필요하지만 draft 에서 이를 언급하지 않는다.
- **제안**:
  - draft §4 (6-config.md 변경 목록)에 Bearer Token 섹션의 "만료 시간" 행 삭제를 명시하거나, 만료 시간 지원 여부를 결정해 JSONB 스키마에 추가한다.

---

### [WARNING] `spec/5-system/1-auth.md §4.1` 감사 로그 카테고리와 draft 변경 사이 범위 불일치

- **target 위치**: draft §3.2 — "§4.1 감사 로그 카테고리 표 '설정' 행 갱신"
- **충돌 대상**: `spec/5-system/1-auth.md §4.1` (현행), `spec/data-flow/1-audit.md`
- **상세**:
  - 현행 `1-auth.md §4.1` 의 "설정" 행은 `auth_config.*, llm_config.*` 로 glob 표기되어 있다. draft 는 이를 `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal, llm_config.*` 로 세분화한다.
  - `spec/data-flow/1-audit.md` 가 별도로 audit_log 카테고리를 정의할 수 있으며, 두 파일이 서로 다른 목록을 보유하면 충돌이 된다. draft 의 Side-effect 섹션은 `spec/data-flow/audit.md` 도 영향 영역으로 언급하지만, 구체 변경 내용이 draft 에 포함되어 있지 않다.
  - `auth_config.regenerate` 와 `auth_config.reveal` 은 현재 spec 에 없는 새 action 이다. draft §3.2 가 이를 1-auth.md 에만 추가하고 data-flow/1-audit.md 에는 누락하면 불일치가 된다.
- **제안**:
  - `spec/data-flow/1-audit.md` 의 auth_config 카테고리 갱신을 draft 변경 범위에 명시적으로 포함한다.
  - 두 파일의 카테고리 목록이 일치하도록 cross-check 한다.

---

### [WARNING] `spec/2-navigation/2-trigger-list.md §2.3.1` 에 인라인 hmac/bearer 행이 여전히 "edit" 모드이며, 현행 `12-webhook.md §4.3 Bearer Token` 도 `config.bearerToken` 직접 참조

- **target 위치**: draft §2.5 ("§4 인증 방식 본문 재작성"), §5.1, §5.3
- **충돌 대상**: `spec/5-system/12-webhook.md §4.3 Bearer Token` (현행), `spec/2-navigation/2-trigger-list.md §3` PATCH 노트
- **상세**:
  - 현행 `12-webhook.md §4.3` 는 `config.bearerToken` 을 검증 필드로 명시한다. draft §2.5 재작성 후에는 이 필드 참조가 `AuthConfig.config.token` 으로 이동하지만, 재작성 후 §4.3 의 내용이 완전히 대체되는지 draft 가 명확하지 않다.
  - `2-trigger-list.md §3` 의 PATCH 노트 블록은 `config.bearerToken` 을 부분 갱신 키로 명시하고 있다. draft §5.3 은 이를 제거한다고 하나, Webhook Configuration 카드에서 bearer token 을 직접 PATCH 하는 기능이 사라지면 사용자 흐름상의 공백이 생긴다 — AuthConfig 를 먼저 생성·연결한 뒤 트리거에 bind 해야 하는 두 단계 흐름이 되는 것이 spec 상 명시되어 있어야 한다.
- **제안**:
  - `12-webhook.md §4.3` 의 `config.bearerToken` 참조를 draft §2.5 재작성 시 완전히 대체한다.
  - trigger-list 상세 드로어에서 bearer/hmac 인라인 필드가 사라지고 AuthConfig selector 로 대체되는 UX 흐름을 6-config.md 또는 2-trigger-list.md 의 해당 섹션에서 명시한다.

---

### [WARNING] `spec/conventions/secret-store.md` URI scheme 범위와 AuthConfig 암호화 저장 방식의 분리 경계가 명확하지 않음

- **target 위치**: draft §7.1 ("§1 예시 표 — 변경 없음"), §7.2 ("§4 보안 요구사항 표 아래 신규 단락")
- **충돌 대상**: `spec/conventions/secret-store.md §1 URI Scheme` (현행)
- **상세**:
  - draft §7.1 은 "AuthConfig 의 config JSONB 는 auth-configs 모듈 자체의 AES-256-GCM transformer (Integration 과 공유) 가 처리 — 본 secret-store URI scheme 의 통합 대상 아님" 이라고 기술한다.
  - 그러나 `spec/conventions/secret-store.md §1` 은 URI scheme 의 scope 를 `triggers`, 향후 `auth-configs`, `oauth-clients` 등으로 확장 가능하다고 예시로 열거한다 (`secret://<scope>/<resourceId>/<name>` 의 scope 예: `auth-configs`).
  - 두 정의가 충돌하지는 않지만, `secret-store.md` 의 예시 scope 에 `auth-configs` 가 포함되어 있으면 독자가 AuthConfig.config 가 secret-store 로 관리된다고 오해할 수 있다. draft §7.2 에서 추가하는 "관련 컨벤션" 단락이 이 혼동을 해소하는지 확인이 필요하다.
  - `spec/conventions/secret-store.md §1` 의 scope 예시에서 `auth-configs` 를 제거하거나, "AuthConfig.config 는 별도 transformer 처리 — secret-store 범위 외" 라는 명시적 주석이 없으면 불명확성이 유지된다.
- **제안**:
  - `spec/conventions/secret-store.md §1` URI Scheme 의 scope 예시에서 `auth-configs` 가 listed 될 수 있는 자리에 "AuthConfig.config 는 모듈 transformer 직접 처리이므로 본 scheme 대상 아님" 을 명시하거나, 예시에서 `auth-configs` scope 를 언급하지 않는다.

---

### [INFO] `spec/data-flow/10-triggers.md §2.1 Postgres` 표에 `auth_config` 행이 SELECT 만 명시 — draft 의 UPDATE 추가 필요

- **target 위치**: draft §6.2 — "§2.1 Postgres 표 auth_config 행 갱신"
- **충돌 대상**: `spec/data-flow/10-triggers.md §2.1 Postgres` (현행)
- **상세**:
  - 현행 `data-flow/10-triggers.md §2.1` 의 `auth_config` 행은 "웹훅 인증" 흐름에서 SELECT 만 나열한다. draft §6.2 는 `last_used_at` 의 fire-and-forget UPDATE 행을 추가한다. 이는 추가이지 충돌은 아니지만 draft 에서 명시적으로 기존 행을 유지하면서 신규 행을 추가하는 것인지, 기존 행을 대체하는 것인지 기술 방식이 불명확하다.
- **제안**:
  - draft §6.2 에서 "기존 SELECT 행을 보존하고 UPDATE 행을 별도 추가" 임을 명시하거나, 두 행을 통합하여 `read/write 컬럼` 열에 `SELECT ... / UPDATE last_used_at` 로 병기한다.

---

### [INFO] `spec/2-navigation/6-config.md §A.2` API Key 섹션의 "복사 가능" 표현과 draft 마스킹 정책 간 표기 비일관성

- **target 위치**: draft §4.3 ("마스킹과 Reveal 흐름")
- **충돌 대상**: `spec/2-navigation/6-config.md §A.2 API Key` 현행 ("API Key | 자동 생성 (표시: 마스킹, 복사 가능)")
- **상세**:
  - 현행 6-config.md §A.2 API Key 표는 마스킹된 값의 "복사 가능" 을 명시하고 있다. draft 의 마스킹 정책에 따르면 평문은 create/regenerate/reveal 3 경로에서만 노출되므로, 마스킹 상태에서 "복사 가능" 의 의미가 `***c8a1` 형태의 마스킹 문자열을 복사하는 것인지, 혹은 평문을 복사하는 것인지 모호하다.
- **제안**:
  - draft §4 의 6-config.md 변경 목록에 §A.2 API Key 의 "복사 가능" 설명을 "마스킹 문자열 복사 (평문 복사는 Reveal 흐름)" 로 명확히 하는 갱신을 포함한다.

---

### [INFO] `spec/5-system/12-webhook.md §8 보안 고려사항` "비밀 키 저장" 행의 "향후 암호화 적용" 표현 잔존 — draft 의 §2.6 갱신 필요

- **target 위치**: draft §2.6 — "§7 (현 §8 보안 고려사항) 갱신"
- **충돌 대상**: `spec/5-system/12-webhook.md §8` (현행)
- **상세**:
  - 현행 `12-webhook.md §8` 의 "비밀 키 저장" 행은 "`config.secret`, `config.bearerToken`은 DB에 저장 (향후 암호화 적용)" 이라 기술한다. draft §2.6 이 이 행을 삭제하고 AES-256-GCM 암호화 저장 문장으로 교체하는 것은 올바른 방향이나, 현재 §8 의 섹션 번호가 "8" 인데 draft 에서 "(현 §8 보안 고려사항)" 라고 "(§7 처리 흐름 step 6 재작성)" 와 다른 번호로 표기하는 것이 draft 내 일관성을 해친다. 섹션 번호 참조를 명확히 확인해야 한다.
- **제안**: draft 내 섹션 번호 참조를 현행 spec 의 실제 번호와 일치시켜 혼란을 방지한다.

---

## 요약

본 draft 는 webhook 인증 경로를 `trigger.config` inline 필드에서 `AuthConfig` FK 중심으로 전환하는 구조적으로 올바른 방향의 변경안이다. 그러나 다음 세 영역에서 즉시 수정이 필요한 CRITICAL 충돌이 발견되었다. (1) `WH-SC-04/05` 요구사항 ID 의 의미가 현행 webhook spec 및 chat-channel spec 의 cross-reference 와 충돌한다 — 기존 cross-reference 참조 파일(`15-chat-channel.md`, `conventions/chat-channel-adapter.md`) 이 깨진다. (2) `2-trigger-list.md §2.3.1` 인라인 필드 매트릭스와 draft 의 "v1 격상" 기술 사이에 직접 모순이 있으며, `/auth/rotate-secret` deprecate 는 아직 미신설 endpoint 계획(`eia-secret-rotation-revoke-api.md`)과 조율이 필요하다. (3) `data-flow/10-triggers.md §1.2` 시퀀스에서 `ip_whitelist-only (auth_config_id IS NULL)` 트리거의 처리 경로가 draft 에서 누락되어 기존 동작과의 의도 불일치가 생긴다. WARNING 4건은 Bearer Token 만료 시간 필드 불일치, 감사 로그 카테고리 범위 누락, 인라인 UX 대체 흐름 기술 미비, secret-store 범위 경계 불명확 으로 채택 전 해소가 권장된다.

## 위험도

**HIGH**

---

STATUS: OK
