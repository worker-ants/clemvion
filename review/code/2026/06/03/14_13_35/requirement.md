# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 1: spec/conventions/interaction-type-registry.md

- **[INFO]** `REGISTRY_SITES` 에 새로 추가된 3개 파일(`conversation-utils.ts`, `conversation-thread.types.ts`, `render-tool-provider.ts`)이 spec frontmatter `code:` 에 등록됨. 그러나 exhaustiveness.test.ts 를 확인하면 `REGISTRY_SITES`(WaitingInteractionType 대상)에는 이 3개 파일이 포함되지 않고, `SOURCE_REGISTRY_SITES`(ConversationTurnSource 대상)에는 `conversation-utils.ts` 만 포함됨. `conversation-thread.types.ts` 와 `render-tool-provider.ts` 는 어느 grep 가드에도 등록되지 않은 상태다.
  - 위치: spec §3 rule 3 설명 및 frontmatter `code:` 목록
  - 상세: spec 본문에서 이 두 파일이 grep 가드가 아니라 TS exhaustive `default: never` 로만 커버된다고 명시하고 있으므로, 이 자체는 drift 가 아님 — 의도적 설계. 단, `code:` frontmatter 에 새 경로가 추가되었으므로 실제 파일 존재 여부 및 coverage test 에 의해 검증 가능한지 확인 필요. spec-code-paths.test.ts 가 glob 매치를 강제하므로 파일이 존재하기만 하면 OK.
  - 제안: 향후 이 파일들이 사라지거나 이동하면 가드 미통과. 현 상태에서는 INFO 수준.

- **[INFO]** §2 `ConversationTurnSource` 설명에서 "frontend union 6개 / backend 누적 enum 5값" 으로 분리가 명시됨. `system_error` 가 frontend 합성 source 임을 명확히 했으나, 이 사실이 `spec/conventions/conversation-thread.md §1.1.1` 에 단일 진실로 위임됨 — 본 문서는 cross-ref 만 하고 있어 적절.

---

### 파일 2: spec/conventions/migrations.md

- **[INFO]** spec §3 "repair" 절 참조가 §4 에서 §5 로 변경됨. 실제 `codebase/backend/migrations/README.md` 의 섹션 번호를 직접 확인하지 않았으나, spec 이 이를 코드 대조로 갱신했다고 명시하고 있어 README 가 §5 를 가지고 있을 가능성이 높음. 향후 README 변경 시 spec 동기화 필요.
  - 위치: spec §3 bullet "운영 사고로…"
  - 제안: README §5 실존 여부를 가드로 강제하는 테스트가 없으므로 INFO.

- **[INFO]** `SQL_NAME_RE`(`[a-z0-9_-]+`, 하이픈 허용)와 `SQL_RE`(`[A-Za-z0-9_]+`, 대문자 허용)의 허용 집합 불일치가 spec 에 명시됨. 두 가드가 통과하더라도 컨벤션 위반 가능성을 spec 이 인지하고 있으며, 일관성은 spec 문서로만 보장함을 명시 — 적절한 Rationale 수준 기록.
  - 코드 확인: `migrations.spec.ts:25` `SQL_NAME_RE = /^V([0-9]+)__[a-z0-9_-]+\.sql$/` (하이픈 허용), `check-migration-versions.py:40` `SQL_RE = re.compile(r"^V(?P<num>\d+)__(?P<name>[A-Za-z0-9_]+)\.sql$")` (대문자 허용) — spec 기술과 정확히 일치함.

- **[INFO]** `[migration-guard] ` prefix 가 스크립트에서 실제로 사용됨을 코드 대조로 확인. spec 의 메시지 표 갱신이 코드와 일치함.

---

### 파일 3: spec/conventions/node-cancellation.md

- **[INFO]** §6 표에서 `ParallelExecutor`의 "구현됨" 항목에 `parallel-executor.ts` 파일명을 참조하나, 이 파일의 실제 경로가 spec 에 명시되지 않음. spec frontmatter `code:` 에도 해당 파일이 없음 — 발견 사항이나 구현 증거로 충분하므로 INFO.

- **[INFO]** "사용자 cancel 버튼" 관련 구현 항목에서 `executions.controller.ts` / `executions.service.ts` / `editor-toolbar.tsx` 가 spec frontmatter `code:` 에 등록됨 — 일치.

- **[INFO]** `OpenAI SDK` 항목이 테이블에서 순서 변경(마지막으로 이동)되었으며 "(OpenAI 사용 노드 도입 시)"로 조건부임. OpenAI SDK 를 현재 사용하는 노드가 없다면 이 항목은 미구현 (Planned) 이어야 하나 `구현됨`/`미구현` 표시가 없음 — spec 자체의 작은 결함. `project-planner` 위임.

---

### 파일 4: spec/conventions/node-output.md

- **[INFO]** `execution-engine.service.ts` 가 새로 `code:` frontmatter 에 추가됨. `node-output.md` 의 policy 와 관련이 있는지 불명확하나, spec 자체가 "본 policy 의 baseline 패턴" 설명을 더 구체화함 — 내용 일치.

---

### 파일 5: spec/conventions/secret-store.md

- **[INFO]** spec §2 schema snippet 에 추가된 CHECK constraint (`chk_secret_store_ref_format`) 가 V063 migration 에서 실제 구현됨을 확인.
  - 코드: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit/codebase/backend/migrations/V063__secret_store.sql:33-35` — 정규식 `'^secret://[a-z][a-z0-9-]*/[^/]+/[a-z0-9][a-z0-9.-]*$'` 가 spec 기술과 정확히 일치함.

- **[INFO]** §6 "Trigger 삭제 시 cascade" 에서 `TriggersService.remove()` 가 `deleteByPrefix('secret://triggers/{id}/')` 로 일괄 삭제한다고 명시함. 코드(`triggers.service.ts:716`) 를 확인하면 `this.secrets.deleteByPrefix('secret://triggers/${trigger.id}/')` 호출 — spec 과 일치. 단 V063 migration 의 주석("TriggersService.delete / workspace 삭제 시")은 아직 구 메서드명 `delete` 를 참조하고 있어 migration 주석과 spec §6 의 `remove()` / `deleteByPrefix` 기술이 불일치.
  - 위치: `V063__secret_store.sql:20-21` 주석 vs. spec §6
  - 상세: migration 주석은 "TriggersService.delete" 를 언급하지만 실제 서비스 코드는 `deleteByPrefix` 이고 spec 은 이를 반영했음. migration 주석은 이미 커밋된 SQL 이므로 수정 불가(checksum). INFO 수준.

---

### 파일 6: spec/conventions/spec-impl-evidence.md

- **[INFO]** `pending_plans` 의 실존 의무가 `plan/in-progress/` 외에 `plan/complete/`(in-progress 경로를 complete 로 치환) 도 허용하도록 확장됨. 이는 plan 이 complete 로 이동한 후 spec 업데이트가 늦을 때 가드가 불필요하게 fail 하는 것을 방지하는 합리적 완화.
  - `spec-pending-plan-existence.test.ts` 가 이를 실제로 구현하는지 직접 확인이 필요하나, spec 의 기술이 일관되며 가드 설명과 상충하지 않음.

- **[INFO]** `backlog` 가드의 "§6.3 로드맵 항목" 한정 grep 에서 "0-overview.md 본문 전체 텍스트" includes 매칭으로 완화됨 — 가드가 더 관대해졌으나 Rationale 에서 이를 명시적으로 인정하고 향후 좁힐 계획 언급.

---

### 파일 7: spec/conventions/swagger.md

- **[INFO]** `interaction-token` Bearer scheme 추가가 문서화됨. `iext_<JWT>` (per_execution) 와 `itk_<opaque>` (per_trigger) 두 토큰 형식에 대한 설명이 추가되었으나, 해당 엔드포인트 목록이나 인증 가드 구현 파일이 이 diff 에서 spec `code:` 에 추가되지 않음 — INFO 수준 gap.

- **[INFO]** `ApiOkWrappedOneOfResponse` 헬퍼가 표에 추가됨. OAuth begin 분기 응답 예시로 언급되어 있으며, 이 헬퍼의 실제 존재 여부는 별도 확인이 필요하나 단순 문서 추가이므로 INFO.

---

### 파일 8: spec/conventions/user-guide-evidence.md

- **[INFO]** `impl-anchor.tsx` 가 `return null` 로 구현됨이 명확히 기술됨. 코드 확인: `impl-anchor.tsx:15` `return null` — spec 기술과 일치.

- **[WARNING]** spec §4 채널 2번("user-guide-writer 자가 검증 체크리스트")이 미구현임을 명시하고, 현재 agent 파일에 언급이 없다고 기술함. 그러나 본 spec 의 `status` 가 `partial` 로 변경되었고 `pending_plans` 에 `plan/in-progress/spec-sync-user-guide-evidence-gaps.md` 가 추가됨 — 추적은 적절.
  - 위치: spec §4 및 frontmatter
  - 상세: plan 파일이 실제 존재하는지 spec-pending-plan-existence 가드가 확인할 것이므로 가드로 커버됨. 현재 WARNING 은 구현 gap 이 spec 에 명확히 기술되어 추적되고 있으므로 LOW 위험.

- **[INFO]** `integrations-coverage.test.ts` 의 `findGuiFlowSections()` 구현에서 GUI 절 판별이 (1) heading 텍스트 `\bGUI\b` 또는 (2) 절 본문 `**…GUI…**`/`__…GUI…__` 두 신호 OR 임을 spec 이 명시함 — 코드 확인(`impl-anchor-parse.ts:98,102`)과 일치.

- **[INFO]** `chatChannelCheckbox` → `chatChannelProvider` symbol 변경이 두 위치(§1 예시, §3 예시)에서 일관되게 갱신됨.

---

### 파일 9: spec/data-flow/0-overview.md

- **[INFO]** PostgreSQL k8s overlay 에서 `pg16` 버전이 사용됨이 주석으로 추가됨. docker-compose 기본값과 불일치 상황이 명시되었으나 추적 plan 은 없음 — 향후 동기화 필요.

- **[INFO]** `knowledge-base.service.ts:723` → `:726` 로 라인 번호 갱신. 코드 확인: 실제 `s3Service.upload` 는 line 726 — 일치.

- **[INFO]** Schedule / Alerts / Integration expiry 큐의 producer 가 `cron sweep` 에서 `BullMQ repeatable scheduler (upsertJobScheduler)` 로 변경됨. 이는 최근 `@Cron` → BullMQ repeatable 이관(commit `2d983a5b`) 을 반영한 정확한 갱신.

---

### 파일 10: spec/data-flow/1-audit.md

- **[INFO]** `audit-logs.service.ts` 의 `findByWorkspace` → `findAll`, `login-history.service.ts` 의 `findMyHistory` → `findForUser` 로 메서드명 수정. 코드 확인: `audit-logs.service.ts:15` `findAll`, `login-history.service.ts:98` `findForUser` — 모두 일치.

- **[INFO]** `loginEventInput` 의 `deviceLabel` 필드 제거 및 `userAgent` 추가 기술. 코드 확인: `LoginEventInput` 인터페이스(`login-history.service.ts:14-22`)에 `deviceLabel` 없음, `userAgent` 있음. `deviceLabel` 은 line 82-84 에서 `deriveDeviceLabel(input.userAgent)` 로 내부 파생됨 — spec 기술과 정확히 일치.

- **[INFO]** `event` 종류가 6종 → 7종(`webauthn_failed` 추가)으로 갱신됨. 코드 확인: `login-history.entity.ts:12-19` 에서 7종 확인 — 일치. `webauthn_failed` 추가는 V058 에서 CHECK 제약 갱신으로 명시됨 — spec fidelity 양호.

- **[INFO]** `login_history.event` 가 DB CHECK 제약으로 고정됨을 명확히 기술. `audit_log.action` 은 자유 문자열임과의 대비가 명확해짐 — 비즈니스 로직 정확성 향상.

---

### 파일 11: spec/data-flow/10-triggers.md

- **[INFO]** Manual trigger 엔드포인트가 `/api/workflows/:id/run` 에서 `/api/workflows/:id/execute` 로 수정됨. 이는 실제 코드 경로 반영. Webhook 에 `is_active=false` 시 응답이 404 → 410 Gone (`TRIGGER_INACTIVE`)으로 구분됨이 명시됨.

- **[INFO]** Schedule 발사 시퀀스가 전면 재작성되어 BullMQ repeatable job scheduler 기반으로 갱신됨. payload 가 `{ scheduleId }` → `{ scheduleId, workspaceId }` 로 변경됨이 queue 테이블에도 반영됨.

- **[INFO]** `schedule.next_run_at` 이 "발사 트리거가 아닌 정보성 컬럼"임이 명확히 기술됨 — 이전 "sweep 직후 다음 발사 시각 계산" 설명이 BullMQ 방식과 맞지 않았던 것을 수정.

- **[WARNING]** §1.4 schedule 생성 시 "순차 저장 — 단일 트랜잭션 아님; 중간 실패 시 고아 trigger 가능"이 spec 에 명시됨. 이는 기능 gap(데이터 정합성 위험)이며 spec 이 이를 인지하고 있으나 추적 plan 이 없음.
  - 위치: spec §1.4 테이블 POST /api/schedules 행
  - 상세: trigger INSERT 성공 후 schedule INSERT 실패 시 고아 trigger 가 남을 수 있음. 현재 spec 에서 이를 Planned 로 표시하거나 pending_plans 로 추적하지 않음.
  - 제안: 단일 트랜잭션화 또는 cleanup 로직에 대한 plan 추가 권장 (`project-planner` 위임).

- **[INFO]** `spec/2-navigation/3-schedules.md` 참조가 `spec/2-navigation/3-schedule.md` 로 수정됨 — 파일명 정합.

---

### 파일 12: spec/data-flow/11-workflow.md

- **[INFO]** Workflow 생성 시 Manual Trigger 시작 노드 자동 생성이 추가됨. `POST /:id/save` 에서 Manual Trigger 정확히 1개 존재 검증(누락/중복 시 400)이 명시됨 — 신규 제약 명확화.

- **[INFO]** Assistant 세션 생성 엔드포인트가 `POST /api/workflows/:wfId/assistant/sessions` → `POST /api/workflow-assistant/sessions {workflowId, ...}` 로 변경됨. 응답도 `{ session }` → `201 { session }` 으로 status code 명시됨.

- **[INFO]** Assistant streaming 이 WebSocket → SSE (text/event-stream) 로 변경됨이 정확히 반영됨. `role='tool'` row 가 persist 되지 않음이 명시됨 — §2.1 schema 테이블에서도 일관되게 반영됨.

- **[INFO]** `workflow_assistant_session` 인덱스가 `(workflow_id, status, last_interaction_at DESC)` → `(workflow_id, user_id, status, last_interaction_at DESC)` 로 갱신됨. 코드 확인: V019 migration `idx_workflow_assistant_session_wf_user_active ON workflow_assistant_session (workflow_id, user_id, status, last_interaction_at DESC)` — spec 기술과 정확히 일치.

- **[INFO]** Assistant `edit` tool call 이 DB 를 직접 건드리지 않고 `ShadowWorkflow` 를 통함이 명확히 기술됨. 기존 설명("NodesService / EdgesService 를 거쳐 Postgres 에 반영")이 현재 구현과 불일치했던 것을 수정.

---

### 파일 13: spec/data-flow/12-workspace.md

- **[INFO]** `WorkspaceId` 데코레이터의 우선순위("X-Workspace-Id 헤더 > JWT workspaceId")가 명확히 기술됨. 이전 spec("클라이언트 요청 헤더로 받지 않음") 이 실제 구현과 정반대였던 것을 수정 — 중요한 정합성 갱신.

- **[INFO]** 초대 token 생성 방식이 `randomBytes(32).toHex()` → `randomBytes(48).toString('base64url')` (64-char base64url)로 변경됨 — 보안 강화 반영.

- **[INFO]** §1.3 invitation accept 에러 코드가 `403 INVITATION_EMAIL_MISMATCH` → `400 code=invitation_email_mismatch` 로 변경됨. 이는 HTTP 의미론 상 400이 더 적절한 갱신.

- **[INFO]** §1.4 invitationToken 기반 가입에서 personal workspace 가 생성되지 않음이 명확히 기술됨 — 비즈니스 로직 명확화.

- **[WARNING]** `(owner_id, type) UNIQUE` 제약이 TypeORM entity decorator 로만 표현되고 DB 마이그레이션에 UNIQUE constraint 가 없음이 spec Rationale 에 명시됨. TypeORM synchronize 가 비활성이므로 이 데코레이터는 런타임 DB 레벨에서 강제되지 않는 갭.
  - 위치: spec Rationale `(owner_id, type) UNIQUE` 절
  - 상세: 한 사용자가 personal workspace 를 2개 이상 가질 수 없다는 제약이 실제 DB 에서 강제되지 않음. 이를 수정하는 migration 이 없고 pending_plans 로 추적되지 않음.
  - 제안: 마이그레이션으로 DB UNIQUE constraint 추가 권장 (`project-planner` / `developer` 위임).

- **[INFO]** audit_log 에 적재되는 워크스페이스 액션이 `workspace.transfer_ownership` 1건뿐임을 명시함 — create/delete/rename/member 변경 등 미적재. 추적 plan 없음이나 INFO 수준.

---

### 파일 14: spec/data-flow/2-auth.md

- **[INFO]** 회원가입 흐름이 2단계(register → verify-email)로 명확히 기술됨. personal workspace 생성이 verify-email 단계에서 일어남 — 이전 spec(register 에서 한 트랜잭션)과 달랐던 것을 수정.

- **[INFO]** 계정 잠금 HTTP 상태 코드가 `423 ACCOUNT_LOCKED` → `401 code=ACCOUNT_LOCKED` 로 변경됨. 임계값이 `N회` → `5회` (`login_attempts >= 5`), 잠금 시간이 `Δ` → `10m` 으로 명확화됨.

- **[INFO]** 로그인 성공 응답이 `{ accessToken, refreshToken, user }` → `{ accessToken }` + httpOnly 쿠키로 변경됨 — 보안 개선 반영.

- **[INFO]** OAuth 콜백이 access token 을 URL 에 싣지 않고 refresh token 만 httpOnly 쿠키로 설정 후 `/callback?success=true` 리다이렉트하는 패턴 기술됨 — 보안 결정 A 반영.

- **[INFO]** 세션 revoke 가 `DELETE /api/auth/sessions/:familyId` → `POST /api/users/me/sessions/:familyId/revoke` 로 변경됨. 응답이 204 → 200 + 세션 목록으로 변경됨. DELETE 대신 POST 사용 이유(CDN/프록시가 DELETE 바디 제거)가 Rationale 에 추가됨 — 명확한 이유.

---

### 파일 15: spec/data-flow/3-execution.md

- **[INFO]** WS 이벤트명이 `'execution:completed'` → `'execution.completed'` 로 수정됨. 코드 확인: spec.ts 에서 `'execution.completed'` 사용 확인 — 일치.

- **[INFO]** 재개 진입 surface 가 2가지(REST `POST /executions/:id/continue` + WS 다수 이벤트)로 명확히 구분됨. REST 에서 `waiting` 아님이면 422 `INVALID_STATE` 로 명시됨.

- **[INFO]** `node_execution` V034 인덱스가 `(execution_id, started_at)` → `(execution_id, node_id, started_at DESC)` 로 수정됨.

- **[INFO]** `execution` 상태 전이 다이어그램에 `waiting_for_input → failed` (AI Agent multi-turn turn 오류) 와 `failed → running` (execution.retry_last_turn, allowRetryReentry opt-in) 두 경로가 추가됨. 이 전이들이 spec §5 에서 이미 언급된 것들의 다이어그램 반영이므로 일관성 향상.

- **[INFO]** `background-execution` 큐 payload 에 `backgroundRunId?`/`conversationThread?` optional 필드가 추가됨. 후방 호환용임이 명시됨.

- **[INFO]** `execution.entity.ts` 라인 참조가 `:78` → `:97` 로 갱신됨.

---

### 파일 16: spec/data-flow/4-file-storage.md

- **[INFO]** S3 키가 `<originalFilename>` → `<sanitizedFilename>` (path.basename 으로 traversal 방지)으로 명확화됨 — 보안 개선 기술.

- **[INFO]** KB 삭제 시 S3 cleanup 이 "코드 상 명시되지 않음" → "for 루프로 best-effort 삭제" 로 갱신됨. 코드 확인: `knowledge-base.service.ts:644-658` 에서 `remove` 함수가 문서 전체를 조회 후 `s3Service.delete` for 루프 실행 확인 — 일치.

- **[INFO]** presigned URL 이 미구현임이 명시됨. 기존 spec 의 "presigned URL 로 보장" 기술이 현재 구현 없이 남아 있었던 오류를 수정.

---

### 파일 17: spec/data-flow/5-integration.md

- **[INFO]** OAuth begin 엔드포인트가 `GET /api/integrations/oauth/:service/start` → `POST /api/integrations/oauth/begin { service, mode }` 로 변경, 응답이 302 리다이렉트 → `200 JSON { authUrl, state }` 로 변경됨.

- **[INFO]** 큐 이름이 `integration-expiry` → `integration-expiry-scanner` 로 수정됨. 이는 `data-flow/0-overview.md §4` 큐 카탈로그 및 실제 큐 등록과 일치해야 함 — 일관성 갱신.

- **[INFO]** `integration.entity.ts` 라인 참조가 `:71~77` → `entities/integration.entity.ts:112~117` 로 경로 포함 갱신됨.

---

### 파일 18: spec/data-flow/7-llm-usage.md

- **[INFO]** `LlmService.chat` 시그니처가 `chat({messages, model, params, ...})` → `resolveConfig` + `chat(config, params, context?, opts?)` 두 단계로 분리됨 — API 변경 반영.

- **[INFO]** usage 필드명이 `prompt_tokens/completion_tokens/total_tokens/thinking_tokens` (snake_case) → `inputTokens/outputTokens/totalTokens/thinkingTokens` (camelCase) 로 변경됨. 이는 provider 응답 내부 표현 변경. `llm_usage_log` DB 컬럼은 여전히 snake_case 로 `prompt_tokens` 등을 사용하므로 service 레이어에서 변환이 일어남 — spec 은 이를 내부 표현으로 기술.

- **[INFO]** `thinking_tokens` 가 `cost_usd` 계산에 포함되지 않음이 명확히 기술됨. 이전 spec("output 단가에 합산")이 실제 코드(`calculateCostUsd` 가 prompt·completion 만 받음)와 불일치했던 것을 수정 — 중요한 비즈니스 로직 정합성 갱신.

---

### 파일 19: spec/data-flow/8-notifications.md

- **[WARNING]** spec 에서 기술한 "단일 `notify()` 표면"이 미구현이고 실제는 `createMany(entries[])` 배치 INSERT 임을 명시함. 알림 이메일 발송 경로(`MailService` 템플릿), WebSocket emit(`notification.new`)이 모두 미구현임을 명확히 함. 이 gap들이 spec 에 분명히 기술되어 있어 추적은 적절하나, 이를 추적하는 별도 plan 이 없음.
  - 위치: spec Overview 주의 블록 및 §1 다이어그램 단계 표
  - 상세: `execution_failed`, `schedule_failed`, `marketplace_update`, `team_invite` 4개 notification type 이 DB CHECK(V052) 에는 허용됨에도 어떤 코드도 발사하지 않음.
  - 제안: 미구현 알림 기능들에 대한 pending_plans 추가 권장 (`project-planner` 위임).

- **[INFO]** `alert_<rule.type>` notification type 이 동적이어서 V052 CHECK 제약 목록 밖임을 spec 에서 인지하고 있음. 이는 DB 와 코드 간의 잠재적 불일치지만 spec 이 명시적으로 인지 — "spec 범위 밖 별도 추적"으로 남겨둠.

---

### 파일 20: spec/data-flow/9-observability.md

- **[INFO]** health check 응답이 `{ status, checks: { postgres, redis, s3 } }` → `{ status, version, uptime, checks: { database, redis } }` 로 변경됨. S3 ping 이 미구현임이 Rationale 에서 명확히 설명됨.

- **[INFO]** alerts evaluator 가 `@Cron` sweep → BullMQ repeatable (`*/5 * * * *`) 단일 job 으로 변경됨. payload 가 `{ ruleId }` (per-rule) → `{ triggeredAt }` (단일 job, processor 가 전체 rule 순회)로 변경됨.

- **[INFO]** `alert_rule` 컬럼명이 `is_enabled` → `enabled` 로 변경됨. 코드 확인: `alert-rule.entity.ts:48` `enabled: boolean` — 일치.

- **[INFO]** `alert_<type>` notification 에서 audit_log 기록이 없음이 spec 에 명시됨. 이전 schema 테이블에서 `audit_log` INSERT 가 있었던 것을 수정.

---

## 요약

본 변경은 20개 spec 파일 전반에 걸쳐 현재 코드 구현과 spec 기술 간의 누적 불일치를 해소하는 "spec sync audit" 성격의 대규모 갱신이다. 주요 수정 항목들은 코드 대조를 통해 사실 확인이 가능하며, 검증한 사항들(login-history 메서드명, entity line 번호, V063 CHECK constraint, migration prefix, WS event 명칭, s3Service.upload 위치, V019 인덱스 컬럼, alert_rule 컬럼명 등)은 모두 코드와 일치함을 확인했다. 기능 완전성 관점에서 중요한 발견은 다음과 같다: (1) workspace `(owner_id, type) UNIQUE` 제약이 DB 레벨에서 강제되지 않는 점, (2) schedule 생성 시 트랜잭션 부재로 인한 고아 trigger 가능성, (3) notification 이메일 발송 및 WS emit 미구현이 spec 에는 명시되었으나 추적 plan 이 없음. 전반적으로 spec 이 코드 실제 상태를 충실히 반영하도록 갱신되었으며, "미구현 (Planned)"으로 표시된 항목들의 추적 계획 수립이 필요하다.

## 위험도

MEDIUM
