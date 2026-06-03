# Spec 감사 — data-flow

## 요약

- **감사 파일 수**: 13개 (`0-overview` + `1-audit` ~ `12-workspace`)
- **severity 분포**: none 1 / minor 1 / major 9 / severe 2
- **핵심 메시지**:
  - 가장 광범위한 drift 패턴은 **트리거·발사 모델**이다. `@Cron` 인메모리 sweep → BullMQ repeatable scheduler 이관(커밋 2d983a5b)이 코드에 반영됐으나 spec(`10-triggers`, `9-observability`, 부분적으로 `0-overview`)은 여전히 "1분 sweep / next_run_at polling / per-rule queue.add" 의 obsolete 모델을 기술한다 — `10-triggers` 는 **정반대 서술**로 severe.
  - **엔드포인트·HTTP status·응답 body** drift 가 auth/workspace/workflow/execution/integration 전반에 퍼져 있다 (경로 표기 틀림, 404 vs 410 vs 401 vs 423, register 2단계 흐름, SSE vs WebSocket 등). `12-workspace` 는 X-Workspace-Id 헤더 보안 모델이 **코드와 정반대**라 severe.
  - 반대로 **DB 스키마·인덱스·마이그레이션 매핑**은 대부분 정확하다. `6-knowledge-base` 는 drift 없음(none), 인덱스/큐 카탈로그·보존정책 등은 1:1로 일치하는 경우가 많다.

## 파일별 발견사항

### spec/data-flow/0-overview.md — minor / N/A / keep · patch-content

**Headline**: data-flow 인덱스는 코드와 매우 정합 — 12개 큐·12개 도메인 링크·S3/refresh_token/HNSW 모두 일치. PG 버전(pg18 vs k8s local pg16)만 minor 불일치.

| claim | reality | evidence |
| --- | --- | --- |
| §1.2 Primary DB 이미지 `pgvector/pgvector:pg18` | docker-compose/e2e 는 pg18 일치하나 k8s 로컬 overlay 는 pg16 — 인프라 간 버전 불일치 | docker-compose.yml:3 vs k8s/overlays/local/infra-postgres.yaml:37 |
| §1.2/§4 등록 BullMQ 큐 12개 | 코드 상수 12개와 1:1 정확 일치, system-status MONITORED_QUEUES 와도 동일, continuation 큐 상수값 일치 | system-status.constants.ts:44-61; continuation-execution.queue.ts:16 |
| §4 schedule/alerts/expiry producer 가 'cron sweep' | 실제는 @Cron 아닌 BullMQ repeatable scheduler. 'cron sweep' 은 축약으로 틀리진 않으나 메커니즘 명시하면 정확 | schedule-runner.service.ts:199 등 |
| §1.2 S3 사용처 KB 문서뿐 | 정확. s3Service.upload 호출처 단 1곳(라인 723→726 이동) | knowledge-base.service.ts:726 |

- **structuralNotes**: 컨벤션 부합. 0-overview=기술개요 역할 정확. 도메인 인덱스 표 링크 텍스트(auth.md)와 타겟(2-auth.md) 표기는 다르나 12/12 모두 resolve. 연번 1-audit~12-workspace 정상.

### spec/data-flow/1-audit.md — major / N/A / patch-content

**Headline**: 핵심 흐름·스키마는 정확하나 service 메서드명·event 목록·DB CHECK 유무 3건이 코드와 어긋남 (특히 Rationale 가 정반대 진술).

| claim | reality | evidence |
| --- | --- | --- |
| 진입점 메서드 `findByWorkspace` / `findMyHistory` | 실제는 `findAll` / `findForUser`. spec 심볼은 코드에 부재 (major) | audit-logs.service.ts:15; login-history.service.ts:98 |
| Rationale: audit_log.action·login_history.event 모두 자유 문자열(DB CHECK 없음) | login_history.event 에는 CHECK `chk_login_history_event`(7개 enum) 존재. event 추가 시 마이그레이션 필요했음(V058). Rationale 'CHECK 없음' 이 정반대 (major) | V040 CONSTRAINT chk_login_history_event; V058 |
| event 6종(login_success/login_failed/totp_failed/logout/session_revoked/token_reuse_detected) | 실제 7종 — `webauthn_failed` 누락 (major) | login-history.entity.ts:16; V058 |
| LoginHistoryService.record 인자에 deviceLabel 포함, ua 표기 | deviceLabel 입력 없음(내부 deriveDeviceLabel 파생), 인자명은 userAgent (minor) | login-history.service.ts:14-22, 82-84 |
| event union 정의 위치 entity:12 | union 은 12-19 라인. 16번 webauthn_failed 를 놓친 결과 (minor) | login-history.entity.ts:12-19 |

- **structuralNotes**: 파일명·위치 컨벤션 부합. audit_log/login_history 컬럼·인덱스(V001/V002/V040), 보존 180일·일일 prune 배치는 코드와 정확히 일치.

### spec/data-flow/10-triggers.md — severe / N/A / patch-content · rewrite

**Headline**: Schedule 발사 모델이 코드와 정반대 — spec 은 1분 sweep(next_run_at polling), 코드는 BullMQ repeatable job. webhook inactive 응답코드·manual 엔드포인트·chat-channel 분기도 drift.

| claim | reality | evidence |
| --- | --- | --- |
| Schedule 은 1분 sweep `SELECT ... WHERE next_run_at <= now` 후 queue.add({scheduleId}), next_run_at 재계산이 발사 트리거 | **DB sweep/polling 자체가 없음**. `upsertJobScheduler('schedule:<id>', {pattern, tz})` 로 repeatable job 등록, BullMQ 가 cron 발사. next_run_at 은 process() 정보성 재계산일 뿐 (severe) | schedule-runner.service.ts:197, 130, 172-180 |
| webhook is_active=false → 404 | inactive 는 410 Gone (GoneException, TRIGGER_INACTIVE). 404 는 미존재 시에만 (major) | hooks.service.ts:89-95 |
| Manual: `POST /api/workflows/:id/run` | 실제 `POST /api/workflows/:id/execute`. `/run` 없음 (major) | workflows.controller.ts:223 |
| webhook 진입은 일반 흐름 한 갈래 (chat inbound 없음) | config.chatChannel 있으면 handleChatChannelWebhook 분기 — Telegram/Slack/Discord 서명검증, url_verification, PING handshake, native modal 응답 등 대규모 경로가 spec 에 전무 (major) | hooks.service.ts:99-110, 169+; hooks.controller |
| schedule-execution payload `{scheduleId}` | `{scheduleId, workspaceId}` (process 가 workspaceId 로도 필터) (minor) | schedule-runner.service.ts:200-205, 130-138 |
| Hk 가 직접 ip_whitelist·검증·last_used_at 갱신 | AuthConfigsService.verifyWebhookRequest 로 위임, hooks 는 호출만. 실패는 단일 401 AUTH_FAILED (minor) | auth-configs.service.ts:205,221,247; hooks.service.ts:114-122 |
| §2.1 type CHECK·endpoint_path UNIQUE 가 'V003 type checks' 로 보장 | V003 은 node_category enum 에 'trigger' 추가일 뿐. 실제 제약은 V001/V002 (minor) | V003__add_trigger_category.sql:3 |
| POST /api/schedules 는 'INSERT schedule + trigger 한 트랜잭션' | 단일 트랜잭션 아님. trigger save 후 schedule save 순차 호출 — 중간 실패 시 고아 trigger 가능 (minor) | schedules.service.ts:72-95 |

- **structuralNotes**: 파일명·위치 정상. 본문이 obsolete 아키텍처(@Cron/sweep)를 기술한 것이 핵심 문제 — §1.3/§2.2/§3.2 mermaid·표 재작성 필요.

### spec/data-flow/11-workflow.md — major / N/A / patch-content

**Headline**: DB 스키마 매핑은 거의 정확하나, AI Assistant 편집 경로·버전 생성 API·전송 채널(SSE vs WebSocket) 서술이 코드와 정면 충돌.

| claim | reality | evidence |
| --- | --- | --- |
| §1.4 Assistant edit tool_call 이 NodesService/EdgesService 통해 Postgres 반영 | Assistant 는 **DB 를 전혀 안 건드림**. ShadowWorkflow=in-memory replica, 프론트 optimistic 적용 후 사용자 Save 로만 persist. 모듈에 Nodes/EdgesService import 없음 (severe) | shadow-workflow.ts:304-311; V019:6-8 |
| §1.3/§2.2/§4 delta 가 WebsocketService 'assistant:delta' 로 emit | WebSocket emit 없음. text/event-stream(SSE) 직접 스트리밍. 이벤트명 text/tool_call/plan/usage/done/error (major) | workflow-assistant.controller.ts:142,164-190 |
| §1.1 버전 커밋은 `POST /api/workflows/:id/versions` | 해당 POST 없음. VersionsController 는 GET 2개만. 버전 생성은 `POST /:id/save` 내부 트랜잭션 (major) | workflow-versions.controller.ts:20-77; workflows.controller.ts:324 |
| §1.1 편집은 개별 POST(/nodes,/edges) 1건씩 반영 | 실제 주 경로는 bulk canvas save — `/save` 가 전체 동기화(미제출 노드 삭제, 엣지 전부 교체, Manual Trigger 1개 강제) (major) | workflows.controller.ts:324-349 |
| §1.3/§2.1 tool_calls 있으면 role='tool' row INSERT | role='tool' row 미기록. persistAssistantTurn 은 role='assistant' 만, tool 결과는 tool_calls[].result. V019 주석도 'do not write them' (major) | workflow-assistant-stream.service.ts:1215-1252; V019:41-47 |
| §2.1 session 인덱스 (workflow_id, status, last_interaction_at DESC) | 실제 (workflow_id, **user_id**, status, last_interaction_at DESC) — user_id 누락 (minor) | V019:32-33 |
| §3.2 archived 진입 전용 `PATCH /sessions/:id/archive` | 전용 없음. 일반 `PATCH /sessions/:id` 로 status 갱신 (minor) | workflow-assistant.controller.ts:111-122 |
| §1.3 세션 생성 `POST /api/workflows/:wfId/assistant/sessions` | 라우트는 @Controller('workflow-assistant') 하위 — `POST /api/workflow-assistant/sessions` (body 에 workflowId) (minor) | workflow-assistant.controller.ts:41,99-109 |

- **structuralNotes**: 파일명/위치/분류 컨벤션 부합. §2.1 스키마 컬럼 매핑·§3.1 is_active 전이는 V001/V019/V020 과 정확히 일치 — drift 는 스키마 아닌 '데이터가 흐르는 경로'에 집중.

### spec/data-flow/12-workspace.md — severe / N/A / patch-content · fix-code-paths · rewrite

**Headline**: X-Workspace-Id 헤더 정책이 코드와 정반대(코드는 헤더 우선 수용), JWT 필드명·accept/switch 엔드포인트·토큰 생성·초대 가입 시 personal 생성 등 핵심 사실 다수 drift.

| claim | reality | evidence |
| --- | --- | --- |
| X-Workspace-Id 는 헤더로 안 받고 token 의 사용자로 서버가 자동 매핑(헤더 수용은 공격 경로) | WorkspaceId 데코레이터가 'X-Workspace-Id header > JWT' 로 헤더를 명시 수용, JWT 보다 **우선**. 보안 모델 정반대 (severe) | workspace.decorator.ts:13-15 |
| token payload 에 `activeWorkspaceId` | JWT 필드명은 `workspaceId`, `activeWorkspaceId` 는 백엔드 전체 grep 0 (major) | current-user.decorator.ts:6 |
| 워크스페이스 전환 `POST /api/auth/workspaces/:id/switch` | auth 모듈에 switch 엔드포인트·서비스·프론트 모두 없음. §1.5 전체 미구현 (severe) | grep switchWorkspace → 0 |
| 초대 수락 `POST /api/workspace-invitations/accept` | 실제 `POST /api/workspaces/invitations/accept`. 'workspace-invitations' 컨트롤러 없음 (major) | workspaces.controller.ts:60,457; main.ts:73 |
| 이메일 불일치 시 403 INVITATION_EMAIL_MISMATCH | BadRequest 400 code='invitation_email_mismatch'. status·대소문자 모두 다름 (major) | workspace-invitations.service.ts:279-284 |
| registerWithInvitation 이 personal workspace 생성(step 2) | personal 생성 안 함 — user INSERT + consumeForRegistration 만. 주석 'must NOT trigger a personal workspace'. 정반대 (major) | auth.service.ts:121-143,728 |
| token = randomBytes(32).toHex() | randomBytes(48).toString('base64url'). 바이트·인코딩 모두 다름 (minor) | workspace-invitations.service.ts:39-42 |
| (owner_id, type) UNIQUE 가 'V001 + entity' 양쪽 강제 | V001 엔 slug UNIQUE 만. 어떤 마이그레이션에도 부재 — 엔티티 @Unique 데코레이터만, DB 차원 미강제 (major) | V001:37-46; workspace.entity.ts:15 |
| 역할 변경 owner→admin 강등은 owner 본인만 불가 | 엔드포인트는 :memberId. member.role/새 role 이 owner 면 무조건 차단(OWNER_ROLE_PROTECTED) — owner 관여 전부 차단 (major) | workspaces.controller.ts:266,278-291 |
| POST transfer-ownership {newOwnerId}=user id | 바디는 newOwnerMemberId(member.id). 본인 지정 TARGET_IS_SELF(400), 이미 owner TARGET_ALREADY_OWNER(409) 등 미기재 (minor) | transfer-ownership.dto.ts; service:392-461 |
| 진입점 invitations.controller 가 /api/workspaces/:id/invitations 노출 | 그 컨트롤러는 @Controller('invitations') 공개 GET /api/invitations/:token 만. 발급/수락/목록 등은 workspaces.controller. 진입점 매핑 틀림 + 공개 메타 엔드포인트가 spec 에 없음 (major) | invitations.controller.ts:24,30-50 |
| §4 workspace.* 액션이 audit_log 적재 | 실제 audit 는 workspace.transfer_ownership 단 1건만. create/delete/rename/member 등 미기록 — 'workspace.*' 과장 (minor) | workspaces.service.ts:465-472 |

- **frontmatterIssues**: 서술 문서로 frontmatter 부재 정상이나, 본문 '코드 진입점'(§15-19)이 invitations.controller 역할을 잘못 기술. 교차참조 링크 §169 ./2-auth.md, §171 ./1-audit.md vs 상단 §3 ../5-system/1-auth.md 로 경로 체계 혼재 — 끊긴 링크 가능성.
- **structuralNotes**: 파일명·배치 컨벤션 부합. 상단 관련 spec 링크(절대형)와 §4 표(같은 폴더 상대형)가 동일 대상에 두 경로로 갈려 일관성 점검 필요.

### spec/data-flow/2-auth.md — major / N/A / patch-content

**Headline**: 엔드포인트 경로·HTTP status·register 트랜잭션 흐름·응답 body 가 코드와 다수 어긋남. 스키마/엔티티/마이그레이션 매핑은 대체로 정확.

| claim | reality | evidence |
| --- | --- | --- |
| §1.5 revoke `DELETE /api/auth/sessions/:familyId` | @Controller('users/me') + @Post('sessions/:familyId/revoke') → `POST /api/users/me/sessions/:familyId/revoke` (major) | sessions.controller.ts:49,77-83 |
| §1.3 OAuth 시작 `GET /api/auth/oauth/:provider/start` | `@Get('oauth/:provider')` — '/start' 없음. callback 은 일치 (major) | auth.controller.ts:454,480 |
| §1.1 register 트랜잭션에 workspace+member 생성, {user,accessToken,refreshToken}+200 Set-Cookie | 로컬 register 는 user+email_verify_token 후 메일만, message 만 반환(201, 토큰·쿠키 없음). personal workspace 는 verifyEmail 단계 createPersonalWorkspace (major) | auth.service.ts:74-89,162,194; controller:112-145 |
| §1.2 로그인 응답 {accessToken,refreshToken,user}+Set-Cookie | body 는 {accessToken} 뿐. refreshToken 은 httpOnly 쿠키, user 없음 (webauthn/totp 동일) (major) | auth.controller.ts:213-217 |
| §1.2/§3.2 계정 잠금 423 ACCOUNT_LOCKED | UnauthorizedException(401), code ACCOUNT_LOCKED. 423 아님 (major) | auth.service.ts:251-263 |
| §2.1 workspace (owner_id,type) UNIQUE 존재 | V001 엔 slug UNIQUE 만. (owner_id,type) 복합 UNIQUE 어떤 마이그레이션에도 없음 (minor) | V001:37-58 |
| §2.1 login_history event 7종 | 엔티티/DB 일치 — webauthn_failed 는 V058 추가. 현재 일치 (minor) | login-history.entity.ts; V058 |
| §2.1 refresh_token 부분 UNIQUE·컬럼(V040) | V040 device_label/last_used_at/last_used_ip + 부분 인덱스. 매핑 정확 (minor) | V040:15-23 |

- **structuralNotes**: 파일명·위치 적합. mermaid 시퀀스를 실제 라우트와 1:1 대조해 수정 필요(특히 §1.1 register 2단계, §1.5 sessions 경로, §1.3 oauth start, §1.2 423→401). refresh 회전·reuse 탐지·sha256 해싱은 정확.

### spec/data-flow/3-execution.md — major / N/A / patch-content

**Headline**: 엔트리포인트·큐·스키마·키 흐름은 정확하나, §1.3 인터랙션 REST 엔드포인트(`POST /interactions`)가 코드에 없음 — 실제는 `/continue {formData}` + WS 메시지. 상태머신 전이 2건 누락.

| claim | reality | evidence |
| --- | --- | --- |
| §1.3 폼/버튼 재개 `POST /api/executions/:id/interactions {nodeId,type,payload}` | 그런 라우트 없음. 실제 `POST /executions/:id/continue {formData?}`. nodeId/type/payload 는 엔진 내부 ContinuationMessage 일 뿐 (major) | executions.controller.ts:137-174 |
| §1.3 단일 interactions 엔드포인트가 type 분기 | 실제는 WS 메시지 4종: submit_form/click_button/submit_message/end_conversation(+retry_last_turn) (major) | websocket.gateway.ts:375,450,524,597,682 |
| §3.1 waiting_for_input→{running,cancelled} 만 | 코드는 waiting_for_input→failed 도 포함(AI Agent multi-turn 오류). 다이어그램 누락 (minor) | state-machine.ts:18-29 |
| §3.1 failed/completed/cancelled 종착 | failed→running opt-in(allowRetryReentry) 허용 — retry_last_turn 재진입. 미표기 (minor) | state-machine.ts:62-71 |
| §2.1 node_execution 인덱스 V034 (execution_id, started_at) | 실제 (execution_id, node_id, started_at DESC) 3컬럼 — node_id·DESC 누락 (minor) | V034 |
| Rationale executionPath 주석 entity:78 | 실제 entity:97 (내용 일치) (minor) | execution.entity.ts:97 |
| §1.1 마지막 WS `execution:completed`(콜론) | 정본은 dot(`execution.completed`), §2.4 도 dot. §1.1 mermaid 만 콜론 — 문서 내부 불일치 (minor) | 3-execution.md:67 vs 166-170 |
| §2.2 background-execution payload 필드 열거 | 코드는 추가로 backgroundRunId?/conversationThread? 포함 — 표 미기재(후방호환 신규) (minor) | background-execution.queue.ts:15-67 |

- **structuralNotes**: 파일명 정상. 엔트리포인트·큐·continuation-bus·state-machine 모두 실존·시그니처 일치. §4 외부의존 링크·5-system cross-link 모두 resolve.

### spec/data-flow/4-file-storage.md — major / N/A / patch-content

**Headline**: KB 삭제 시 S3 cleanup 이 "미구현·orphan 가능"이라 기술됐으나 코드는 실제 삭제 루프 수행 — 라이프사이클·Rationale 핵심 주장이 코드와 반대.

| claim | reality | evidence |
| --- | --- | --- |
| §3 'KB 삭제 시 S3 orphan 가능, cleanup batch 추후 도입 필요' | remove(id, workspaceId) 가 모든 document 조회 후 for 루프로 s3Service.delete(doc.fileUrl) 호출 — 이미 구현됨, 미구현 아님 (major) | knowledge-base.service.ts:644-658 |
| Rationale '누적 orphan 은 정기 GC batch 로 정리할 계획' | remove 가 동기 best-effort 삭제 수행하므로 KB 삭제 orphan 가정 불성립 (major) | knowledge-base.service.ts:651-657 |
| Rationale 'workspace 격리는 DB 권한+presigned URL 로 보장한다'(현재형) | KB 경로에 presigned URL(getSignedUrl/presigner) 사용처 전무. S3 download 는 worker 임베딩용 서버사이드 GET 뿐, 다운로드 엔드포인트 없음 — 미구현(설계 의도)을 현재형 기술 (minor) | knowledge-base.controller.ts; presigner import 0 |
| §1.1 embedding.service.ts:163 GET key | 라인 163 정확. 실제 경로 embedding/embedding.service.ts — 약식 경로가 모듈 루트처럼 읽힐 수 있음 (minor) | embedding/embedding.service.ts:163 |
| §1.1 업로드 키 'kb/<kbId>/<docId>/<originalFilename>' | path.basename 으로 sanitize 한 sanitizedFilename 사용(traversal 방지). sanitize 단계 미언급 (minor) | knowledge-base.service.ts:722-723 |

- **structuralNotes**: 파일명·연번 정상. s3.service 시그니처, ConfigService 키 5종, region default, document.file_url/avatar_url 컬럼, Form/Avatar 업로드 미구현은 모두 정합.

### spec/data-flow/5-integration.md — major / N/A / patch-content

**Headline**: 정밀도 높은 문서. 다만 BullMQ 큐 실명('integration-expiry-scanner')과 OAuth start 엔드포인트(실제 POST /oauth/begin + JSON 응답)가 spec 표기와 어긋남.

| claim | reality | evidence |
| --- | --- | --- |
| 만료 스캐너 큐 이름 `integration-expiry` (§1.4·§2.2) | 코드 상수 `INTEGRATION_EXPIRY_QUEUE = 'integration-expiry-scanner'`. spec 전반이 `-scanner` 누락 — 대시보드 grep 빗나감 (major) | integration-expiry-scanner.service.ts:30 |
| §1.2 OAuth 연결 `GET /api/integrations/oauth/:service/start` → 302 redirect | 그런 라우트 없음. 일반/cafe24 모두 `POST /api/integrations/oauth/begin`, 302 아닌 JSON `{authUrl, state}` 반환 (major) | integrations.controller.ts:183; integration-oauth.service.ts:344,488 |
| Rationale last_error 암호화 근거 entity:71~77 | lastError 는 entity:111~117. 71~77 은 installTokenIssuedAt. 라인 stale(암호화 자체는 일치) (minor) | integration.entity.ts:111-117 |
| §2.2 producer: integration-expiry 큐 4개 스케줄러 등록 | 일치(connected-expiry/pending-install-ttl/usage-log-prune daily + cafe24-background-refresh 6h). 큐 이름만 위 finding 대로 어긋남 (minor) | integration-expiry-scanner.service.ts:96-145 |

- **structuralNotes**: 파일명 정상. cross-ref 링크 실재. 본문은 코드 심볼·migration·잡 이름·jobId 패턴까지 1:1 추적 가능한 수준으로 매우 정확.

### spec/data-flow/6-knowledge-base.md — none / N/A / keep

**Headline**: KB/RAG 데이터플로우 문서가 코드와 정밀 일치 — 스키마·엔드포인트·큐·동시성·재시도·WS 이벤트·알려진 divergence 모두 정확. drift 없음. (상세는 "## 일치 확인됨" 참조)

### spec/data-flow/7-llm-usage.md — major / N/A / patch-content

**Headline**: caller 카탈로그·테이블 스키마는 정확하나, chat() 시그니처/resolveConfig 위치, provider 집합(Ollama·vLLM), thinking_tokens 비용 합산 서술이 코드와 어긋남.

| claim | reality | evidence |
| --- | --- | --- |
| §1.2 chat({messages,model,params,workspaceId,llmConfigId?,context}) 내부에서 resolveConfig 수행 | chat(config: LlmConfig, params, context?, opts?) — 이미 resolve 된 엔티티를 받음. resolveConfig 는 caller 가 먼저 호출하는 별개 메서드. chat 옵션 객체가 실제 시그니처와 다름 (major) | llm.service.ts:97-140, 277-297 |
| §3.1 thinking_tokens 단가가 output 단가에 합산되어 cost_usd 포함(V018) | calculateCostUsd 는 prompt·completion 만으로 계산. thinkingTokens 는 컬럼 저장에만, cost 미포함 — 정반대 (major) | pricing.ts:51-64; llm-usage-log.service.ts:34-52 |
| provider 6종(...Ollama·vLLM) | factory switch 는 openai/anthropic/google/azure/**local** 5종. Ollama·vLLM 은 독립 provider 아닌 local(OpenAI 호환) — provider enum 어긋남 (minor) | llm-client.factory.ts:18-53; local.client.ts:7-11 |
| §2.1 인덱스 (workspace_id,created_at),(provider,model,created_at) 2종 | V014 는 추가로 idx ...workflow_created_at (workflow_id,created_at DESC) WHERE workflow_id IS NOT NULL partial 생성 — §2.1 누락 (minor) | V014 |
| §1.2 usage {prompt_tokens,completion_tokens,...thinking_tokens?} | 내부 TokenUsage 는 inputTokens/outputTokens/totalTokens/thinkingTokens(camelCase). snake_case 는 DB·raw 표기 — 표면 표기 혼용(동작 일치) (minor) | llm-usage-log.service.ts:46-51 |

- **structuralNotes**: 파일명·연번 정합. caller 카탈로그·테이블 스키마·is_default partial UNIQUE·resolveConfig default fallback·nullable context 컬럼은 코드와 정확히 일치. 재배치 불필요.

### spec/data-flow/8-notifications.md — major / N/A / patch-content

**Headline**: Dismiss/스키마/인덱스 부분은 정확하나, spec 핵심 전제(notify() 단일 표면·이메일 발송·다수 type 발사)가 코드에 미구현 — 현재 구현 상태를 오인시킴.

| claim | reality | evidence |
| --- | --- | --- |
| Source 가 NotificationsService.notify({...}) 단일 표면 호출(preference+INSERT+WS emit+이메일) | notify() 메서드 없음. 공개 API 는 findAll/getUnreadCount/markAsRead/dismiss 등뿐. preference·channel·이메일은 서비스 밖(expiry-scanner)에 흩어짐. 적재는 createMany (major) | notifications.service.ts:1-270; integration-expiry-scanner.service.ts:413-430 |
| channel IN('email','both')일 때 MailService 로 type별 이메일 + email_sent_at UPDATE | 알림 이메일 경로 미구현. MailService 는 verification/invitation/password-reset 3개만. email_sent_at setter 코드 전무 (major) | mail.service.ts:34,114,201; grep email_sent_at |
| §1.1 type: execution_failed/schedule_failed/marketplace_update/team_invite 발사 | 어느 것도 notification row 안 만듦. 실제 발사 3종: background_failed/integration_expired/integration_action_required (major) | background-execution.processor.ts:181; expiry-scanner:417 |
| §1.1 type 표가 전체 목록처럼 제시 | V052 추가·코드 발사하는 integration_action_required 가 §1.1 누락(본문 '향후 신설'로만 언급되나 이미 구현) (minor) | V052; integration-action-required-notifier.service.ts:38-93 |
| §2.1 dismissed_at 인덱스·partial 전환·dismiss 멱등 | 코드·마이그레이션 정확 일치(V055 ADD COLUMN, V056 partial INDEX, findAll/getUnreadCount/dismiss) (minor) | V055,V056; notifications.service.ts:52,79,128-197 |
| §4.4 hasRecentByResource 가 dismissed_at·is_read 무시 | 일치(workspaceId/type/resourceId/title/createdAt 만) (minor) | notifications.service.ts:209-227 |
| WS emit notification.new 미구현, prefix 등록 | 일치 — prefix 존재, emit 미구현. spec 이 스스로 미구현 명시 (minor) | websocket.gateway.ts:30-42 |

- **structuralNotes**: 파일명·배치 부합. §1 sequence·§1.1 type 표가 'as-is 구현'과 'to-be 설계'를 구분 없이 한 평면에 그려 독자가 모두 구현된 것으로 오인 — WS emit 처럼 '현재 구현/follow-up' 마킹을 이메일·미발사 type 에도 적용 권장.

### spec/data-flow/9-observability.md — major / N/A / patch-content

**Headline**: Alerts evaluator 흐름(큐 payload·cron 방식·audit_log 기록)과 health S3 ping, alert type 값이 코드와 다수 불일치 — spec 만 보면 오해.

| claim | reality | evidence |
| --- | --- | --- |
| Health 가 S3 HEAD ping, 응답 checks{postgres,redis,s3} | check() 는 database(SELECT 1)·redis(ping)만. s3 키 없음, 키 이름 postgres 아닌 database (major) | health.service.ts:53-88 |
| Alerts: cron sweep 가 alert_rule SELECT 후 per-rule queue.add({ruleId}), payload {ruleId} | onModuleInit 이 upsertJobScheduler 로 단일 repeatable job('evaluate'), payload {triggeredAt}. process→run 이 전체 rule 직접 로드. per-rule 큐잉 없음 (major) | alerts-evaluator.service.ts:15-17,58-65,76-77 |
| threshold 초과 시 AuditLogsService.record(action='alert_rule.triggered') INSERT | dispatchBreach 는 createMany 로 알림만 + lastTriggeredAt 업데이트. AuditLog 주입·호출·INSERT 전무 (major) | alerts-evaluator.service.ts:197-225; grep audit=0 |
| §2.1 alert_rule.type 예시 'execution_failure_rate/llm_cost' | CHECK/엔티티는 'failure_rate'\|'duration'\|'llm_cost'. 'execution_failure_rate' 부재, 'duration' 누락 (major) | V016:8; alert-rule.entity.ts:10 |
| §1.2 Dashboard 가 audit_log 를 집계 소스로 읽음 | dashboard.service 에 audit_log 참조 없음 (minor) | grep audit in dashboard=0 |
| §2.1 alert_rule 인덱스 idx_alert_rule_workspace 하나 | 추가로 partial idx_alert_rule_enabled ON(enabled) WHERE enabled=true 존재 — 누락 (minor) | V016:22-23 |
| §Overview 진입점 'ALERTS_EVALUATOR_QUEUE cron+processor' | 정확. 다만 cron 아닌 BullMQ repeatable(pattern */5), @Processor 통합형 (minor) | alerts-evaluator.service.ts:13,37,59 |

- **structuralNotes**: 파일·네이밍 적절. §1.4 System Status SoT 링크 실존, 0-overview §4 큐 12개=MONITORED_QUEUES 일치. 다만 코드 system-status.constants 는 spec/2-navigation/15-system-status.md 를 SoT 로, 본 spec 은 5-system/16-system-status-api.md 를 가리켜 SoT 참조 두 갈래 — 일관성 점검 권장.

## 일치 확인됨

- **spec/data-flow/6-knowledge-base.md** (none / keep): KB/RAG 데이터플로우가 스키마·엔드포인트·큐·동시성·재시도·WS 이벤트·알려진 divergence 모두 코드와 정밀 일치. 미세 보완 여지만 — §Overview '코드 진입점' 목록에 graph.controller.ts(re-extract 경로)와 knowledge-base.controller 의 일부 REST surface(retry-failed:231, embedding-probe:129, embedding-stats:211)가 빠져 진입점 인덱스가 service 계층 위주로 편향(서술 문서 특성상 허용 범위, drift 아님).

## 영역 구조·네이밍 이슈

- **frontmatter 부재는 정상**: data-flow/* 는 의도적으로 frontmatter(status/code/id) 없는 서술 문서(spec §2/§3 에서 명시). 0-overview 포함 전 파일에서 이슈 아님. 단, **frontmatter `code:` 글로브가 없어 정합 추적이 본문 '코드 진입점' 목록에만 의존** — 이 목록이 stale 하면(특히 1-audit 메서드명, 12-workspace invitations 귀속) 본문 경로가 실제 동작을 오도하는 구조적 약점이 반복된다.
- **연번·파일명·분류**: 1-audit~12-workspace 연번, N-name.md 패턴, 영역 배치 모두 컨벤션 정상. 재명명/재분류 불필요.
- **교차참조 링크 경로 체계 혼재**: 같은 대상(auth/audit)을 가리키는 링크가 파일마다 절대형(`../5-system/1-auth.md`)과 폴더 상대형(`./2-auth.md`)으로 갈린다(특히 12-workspace 상단 vs §4). data-flow 영역 내 상대 링크 표기를 한 가지로 정규화 권장. 0-overview 도메인 인덱스 표는 링크 텍스트(auth.md)와 타겟(2-auth.md)이 다르나 12/12 모두 resolve.
- **System Status SoT 두 갈래**: 코드(system-status.constants)는 spec/2-navigation/15-system-status.md, spec(9-observability)은 5-system/16-system-status-api.md 를 SoT 로 가리킴 — 단일 SoT 로 수렴 권장.

## 우선 액션 (정렬)

**severe**

1. `spec/data-flow/10-triggers.md` §1.3/§2.2/§3.2 재작성 — Schedule 발사를 1분 sweep/next_run_at polling 에서 BullMQ repeatable job(upsertJobScheduler pattern+tz)로 교체, mermaid·표 갱신.
2. `spec/data-flow/12-workspace.md` §1(헤더 정책)·Rationale 재작성 — X-Workspace-Id 가 코드상 헤더 우선 수용임을 반영(보안 모델 정반대). `activeWorkspaceId`→`workspaceId`, §1.5 switch 엔드포인트(미구현) 제거 또는 미구현 마킹, registerWithInvitation 의 personal workspace 미생성 반영.
3. `spec/data-flow/11-workflow.md` §1.4 재작성 — Assistant 가 DB 미접촉(ShadowWorkflow in-memory + 프론트 Save persist)임을 반영.

**major (대표)**

4. `spec/data-flow/11-workflow.md` — 전송 채널 WebSocket→SSE(text/tool_call/plan/usage/done/error), 버전 생성은 `POST /:id/save` 내부 트랜잭션(별도 /versions POST 없음), 편집 주 경로 bulk `/save` 동기화, role='tool' row 미기록 반영.
5. `spec/data-flow/2-auth.md` — 라우트/status/응답 body 코드 기준 수정: §1.5 `POST /api/users/me/sessions/:familyId/revoke`, §1.3 `GET oauth/:provider`(no /start), §1.1 register 2단계(verifyEmail 에서 personal 생성, 201 message-only), §1.2 응답 {accessToken} 만, 423→401.
6. `spec/data-flow/9-observability.md` — health checks{database,redis}(S3 ping 제거), alerts payload {triggeredAt}+단일 repeatable job, audit_log 미기록 반영, alert type 'failure_rate'|'duration'|'llm_cost' 로 수정.
7. `spec/data-flow/8-notifications.md` — notify() 단일 표면·이메일 발송·execution_failed/schedule_failed/team_invite 발사를 'follow-up 미구현'으로 마킹, 실제 발사 3종(background_failed/integration_expired/integration_action_required)으로 type 표 갱신.
8. `spec/data-flow/4-file-storage.md` §3·Rationale — KB 삭제 시 S3 cleanup 이 remove() 루프로 이미 구현됨을 반영(orphan 가능·미구현 주장 제거), presigned URL 격리는 미구현(설계 의도)으로 시제 수정.
9. `spec/data-flow/7-llm-usage.md` — chat(config: LlmConfig,...) 시그니처·resolveConfig 분리 반영, thinking_tokens 가 cost_usd 에 미포함임을 정정, provider enum 5종(local) 반영.
10. `spec/data-flow/5-integration.md` — 큐명 `integration-expiry`→`integration-expiry-scanner` 전면 교체, §1.2 OAuth start 를 `POST /oauth/begin`+JSON{authUrl,state} 로 수정.
11. `spec/data-flow/1-audit.md` — 진입점 메서드 findAll/findForUser 로 수정, Rationale 의 login_history.event CHECK '없음'→'있음(chk_login_history_event, V058)' 정정, event 7종(webauthn_failed 추가).
12. `spec/data-flow/10-triggers.md` major 항목 — webhook inactive 404→410 Gone, manual `/run`→`/execute`, chat-channel inbound 분기(서명검증/handshake/modal) 문서화.

**minor (대표)**

13. `spec/data-flow/0-overview.md` §1.2 — PG 이미지 표기에 k8s 로컬 overlay 가 pg16 임을 주석(인프라 간 버전 차이) 또는 통일.
14. `spec/data-flow/3-execution.md` — §1.3 `POST /:id/continue {formData}` + WS 인터랙션 4종으로 수정, state-machine 누락 전이 2건(waiting→failed, failed→running) 다이어그램 반영, V034 인덱스 3컬럼 정정, §1.1 콜론→dot 통일.
15. 영역 전반 — data-flow 내 교차참조 상대 링크 표기 정규화 + System Status SoT 단일화.
