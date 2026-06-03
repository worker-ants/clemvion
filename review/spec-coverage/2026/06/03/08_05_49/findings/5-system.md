# Spec 감사 — 5-system

## 요약

- **감사 파일 수**: 18건
- **severity 분포**: none 1 / minor 4 / major 13 / severe 0
- **핵심 메시지**:
  - 핵심 surface(인증·RAG·실행엔진 상태머신·시스템상태 API)는 코드와 정밀 일치하나, **transport·운영 표면(WebSocket framing, MCP 진단, webhook 응답계약, rate-limit, retry backoff)에서 spec 약속이 코드에 미구현인 major drift 가 다수**다.
  - 가장 큰 괴리는 `6-websocket-protocol.md` — spec 이 raw WebSocket framing 으로 작성됐으나 구현은 socket.io 라 transport 정정(rewrite) 필요.
  - 여러 파일에서 frontmatter `code:` 글로브가 spec 본문이 핵심으로 다루는 구현 파일(큐 프로세서·rotation·diagnostics·error-codes)을 누락 → fix-code-paths 권장이 반복.

## 파일별 발견사항

### spec/5-system/1-auth.md — minor / partial→implemented / keep, fix-frontmatter
- **headline**: 인증/인가 spec 은 코드와 매우 정확히 일치 — WebAuthn·2FA 분기·복구코드·RBAC·V058·pruner 전부 부합. `status='partial'` 은 구현 완성도 대비 과소평가로 보임.
- findings (전부 일치 확인, minor):
  - OAuth 콜백 `?success=true` 만 리다이렉트, token URL 미동봉 → auth.controller.ts:524-528 부합.
  - §1.4.3 WebAuthn 비활성 503 WEBAUTHN_DISABLED + countCredentials 0 분기 → webauthn.service.ts:102-111, auth.service.ts:316-336 일치.
  - §1.4 counter 역행 시 단일 트랜잭션+pessimistic lock+credential 삭제+revoke, audit 는 트랜잭션 밖 → webauthn.service.ts:304-444 부합.
  - §1.1 PW 정책(8자, 4종 중 3종) → password.util.ts:7-32 일치.
  - §1.1.A reset-password 가 passwordHash 만 갱신·refresh 전체 revoke·WebAuthn 보존 → auth.service.ts:614-647 부합.
  - §4.3 LoginHistory 180일, BullMQ repeatable `0 3 * * *` Asia/Seoul → login-history-pruner.service.ts:6-44, V058 부합.
  - §2.2 Access Token payload(sub/email/workspaceId/role, 15분) → auth.service.ts:676-715 부합.
  - §1.5.4 초대 에러코드 4종 → workspace-invitations.service.ts, auth.service.ts:116 일치.
- frontmatterIssues: `status: partial` 사유가 LDAP/SAML(§1.3 선택) 미구현이면 정당, auth-config 후속이면 본 spec 범위 밖이라 모호. webauthn.config.ts(common/config)가 §1.4.3 핵심인데 글로브 미포함.

### spec/5-system/10-graph-rag.md — minor / implemented / fix-code-paths, patch-content
- **headline**: 데이터모델·검색흐름·파이프라인 정밀 일치. drift 는 (1) graph_error 이벤트 미emit, (2) frontmatter code 글로브가 핵심 구현 다수 누락 2건 minor.
- findings:
  - §6/§7 `document:graph_error` 이벤트 → graph-extraction.service.ts 가 한 번도 emit 안 함. 실제는 graph_started/_progress/_completed/_retry/_failed 5종, graph_error 는 websocket.service.ts:260 타입 union 에만 dead declared.
  - frontmatter code 글로브가 graph-extraction.processor.ts·stuck-document-recovery.service.ts·graph.controller.ts·V037 마이그레이션·retry-failed.dto.ts·kb-form-body.tsx·entity-detail-dialog.tsx·graph-visualization.tsx 누락.
  - KB-GR-SR-06 메타필드 traversedEntities/traversalDepth/seedChunkIds(목록형) → 실제는 seedChunkCount/traversedEntityCount/maxDepth/expandedChunkCount(개수형). §4.3 JSON 예시와는 일치하나 §3.6 본문 필드명 불일치.
  - §5 API 표 path param `:kbId` → 실제 `@Controller('knowledge-bases/:id')`. 표기 차이.
- structuralNotes: line 17 관련문서 첫 링크가 자기 자신(self-link). PRD+Spec 통합형이나 단일 기능이라 split 강제 불필요.

### spec/5-system/11-mcp-client.md — major / partial / patch-content, fix-frontmatter
- **headline**: MCP 코어(transport·tool 노출·에러 vocab·연결테스트)는 잘 맞으나, §6.2 mcpDiagnostics surface·외부 provider serverSummaries 미구현·§9 테스트 응답 코드/형식 불일치가 major drift.
- findings:
  - §6.2 mcpDiagnostics.errors[] 누적 → 외부 McpToolProvider 가 아무것도 push 안 함(allSettled→warn만). buildMcpDiagnosticsMeta 는 serverSummaries 만 emit. attempted/serverCount/toolCalls/resourceReads/promptGets/errors 전부 미구현 (mcp-diagnostics.ts 주석이 follow-up 명시). **major**
  - §6.2 serverSummaries[] 외부 mcp 포함 → push 는 Cafe24McpToolProvider 뿐, 외부 service_type='mcp' Integration 은 진단 표면에 미노출. **major**
  - §9 URL 검증 실패 MCP_INVALID_URL / 실패 시 INTEGRATION_TEST_FAILED(422) → MCP_INVALID_URL 코드 부재(실제 MCP_HTTPS_REQUIRED), previewTest 는 HTTP 200 OK body 로 반환·422 안 던짐(422 는 rotate 경로만). **major**
  - §8.2 에러 vocabulary 완전성 → 코드는 표에 없는 MCP_TOOL_ERROR·MCP_UNKNOWN_TOOL 반환, 역으로 표의 MCP_CONNECT_FAILED·MCP_LIST_FAILED·MCP_TIMEOUT 은 외부 provider 경로에서 미emit. **major**
  - §3.3 cached_capabilities 캐시 → 심볼 코드베이스 부재, 미구현(미리보기는 매번 live). minor
  - §5.4 read_resource uri description 'use list_resources to discover' 부기 누락. minor
- frontmatterIssues: `status: implemented` 과대 → partial 이 정확. mcp-test-connection.service.ts(§9)·mcp-error-codes.ts(§8.2)·tool-providers/mcp-diagnostics.ts(§6.2) code 글로브 누락.

### spec/5-system/12-webhook.md — major / partial / patch-content
- **headline**: 인증/파라미터/HMAC/URL base 핵심은 정합하나, 비활성 chatChannel 트리거의 202-ignored 분기와 1MB body 한도가 코드와 어긋남(major).
- findings:
  - WH-EP-07/§3.1/§7: config.chatChannel 비활성 트리거는 202 Accepted+{ignored:true} → handleWebhook 이 isActive=false 면 chatChannel 분기(103-111) 도달 전 무조건 410 GoneException. 202-ignored 선행 인증 로직 없음. **major**
  - WH-NF-02/§8 1MB body→413 → main.ts 전역 body-parser limit 없음. 유일한 게이트는 공개 webhook 전용 32KB(DEFAULT_MAX_BODY_BYTES), 인증 webhook 은 무제한. spec 1MB 임계와 다름. **major**
  - §7 step10 성공 응답 {executionId,message} 뿐 → 코드는 Slack url_verification/Discord PING/native modal 등 200 OK 비-래핑 응답 경로 다수. minor
  - §8 글로벌 throttler 100 req/min → 일치하나 /api/hooks POST 는 PublicWebhookThrottleGuard 의 IP 단위 분당/시간당 한도 별도 적용, spec 누락. minor
- frontmatterIssues: public-webhook-throttle.guard.ts(body 32KB·IP rate-limit)·hooks.controller.ts code 글로브 누락. §13 'PRD Webhook' self-link.

### spec/5-system/13-replay-rerun.md — minor / implemented / keep
- **headline**: spec↔코드 거의 완벽 정합(API/DTO/마이그레이션/엔진 dry-run/프론트 모달·chain badge·i18n 전부). DTO 주석 한 줄만 stale.
- findings:
  - re-run.dto.ts:29 dryRun 필드 주석이 'v1 미지원' 으로 적혀 있으나 실제는 4개 노드(http-request/send-email/database-query/cafe24) 모두 supportsDryRun:true+mock 구현, 엔진 __dryRun 주입·rehydration 완료. **코드 자체 stale 주석(spec drift 아님)**. minor
- frontmatterIssues: V068__execution_dry_run.sql 마이그레이션이 §9.2 핵심인데 code 글로브 누락(minor) — V068 추가 권장.

### spec/5-system/14-external-interaction-api.md — major / partial / patch-content, fix-code-paths
- **headline**: 핵심 surface(REST/SSE/토큰/서명/SSRF/secret rotation)는 충실히 구현됐으나, retry backoff 배율·SSE 분산 fan-out·per-execution rate-limit·getStatus seq/context 4건이 spec 약속과 어긋남.
- findings:
  - §3.1/§6.6 backoff default 5회 1s/4s/16s/64s/256s(base 4) → BullMQ exponential delay:1000(base 2: 1/2/4/8/16). 코드 주석도 base*2^n 인정. **major**
  - §R10 NotificationDispatcher·SSE 어댑터 Redis pub/sub fan-out → SseAdapter·NotificationFanout 모두 in-process RxJS Subject 직접 subscribe, Redis publish 없음. 주석이 'v1 single-instance, 분산 fan-out follow-up' 명시. **major**
  - §5.1/§8.4 inbound /interact execution당 분당 60, status 120 초과 429 RATE_LIMITED → per-execution rate-limit 미구현. 유일한 429 는 SSE 동시연결 초과(TOO_MANY_CONNECTIONS). RATE_LIMITED 코드 부재. **major**
  - §5.3 getStatus 가 currentNode/context/seq 반환 → currentNode:null·context:null 고정, seq:0 placeholder 하드코딩. minor
  - §10 구현 파일 구조 목록이 fanout/processor/guard/interceptor 미기재. minor
  - §R10 listener 이름 NotificationDispatcher → 실제 구독 주체는 NotificationFanout(Dispatcher 는 enqueue-only facade). minor
- frontmatterIssues: triggers.controller.ts/triggers.service.ts(rotate-secret/revoke EIA-NX-12/EIA-AU-07 SoT) code 글로브 밖. `status: implemented` → partial 측면 존재.

### spec/5-system/15-chat-channel.md — major / partial / patch-content, fix-code-paths
- **headline**: CCH-CV-03 running 분기·§5.5 inbound 응답계약(202 ignored/inactive)·§5.4 rotate 응답 shape 가 코드와 어긋남. 핵심 어댑터·rotation·migration 은 대체로 정합.
- findings:
  - CCH-CV-03 running-not-waiting 분기 → isActiveExecution 이 non-terminal 전부 'active' collapse 후 무조건 forward(submit_message). (b) 분기 자체 없음, executionStillRunning 미소비. R9 가 반대한 input-sequence 충돌 발생. **major**
  - §5.5 ignored 케이스 본문 {ignored:true} → 코드는 executionId 에 sentinel 'ignored' 문자열 넣어 {data:{executionId:'ignored',...}}. {ignored:true} 형태 없음. **major**
  - §5.5/R-CC-12 비활성 chatChannel 202 silent skip → isActive 체크(410)가 chatChannel 분기보다 먼저 실행, 비활성 chatChannel 도 410. 202 예외 미구현, 인증 도달 안 함. **major**
  - §5.4 rotate-bot-token 응답 {triggerId,rotatedAt,chatChannelHealth,botIdentity} → 코드 {rotatedAt} 만. 3필드 누락. **major**
  - CCH-NF-03 채널당 분당 60 inbound·chat 단위 큐·폭주 degraded → rateLimitPerMinute 저장만, enforce·큐·degraded 로직 없음. **major**
  - §5.4 404 TRIGGER_NOT_FOUND → 실제 RESOURCE_NOT_FOUND. minor
  - §5.4 400 BOT_TOKEN_INVALID → controller 는 INVALID_BOT_TOKEN/WORKSPACE_REQUIRED. minor
  - §7 구현 트리 telegram 단일 → 실제 telegram/slack/discord 3 provider + shared/registry/rotator/authenticator. stale 스냅샷. minor
- frontmatterIssues: `status: partial` 합리적이나 사유 어긋남(slack/discord 는 구현 완료, 진짜 사유는 CV-03·§5.5·NF-03). pending_plans 3건은 gateway/socket-mode 한정. code 글로브 chat-channel/** 는 stale 아님이나 §7 본문 트리는 telegram-only.

### spec/5-system/16-system-status-api.md — none / implemented / keep
- (일치 확인됨 — 아래 섹션 참조)

### spec/5-system/2-api-convention.md — major / partial / patch-content, fix-code-paths, fix-frontmatter
- **headline**: 에러응답 requestId 누락·webhook message 필드 허구·cursor 페이지네이션 미구현·avatar 업로드/파일업로드 rate-limit 등 4건 실질 drift. 핵심 규약은 대체로 일치.
- findings:
  - §5.3 에러 응답 error.{code,message,details} 만 → GlobalExceptionFilter 가 항상 error.requestId(uuid) 추가, ErrorResponseBodyDto 문서화. spec 예시 과소 기술. minor
  - §11.4 webhook 응답 {executionId, message:"..."} → hooks.service 는 {executionId}(또는 {executionId,status:'pending',interaction}) 만, message 필드 코드에 없음. **major**
  - §8.2 Cursor 페이지네이션 GET /api/executions?cursor → 해당 엔드포인트 부재, GET /api/executions/workflow/:workflowId 가 offset 기반 {page,limit,totalItems,totalPages} 만. cursor/hasNext 미구현. **major**
  - §9 Avatar jpg/png 업로드 → multipart 업로드 엔드포인트는 KB 1개뿐, avatar 는 avatarUrl URL 필드. 파일 업로드 엔드포인트 없음. minor
  - §7 파일 업로드 10 req/min → POST /:id/documents 에 @Throttle 없어 글로벌 100/60s 상속. minor
  - §5.3 details 항목 {field,message} → 코드는 {field,message,code:'INVALID_FIELD'}. minor
  - §11.2 POST 유일 → hooks 컨트롤러에 GET :endpointPath/embed-config 추가 존재. minor
- frontmatterIssues: app.module.ts:204-209(ThrottlerModule)·user-throttler.guard.ts·throttler-skip.ts·hooks.{controller,service}.ts 가 code 글로브 밖. `status: implemented` 과대 → partial.

### spec/5-system/3-error-handling.md — major / partial / patch-content, fix-code-paths
- **headline**: 에러코드 카탈로그·envelope·정책은 잘 일치하나, §7 헬스(vectorDb·degraded)와 §3.3 maxInterval 이 코드에 부재 — 3건 major.
- findings:
  - §7.2 헬스 checks.vectorDb → HealthService.check() 는 database·redis 만. vectorDb 체크 없음. **major**
  - §7.2 healthy/degraded/unhealthy 3-state → 코드는 binary(healthy/unhealthy)만, degraded 분기 없음. redis 미설정 시 'unconfigured'(미문서화). **major**
  - §3.3 Retry maxInterval(30000) 클램프 → maxInterval backend 전체 0건. RetryConfig 3필드뿐, 두 경로 모두 무제한(클램프 없음). **major**
  - §2.1 검증 details code REQUIRED/INVALID_FORMAT → CustomValidationPipe 고정 'INVALID_FIELD'. minor
- frontmatterIssues: nodes/core/error-codes.ts(§1.4,§3.2)·modules/health/health.service.ts(§7) code 글로브 누락.

### spec/5-system/4-execution-engine.md — major / partial / keep, patch-content, fix-code-paths
- **headline**: 상태머신·continuation·rehydration 등 핵심 동작은 정합하나, §4 Worker 모델(별도 task-queue/heartbeat)과 §8 동시실행 제한은 미구현 — partial 타당.
- findings:
  - §4 Worker 모델(Redis BQ task-queue, 1 Worker=1 NodeExecution, taskId/timeout, worker 수 env, 큐 파티셔닝·우선순위 큐) → 일반 노드 실행은 in-process while-loop dispatch. §9.3 자체가 '별도 task-queue 없음' 자기모순 명시. **major**
  - §7.1 Worker Heartbeat 5초/15초 미응답 재큐 → 미구현. 실제는 서버 재시작 시 running+startedAt<now-30분 일괄 FAIL(STUCK_RECOVERY_STALE_MS), code 'WORKER_HEARTBEAT_TIMEOUT' 이름만 재사용. **major**
  - §8 동시 실행 제한(워크스페이스 10/워크플로우 3/노드 500/30분 timeout/5분 큐대기 cancel) → enforcement 코드 없음. EXECUTION_TIMEOUT 은 chat-channel 분류기 문자열로만 존재. **major**
  - §5.5 표현식 제외 code/template → 실제 EXPRESSION_EXCLUSIONS 는 code/table/filter/loop. template 제외 없음. minor
  - §7.4 Continuation Bus 5종 → 코드는 retry_last_turn 포함 6종. §7.4 행·§9.3 큐 표 누락. minor
  - §11 Graceful Shutdown continue 분기 → spec 인라인 노트(line 1056)가 'Phase 1 stop 동등, continue Phase 2' 정직 표기. minor(phasing)
- frontmatterIssues: deriveExecutionTrigger(executions/)·V035/V036·ai-agent _retryState TTL 가 execution-engine 모듈 밖이라 글로브 미포함. `status: partial` 적정.
- structuralNotes: 1216줄 단일 문서에 미구현 aspirational(§4·§8)과 정합 섹션 혼재 → §11/§10.2 의 'Phase 1/Phase 2' 인라인 노트 패턴을 §4·§8 에도 적용 권장.

### spec/5-system/5-expression-language.md — major / partial / patch-content, fix-code-paths
- **headline**: 문법·타입·함수·에러코드·optional chaining 은 정확히 일치하나, §8.3.3 핸들러 제외규칙 전면 어긋나고 $trigger/$env 가 백엔드 미주입(에디터만 제안)이라 실행 시 ReferenceError 위험.
- findings:
  - §8.3.3 제외 핸들러 code/template → 실제 code/table/filter/loop, template 제외 없음(template config 정상 resolve). 정반대. **major**
  - §4.1 $trigger/$env → buildExpressionContext 가 미주입(grep 무매치), 프론트 autocomplete 만 제안 → 입력 시 EXPR_REFERENCE_ERROR. **major**
  - §4.1 변수 표 → 코드/에디터에 $params·$sourceItem/$sourceItemIndex/$dataSource 추가, spec 미문서화. minor
  - §4.1 $node '.output 만' → 실제 config/output/meta/port/status 노출. minor
  - §4.1 $thread → 백엔드 주입 OK 이나 프론트 autocomplete 목록에 부재. minor
  - §8.3.1 validate/resolveConfig/execute 플로우 → resolveConfig 만 존재, validate 는 엔진 패키지, excludeKeys 아니라 nodeType 인자. minor
- frontmatterIssues: code 글로브 `editor/expression/*.ts` 가 .tsx 4개(expression-input/autocomplete/highlight/variable-picker) 누락 → `*.{ts,tsx}` 보정. `status: implemented` 대체로 타당하나 $trigger/$env 미주입으로 partial 강등 또는 본문 수정 택일.

### spec/5-system/6-websocket-protocol.md — major / partial / patch-content, rewrite, fix-frontmatter, fix-code-paths
- **headline**: 전송 계층이 raw WebSocket 으로 기술됐으나 구현은 socket.io — auth.refresh/ping-pong/close코드/start·stop WS명령/snapshot payload 등 다수 framing 약속 불일치.
- findings (major 다수):
  - §1.1/§1.2 raw WS + Sec-WebSocket-Protocol 서브프로토콜 인증 → socket.io 게이트웨이(namespace '/ws'), 인증 handshake.query/auth.token 만. 서브프로토콜 경로 없음. **major**
  - §1.3 auth.refresh/auth.refreshed, §4.5 auth.token_expired → 백엔드 핸들러·emit 전무. 프론트는 auth payload 교체 후 재연결. **major**
  - §4.2 execution.start/stop WS 명령·start.ack → @SubscribeMessage 핸들러 없음, 실행 시작/중단 REST 전용. **major**
  - §5 서버발신 30s/10s heartbeat·close 1001 → socket.io 기본 25s/20s, app ping 방향 반대(client→server ping→server pong). **major**
  - §8 close 코드 1000/1001/1008/4000/4001 → socket.io 가 raw close 코드 미노출, emit 로직 없음. **major**
  - §4.1/§6.2 execution.snapshot {executionId,status,nodeExecutions[]} → 실제 {executionId, execution:<전체>, timestamp} nest. **major**
  - §7.1 WS 에러코드 INVALID_MESSAGE/UNKNOWN_TYPE/SUBSCRIPTION_LIMIT_EXCEEDED/RATE_LIMITED → WS 응답에 미사용, 한도초과 평문 string, WsErrorCode 4개(UNAUTHENTICATED/FORBIDDEN/NOT_FOUND/INTERNAL_ERROR)뿐, 60 msg/min rate-limit 없음. **major**
  - §3.3 구독 응답 {type:'subscribed',id,payload} / FORBIDDEN → 실제 {event:'subscribed',data:{success,channel?,error?}}, 권한거부도 같은 ack 평문 error(code 없음). **major**
  - §4.4 notification.new → 채널 prefix 는 등록됐으나 emit 코드 미발견. **major**
  - §6.1 재연결 1/2/4/8/16+지터 → socket.io 내장 reconnection(동작 다름). minor
  - §4.5 system.maintenance emit 전무. minor
  - §4.2 INVALID_EXECUTION_STATE/RESUME_*/RETRY_* → 실제 존재·정합(positive, drift 아님). minor
- frontmatterIssues: nodes/core/error-codes.ts·ws-error-codes.ts·frontend ws-client.ts code 글로브 누락. `status: implemented` → partial.
- structuralNotes: 'native WebSocket protocol' 프레이밍과 socket.io 구현 추상화 괴리 커 rewrite 수준 transport 정정 필요.

### spec/5-system/7-llm-client.md — major / implemented / patch-content, fix-code-paths
- **headline**: 인터페이스 대체로 일치하나, §6 에러코드 4종 부재, §5.5 previewModels 위치·embed 시그니처 어긋남. code 글로브에 preview/usage-log 서비스 누락.
- findings:
  - §6 LLM_AUTH_ERROR(401)/LLM_MODEL_NOT_FOUND(404)/LLM_CONTEXT_EXCEEDED(400)/LLM_TIMEOUT → 4개 코드 부재, catch 는 429→RATE_LIMIT, 그외 CONNECTION_ERROR(또는 OUTPUT_MALFORMED)만. **major**
  - §5.5 LlmService.previewModels → 실제 별도 LlmPreviewService.previewModels, LlmService 에 부재. **major**
  - §3.1/§3.3 embed(EmbedParams)→EmbedResponse{embeddings,usage,model,dimensions} → 실제 embed(texts,model?):Promise<number[][]>, 메타데이터 미반환. **major**
  - §3.1 인터페이스에 signal?:AbortSignal 추가됨(spec 미기재). minor
  - ToolCall.signature/TokenUsage.thinkingTokens/tool_call_end signature 누락. minor
  - §4 factory.create(LLMConfig) → 실제 LLMClientCreateOptions 평탄화. minor
  - §8.2 Google ChatSession/GenerativeModel → 신 @google/genai ai.models.generateContentStream() 단일 경로. minor
  - §6 LLM_OUTPUT_MALFORMED 미기재이나 코드에 존재. minor
- frontmatterIssues: llm-preview.service.ts(§5.5)·llm-usage-log.service.ts(§8.3) code 글로브 누락. `status: implemented` 유지+본문 패치 적절.

### spec/5-system/8-embedding-pipeline.md — minor / implemented / patch-content
- **headline**: 파이프라인 본체(파싱·청킹·임베딩·큐·재시도·WS·재임베딩 API)는 정밀 일치. CSV 전용 청킹과 chunk metadata(page/section)만 미구현 — 문서 보강 수준.
- findings (전부 minor):
  - §4.3 CSV 행 단위 청킹·행 중간 미분할 → CSV 전용 경로 없음, csv.parser 가 '\n' join 후 공통 chunkText('\n\n+' 분할) 통과 → 행 중간 분할 가능.
  - §6.1 DocumentChunk.metadata {page?,section?} → 항상 빈 {} INSERT, page/section 채우는 경로 없음.
  - §5.3 벡터 차원 3개 예시 → 코드 6개(384/512/768/1024/1536/3072)+V030~V033 partial HNSW. illustrative 라 contradiction 아님.
  - §6.2 DDL knowledge_base_id 없음 → 실제 포함. spec 이 '컨셉 예시' 명시(의도된 단순화).
- frontmatterIssues: code 글로브 4개 stale 없음. `status: implemented` 타당(엄밀히는 CSV/metadata partial 요소, severe 아님).

### spec/5-system/9-rag-search.md — minor / implemented / patch-content, keep
- **headline**: 핵심 흐름·필드·기본값 정확히 일치. 디버그 엔드포인트 경로 표기와 §3.1 SQL 단순화 2건만 minor.
- findings:
  - §1 디버그 컨트롤러 `POST /knowledge-base/search`(단수, 프리픽스 없음) → 실제 `POST /api/knowledge-bases/search`(복수+/api). minor
  - §3.1 유사도 SQL 단순 쿼리 → 실제 ::vector(dim) cast·vector_dims 필터·IS NOT NULL·workspace 조인 포함(개념 축약본). minor
  - search() multi-KB score 병합 후 topK slice → 정확 일치(KbToolProvider 는 항상 단일 KB). 일치 확인.
  - ragDiagnostics.skipReason empty_kb_list/no_results → ai-agent.handler.ts:391-417 정확 일치.
- frontmatterIssues: code 글로브 2개 정상. §4 ragSources/ragDiagnostics 누적·References UI 는 ai-agent.handler.ts·result-detail.tsx 에 있으나 본 spec 주제 범위상 수용 가능.

### spec/5-system/_product-overview.md — major / partial / patch-content, add-frontmatter
- **headline**: NFR 매트릭스 대부분 정합하나, NF-OB-02 Prometheus 메트릭은 ✅인데 백엔드에 /metrics·prom-client 등 메트릭 surface 전무(코드엔 OTEL 트레이싱만).
- findings:
  - NF-OB-02 Prometheus 메트릭 ✅(필수) → prom-client/nestjs-prometheus 의존성·/metrics·MeterProvider 전무, instrumentation.ts 는 trace exporter만. **major**
  - NF-DP-02 Docker Compose 셀프호스팅 ❌ → 루트 docker-compose.yml 에 풀스택 정의(개발 모드 start:dev). ❌ 자체 방어 가능하나 'production 미지원' 뉘앙스 미구분으로 오해 소지. minor
  - NF-OB-05 AlertsEvaluator '*/5 * * * *' UTC+/profile/alerts → 정합(서비스는 modules/alerts/, 무해). minor
  - NF-OB-06 system-status overview+/system-status → 정합. minor
  - NF-OB-03 OTEL 트레이싱 → 정합. minor
  - NF-SC-06 감사 로그 → 정합. minor
  - NF-AV-04 헬스체크/NF-DP-05 CI/CD → 정합. minor
- frontmatterIssues: frontmatter 전무(status/code/id 없음). _product-overview 라 code 글로브 부재는 자연스러우나 NFR ✅/❌ 가 구현 진실성 주장이므로 영역 status frontmatter 추가 유익.
- structuralNotes: 5-system 에 0-overview.md(기술개요) 없고 _product-overview 가 진입 겸함. NFR 표가 16개 상세 문서를 포괄 링크 안 해 신규 영역(15/16) 인덱스 정합 약함 → add-index 검토 여지.

## 일치 확인됨

- **spec/5-system/16-system-status-api.md** — none / implemented: 엔드포인트·DTO·health 규칙·임계값·12개 큐 레지스트리 모두 코드 부합, drift 없음. (utilization Math.min 1.0 상한은 동작상 합리적 보강, DTO description 미반영만)

## 영역 구조·네이밍 이슈

- **인덱스 부재**: 5-system 폴더에 `0-overview.md`(기술개요) 가 없고 `_product-overview.md` 가 진입을 겸한다. 다른 영역과 달리 기술개요 인덱스가 없어, NFR 표 외엔 16개 상세 문서(1-auth~16-system-status-api)를 포괄 링크하는 곳이 약하다. 특히 신규 문서(15-chat-channel, 16-system-status-api)의 인덱스 정합이 누락 → add-index 검토 권장.
- **self-link 반복**: `10-graph-rag.md`(line 17), `12-webhook.md`(§13) 가 관련문서 첫 링크로 자기 자신을 가리키는 무의미 self-link. 별도 PRD 문서가 없는 통합형이면 self-link 제거 권장.
- **PRD+Spec 통합형 vs `_product-overview.md` 분리 컨벤션**: `10-graph-rag.md` 등 일부는 제품정의+기술명세 통합형. 단일 기능이라 split 강제까진 불필요하나 컨벤션과의 의도 차이를 Rationale 에 명시하면 좋다.
- **frontmatter `code:` 글로브 stale 반복**: 다수 파일(10/11/12/14/2/3/5/6/7)에서 spec 본문이 핵심으로 다루는 구현 파일(큐 프로세서·rotation·error-codes·diagnostics·.tsx 컴포넌트)이 글로브 밖이다. 영역 단위 점검으로 `code:` 글로브를 본문 SoT 파일과 동기화하는 일괄 grooming 이 효율적.

## 우선 액션 (정렬)

### major — 본문 약속과 코드 정면 불일치 (patch-content / rewrite)
1. `spec/5-system/6-websocket-protocol.md` — transport 를 socket.io 기준으로 **rewrite** 수준 정정(auth.refresh·ping 방향·close 코드·execution.start/stop·snapshot nest·WS 에러코드·구독 ack shape 전반). frontmatter status partial 강등 + ws-error-codes.ts/error-codes.ts/ws-client.ts code 글로브 추가.
2. `spec/5-system/15-chat-channel.md` — CCH-CV-03 running-not-waiting 분기, §5.5 inbound {ignored:true} 응답계약, 비활성 chatChannel 202 silent skip, §5.4 rotate 응답 shape, CCH-NF-03 rate-limit/큐/degraded 를 코드 현실에 맞춰 본문 정정(또는 코드 구현 결정). partial 사유를 실제 갭으로 재기술.
3. `spec/5-system/12-webhook.md` — 비활성 chatChannel 202-ignored 분기와 1MB body 한도(현 32KB 공개 전용)를 본문/코드 중 하나로 정합화. public-webhook-throttle.guard.ts·hooks.controller.ts code 글로브 추가.
4. `spec/5-system/11-mcp-client.md` — §6.2 mcpDiagnostics surface(errors/attempted/serverSummaries 외부 mcp)·§9 테스트 응답 코드/형식(MCP_INVALID_URL·422)·§8.2 vocabulary(MCP_TOOL_ERROR/UNKNOWN_TOOL)를 코드와 정합화. status partial 강등 + test-connection/error-codes/diagnostics 글로브 추가.
5. `spec/5-system/14-external-interaction-api.md` — backoff 배율(base 2)·분산 SSE fan-out(미구현)·per-execution rate-limit·getStatus context/seq 를 본문에서 '미구현/Phase' 로 정정. §10 파일구조를 fanout/processor/guard/interceptor 로 갱신. triggers.{controller,service}.ts 글로브 추가.
6. `spec/5-system/2-api-convention.md` — §11.4 webhook message 허구 제거, §8.2 cursor 페이지네이션·§9 avatar 업로드 미구현 반영, error.requestId/details.code 보강 기술. status partial 강등 + hooks·throttler 경로 글로브 추가.
7. `spec/5-system/3-error-handling.md` — §7.2 vectorDb 체크·degraded 3-state·§3.3 maxInterval 클램프를 코드(미구현)에 맞춰 정정. status partial. error-codes.ts·health.service.ts 글로브 추가.
8. `spec/5-system/4-execution-engine.md` — §4 Worker 모델·§7.1 heartbeat·§8 동시실행 제한에 §11/§10.2 의 'Phase 1/Phase 2' 인라인 노트 패턴 적용해 미구현 명시. §5.5 표현식 제외 code/table/filter/loop 정정, §7.4 retry_last_turn 6종 반영.
9. `spec/5-system/5-expression-language.md` — §8.3.3 제외 핸들러(code/table/filter/loop), $trigger/$env 백엔드 미주입(에디터 제안만)을 본문 정정(또는 컨텍스트 주입 구현 결정). code 글로브 `*.{ts,tsx}` 보정.
10. `spec/5-system/7-llm-client.md` — §6 에러코드 4종(AUTH/MODEL_NOT_FOUND/CONTEXT_EXCEEDED/TIMEOUT) 부재·LLM_OUTPUT_MALFORMED 추가, §5.5 LlmPreviewService 명칭, embed 시그니처(number[][]) 정정. llm-preview/usage-log 글로브 추가.
11. `spec/5-system/_product-overview.md` — NF-OB-02 Prometheus 메트릭 ✅→❌/계획 으로 정정(코드엔 OTEL 트레이싱만), NF-DP-02 'production 미지원' 뉘앙스 명시. 영역 status frontmatter 추가.

### minor — frontmatter/구조 보강 (fix-frontmatter / keep)
12. `spec/5-system/1-auth.md` — status partial 사유 명확화(LDAP/SAML §1.3 미구현이면 유지, auth-config 후속이면 implemented). webauthn.config.ts 글로브 추가.
13. `spec/5-system/10-graph-rag.md` — graph_error 이벤트 본문 제거(미emit), §3.6 메타필드명(개수형) 정정. queues/processor·controller·V037·.tsx 컴포넌트 글로브 추가. self-link 제거.
14. `spec/5-system/13-replay-rerun.md` — re-run.dto.ts:29 stale 주석은 코드측 수정 사안(spec drift 아님). V068 마이그레이션 글로브 추가.
15. `spec/5-system/8-embedding-pipeline.md` — §4.3 CSV 전용 청킹·§6.1 metadata page/section 미구현을 본문 보강(또는 구현). §5.3 벡터 차원 6종 반영.
16. `spec/5-system/9-rag-search.md` — §1 디버그 엔드포인트 경로(/api/knowledge-bases/search 복수형)·§3.1 SQL 축약본 disclaimer 보강.

### 영역 공통
17. 5-system 인덱스(`0-overview.md` 또는 _product-overview NFR 표) 가 16개 상세 문서를 포괄 링크하도록 add-index.
18. frontmatter `code:` 글로브 일괄 grooming — 본문 SoT 파일과 동기화(10/11/12/14/2/3/5/6/7 공통).
