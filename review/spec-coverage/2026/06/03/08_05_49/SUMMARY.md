# Spec-Impl Coverage Audit — 마스터 리포트

- 감사 일시: 2026-06-03 08:05:49
- 감사 범위: `spec/**` 전체 142개 파일 vs 코드베이스
- SoT 규약: spec/conventions/spec-impl-evidence.md + .claude/docs/plan-lifecycle.md §6.2
- 영역별 상세: review/spec-coverage/2026/06/03/08_05_49/findings/<area>.md

> 성격: NLP 휴리스틱 기반 standing audit. CI 차단 아님, 보고형. "약속한 surface"(spec 본문)와 "구현 코드"(frontmatter code: glob)의 정적 갭을 검출한다.

---

## 1. 총평

### 1.1 전체 severity 분포 (per-file 기준, 142개)

| severity | 파일 수 | 비율 | 의미 |
| --- | ---: | ---: | --- |
| severe | 4 | 2.8% | 코드와 정반대/핵심 표면 미주입 — 사용자 코드 오작동·보안모델 역전 |
| major | 73 | 51.4% | 약속 surface 다수 미구현 또는 단정형 stale (status 과대평가 포함) |
| minor | 42 | 29.6% | 서술 정밀성 격차·code glob 누락·메시지 언어(i18n) 오인 |
| none | 23 | 16.2% | drift 없음 (catalog-sync 강제 영역·신규 정합 문서 집중) |

> 참고: 영역별 driftCount JSON 합산(148)은 일부 영역이 cross-reference 파일을 중복 카운트해 142를 초과한다. 위 표가 authoritative.

### 1.2 영역별 한눈 표

| 영역 | 파일 | none | minor | major | severe | drift 밀도 | 한줄 진단 |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| root (0-overview·1-data-model·6-brand) | 3 | 0 | 1 | 2 | 0 | 높음 | Flyway 롤백·웹채팅❌·chain_id NOT NULL stale |
| 2-navigation | 20 | 1 | 4 | 15 | 0 | 매우 높음 | code: 백엔드 누락 + status 과대평가 10건 |
| 3-workflow-editor | 6 | 0 | 0 | 6 | 0 | 전건 major | 약속 UI/API surface 광범위 미구현, 현재형 단정 |
| 4-nodes | 46 | 2 | 12 | 28 | 4 | 최다 + severe 집중 | 컨테이너 출력 계약 불일치, Code 전역 미주입 |
| 5-system | 18 | 1 | 4 | 13 | 0 | 높음 | transport/운영 표면(WS·webhook·관측) drift |
| 7-channel-web-chat | 6 | 2 | 3 | 1 | 0 | 낮음 | 코드 강정합, security §2.1 stale 1건만 |
| conventions | 36 | 17 | 14 | 5 | 0 | 낮음 | cafe24 카탈로그 catalog-sync 강제로 거의 완벽 |
| data-flow | 13 | 1 | 1 | 9 | 2 | 높음 + severe | 트리거/워크스페이스 발사·보안 모델 정반대 |

### 1.3 가장 심각한 drift 패턴 (전역)

1. 컨테이너 노드 출력 계약 역전 (severe) — Parallel done 포트가 spec 의 allSettled-shape 가 아닌 raw 배열 + 제거됐다던 count 잔존. Loop/ForEach 의 output.count/$loop.count/$item.isFirst/port='done'/meta.durationMs 가 코드와 어긋나 표현식 예시가 다운스트림에서 오작동.
2. 실행 컨텍스트 전역 미주입 (severe) — Code 노드의 $helpers/$node, expression-language 의 $trigger/$env 가 sandbox/실행 컨텍스트에 미주입 → 사용자 코드에서 ReferenceError.
3. 트리거·발사 모델 obsolete (severe) — @Cron 인메모리 sweep → BullMQ repeatable scheduler 이관(#424)이 코드에 반영됐으나 data-flow/10-triggers·9-observability·0-overview 가 여전히 1분 sweep/next_run_at polling 모델 기술.
4. 보안 모델 정반대 (severe) — data-flow/12-workspace 의 X-Workspace-Id 헤더 정책이 코드(헤더 우선 수용)와 Rationale 까지 정면 충돌.
5. code: glob 이 백엔드/엔진 SoT 누락 (만연한 minor→major 증폭원) — 2-navigation·3-editor·4-nodes·5-system 전반에서 code: 가 프론트 page.tsx 만 가리켜, 본문이 SoT 로 기술하는 백엔드 모듈/execution-engine/컨테이너 구현이 추적 밖. drift 검출 약화.
6. status: implemented 과대평가 (major 증폭원) — 약속 surface 일부 미구현인데 implemented 단정. 최소 16+ 파일 partial 강등 대상.
7. stale 카운트/현재형 단정 — Presentation 6→5종, Integration 3→4종(cafe24 누락), 동적 포트 UUID→slug. 미구현 vaporware(Marketplace/Custom/샌드박싱)가 implemented 본문에 혼재.
8. i18n 결과를 SoT 로 오인 (반복 minor) — §6 에러 메시지를 한국어 인용했으나 source warningRule 은 영문(i18n 렌더 결과가 한국어). 4-nodes 다수.

---

## 2. 갱신 우선순위 큐 (severe → major, 영역 무관 실행 리스트)

### 2.1 SEVERE (즉시, 사용자 영향·보안)

- [ ] spec/4-nodes/1-logic/10-parallel.md — done 포트를 raw branches[i] 배열+count 잔존·분기 에러 미포함 현실에 맞춰 §3.2/§5.2/§5.7 patch, status→partial (patch-content, fix-code-paths)
- [ ] spec/4-nodes/5-data/2-code.md — $helpers(date/crypto/base64)·$node 전역 sandbox 미주입·config.timeout schema 부재 정정, status→partial (patch-content, fix-frontmatter)
- [ ] spec/data-flow/10-triggers.md — Schedule 발사 1분 sweep→BullMQ repeatable job(upsertJobScheduler+tz) rewrite, webhook inactive 404→410, manual /run→/execute, chat-channel inbound 분기 (patch-content, rewrite)
- [ ] spec/data-flow/12-workspace.md — X-Workspace-Id 헤더 우선 수용(보안모델 정반대) 반영, activeWorkspaceId→workspaceId, switch 엔드포인트(미구현) 마킹, register personal workspace 미생성 (patch-content, fix-code-paths, rewrite)

### 2.2 MAJOR — root / cross-cutting

- [ ] spec/0-overview.md — §6.1/§6.3 채널 웹채팅 ❌→구현 갱신, §2.8 Flyway 롤백(undo)→forward-only 정정, §2.4 Integration 3→4종(cafe24) (patch-content)
- [ ] spec/1-data-model.md — §2.13 Execution.chain_id NOT NULL/자기참조→NULLABLE(re-run 행만 set) 정정 + frontmatter 추가 (patch-content, add-frontmatter)

### 2.3 MAJOR — 2-navigation (백엔드 glob + status 집중)

- [ ] spec/2-navigation/1-workflow-list.md — 상태필터 param 불일치(isActive vs status) 필터 비동작 + 정렬/태그/폴더 필터 미구현 반영 + backend/api glob (patch-content, fix-code-paths)
- [ ] spec/2-navigation/14-execution-history.md — 목록 API nodeExecutions 미반환 → Nodes 열 항상 '—'(EH-LIST-02 무력화): DTO 필드 복구 또는 §2.4/§5 patch (patch-content)
- [ ] spec/2-navigation/9-user-profile.md — §6 API 표 다수 엔드포인트(avatar/notifications/sessions revoke/2FA)·슬러그 URL·테마 System patch + backend glob (patch-content, fix-code-paths)
- [ ] spec/2-navigation/0-dashboard.md — 성공률 공식·정렬 기준·summary 필드 patch + backend/dashboard glob, status→partial (fix-code-paths, patch-content, fix-frontmatter)
- [ ] spec/2-navigation/7-statistics.md — API 경로(llm-usage 분할)·집계 의미·증감률 patch + backend/statistics glob (patch-content, fix-code-paths)
- [ ] spec/2-navigation/10-auth-flow.md — resend-verification 부재·/auth 접두사·강도바 단계 patch + backend/auth glob, status→partial (patch-content, fix-frontmatter, fix-code-paths)
- [ ] spec/2-navigation/11-error-empty-states.md — §2.2 Triggers/Schedules CTA·§2.3 필터 초기화 화면 미구현 반영, status→partial (patch-content, fix-frontmatter)
- [ ] spec/2-navigation/13-user-guide.md — 단일언어 /docs→ko/en 이중언어 라우트·frontmatter·IA 갱신 + i18n glob (patch-content, fix-code-paths)
- [ ] spec/2-navigation/3-schedule.md — /toggle 엔드포인트 부재·UI 액션 부재 patch + backend/schedules glob, status→partial (patch-content, fix-code-paths)
- [ ] spec/2-navigation/6-config.md — §A.3 usage 이력·§A.2 IP Whitelist·Header 이름 미구현 반영, status→partial (patch-content)
- [ ] spec/2-navigation/2-trigger-list.md — '목록 화면 생성 금지' 명시 vs Add Webhook 다이얼로그 충돌·formMode enum stale patch (patch-content)
- [ ] spec/2-navigation/_layout.md — §3.2 유저 팝업/§5 공통헤더 실제 분산 구현 반영 + frontmatter 추가 (add-frontmatter, fix-code-paths, patch-content)
- [ ] spec/2-navigation/_product-overview.md — NAV-TR-09/10/11 상태칸 🚧→✅ (역방향 stale) (patch-content)

### 2.4 MAJOR — 3-workflow-editor (전건)

- [ ] spec/3-workflow-editor/3-execution.md — §9 API 표 라우트 정합·§8 WS 이벤트(execution. prefix)/명령 정정, status→partial (patch-content, fix-code-paths)
- [ ] spec/3-workflow-editor/1-node-common.md — §1.3 포트 표를 resolve-dynamic-ports.ts·*.schema.ts 에 맞춰 재생성·Default Output/Retry UI 미구현, status→partial (patch-content, fix-code-paths, reclassify)
- [ ] spec/3-workflow-editor/2-edge.md — §2.2/§2.3 연결 유효성·§3.2 실행상태·§4/§5 인터랙션 현재형 단정→미구현(계획) 표기 (patch-content)
- [ ] spec/3-workflow-editor/0-canvas.md — 미니맵/줌슬라이더/노드삭제/copy-paste/단축키/팔레트 Recent·Installed 미구현 명시, §11.4↔§11.2 모순 해소 (patch-content, fix-code-paths)
- [ ] spec/3-workflow-editor/4-ai-assistant.md — verify_workflow/WORKFLOW_VERIFY_REQUIRED·mcp-server-selector 추가 기술, 미구현 에러코드 3종·409 가드 정정 (patch-content)
- [ ] spec/3-workflow-editor/_product-overview.md — ED-AI-33 tool-call 상한 16→동적 budget(48/plan*3+8/cap200) 정정 (patch-content)

### 2.5 MAJOR — 4-nodes

- [ ] spec/4-nodes/6-presentation/4-form.md — 서버측 폼 검증·file 클라이언트 검증·ValidationPreset(phone)·file 기본 제약 미구현, status→partial + execution-engine/websocket glob (patch-content, fix-frontmatter)
- [ ] spec/4-nodes/1-logic/3-loop.md — output.count 제공됨/$loop.count·$item.isFirst·port:'done'·meta.durationMs 미존재 정정 (patch-content)
- [ ] spec/4-nodes/1-logic/9-foreach.md — $item.isFirst/isLast·output.port='done'·meta.durationMs 미존재 정정 (patch-content)
- [ ] spec/4-nodes/_product-overview.md + spec/4-nodes/0-overview.md — Presentation 6→5종, Integration 3→4종(cafe24), 동적 포트 UUID→slug, Marketplace/Custom/샌드박싱 'Planned' 마킹 + 0-overview frontmatter (patch-content, add-frontmatter)
- [ ] spec/4-nodes/4-integration/_product-overview.md — §4 Marketplace vaporware 'Planned' 분리, §2.6 google/github/mcp 누락 보정 (keep, patch-content)
- [ ] spec/4-nodes/4-integration/4-cafe24.md — Cafe24McpBridge→Cafe24McpToolProvider, listTools/callTool→buildTools/execute, 실재 안하는 imcp-client.ts 경로 정정 + glob (patch-content, fix-code-paths)
- [ ] spec/4-nodes/4-integration/0-common.md — §5 캔버스 요약(DB/Email/Missing 배지/35자 잘림) 미구현 반영, status→partial (patch-content)
- [ ] spec/4-nodes/4-integration/1-http-request.md — verifySsl/followRedirects 미사용(echo만) 정정, status→partial (patch-content)
- [ ] spec/4-nodes/4-integration/3-send-email.md — EMAIL_NO_RECIPIENTS/INTEGRATION_NOT_FOUND/SERVICE_UNAVAILABLE 미라우팅·dry-run 누락 정정, status→partial (patch-content)
- [ ] spec/4-nodes/1-logic/0-common.md — §1 ConditionGroup 중첩(logicalOperator) 부재·§4 Parallel errorPolicy·Background 포트명 정정 + condition-evaluator/execution-engine glob (patch-content, fix-code-paths)
- [ ] spec/4-nodes/1-logic/1-if-else.md — regex 연산자 항상 false·§6 메시지 한/영 정정 (patch-content)
- [ ] spec/4-nodes/1-logic/2-switch.md — reserved case-id 차단 위치(backend)·§6 메시지 언어·migration 경로 정정 (patch-content)
- [ ] spec/4-nodes/1-logic/4-variable-declaration.md — coerceToType array/object fallback 정반대(원본 반환) 정정 + coerce-type.ts glob, status→partial (patch-content, fix-code-paths)
- [ ] spec/4-nodes/1-logic/11-merge.md — config echo 정반대(4필드 모두 echo)·dormant warningRule severity 정정 (patch-content)
- [ ] spec/4-nodes/2-flow/0-common.md — §2 meta 4필드→1필드·§4 캔버스 요약 미구현, status→partial (patch-content, fix-code-paths)
- [ ] spec/4-nodes/2-flow/1-workflow.md — §2 셀렉터 UI(UnsupportedWidget)·§7 summaryTemplate 미구현, status→partial (patch-content, fix-code-paths)
- [ ] spec/4-nodes/3-ai/0-common.md — §2 Info Extractor KB/RAG 과대주장(스키마에 필드 부재) 정정 (patch-content)
- [ ] spec/4-nodes/3-ai/2-text-classifier.md — error.details.retryable·예약어 충돌 검증·캔버스 요약 미구현, status→partial (patch-content)
- [ ] spec/4-nodes/3-ai/3-information-extractor.md — retryable 필수 필드 미set·메시지 한/영·resumed source 정정 (patch-content)
- [ ] spec/4-nodes/5-data/0-common.md — §4 code meta(제거된 error/errorCode/exitReason) stale·§3 요약 미구현 정정 (patch-content)
- [ ] spec/4-nodes/6-presentation/0-common.md — §4.6 UI 토글 부재·§1.1 link+userMessage warning 모순 정정 (patch-content, keep)
- [ ] spec/4-nodes/6-presentation/5-template.md — §7 캔버스 요약 summaryTemplate 미구현, status→partial (patch-content)
- [ ] spec/4-nodes/7-trigger/1-manual-trigger.md — §6 에러 표 generic invalid_schema 와 전면 어긋남·webhook/manual 명칭 정정 (patch-content)
- [ ] spec/4-nodes/7-trigger/providers/discord.md — §5.1(b) Reply 버튼/modal·setupChannel public_key verify·carousel embed 미구현, status→partial + renderer glob (patch-content, fix-frontmatter)
- [ ] spec/4-nodes/7-trigger/providers/telegram.md — /help dead·update_id dedup·per-chat 큐·typing·editMessageReplyMarkup 미구현 단정형 정정, status→partial (patch-content)

### 2.6 MAJOR — 5-system

- [ ] spec/5-system/6-websocket-protocol.md — raw WebSocket→socket.io rewrite(auth.refresh·ping 방향·close 코드·execution.start/stop·snapshot·WS 에러코드), status→partial + glob (patch-content, rewrite, fix-frontmatter, fix-code-paths)
- [ ] spec/5-system/15-chat-channel.md — CCH-CV-03 running 분기·§5.5 inbound {ignored:true}·§5.4 rotate shape·CCH-NF-03 rate-limit 정정, partial 사유 재기술 (patch-content, fix-code-paths)
- [ ] spec/5-system/12-webhook.md — 비활성 chatChannel 202-ignored·1MB body(현 32KB) 정합화 + throttle/controller glob (patch-content)
- [ ] spec/5-system/11-mcp-client.md — §6.2 mcpDiagnostics surface·§9 테스트 응답(MCP_INVALID_URL/422)·§8.2 vocabulary 정합, status→partial + glob (patch-content, fix-frontmatter)
- [ ] spec/5-system/14-external-interaction-api.md — retry backoff 배율·SSE 분산 fan-out·per-execution rate-limit·getStatus seq/context 정정, status→partial + triggers glob (patch-content, fix-code-paths)
- [ ] spec/5-system/2-api-convention.md — requestId 누락·webhook message 허구·cursor 미구현·avatar/파일 rate-limit 정정, status→partial + hooks/throttler glob (patch-content, fix-code-paths, fix-frontmatter)
- [ ] spec/5-system/3-error-handling.md — §7 헬스(vectorDb/degraded)·§3.3 maxInterval 부재 정정 + error-codes/health glob, status→partial (patch-content, fix-code-paths)
- [ ] spec/5-system/4-execution-engine.md — §4 Worker 모델·§8 동시실행 제한 미구현에 Phase 노트 적용 (keep, patch-content, fix-code-paths)
- [ ] spec/5-system/5-expression-language.md — §8.3.3 제외 핸들러 정반대·$trigger/$env 백엔드 미주입(ReferenceError) 정정 + *.{ts,tsx} glob, status→partial (patch-content, fix-code-paths)
- [ ] spec/5-system/7-llm-client.md — §6 에러코드 4종 부재·§5.5 previewModels 위치·embed 시그니처 정정 + preview/usage-log glob (patch-content, fix-code-paths)
- [ ] spec/5-system/_product-overview.md — NF-OB-02 Prometheus 메트릭 ✅→❌(코드엔 OTEL 트레이싱만) + 영역 status frontmatter (patch-content, add-frontmatter)

### 2.7 MAJOR — conventions

- [ ] spec/conventions/cafe24-restricted-scopes.md — §4.3 노드 실행 403 requiresCafe24Approval/missingScopes enrich 미구현, status→partial 또는 구현 (patch-content)
- [ ] spec/conventions/cafe24-api-metadata.md — Cafe24McpBridge.listTools/callTool/operationToMcpTool→Cafe24McpToolProvider.buildTools/execute/buildToolDescription patch (patch-content)
- [ ] spec/conventions/conversation-thread.md — system_error 를 backend source enum 오기→frontend 합성 UI source 정정, classifier/extractor push v1/v2 경계 갱신 + frontend glob (patch-content, fix-code-paths)
- [ ] spec/conventions/node-cancellation.md — §6 본 PR/후속 분류 갱신(AI/DB/Email 소비 구현완료), §2.3 cancel 버튼 in-flight abort 과장 제거 + glob (patch-content, fix-frontmatter, fix-code-paths)
- [ ] spec/conventions/user-guide-evidence.md — §2 api-endpoint 검증·triggers provider-name 탐지 over-claim 하향 + coverage 가드 glob (patch-content, fix-code-paths)

### 2.8 MAJOR — data-flow / 7-channel-web-chat (나머지)

- [ ] spec/data-flow/11-workflow.md — Assistant DB 미접촉(ShadowWorkflow in-memory+프론트 Save)·전송 WebSocket→SSE·버전 POST /:id/save 트랜잭션 (patch-content)
- [ ] spec/data-flow/2-auth.md — sessions/:familyId/revoke·oauth/:provider(no /start)·register 2단계·응답 {accessToken}·423→401 (patch-content)
- [ ] spec/data-flow/9-observability.md — health{database,redis}(S3 ping 제거)·alerts payload·audit_log 미기록·alert type 정정 (patch-content)
- [ ] spec/data-flow/3-execution.md — §1.3 인터랙션 REST(/interactions)→/continue+WS·상태머신 전이 2건 (patch-content)
- [ ] spec/data-flow/4-file-storage.md — KB 삭제 S3 cleanup '미구현·orphan' 주장 정반대(실제 삭제 루프 수행) §3/Rationale 정정 (patch-content)
- [ ] spec/data-flow/5-integration.md — BullMQ 큐 실명·OAuth start(POST /oauth/begin+JSON) 정정 (patch-content)
- [ ] spec/data-flow/7-llm-usage.md — chat() 시그니처·resolveConfig 위치·provider(Ollama/vLLM)·thinking_tokens 비용 정정 (patch-content)
- [ ] spec/data-flow/8-notifications.md — notify() 단일 표면·이메일 발송·다수 type 발사 as-is/to-be 구분 마킹 (patch-content)
- [ ] spec/data-flow/1-audit.md — service 메서드명·event 목록·DB CHECK 유무(Rationale 정반대) 정정 (patch-content)
- [ ] spec/7-channel-web-chat/4-security.md — §2.1 path-scope CORS delegate 구현 완료 반영('브라우저 요청 차단' 서술 삭제) + hooks glob (patch-content, fix-code-paths)

---

## 3. 구조·네이밍 정규화 제안 (전역)

### 3.1 연번 prefix 불일치

| 관찰 | 현황 | 제안 |
| --- | --- | --- |
| 0-overview.md(기술개요) 부재 영역 | 5-system 은 0-overview 없이 1-auth 시작, _product-overview(NFR)가 진입 겸함. data-flow·4-nodes 는 0-overview 보유 | 일관성 위해 5-system/0-overview.md 신규 검토(영역 인덱스 부재로 신규 문서 인덱스 정합 약함). 신규 파일이라 링크 영향 없음 — 안전 |
| 4-nodes/0-overview.md frontmatter 누락 | 기술개요인데 status/code/id 전무 | add-frontmatter: status + code: codebase/backend/src/nodes/** |
| 3-workflow-editor/0-canvas.md 네이밍 모호 | 0- prefix 지만 영역 기술개요 아닌 '캔버스 상세' | 기존 관행과 일관되면 유지. 본 감사 범위에선 보류 |

### 3.2 _product-overview.md 보유 영역 불일치

| 영역 | _product-overview | 비고 |
| --- | --- | --- |
| 2-navigation, 3-workflow-editor, 4-nodes, 4-nodes/3-ai, 4-nodes/4-integration, 5-system, 7-channel-web-chat | 보유 | 정상 (PRD 인덱스) |
| 4-nodes 의 1-logic / 2-flow / 5-data / 6-presentation / 7-trigger | 미보유 | 노드 카테고리 중 ai/integration 만 보유 — 불일치이나 미보유 카테고리는 0-common.md 가 공통 규약+인덱스 겸함. 강제 추가 권장 아님 (현 패턴 내부 일관) |

### 3.3 rename / merge / split / reclassify 후보

> ⚠️ 파일명 변경은 frontmatter code:·상호링크·user-guide spec: 참조·spec-impl-evidence 가드를 깨므로 영향 범위 동반 표기. 전부 보류(권고만) — 실제 적용은 별도 planner turn 에서 link 갱신 동반.

| 후보 | before → after | 영향 범위 | 판단 |
| --- | --- | --- | --- |
| version-history 영역 재배치 | spec/2-navigation/12-workflow-version-history.md → spec/3-workflow-editor/12-workflow-version-history.md | 상호링크 다수(상단 ../3-workflow-editor/ 참조), frontmatter code glob, cross-area | 보류 — editor 결합 강하나 cross-area 영향 큼 |
| 1-node-common §1.3 포트 표 위임 | rename 아님 — 표를 ../4-nodes 개별 문서로 위임, 본 표는 대표 식별자만 | 본문 patch 만, 링크 영향 없음 | 검토 권장 (reclassify) |
| Marketplace backlog 분리 | 4-nodes/4-integration/_product-overview.md §4 → 별도 backlog/spec-only 문서 split | 본문 split, PRD 인덱스 링크 추가 | 검토 권장 (오해 감소) |
| execution-context frontmatter 정렬 | rename 아님 — status: spec-only/code: [] → sibling 관례(partial/code glob) | frontmatter only, 안전 | 즉시 적용 가능 (fix-frontmatter) |

### 3.4 frontmatter code: glob 보강 (rename 아님, 안전)

전역 반복 패턴: code: 가 프론트만 가리켜 백엔드/엔진 SoT 누락. 영향 범위 frontmatter only — 링크/가드 무영향, 안전.

- 2-navigation: dashboard/workflows/auth/statistics/schedules/integrations/knowledge-base/auth-configs 백엔드 모듈 추가
- 3-editor: editor-store.ts, resolve-dynamic-ports.ts, edge-utils.ts, backend WS gateway·executions/workflows/nodes 컨트롤러, workflow-editor.tsx, assistant-editor-bridge.ts
- 4-nodes logic: execution-engine.service.ts, containers/{parallel,loop,foreach}-executor.ts, coerce-type.ts, condition-evaluator.util.ts
- 5-system: ws-error-codes.ts, error-codes.ts, ws-client.ts, queue 프로세서, rotation, llm-preview/usage-log, hooks/throttler

---

## 4. frontmatter status 교정 목록 (현재 status ≠ suggestedStatus)

| path | 현재 status | → 제안 | 사유 |
| --- | --- | --- | --- |
| spec/4-nodes/5-data/2-code.md | implemented | partial | $helpers/$node 전역 미주입 (severe) |
| spec/4-nodes/1-logic/10-parallel.md | implemented | partial | done 포트 출력 구조 미구현 (severe) |
| spec/2-navigation/0-dashboard.md | implemented | partial | Avg Time/정렬/성공률 surface 미구현 |
| spec/2-navigation/1-workflow-list.md | implemented | partial | 정렬/필터 미구현·상태필터 비동작 |
| spec/2-navigation/10-auth-flow.md | implemented | partial | resend-verification·중복확인 미구현 |
| spec/2-navigation/11-error-empty-states.md | implemented | partial | §2.2/§2.3 빈 상태 미구현 |
| spec/2-navigation/13-user-guide.md | implemented | partial | 이중언어 IA/라우트 미반영 |
| spec/2-navigation/14-execution-history.md | implemented | partial | EH-LIST-02 Nodes 열 무력화 |
| spec/2-navigation/3-schedule.md | implemented | partial | /toggle·UI 액션 부재 |
| spec/2-navigation/6-config.md | implemented | partial | §A.3 usage 이력 미구현 |
| spec/2-navigation/9-user-profile.md | implemented | partial | 슬러그/알림/아바타/테마 미구현 |
| spec/2-navigation/_layout.md | (없음) | partial | + add-frontmatter |
| spec/3-workflow-editor/1-node-common.md | implemented | partial | Default Output/Retry UI 미구현 |
| spec/3-workflow-editor/3-execution.md | implemented | partial | §2/§7/§8/§9 surface 미구현 |
| spec/4-nodes/2-flow/0-common.md | implemented | partial | meta 4→1필드·요약 미구현 |
| spec/4-nodes/2-flow/1-workflow.md | implemented | partial | 셀렉터 UI·summaryTemplate 미구현 |
| spec/4-nodes/3-ai/0-common.md | implemented | partial | Info Extractor KB 과대주장 |
| spec/4-nodes/3-ai/2-text-classifier.md | implemented | partial | retryable·예약어 검증·요약 미구현 |
| spec/4-nodes/4-integration/0-common.md | implemented | partial | 캔버스 요약 미구현 |
| spec/4-nodes/4-integration/1-http-request.md | implemented | partial | verifySsl/followRedirects echo만 |
| spec/4-nodes/4-integration/3-send-email.md | implemented | partial | 에러코드 3종 미라우팅 |
| spec/4-nodes/5-data/0-common.md | implemented | partial | code meta stale·요약 미구현 |
| spec/4-nodes/6-presentation/4-form.md | implemented | partial | 서버 검증·file 검증·preset 미구현 |
| spec/4-nodes/6-presentation/5-template.md | implemented | partial | §7 summaryTemplate 미구현 |
| spec/4-nodes/7-trigger/providers/discord.md | implemented | partial | Reply 버튼/modal·public_key verify 미구현 |
| spec/4-nodes/7-trigger/providers/telegram.md | implemented | partial | dedup/typing//help 미구현 |
| spec/5-system/6-websocket-protocol.md | implemented | partial | socket.io framing 다수 미구현 |
| spec/5-system/11-mcp-client.md | implemented | partial | mcpDiagnostics surface 미구현 |
| spec/5-system/2-api-convention.md | implemented | partial | cursor/avatar/message 미구현 |
| spec/5-system/3-error-handling.md | implemented | partial | §7 헬스·maxInterval 부재 |
| spec/5-system/5-expression-language.md | implemented | partial | $trigger/$env 미주입 |
| spec/conventions/cafe24-restricted-scopes.md | implemented | partial | §4.3 403 enrich 미구현 |
| spec/conventions/execution-context.md | spec-only | implemented/partial | 분류가 코드에 모두 실재 (역방향) |
| spec/5-system/1-auth.md | partial | implemented (검토) | 핵심 인증 전 surface 구현 — partial 사유가 범위 밖 auth-config 후속 |

> 역방향 stale(과소평가): 2-navigation/_product-overview.md NAV-TR-09/10/11 🚧→✅, 5-system/1-auth.md partial→implemented 후보, execution-context.md spec-only→구현됨.

---

## 5. 재작성(rewrite) 후보 (부분 패치보다 전면 재작성)

| path | 사유 | rewrite 범위 |
| --- | --- | --- |
| spec/5-system/6-websocket-protocol.md | spec 이 raw WebSocket framing 으로 작성됐으나 구현은 socket.io — 추상화 레벨 괴리가 커 절별 패치로 수습 불가 | transport 전반(인증·heartbeat·close 코드·이벤트명·snapshot·에러코드) |
| spec/data-flow/10-triggers.md | Schedule 발사가 1분 sweep→BullMQ repeatable 로 모델 자체 교체 | §1.3/§2.2/§3.2 mermaid·표 재작성 |
| spec/data-flow/12-workspace.md | X-Workspace-Id 보안 모델이 정반대, JWT 필드·엔드포인트·register 흐름 다수 정면 충돌 | §1·Rationale 재작성 |

---

## 6. 다음 단계 권고 (안전 → 위험 순)

### 단계 1 — frontmatter / 연번 (저위험, 링크/가드 무영향)
- [ ] add-frontmatter: 1-data-model, 6-brand, 4-nodes/0-overview, 2-navigation/_layout, 5-system/_product-overview
- [ ] fix-frontmatter: execution-context(spec-only→구현 + code glob), status 교정 33건(§4 표)
- [ ] fix-code-paths: §3.4 백엔드/엔진 glob 보강 일괄
- 건드리는 가드: spec-impl-evidence build-time 가드(code glob 존재성). frontmatter 추가는 가드 통과율만 개선, 차단 위험 없음.

### 단계 2 — 내용 패치 (중위험, 본문 사실 정정)
- [ ] severe 4건 우선(§2.1) → root/cross-cutting(§2.2) → 영역별 major
- [ ] 현재형 단정 → 미구현(계획) 표기 분리, i18n 메시지 SoT 영문 기준 정정
- 건드리는 링크: 상호 cross-ref·user-guide spec: 참조. 파일명 불변이므로 링크 안전, 본문 앵커 변경 시 역참조만 점검.

### 단계 3 — 재작성 / 재분류 (고위험, 별도 turn)
- [ ] rewrite 3건(§5) — planner turn 에서 consistency-check --spec 의무 선행
- [ ] reclassify/split 후보(§3.3) — 파일명·경로 변경 동반 시 frontmatter code·상호링크·user-guide spec·spec-impl-evidence INCLUDE_PREFIXES 일괄 갱신 필수. 단독 적용 금지.

> 모든 spec/ 쓰기는 project-planner 권한 + consistency-check --spec 의무. 단계 1~2 는 동일 turn 묶음 가능, 단계 3 은 분리 권고.

---

severe=4, major=73, minor=42
