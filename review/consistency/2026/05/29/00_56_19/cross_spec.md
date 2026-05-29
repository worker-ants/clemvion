# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep`
- 대상 영역: `spec/5-system/`
- 검토 일시: 2026-05-29

---

## 발견사항

### [INFO] spec/5-system/1-auth.md — LoginHistory 이벤트 enum 과 데이터 모델의 표기 미세 차이

- **target 위치**: `spec/5-system/1-auth.md §4.3` — LoginHistory 이벤트 목록
- **충돌 대상**: `spec/1-data-model.md §2.18.2` — LoginHistory 테이블 정의
- **상세**: auth.md §4.3 의 이벤트 설명 표에서는 `login_success` 이벤트의 설명을 "비밀번호 또는 OAuth 로그인 성공"으로 기술하지만, data-model.md §2.18.2 의 `event` enum 목록에는 이벤트 값과 failure_reason 이 모두 나열되어 있다. 두 문서 간 실질적 모순은 없으나 auth.md §4.3 의 보존 정책("180일") 기술과 data-model.md §2.18.2 의 보존 정책("180일 경과 row는 일일 배치로 자동 삭제") 이 동일하게 정의되어 있어 현재는 일관적이다.
- **제안**: 현재 일치. 변경 없이 구현 가능.

---

### [INFO] spec/5-system/12-webhook.md — AuthConfig.type 열거 vs 데이터 모델 AuthConfig.type Enum

- **target 위치**: `spec/5-system/12-webhook.md §3.1` — 인증 항목 서술 `(none = auth_config_id IS NULL / api_key / bearer_token / basic_auth / hmac)`
- **충돌 대상**: `spec/1-data-model.md §2.17` — `AuthConfig.type` Enum: `api_key / bearer_token / basic_auth / hmac`
- **상세**: webhook 스펙이 `none` 을 마치 AuthConfig.type 의 하나처럼 나열하지만 (`none = auth_config_id IS NULL`), 데이터 모델 §2.17.3 Rationale 에서 명시적으로 "`none` 미포함 (의도): AuthConfig.type 에는 `none` 이 없다"고 설명한다. 괄호 내 설명으로 "IS NULL 인 경우"임을 부연하고 있어 혼동 여지가 있다.
- **제안**: 구현 시 주의가 필요하나 실질적 모순은 아님. 구현에서 `auth_config_id IS NULL` 체크와 `AuthConfig.type` enum 분기를 분리하면 충분하다.

---

### [INFO] spec/5-system/11-mcp-client.md §3.1 — `auth_type='none'` 이 Integration.auth_type 에만 존재하고 AuthConfig.type 과는 별개

- **target 위치**: `spec/5-system/11-mcp-client.md §3.1` — `Integration.auth_type: bearer_token / api_key / none`
- **충돌 대상**: `spec/1-data-model.md §2.17` — AuthConfig.type 과 §2.10 Integration.auth_type 는 별개 도메인
- **상세**: MCP spec 이 `auth_type='none'` 을 Integration 도메인에서 사용하는 것은 data-model §2.10 에 명시된 대로 유효하다. data-model §2.17.3 Rationale 에서 "AuthConfig 는 row 부재 = 인증 없음, Integration 은 row 존재 + auth_type=none" 으로 의도적 분리임을 명문화하고 있다. 두 도메인의 TypeScript 타입을 `AuthConfigType` / `IntegrationAuthType` 으로 분리하라는 지침도 있다.
- **제안**: 구현 시 `AuthConfigType` 유니온과 `IntegrationAuthType` 유니온을 별도로 정의하고 혼용하지 않을 것.

---

### [INFO] spec/5-system/1-auth.md §5 API 목록 — `POST /api/workspaces/invitations/accept` 경로 vs 사용자 프로필 spec 상호 참조

- **target 위치**: `spec/5-system/1-auth.md §5` — "초대 발송·재발송·취소·수락 엔드포인트는 사용자 프로필 spec §6.1 에 정의 (`/api/workspaces/:id/invitations`, `/api/workspaces/invitations/accept`)"
- **충돌 대상**: `spec/5-system/1-auth.md §1.5.3` — 흐름에서 `POST /api/workspaces/invitations/accept { token }` 으로 기술
- **상세**: auth.md §5 의 API 목록 자체는 해당 엔드포인트를 직접 정의하지 않고 사용자 프로필 spec으로 위임한다. §1.5.3 내부 흐름과 §5 위임 선언 사이에 불일치는 없다. 다만 현재 검토 범위(`spec/5-system/`)에서 구현 시 엔드포인트 정의 진실 소스가 외부 spec(`spec/2-navigation/9-user-profile.md §6.1`)에 있음을 인지해야 한다.
- **제안**: 구현 착수 전 `spec/2-navigation/9-user-profile.md §6.1` 를 함께 참조할 것.

---

### [INFO] spec/5-system/10-graph-rag.md §6 — WebSocket 채널명 불일치 가능성

- **target 위치**: `spec/5-system/10-graph-rag.md §6` — "채널은 `kb:{documentId}` (`spec/5-system/8-embedding-pipeline.md §8` 과 동일)"
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §8` — 임베딩 파이프라인 WebSocket 채널 정의
- **상세**: graph-rag.md 가 embedding-pipeline.md §8 을 채널 정의의 단일 진실로 참조하며 동일 채널을 공유한다고 명시한다. 두 spec 이 동일 `kb:{documentId}` 채널에 이벤트를 공유한다면 클라이언트 구독 시 embedding 이벤트와 graph 이벤트가 혼합된다. 이는 의도적 설계로 spec 간 모순이 아니지만, 구현 시 이벤트 타입 prefix (`document:embedding_*` vs `document:graph_*`) 로 필터링해야 함을 코드 레벨에서 명확히 해야 한다.
- **제안**: 구현 시 각 이벤트 타입 prefix 를 혼용하지 않도록 주의.

---

### [WARNING] spec/5-system/12-webhook.md §2.1 — camelCase 필드명 vs 데이터 모델 snake_case 표기 혼용

- **target 위치**: `spec/5-system/12-webhook.md §2.1` — 기존 엔티티 활용 표에서 `isActive`, `endpointPath`, `authConfigId`, `workflowId`, `lastTriggeredAt` 를 camelCase 로 표기
- **충돌 대상**: `spec/1-data-model.md §2.8` — Trigger 엔티티 필드를 `is_active`, `endpoint_path`, `auth_config_id`, `workflow_id`, `last_triggered_at` 으로 snake_case 표기
- **상세**: webhook.md 의 "기존 엔티티 활용" 표가 camelCase 로 필드를 기술하고 있으나, 데이터 모델 spec 은 snake_case 로 정의한다. 동일 엔티티의 동일 필드를 같은 spec 영역 내에서 두 가지 표기로 혼용하면, 구현 시 DB 컬럼 이름과 API DTO 이름을 혼동할 수 있다. webhook.md §3.1 의 API 명세에서는 다시 snake_case 를 사용하는 혼재가 있다.
- **제안**: `spec/5-system/12-webhook.md §2.1` 의 표 헤딩을 snake_case(DB 레벨) 표기로 통일하거나, camelCase 표기가 DTO 레벨임을 명시하는 주석을 추가할 것. 구현 시는 DB 컬럼 = snake_case, API 응답 DTO = camelCase 임을 각각 data-model.md 를 SoT 로 따를 것.

---

### [WARNING] spec/5-system/1-auth.md §1.4.2 — `methods=['totp']` vs `two_factor_enabled` 의 의미 경계

- **target 위치**: `spec/5-system/1-auth.md §1.4.2` — WebAuthn credential = 0 AND `two_factor_enabled = true` → `methods=['totp']`
- **충돌 대상**: `spec/1-data-model.md §2.1` — `two_factor_enabled: Boolean` — "TOTP 2FA 활성 여부 (WebAuthn credential 등록 여부와는 독립)"
- **상세**: auth.md §1.4.2 에서 `two_factor_enabled = true` 를 TOTP 활성 조건으로 사용하고, data-model.md §2.1 도 이를 "TOTP 2FA 활성 여부"로 정의한다. 두 spec 모두 같은 의미로 사용하므로 실질적 모순은 없다. 그러나 §1.4.2 의 "WebAuthn credential ≥ 1" 분기가 `two_factor_enabled` 값과 독립적으로 동작한다는 점(WebAuthn만 등록한 사용자는 `two_factor_enabled = false` 이지만 2FA 강제)이 코드에서 조건 분기 순서를 잘못 구현하면 버그가 생길 수 있다.
- **제안**: 구현 시 `/auth/login` 의 2FA 분기는 반드시 `webauthnCount` 를 먼저 확인하고 (`WebAuthnService.countCredentials()` 반환 기반), 그 후 `two_factor_enabled` 를 확인하는 순서를 따를 것. spec §1.4.3 의 WebAuthn 비활성 시 `webauthnCount=0` 처리를 함께 구현해야 함.

---

### [WARNING] spec/5-system/4-execution-engine.md 표현식 예시 — `$node["SendEmail"].output.messageId` 와 send-email 노드 출력 구조 일치 확인 필요

- **target 위치**: `spec/5-system/4-execution-engine.md §5.2` — 표현식 예시 `$node["SendEmail"].output.messageId`
- **충돌 대상**: `spec/4-nodes/4-integration/3-send-email.md §5.1` — 정상 발송 출력 `output.messageId`
- **상세**: 두 spec 이 동일한 `output.messageId` 필드를 참조하고 있어 일치한다. 단, send-email §5.1 의 성공 케이스에서 `meta.deliveryStatus: 'sent'` 가 있는 반면, execution-engine.md 는 `meta.deliveryStatus` 를 예시에서 다루지 않는다. 이것은 완전성 차이이지 모순은 아니다. 또한 `$node["X"].meta.durationMs` 패턴은 execution-engine §5.2 에서 `$node["HTTP"].meta.statusCode` 예시로 보여주듯 일반화되어 있으나, send-email 의 `meta.durationMs` 는 spec 에서 명시된 유일한 meta 필드다.
- **제안**: 현재 일치. 구현 시 `meta.deliveryStatus` 가 표현식으로 접근 가능한지 execution engine 의 nodeOutputCache 에 `meta` 가 포함되는지 확인할 것.

---

### [WARNING] spec/5-system/1-auth.md §5 API 목록 — `POST /api/auth/login/totp` 경로 명명 vs WebAuthn 엔드포인트 네임스페이스 일관성

- **target 위치**: `spec/5-system/1-auth.md §5` — `POST /api/auth/login/totp` (TOTP 검증) vs `POST /api/auth/2fa/webauthn/authenticate/verify` (WebAuthn 검증)
- **충돌 대상**: `spec/5-system/2-api-convention.md §2.2` — URL 명명 규칙
- **상세**: TOTP 2FA 검증 경로는 `/api/auth/login/totp` 이고 WebAuthn 경로는 `/api/auth/2fa/webauthn/...` 으로 네임스페이스가 다르다. TOTP setup/verify/disable 은 `/api/auth/2fa/setup`, `/api/auth/2fa/verify`, `/api/auth/2fa/disable` 로 `/auth/2fa/` 하위에 있지만, 로그인 시 TOTP 검증은 `/auth/login/totp` 로 `/auth/login/` 하위에 위치한다. API convention spec 은 이 예외에 대한 명시적 가이드를 제공하지 않으나, 로그인 플로우의 2단계 검증이라는 의미상 분리는 합리적이다.
- **제안**: 명명 불일치는 현재 상태에서 설계 결정으로 수용 가능하다. 구현 시 라우터 모듈 내에서 이 두 경로가 별도의 컨트롤러/메서드로 처리됨을 명확히 할 것.

---

## 요약

`spec/5-system/` 의 세 핵심 파일(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)과 이들이 참조하는 `spec/1-data-model.md`, `spec/2-navigation/`, `spec/4-nodes/` 간 cross-spec 일관성을 검토한 결과, **CRITICAL 수준의 직접 모순은 발견되지 않았다.** 주요 유의 사항은 두 가지다: (1) `spec/5-system/12-webhook.md §2.1` 의 camelCase/snake_case 표기 혼용은 구현 시 DB 컬럼명과 DTO 필드명 혼동 위험이 있으므로(WARNING), 데이터 모델 spec 을 snake_case SoT 로 사용하고 DTO 매핑 시 변환을 명확히 해야 한다. (2) `spec/5-system/1-auth.md §1.4.2` 의 WebAuthn/TOTP 분기 조건은 `two_factor_enabled` 와 `webauthnCount` 의 평가 순서를 구현 코드에서 정확히 따라야 한다(WARNING). 나머지 발견사항은 INFO 수준으로, 기존 결정을 이해하고 구현하면 충분하다.

---

## 위험도

LOW
