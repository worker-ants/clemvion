# 신규 식별자 충돌 Check 결과

검토 대상: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
검토 모드: spec draft (--spec)
검토일: 2026-05-28

---

## 발견사항

### 1. 요구사항 ID 충돌

- **[CRITICAL]** WH-SC-01~05 재번호 부여로 기존 ID 와 의미 충돌
  - target 신규 식별자: `WH-SC-01` (auth_config_id IS NULL → 인증 없음), `WH-SC-02` (hmac), `WH-SC-03` (bearer_token), `WH-SC-04` (api_key), `WH-SC-05` (basic_auth), `WH-SC-06` (401 AUTH_FAILED), `WH-SC-07` (last_used_at), `WH-SC-08` (rate limiting)
  - 기존 사용처: `spec/5-system/12-webhook.md` 57~61행 (현행 테이블)
    - `WH-SC-01`: "인증 없음(공개) 옵션" (의미 유사 — 표현 계승 가능)
    - `WH-SC-02`: "HMAC 서명 검증 (Secret 기반)" (의미 유사)
    - `WH-SC-03`: "Bearer Token 검증" (의미 유사)
    - `WH-SC-04`: "인증 실패 시 401 Unauthorized 응답" — **target 에서는 WH-SC-06 으로 배정**
    - `WH-SC-05`: "Rate limiting" — **target 에서는 WH-SC-08 로 배정**
  - 상세: target 이 기존 4행 테이블을 8행으로 확장하면서 WH-SC-04 (기존: "인증 실패 → 401") 에 "api_key" 의미를 새로 부여하고, WH-SC-05 (기존: "Rate limiting") 에 "basic_auth" 의미를 새로 부여한다. 기존 WH-SC-04/05 의 의미를 계승하지 않은 채 번호만 재사용한 것이다. `spec/5-system/15-chat-channel.md` 408행이 `WH-SC-04` 를 "인증 실패 → 401" 의미로 cross-reference 하고 있어, 해당 참조가 오염된다.
  - 제안: 기존 WH-SC-01~03 은 확장 의미와 호환되므로 그대로 계승. **WH-SC-04/05** 는 기존 의미를 보존한 채 번호를 유지하고, 신규 type 항목 (api_key, basic_auth) 은 WH-SC-04a/04b 또는 WH-SC-06/07 로 배정. "401 AUTH_FAILED" 는 WH-SC-04 그대로 유지, "last_used_at 갱신" 은 WH-SC-08, "Rate limiting" 은 WH-SC-09 로 순서 조정. 이렇게 하면 `15-chat-channel.md` 의 cross-ref 가 깨지지 않는다.

---

### 2. 엔티티/타입명 충돌

- **[WARNING]** `Integration.auth_type` 의 `none` 과 `AuthConfig.type` 의 `none` 제거 — 동일 값이 다른 엔티티에서 다른 의미로 공존
  - target 신규 변경: `AuthConfig.type` 에서 `none` 제거. "인증 없음" 은 `Trigger.authConfigId IS NULL` 로 표현.
  - 기존 사용처: `spec/1-data-model.md §2.10` 265행 — `Integration.auth_type Enum: … / none` — `none` 은 "인증이 없는 공용 MCP 서버 등에 사용".
  - 상세: `AuthConfig.type=none` 제거 자체는 충돌이 아니다. 그러나 동일 단어 `none` 이 `Integration.auth_type=none` (공용 MCP 서버 인증 없음) 과 `Trigger.authConfigId IS NULL` (webhook 인증 없음) 이라는 두 경로로 각각 "인증 없음"을 표현하게 되어, 향후 문서·코드 독자가 "none 처리 방식" 을 혼동할 수 있다. 또한 백엔드 DTO `AUTH_CONFIG_TYPES` 배열이 이미 `'none'` 을 포함하고 있어 (create-auth-config.dto.ts 18행) DB CHECK 와의 불일치가 잠재하지만, target draft 는 이를 "미해결" 로 남기고 있다.
  - 제안: target Rationale 에 두 경로의 의미 차이 ("AuthConfig row 없음 = 인증 없음" vs "Integration.auth_type=none = MCP 서버 인증 없음") 를 명시적으로 서술해 독자 혼동을 방지. DTO 의 `none` 제거는 Phase 별 구현 결정이지만 spec 에 "DTO 에서 none 값 수락 중단" 을 명시할 것.

- **[WARNING]** `AuthConfig.type` 에 신규 추가되는 `hmac` 이 `AuthConfig.config` JSONB 내 기존 inline 필드 `hmacHeader`/`hmacAlgorithm` 과 명명 레이어 혼재
  - target 신규 식별자: `AuthConfig.type = 'hmac'` + `config: { secret, header, algorithm }` (JSONB 필드명 `header`, `algorithm`)
  - 기존 사용처: `spec/5-system/12-webhook.md §2.2` 에서 `config.hmacHeader` / `config.hmacAlgorithm` (Trigger.config 의 inline 필드). `spec/2-navigation/2-trigger-list.md §2.3.1` 88~89행의 `hmacHeader`, `hmacSecret` 필드명.
  - 상세: target 은 Trigger.config 의 `hmacHeader` / `hmacAlgorithm` 를 제거하고 AuthConfig.config 의 `header` / `algorithm` 으로 이전한다. 두 JSONB 필드명이 서로 다른 길이를 가지므로 (`hmacHeader` vs `header`) 코드·테스트·마이그레이션 작성자가 문서만 보고 두 영역을 혼동할 가능성이 있다. 의미 충돌은 아니나, cleanup 후 잔존 참조가 어느 도메인 JSONB 를 가리키는지 불명확해질 수 있다.
  - 제안: spec 내 AuthConfig.config 의 JSONB 필드명을 문서화할 때 "이전 Trigger.config.hmacHeader 와 다른 위치·다른 소유자" 임을 주석으로 명시. cleanup migration 이 완료되면 spec §2.2 의 기존 `hmacHeader` / `hmacAlgorithm` 언급을 완전 삭제해 이름 잔재를 제거.

---

### 3. API Endpoint 충돌

- **[INFO]** `POST /api/auth-configs/:id/reveal` — 기존 spec 에 미존재, 충돌 없음
  - target 신규 식별자: `POST /api/auth-configs/:id/reveal`
  - 기존 사용처: `spec/2-navigation/6-config.md §3 Authentication API` — `POST /api/auth-configs`, `GET /api/auth-configs`, `GET /api/auth-configs/:id`, `PATCH /api/auth-configs/:id`, `DELETE /api/auth-configs/:id`, `POST /api/auth-configs/:id/regenerate` (6행).
  - 상세: `reveal` endpoint 는 기존 표에 없으며 `regenerate` 와 경로 패턴이 일관되어 충돌 없음. 신규 행 추가로 처리 가능.
  - 제안: 없음.

- **[WARNING]** `POST /api/triggers/:id/auth/rotate-secret` 의 deprecate 처리 — 기존 spec 에 "v1.1 예약" 으로 명시된 endpoint
  - target 신규 변경: 해당 endpoint 를 deprecate + 410 `GONE` 응답 명시.
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md §3` 135행 — "v1.1 예약 (실제 endpoint 신설은 별 spec PR)" 로 명시. `plan/in-progress/eia-secret-rotation-revoke-api.md` 와 합의 후 확정이라 표기.
  - 상세: 해당 endpoint 는 아직 `v1.1 예약` 상태(미구현)이나, target spec draft 가 이를 410 deprecate 로 처리하는 것은 아직 구현되지 않은 예약 endpoint 를 선제적으로 폐기하는 것이다. `eia-secret-rotation-revoke-api.md` plan 과의 합의 없이 spec 에만 deprecate 를 기록하면 plan 문서와 spec 이 충돌하게 된다.
  - 제안: target §5.2 의 deprecate 처리를 확정하기 전에 `plan/in-progress/eia-secret-rotation-revoke-api.md` 의 담당자(project-planner)와 명시적으로 합의. 합의 후 해당 plan 에도 "rotate-secret endpoint 는 auth-config-webhook-wiring PR 에서 선제 deprecate" 라는 메모를 추가.

---

### 4. 이벤트/메시지명 충돌

- **[INFO]** audit_log action `auth_config.reveal` — 기존 패턴과 일관, 충돌 없음
  - target 신규 식별자: `auth_config.reveal` (audit_log action)
  - 기존 사용처: `spec/5-system/1-auth.md §4.1` 328행 — `auth_config.*` 표기로 묶어서 정의 (auth_config.create, auth_config.update, auth_config.delete 포함 추정). `auth_config.regenerate` 는 기존 표 본문에 없으며, target §3.2 가 처음 명시하는 action.
  - 상세: `auth_config.*` wildcard 하위에 새 action 을 추가하는 것이므로 충돌 없음. `auth_config.regenerate` 도 동시에 신규 추가되므로 일관성 유지됨.
  - 제안: 없음.

---

### 5. 환경변수·설정키 충돌

- **[INFO]** 신규 환경변수·설정키 없음 — 충돌 대상 없음
  - target 은 새로운 ENV var 나 config key 를 도입하지 않는다.
  - 제안: 없음.

---

### 6. 파일 경로 충돌

- **[WARNING]** `spec/conventions/secret-store.md` 에 신규 sub-section `§4.A 관련 컨벤션 — 응답 마스킹` 추가
  - target 신규 식별자: `§4.A` (섹션 번호)
  - 기존 사용처: `spec/conventions/secret-store.md §4` (보안 요구사항), §5~§7 존재. 현행 문서에 `§4.A` 패턴의 sub-section 은 없음.
  - 상세: `§4.A` 스타일 sub-section 번호는 이 프로젝트 spec 에서 드문 패턴이다. `spec/0-overview.md §3.4`, `spec/4-nodes/6-presentation/1-carousel.md §5.4-A` 등에서 A/B 접미사가 사용되지만 주로 `§N-A` 또는 `§N.X` 형태다. `§4.A` 는 `§4` 의 하위 항목인지 독립 절인지 구조적으로 모호하다.
  - 제안: `§4.A` 대신 `§4.1 관련 컨벤션 — 응답 마스킹` 으로 변경하거나, 기존 secret-store.md 의 섹션 번호 체계 (§4 바로 뒤에 §5 가 옴) 를 유지하기 위해 `## 4.1` 로 추가하는 것이 더 자연스럽다.

- **[INFO]** target 이 갱신 대상으로 지정한 7개 spec 파일 경로는 모두 실재하는 파일
  - `spec/1-data-model.md`, `spec/5-system/12-webhook.md`, `spec/5-system/1-auth.md`, `spec/2-navigation/6-config.md`, `spec/2-navigation/2-trigger-list.md`, `spec/data-flow/10-triggers.md`, `spec/conventions/secret-store.md` — 모두 기존 파일이며 신규 파일 생성이 없으므로 경로 명명 충돌 없음.
  - 제안: 없음.

---

## 요약

target spec draft 가 도입하는 신규 식별자 중 가장 심각한 충돌은 **WH-SC-04/05 의 의미 재정의**다. 기존 `WH-SC-04` ("인증 실패 → 401") 를 `spec/5-system/15-chat-channel.md` 가 cross-reference 하고 있는 상태에서 target 이 해당 번호에 "api_key 검증" 이라는 완전히 다른 의미를 부여하면, chat-channel spec 의 참조가 오염된다. 이 외에 `POST /api/triggers/:id/auth/rotate-secret` 의 선제 deprecate 는 아직 합의되지 않은 plan 문서(`eia-secret-rotation-revoke-api.md`)와 충돌할 소지가 있어 조정이 필요하다. 나머지 발견사항 (none 이중 경로, hmac JSONB 필드명 혼재, §4.A 섹션 번호) 은 명확화 권장 수준이며 즉각 차단 사유는 아니다.

---

## 위험도

MEDIUM
