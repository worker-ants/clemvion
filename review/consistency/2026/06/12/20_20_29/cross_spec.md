# Cross-Spec 일관성 검토 결과

**대상**: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 15-chat-channel.md 등 전 파일)
**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
**검토 일시**: 2026-06-12

---

## 발견사항

### [INFO] `Trigger.type` enum 에 chat-channel 전용 값 미존재 — 문서 내 기술 통일 확인

- **target 위치**: `spec/5-system/15-chat-channel.md §1 개요`, `spec/1-data-model.md §2.8 Trigger`
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger.type` Enum 정의
- **상세**: `1-data-model.md §2.8` 의 `Trigger.type` 은 `webhook / schedule / manual` 3종으로 정의되고, `chat-channel` 은 "별도 type 이 아니라 `webhook` 트리거의 `config.chatChannel` 변형"임을 괄호 주석으로 명시한다. `15-chat-channel.md R1` 도 같은 설명을 한다. 두 문서가 일치하므로 모순은 없다. 다만 `spec/0-overview.md §6.1` 의 "임베드형 웹채팅 위젯" 설명에서 트리거 종류 관련 언급이 없어 신규 독자가 webhook 변형임을 파악하기 어려울 수 있다.
- **제안**: 현 상태 유지. 신규 독자 안내가 필요하다면 `spec/0-overview.md §7 용어 정의` 에 "Chat Channel" 항목을 추가할 때 "Webhook 트리거의 `config.chatChannel` 옵션" 임을 한 줄 부기하는 것을 고려. 필수 변경 아님.

---

### [INFO] `Trigger.config` JSONB 설명의 `chatChannel` cross-link — `1-data-model.md` 와 `15-chat-channel.md` 동기화 상태 확인

- **target 위치**: `spec/1-data-model.md §2.8 Trigger.config` 컬럼 설명
- **충돌 대상**: `spec/5-system/15-chat-channel.md §4.1 Trigger.config.chatChannel`
- **상세**: `1-data-model.md §2.8` 의 `Trigger.config` 설명에 "`chatChannel` 서브 필드 (외부 chat 플랫폼 어댑터) 는 [Spec Chat Channel §4.1](./5-system/15-chat-channel.md#41-triggerconfigchatchannel) 참조" cross-link 가 명시되어 있다. `15-chat-channel.md §4.2` 도 "Spec 1-data-model §2.8 와 동기화 완료 (5개 신규 컬럼 + `hasBotToken` derived 필드 cross-link 모두 반영)" 라고 자기 선언한다. 두 문서의 내용이 일치한다. `hasBotToken` derived 필드도 양쪽에서 같은 방식으로 설명된다.
- **제안**: 현 상태 유지. 일관성 양호.

---

### [INFO] `SecretStore §2.21.1` 의 `secret://triggers/{id}/inbound-signing` SoT 선언 — `15-chat-channel.md §4.1` 과의 교차 확인

- **target 위치**: `spec/1-data-model.md §2.21.1 SecretStore` (용도 목록 4번째 bullet)
- **충돌 대상**: `spec/5-system/15-chat-channel.md §4.1` `inboundSigningRef` 설명
- **상세**: `1-data-model.md §2.21.1` 은 `secret://triggers/{id}/inbound-signing` 의 SoT 를 `conventions/chat-channel-adapter.md §2.3` 으로 명시하고, `15-chat-channel.md §4.1` 도 동일하게 `conventions/chat-channel-adapter.md §2.3` 을 SoT 로 가리킨다. 두 spec 의 SoT 지시가 동일한 파일을 향하므로 충돌 없음.
- **제안**: 현 상태 유지.

---

### [INFO] `Notification.type` enum 의 `integration_action_required` — `1-data-model.md` 에 정의, `1-auth.md` 에서 미참조

- **target 위치**: `spec/1-data-model.md §2.19 Notification.type`
- **충돌 대상**: `spec/5-system/1-auth.md §4.1 감사 로그`
- **상세**: `1-data-model.md` 의 `Notification.type` enum 에 `team_invite` 가 포함되어 있다. `1-auth.md §1.5 초대 토큰 흐름` 은 초대 이메일 발송을 시스템 SMTP 로만 처리하며 워크플로우 SMTP Integration 미사용을 명시하지만, `team_invite` 알림 (`Notification.type`) 과 초대 이메일 발송 채널의 관계를 명확히 설명하지 않는다. `Notification` 은 in-app / email / both 채널을 가지므로 이메일 SMTP 채널과 별개이다. 직접적 모순은 아니지만 `team_invite` 알림이 실제로 구현됐는지, 어느 파일이 SoT 인지 불명확하다.
- **제안**: INFO 수준. `1-auth.md §1.5` 또는 `data-flow/8-notifications.md` 에 `team_invite` 알림의 발송 시점·채널을 명시하는 것을 권장. 현재 충돌은 없음.

---

### [INFO] `AuditLog.action` 명명 — `auth_config.*` 현재형 예외와 `1-auth.md §4.1.A` Planned action 시제 정규화 양쪽 SoT 분산

- **target 위치**: `spec/5-system/1-auth.md §4.1 감사 로그` Planned 액션 표 + Rationale §4.1.A
- **충돌 대상**: `spec/data-flow/1-audit.md §1.1` (prompt 에 미포함, 추론 기반)
- **상세**: `1-auth.md §4.1` 은 `AUDIT_ACTIONS` union 의 단일 SoT 를 `audit-action.const.ts` 라고 명시하며, Planned 액션의 표기 정규화 (`user.password_changed` 등)를 §4.1.A Rationale 에서 결정·선언한다. `data-flow/1-audit.md §1.1` 이 "ground truth" 라고도 같은 §4.1 본문에 언급된다. 두 문서가 각각 일부 권위를 주장하는 분산 SoT 구조이나, `1-auth.md §4.1.A` 가 명시적으로 Planned 표기를 확정하고 구현 시 `AUDIT_ACTIONS` 에 추가하는 절차를 기술하여 충돌 해소 방식을 설명하고 있어 실질적 모순은 없다.
- **제안**: 현 상태 유지. 향후 `data-flow/1-audit.md §1.1` 에 `user.*` 시제 정규화 결과를 반영하는 갱신이 권장되나 필수는 아님.

---

### [INFO] `Graph RAG §4.3 ragSources[]` 항목 SoT — `10-graph-rag.md` 와 `9-rag-search.md` 교차 SoT 주석 일치 확인

- **target 위치**: `spec/5-system/10-graph-rag.md §4.3` 주석
- **충돌 대상**: `spec/5-system/9-rag-search.md §4.1` (prompt 에 미포함, cross-link 추론)
- **상세**: `10-graph-rag.md §4.3` 주석에 "`ragSources[]` 항목 스키마(`chunkId`·`documentId`·`documentName`·`content`·`score`·`origin`)의 단일 SoT 는 [RAG 검색 §4.1](./9-rag-search.md#41-ragsources-run-results-ui-에서-인용-청크-표시)" 라고 명시되어 있다. 이 cross-link 가 명확하므로 두 문서 사이의 SoT 분산 가능성은 cross-link 로 해소된 상태.
- **제안**: 현 상태 유지.

---

### [INFO] `KnowledgeBase.embedding_model_config_id` 1급화 마이그레이션 — `10-graph-rag.md` 와 `1-data-model.md §2.11` 동기화

- **target 위치**: `spec/5-system/10-graph-rag.md §2.1` KnowledgeBase 추가 컬럼
- **충돌 대상**: `spec/1-data-model.md §2.11 KnowledgeBase`
- **상세**: `10-graph-rag.md §2.1` 의 KnowledgeBase 추가 컬럼 표 (`rag_mode`, `extraction_llm_config_id`, `max_hops`, `vector_seed_top_k`, `expanded_chunk_limit`, `entity_count`, `relation_count`) 는 `1-data-model.md §2.11` 에 모두 반영되어 있다. `reextract_status` 컬럼도 `1-data-model.md §2.11` 에 존재하고 `10-graph-rag.md §7` 에서 `KB_REEXTRACT_IN_PROGRESS` 로 참조된다. 두 문서가 일치한다.
- **제안**: 현 상태 유지. 일관성 양호.

---

### [INFO] `MCP Client §3.2 credentials JSONB` — `Integration.auth_type` enum 과의 정합

- **target 위치**: `spec/5-system/11-mcp-client.md §3.1 service_type / auth_type`
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration.auth_type` enum
- **상세**: `11-mcp-client.md §3.1` 은 `Integration.auth_type` 허용값으로 `bearer_token / api_key / none` 을 명시한다. `1-data-model.md §2.10` 의 `auth_type` enum 은 `oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none` 을 열거한다. `bearer_token`, `api_key`, `none` 이 모두 상위 enum 에 포함되어 있어 충돌 없음.
- **제안**: 현 상태 유지.

---

### [INFO] `RBAC §3.2 System Status 권한` — `spec/5-system/16-system-status-api.md §4 보안` cross-link

- **target 위치**: `spec/5-system/1-auth.md §3.2` System Status 행 주석
- **충돌 대상**: `spec/5-system/16-system-status-api.md §4 보안` (prompt 에 미포함, cross-link 추론)
- **상세**: `1-auth.md §3.2` 는 System Status 행에 "`/api/system-status/overview`, 워크스페이스 경계 없음, 모든 역할 동일하게 읽기만 가능 (별도 admin 가드 없음). 상세는 [System Status API §4 보안](./16-system-status-api.md#4-보안)" 이라 cross-link 한다. cross-link 가 존재하므로 충돌 리스크는 낮다.
- **제안**: 현 상태 유지.

---

### [INFO] `LoginHistory.event` CHECK 제약 — `1-auth.md §4.3` 과 `1-data-model.md §2.18.2` 일치 확인

- **target 위치**: `spec/5-system/1-auth.md §4.3 LoginHistory`
- **충돌 대상**: `spec/1-data-model.md §2.18.2 LoginHistory`
- **상세**: `1-auth.md §4.3` 에 열거된 이벤트 enum (`login_success / login_failed / totp_failed / webauthn_failed / logout / session_revoked / token_reuse_detected`) 과 `1-data-model.md §2.18.2` 의 `event` Enum 이 완전히 일치한다. `failure_reason` 필드의 예시값 (`WEBAUTHN_COUNTER_REGRESSION` 등) 도 양쪽에서 동일하게 언급된다. V058 마이그레이션 관련 `webauthn_failed` 추가 근거도 `1-auth.md §1.4.G Rationale` 에 상세히 기술되어 있다.
- **제안**: 현 상태 유지. 일관성 양호.

---

### [INFO] `WebAuthnCredential §2.21` — `1-auth.md §1.4.4` 등록·인증 흐름과의 필드 일치

- **target 위치**: `spec/5-system/1-auth.md §1.4.4 WebAuthn 흐름`
- **충돌 대상**: `spec/1-data-model.md §2.21 WebAuthnCredential`
- **상세**: `1-auth.md §1.4.4` 에서 "`webauthn_credential` row INSERT", "`counter` 갱신", "counter 역행 시 해당 credential **row 즉시 삭제**", "LoginHistory `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`) 기록" 을 언급한다. `1-data-model.md §2.21` 도 `counter` 역행 시 "해당 credential **row 즉시 삭제** (suspend 컬럼 도입 금지, Rationale 1.4.E) + LoginHistory `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`) 기록" 으로 동일하게 기술한다. 필드명·동작이 일치한다.
- **제안**: 현 상태 유지.

---

### [INFO] `CCH-CV-03` 의 `running` 안내 기본 문구 — `1-data-model.md` 와 cross-link 부재

- **target 위치**: `spec/5-system/15-chat-channel.md §4.1 languageHints.executionStillRunning`
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger.config` JSONB
- **상세**: `15-chat-channel.md §4.1` 의 `languageHints` 객체는 `Trigger.config.chatChannel` JSONB 안에 위치한다. `1-data-model.md §2.8` 의 `Trigger.config` 컬럼 설명은 `chatChannel` 를 [§4.1](./5-system/15-chat-channel.md#41-triggerconfigchatchannel) 로 위임하며 세부 필드(예: `languageHints`)를 직접 열거하지 않는다. 이는 의도적 분업이며 모순 아님.
- **제안**: 현 상태 유지.

---

### [INFO] `1-auth.md §5 API` 의 초대 엔드포인트 cross-link 이중화 — `9-user-profile.md` SoT 선언

- **target 위치**: `spec/5-system/1-auth.md §5 API` 하단 주석 2개
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §6.1` (prompt 에 미포함, cross-link 추론)
- **상세**: `1-auth.md §5` 는 세션·이력 관리 엔드포인트 (`/api/users/me/sessions`, `/api/users/me/login-history`) 와 초대 엔드포인트 (`/api/workspaces/:id/invitations`, `/api/workspaces/invitations/accept`) 의 SoT 를 `9-user-profile.md §6.1` 로 위임하는 cross-link 를 명시한다. 이는 SoT 를 명확히 위임한 것으로, 두 spec 이 동시에 같은 엔드포인트를 독립적으로 정의하는 것이 아니다.
- **제안**: 현 상태 유지.

---

## 요약

`spec/5-system/` 의 전 파일과 `spec/0-overview.md`, `spec/1-data-model.md` 를 cross-spec 관점에서 검토한 결과, CRITICAL 또는 WARNING 수준의 직접적 모순은 발견되지 않았다. 주요 확인 사항: (1) `Trigger.type` enum 은 chat-channel 을 `webhook` 변형으로 양쪽 spec 에서 일치하게 기술하고, (2) `WebAuthnCredential` 필드·동작은 `1-auth.md` 와 `1-data-model.md` 에서 완전히 동기화되어 있으며, (3) `Graph RAG` 의 KnowledgeBase 추가 컬럼들은 `1-data-model.md §2.11` 에 반영되어 있고, (4) MCP Client 의 `auth_type` 허용값은 상위 `Integration.auth_type` enum 의 부분집합으로 정합한다. `LoginHistory.event` CHECK 제약의 V058 `webauthn_failed` 추가도 `1-auth.md §4.3` 과 `1-data-model.md §2.18.2` 가 일치하게 기술한다. 발견된 INFO 항목들은 모두 SoT cross-link 를 통해 이미 위임·해소된 사항이거나 명시적 동기화 선언이 존재하는 것으로, 신규 독자 안내 보강 정도의 권고 수준이다.

---

## 위험도

NONE
