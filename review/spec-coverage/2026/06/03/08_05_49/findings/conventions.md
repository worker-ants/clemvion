# Spec 감사 — conventions

## 요약

- **감사 파일 수**: 36개 (cafe24-api-catalog 하위 20개 + conventions 루트 16개)
- **severity 분포**: none 17 · minor 14 · major 5 · severe 0
- **핵심 메시지**:
  - cafe24-api-catalog 카탈로그(18 resource + _overview)는 `catalog-sync.spec.ts` 양방향 동기 테스트로 강제되어 메타데이터와 거의 완벽 정합. 잔존 drift 는 코드가 ⚠ "미문서/미검증 seed" 로 표기한 endpoint(application/category/customer/promotion)의 caveat 가 spec 표에 미노출된 minor 뿐.
  - major 5건은 모두 컨벤션 루트 문서에서 발생: 클래스/메서드명 stale(`cafe24-api-metadata`), 노드 실행 403 enrich 미구현(`cafe24-restricted-scopes`), backend source enum·v2 경계 오기(`conversation-thread`), cancel 버튼의 in-flight abort 과장·후속 분류 stale(`node-cancellation`), 가드 검증 강도 over-claim(`user-guide-evidence`).
  - 공통 패턴: 컨벤션 문서의 `code:` 글로브가 실제 강제 surface(소비처·가드 테스트·런타임 enrich 경로)를 과소 커버 → fix-code-paths 다발.

## 파일별 발견사항

### spec/conventions/cafe24-api-catalog/_overview.md — minor / N/A / patch-content

- **headline**: 카탈로그 인덱스는 코드와 거의 완벽 일치(18 resource·500 op·sync 8규칙). 단 planned 메커니즘 기술이 실제 planned.ts mirror 와 어긋남.
- findings:
  - claim: §3 status enum — `planned` 백엔드 메타데이터는 'row 없음'
    → reality: 전용 `planned.ts` 의 `CAFE24_PLANNED_BY_RESOURCE` mirror 가 존재하고 catalog 의 모든 `status: planned` row 가 여기 등록·양방향 강제됨. 'row 없음' 은 supported 메타데이터 한정으로만 참 (evidence: `metadata/planned.ts:24`, `catalog-sync.spec.ts:346-378`)
  - claim: §4 Sync Contract 가 검증 규칙 8개로 enumerate
    → reality: 실제 sync 테스트는 catalog↔planned.ts mirror 불변식 4개 it 추가 수행. §4 규칙 목록에 planned mirror 항목 누락(테스트 헤더에는 규칙7로 명시) (evidence: `catalog-sync.spec.ts:346-410` vs `:27-28`)
  - claim: §5 Coverage Matrix supported 500/planned 0, resource별 카운트
    → reality: 18개 전부 정확 일치, drift 없음 (확인됨)
  - claim: §2 컬럼 정의(restricted/scope/paginated) = 메타데이터 토큰
    → reality: types.ts 와 정확히 일치, §4 규칙8 program 제외 서술도 일관 (evidence: `metadata/types.ts:103,128,134,140`)
- frontmatterIssues: frontmatter 없음 — `_overview.md` 인덱스/레이아웃 문서로 `_*` 인덱스에 frontmatter 미강제 컨벤션과 일관, 정상 판단.
- structuralNotes: `_overview.md` 가 디렉토리 인덱스 역할로 `_*` 레이아웃 규약 부합. 하위 18개 resource md = §1 디렉토리 구조 = Cafe24Resource enum 18토큰 1:1 정합.

### spec/conventions/cafe24-api-catalog/application.md — minor / implemented / keep, patch-content

- **headline**: application.md 19 row 가 application.ts 와 id/method/path/scope/paginated 전부 1:1 일치. 코드가 ⚠seed/미검증 표기한 2개 endpoint 의 caveat 가 spec 본문에 없음.
- findings:
  - claim: applications_list (GET applications) 가 정상 지원 endpoint 로 표기
    → reality: 코드 description 에 '⚠ Not documented in cafe24 admin docs; pending production verification' + §G-2 트랙 명시. spec 표에 미노출 (evidence: `application.md:19` vs `application.ts:16-33`)
  - claim: webhooks_list (GET webhooks) 정상 지원 표기
    → reality: 코드에 '⚠ Not documented' 표기, bare GET webhooks 는 미문서 seed (§G-2). spec 미노출 (evidence: `application.md:21` vs `application.ts:46-62`)
- frontmatterIssues: code 글로브 단일 파일 정확 매치. status: implemented 는 19 supported row 모두 메타데이터 존재로 적절.

### spec/conventions/cafe24-api-catalog/category.md — minor / implemented / keep, patch-content

- **headline**: category.md 19행이 category.ts 와 전부 1:1 일치. mains_update/delete 의 미문서·미검증 경고 누락만 minor.
- findings:
  - claim: mains_update/mains_delete 를 supported + 공식 docs anchor 로 등재
    → reality: 코드 두 op 에 '⚠ Not documented; pending production verification' + §G-2 주석. spec 표만 보면 정상 endpoint 로 오해 (evidence: `category.md:31-32` vs `category.ts:207-239`)
  - claim: autodisplay_update path = `autodisplay/{display_no}`
    → reality: path 값 일치하나 display_no 의미(진열 규칙 id vs 카테고리 번호) 설명이 spec 에 없어 모호 (evidence: `category.md:35` vs `category.ts:255-269`)
- frontmatterIssues: code 글로브 정확. status: implemented 정확(catalog-sync 강제).

### spec/conventions/cafe24-api-catalog/customer.md — minor / implemented / keep, patch-content

- **headline**: customer.md 24행이 customer.ts 와 전부 정합. customer_get/update 의 미문서 provisional 상태가 표에 미노출.
- findings:
  - claim: customer_get/update 가 supported + docs anchor 로 등재
    → reality: 코드에 '⚠ Not documented; pending production verification' + §G-2 제거 검토 중. spec 표는 provisional 성격 미노출 (evidence: `customer.ts:26-62` vs `customer.md:19-20`)
  - claim: 두 행 docs 링크가 단건 조회/수정 전용 anchor
    → reality: 둘 다 list anchor(#retrieve-a-list-of-customers) 재사용 — 단건 GET/PUT 이 공식 문서에 없기 때문. anchor 가 실제 op 와 불일치 (evidence: `customer.md:19-20`)
- frontmatterIssues: code 글로브 정확. status: implemented 정합.

### spec/conventions/cafe24-api-catalog/design.md — none / implemented / keep

- **headline**: design.md 9 operation 이 design.ts 와 method/path/scope/paginated 전부 1:1 일치 — drift 없음.
- findings(전부 일치 확인): themes_list 만 paginated:true, icons_list 비-paginated, theme_pages_update path `themes/{skin_no}/pages` 모두 정합.
- structuralNotes: restricted 컬럼 의도적 생략(restrictedApproval 0건, MIN_CATALOG_COLUMNS=9 파서 허용). icons_list docs anchor 'desgin' 오타는 Cafe24 공식 anchor 자체 오타로 추정, 표 텍스트 정상.

### spec/conventions/cafe24-api-catalog/promotion.md — minor / implemented / keep

- **headline**: promotion 35행이 코드 35 op 와 전부 1:1 일치. coupon_get/delete 의 ⚠ 미검증 caveat 만 spec 미반영.
- findings:
  - claim: coupon_get/coupon_delete 를 supported + docs 링크로 등재
    → reality: 코드에 '⚠ Not documented; pending production verification' + §G-2 트랙. spec 표에 미검증 신호 없음 (evidence: `promotion.ts:29-46,95-106` vs `promotion.md:19,22`)
- frontmatterIssues: code 글로브 1매치 정확. status: implemented 정확.

### spec/conventions/cafe24-api-metadata.md — major / implemented / patch-content

- **headline**: behavior(constraints·timezone suffix·envelope·catalog key·label 제거)는 코드와 정합. 다만 소비처 클래스명 `Cafe24McpBridge.listTools()/callTool()/operationToMcpTool()` 가 실제 `Cafe24McpToolProvider.buildTools()/execute()/buildToolDescription()` 와 불일치.
- findings:
  - **[major]** claim: §7 이 `Cafe24McpBridge.listTools()/callTool(name,args)/operationToMcpTool(op)` 를 canonical 메서드로 기술
    → reality: `Cafe24McpBridge` 클래스 코드에 부재. 실제 소비처 `Cafe24McpToolProvider`, 메서드 `buildTools()/execute()`, 빌더 free function `buildToolDescription()`. 3개 심볼 어디에도 없음(index.ts:91 주석에만 stale) (evidence: `cafe24-mcp-tool-provider.ts:46,99,339,779`; grep `class Cafe24McpBridge` → 0)
  - claim: §5.3 product_list description 2번째 줄 `(Cafe24 GET products)`
    → reality: 코드는 항상 `(Cafe24 GET products — via Internal Bridge: <name>)`. §2/§7.5 는 맞지만 §5.3 만 stale (evidence: `cafe24-mcp-tool-provider.ts:786`)
  - claim: Rationale constraints 가 'kind 3종(oneOf/allOrNone/implies)'
    → reality: 실제 4종 — +`impliesValue`. §2 본문은 포함하나 Rationale 만 '3종' (spec 내부 불일치) (evidence: `types.ts:75-92`; spec line 454 vs 104)
  - claim: §7 operationToMcpTool 이 `name: op.id` (bare id) 반환
    → reality: 실제 tool name `mcp_${sid}__${operation.id}` 를 buildTools 가 직접 생성. prefix 부여 레이어 경계 서술과 어긋남. 단 §8 allowlist bare id 비교는 정합 (evidence: `cafe24-mcp-tool-provider.ts:218`)
  - claim: §2/§3/§5.2 예시 — price description='Decimal string (KRW)', customer_list.fields 6개
    → reality: price 무 description, fields 3개. 단 spec line 175 가 '예시 fields 부분 일치, 후속 트랙' 면제 명시 → illustrative 차이 (evidence: `product.ts:121`, `customer.ts:18-22`)
  - claim: §7.5 'backend 가 한국어 라벨 직접 보유 안 함'
    → reality: operation label 은 제거 정합. 단 resource-level `CAFE24_RESOURCE_LABELS`(한국어 hardcoded) 잔존 — 표면적 충돌 (evidence: `types.ts:199-218`)
- frontmatterIssues: code 글로브 `metadata/**` 가 핵심 소비처 `Cafe24McpToolProvider`·handler 가드(cafe24.handler.ts, cafe24-api.client.ts)를 미포함 → §2/§4/§7/§7.5 약속 surface 과소 커버. 3파일 추가 권장. status: implemented 는 behavior 관점 정확, 강등 불요.
- structuralNotes: §1 디렉토리 목록·상호참조 정합. 핵심은 본문 naming drift, SoT 이므로 실제 심볼로 patch 권장.

### spec/conventions/cafe24-restricted-scopes.md — major / partial / patch-content

- **headline**: 메타데이터 SoT·OAuth invalid_scope·4 UI 배지 모두 구현 일치. 단 §4.3 둘째 bullet(노드 실행 403 응답에 missingScopes+requiresCafe24Approval 채움)은 핸들러에 미구현.
- findings:
  - **[major]** claim: §4.3 둘째 bullet — 노드 실행 403 details 에 missingScopes 옆 requiresCafe24Approval 채워 frontend 분기 메시지 노출
    → reality: cafe24.handler.ts 403 경로는 statusCode/mallId/resource/operation/cafe24ErrorCode/cafe24Message 만 넣고 둘 다 미채움. requiresCafe24Approval enrich 은 OAuth 경로(markAuthFailed/markIntegrationCallbackError)에만 존재. frontend i18n 도 scope-tab 에서만 소비, 노드 실행 결과 렌더에 소비처 없음 (evidence: `cafe24.handler.ts:296-327`; grep missingScopes node 경로 0; `scope-tab.tsx:144,161`)
  - claim: §4.3/§4.4 에러코드 = INSUFFICIENT_SCOPE(403) 유지
    → reality: 실제 코드 `CAFE24_INSUFFICIENT_SCOPE` (prefix 차이, 동일 의미) (evidence: `cafe24-api.client.ts:401,428`)
  - §1 scope 단위(mileage 8/8·notification 12/12·privacy 6/6), §2 operation 단위 명단(activitylogs/menus/naverpay/kakaopay/pg_settings), §3 program 단위 placeholder, §4.3 첫째 bullet OAuth invalid_scope, §4.1 4 UI 배지, Trade-off paymentmethods 빈칸 — 전부 일치 확인.
- frontmatterIssues: code 글로브가 restricted-approval.ts 단일 파일만 — 약속 surface(store/mileage/notification/privacy.ts, integration-oauth/status-reason/api.client, frontend scope-tab/integration-configs/approval-required-badge/cafe24-allowlist-editor/new page, catalog-sync.spec)로 확장 권장. status: implemented 는 §4.3 둘째 bullet 미구현으로 엄밀히는 partial.
- structuralNotes: 명단 SoT 단독 보유 + 동기 강제 설계가 catalog-sync 와 정확히 맞물림. 구조 개선 불필요.

### spec/conventions/chat-channel-adapter.md — minor / partial / keep, patch-content, fix-code-paths

- **headline**: 컨벤션 인터페이스(6+4함수·EiaEvent union·classifier)는 정밀 일치. visualNode·callbackQueryId·ChannelButton.style 소폭 drift 와 code 글로브 협소만 minor.
- findings:
  - claim: §2.3 visualNode = "text"|"photo"|"auto" (text_only legacy normalize)
    → reality: DTO·telegram renderer 는 spec 그대로 구현. 그러나 canonical in-memory `types.ts:66` 은 `'photo'|'text_only'` 로 stale(현 enum text/auto 누락) — spec 이 정답, types.ts 뒤처짐 (evidence: `types.ts:66` vs `chat-channel-config.dto.ts:61-67`)
  - claim: §2.1 button_callback variant = {kind, callbackData} 만
    → reality: 코드에 `callbackQueryId: string` 추가(answerCallbackQuery 용). spec 미문서(code-ahead) (evidence: `types.ts:126`)
  - claim: §2.2 ChannelButton = {id,label,type,url?} 4필드
    → reality: 코드에 `style?: 'primary'|'danger'|'none'` 추가. spec 미문서 (evidence: `types.ts:178-179`)
  - claim: §1.1/§3.1 호출자 HooksService.openFormModal, TriggersService.rotateBotToken/setupChatChannel
    → reality: 구현 실재하나 frontmatter code 글로브(chat-channel/**)가 두 모듈 미포함 → 컨벤션 핵심 동작 일부가 글로브 밖 (evidence: `hooks.service.ts:294-325`, `triggers.service.ts:1080-1089`)
- frontmatterIssues: code 글로브 chat-channel/** 단독, 호출자 모듈 누락. status=partial 사유는 증분 pending_plans(discord-gateway/slack-socket/visual-ssr-png) — 인터페이스 관점 implemented 에 가까움, partial 근거 명시 권장.

### spec/conventions/conversation-thread.md — major / implemented / patch-content, fix-code-paths

- **headline**: 백엔드 핵심(타입/렌더러/cap/주입)은 정합하나, system_error 를 backend source 로 기술·classifier/extractor push v1/v2 경계·frontmatter code 글로브가 코드 현실과 어긋남.
- findings:
  - **[major]** claim: §1.1/§8.3 system_error 가 backend ConversationTurnSource 의 6번째 신규 enum
    → reality: backend source 는 5값(presentation_user/ai_user/ai_assistant/ai_tool/system)뿐, system_error 없음. frontend 가 node.failed/completed WS 로 합성, frontend conversation-utils.ts 만 6값. spec 이 backend source 처럼 §1.2/§5.1 에 섞어 기술 → 오해 (evidence: `conversation-thread.types.ts:19-24`; `conversation-utils.ts:14-20`; `use-execution-events.ts:96`)
  - **[major]** claim: §2.3/§1.4/§7 — text_classifier·information_extractor final-assistant push 는 v2 로드맵(미래형)
    → reality: 두 노드 모두 push hook 구현·활성(pushClassifierTurn 259,277 / pushExtractorTurn 282, appendAiAssistantMessage). v2 로 미룬 기능이 이미 출하 (evidence: `text-classifier.handler.ts:56-72,259,277`; `information-extractor.handler.ts:144-151,282`)
  - claim: §5.3 MAX_INJECTED_TURNS 초과 시 '[... N earlier turns omitted ...]' 마커 prepend
    → reality: applyCap 은 head drop 만, 마커 없음. LLM 이 잘림 신호 못 받음 (evidence: `thread-renderer.ts:157-187`; grep 'earlier turns omitted' → 0)
  - claim: §2.4 opt-out UI 그룹 'Advanced > Conversation'
    → reality: 코드 group 은 'Conversation Context' (5필드), 'Advanced > Conversation' 없음 (evidence: `ai-agent.schema.ts:414-425`)
  - claim: §9.7.1 '식별자 비노출' 자기-규칙
    → reality: 같은 표가 startExecution/completeExecution/failExecution 등 구체 store 액션명 노출 — 구현은 정합이나 spec 내부 모순 (evidence: `execution-store.ts:342-345,380-388,460-466`)
- frontmatterIssues: code 글로브가 backend 2디렉토리만 — §9 전체·§1.6 UI·§9.6/§9.8 SoT 가 frontend(conversation-utils.ts, execution-store.ts, use-execution-events.ts, conversation-inspector.tsx)에 있어 spec 절반 누락. ai-agent.handler.ts·classifier/extractor handler 도 미포함 → 추적 끊김.
- structuralNotes: types/renderer(shared) vs service(execution-engine) 분리 글로브는 현재 둘 다 잡음(OK). frontmatter 보강 우선.

### spec/conventions/data-hydration-surfaces.md — minor / implemented / patch-content

- **headline**: 매트릭스 핵심 hydration 경로는 implemented. 함수명 2건 stale·maxTurns 분모 출처 서술이 timeline 코드와 어긋남.
- findings:
  - claim: §2.1 tool_call_completed → `patchToolItem`
    → reality: 실제 `updateToolItem`, patchToolItem 심볼 grep 0 (evidence: `execution-store.ts:291,668`; `use-execution-events.ts:676`)
  - claim: §1.2 presentation hydration = inferInteractionTypeFromData + `appendPresentationInteraction` push
    → reality: appendPresentationInteraction 부재(grep 0). presentation_user push 는 `submitForm` 가 인라인 수행. inferInteractionTypeFromData 는 실재 (evidence: `use-execution-interaction-commands.ts:139-153`; `conversation-utils.ts:116`)
  - **[major]** claim: §1.1 turnCount 분모 M 을 config.maxTurns 에서 읽음
    → reality: backend echo 안 함은 맞으나 ResultTimeline 은 `output.conversationConfig.maxTurns` 를 읽음. handler 가 output.conversationConfig 를 어떤 분기에서도 안 써(grep 0) 분모가 0 fallback 가능. spec 출처와 코드 출처 불일치 (evidence: `result-timeline.tsx:162-169`; `ai-agent.handler.ts:1656,1675-1676`)
  - §1.1 presentations echo·last-assistant attach·output.error system_error 합성·§2.1 waiting 경로 — 전부 일치 확인.
- frontmatterIssues: code 글로브 2개(hydration-coverage.test.ts, apply-execution-snapshot.ts) 실재하나 핵심 hydration 구현(conversation-utils.ts, result-timeline.tsx) 누락 — COVERAGE_MATRIX 가 가리키는 파일 추가 권장. status: implemented 타당(§2.4 Replay 만 미구현이나 v2 명시).
- structuralNotes: 매트릭스가 frontend 심볼명 hard-code → rename 시 §3 동기화 의무. patchToolItem/appendPresentationInteraction stale 이 자기-규약 위반 사례.

### spec/conventions/execution-context.md — minor / partial / fix-frontmatter, fix-code-paths

- **headline**: 본문 사실은 코드와 1:1 일치. 다만 frontmatter status=spec-only / code=[] 가 실제 구현 상태와 어긋남 — ParallelBranchContext, _contextKey, 원칙4 모두 코드 실재.
- findings:
  - 원칙2 ParallelBranchContext extends ExecutionContext, 원칙4 _contextKey 라우팅(bg 키), Stable core 필드 — 전부 정확 일치 (evidence: `node-handler.interface.ts:212-214,160-269`; `execution-context.service.ts:45-68`)
  - claim: frontmatter status: spec-only, code: []
    → reality: 핵심 구조가 node-handler.interface.ts + execution-engine + execution-context.service 에 모두 구현 → spec-only 부정확. sibling(node-cancellation/node-output=partial, conversation-thread=implemented)은 글로브 채움 (evidence: `execution-context.md:1-6` vs `node-cancellation.md:1-6`)
- frontmatterIssues: status spec-only → partial/implemented 적절. code: [] → 최소 node-handler.interface.ts, 라우팅 구현체 execution-context.service.ts/execution-engine.service.ts 후보. pending_plans 에 parallel-p2-followups.md 등재 고려(complete 사본과 라이프사이클 정리 필요할 수 있음).
- structuralNotes: 위치·네이밍·3섹션 정합, cross-ref 전부 실재. 유일 이슈는 frontmatter 가 sibling 관례와 어긋남.

### spec/conventions/i18n-userguide.md — minor / implemented / patch-content

- **headline**: 규약 본문 거의 정합. Principle 1 ratchet 가드 위치를 i18n.test.ts 로 오기 — 실제는 hardcoded-korean-ratchet.test.ts.
- findings:
  - claim: Principle 1 자동 가드 = i18n.test.ts ratchet
    → reality: i18n.test.ts 는 isLocale/parity 만, ratchet 없음. 전용 `hardcoded-korean-ratchet.test.ts`(+baseline.json) 가 자기 선언 (evidence: `i18n.test.ts:35,50,60,125`; `hardcoded-korean-ratchet.test.ts:6`)
  - claim: §3-B 표가 ui.* 매핑 전수(label/hint/group/itemLabel/options[].label 5종)
    → reality: PLACEHOLDER_KO + translateBackendPlaceholder(ui.placeholder) 존재하나 표 미열거. 단 현 schema 가 ui.placeholder emit 안 해 실해 없음 (evidence: `backend-labels.ts:245,566`)
- frontmatterIssues: code 글로브(backend-labels.ts, dict/**) 정상. 핵심 가드(backend-labels.test/ui-label-parity.test/hardcoded-korean-ratchet.test/locale.ts) 추가 시 추적 정확도 향상.

### spec/conventions/interaction-type-registry.md — minor / implemented / patch-content, fix-code-paths

- **headline**: 3개 enum 단일진실 표는 정확 일치. §2.1 system_error 행의 렌더 분기 파일 참조만 stale.
- findings:
  - claim: §2.1 system_error 렌더 분기 파일 = conversation-utils.ts, conversation-inspector.tsx, result-timeline.tsx
    → reality: 실제 분기는 conversation-timeline-item.tsx(item.type 6종 case). result-timeline.tsx 는 import/위임만(source 분기 0). 실제 분기 파일이 spec 에 미기재 (evidence: `conversation-timeline-item.tsx:35-66`; `result-timeline.tsx:20`)
  - claim: AST 가드가 매트릭스 모든 source 처리 위치를 grep 검증(inspector/timeline 포함 듯)
    → reality: SOURCE_REGISTRY_SITES 는 conversation-utils.ts 1개만. spec line 63 라벨이 가드 범위 과대표현 (evidence: `interaction-type-exhaustiveness.test.ts:91-95`)
  - claim: §1.2 form (a)~(f) 6위치 가드 검증
    → reality: REGISTRY_SITES 4개만(use-execution-events/apply-execution-snapshot/run-results-drawer/executions page). (f) result-detail.tsx·AssistantPresentationsBlock 은 TS switch 커버, grep 가드 아님. 동작 drift 아님 (evidence: `interaction-type-exhaustiveness.test.ts:30-35`)
- frontmatterIssues: code 글로브 2개 정확. §2/§3 단일진실 파일(conversation-thread.types.ts, conversation-utils.ts)·§3.2 render-tool-provider.ts 보강 여지.

### spec/conventions/migrations.md — minor / implemented / fix-code-paths, patch-content

- **headline**: spec 와 코드(가드 스크립트·워크플로·Dockerfile·spec.ts)는 거의 정확 일치. descriptor 문자집합 표현 불일치·README §번호 오참조·code 글로브 누락 정도의 minor.
- findings:
  - claim: §1 설명자 snake_case '소문자+숫자+_ 만'
    → reality: SQL_NAME_RE 는 하이픈 허용 `[a-z0-9_-]+`, PR CI 는 대문자까지 `[A-Za-z0-9_]+`. 세 위치 허용 집합 상이. 단 V001~V068 실파일은 위반 없음 (evidence: `migrations.md:31` vs `migrations.spec.ts:25` vs `check-migration-versions.py:40`)
  - claim: §3 'repair 절차 README §4 참고'
    → reality: §4 는 비-트랜잭션 모드, 실제 repair 절차는 README §5(143~166). 섹션 번호 오참조 (evidence: `migrations.md:49` vs `README.md:105,143`)
  - claim: §6.1 가드 메시지 'FAIL: V041 is duplicated' 등
    → reality: 실제 출력에 '[migration-guard] ' prefix. 본문 문구는 정확하나 prefix 생략 (evidence: `check-migration-versions.py:138,153,163,185`)
  - claim: §6.4 빌드 가드가 동일 V번호 정규화 사용 → 일치 확인(drift 없음)
- frontmatterIssues: code 글로브가 §6 surface 절반 누락(check-migration-versions.py, migration-check.yml, migration-recheck-on-main.yml, PULL_REQUEST_TEMPLATE.md). status: implemented 적절.

### spec/conventions/node-cancellation.md — major / partial / patch-content, fix-frontmatter, fix-code-paths

- **headline**: 소비자 측 signal 전파는 spec 이 '후속'으로 미룬 DB/AI/Email 까지 이미 구현됨(§6 stale). 사용자 cancel 버튼은 RUNNING 실행의 진행 중 외부 I/O 를 실제로 abort 하지 않음(§2.3 과장).
- findings:
  - **[major]** claim: §6/§2.1 — DB/AI/Email·chat-channel signal 전파는 모두 후속 PR, 본 PR 은 type + HTTP 1개만
    → reality: AI 3종(text-classifier/ai-agent/information-extractor) + llm.service/google.client 가 이미 abortSignal 전파. DB/Email 노드는 dispatch 직전 aborted 사전체크 구현. '미구현(후속)' 분류 surface 상당 부분 실구현 (evidence: `text-classifier.handler.ts:181`; `ai-agent.handler.ts:1211,1423`; `information-extractor.handler.ts:253`; `llm.service.ts:48,117`; `google.client.ts:235,575`; `database-query.handler.ts:121`; `send-email.handler.ts:87`)
  - **[major]** claim: §1/§2.3 사용자 cancel 버튼이 producer 로서 진행 중 노드 외부 I/O abort
    → reality: executions.service.ts stop() 의 RUNNING/PENDING 은 단일 DB UPDATE(status=cancelled)만 — AbortController 생성·abort 없음, context.abortSignal 미주입. 실제 producer 는 ParallelExecutor 하나뿐. cancel 버튼은 DB 상태만 변경, in-flight fetch/SDK 중단 못 함 — 과장 (evidence: `executions.service.ts:583-643`; createContext 호출부 1052,2748,7147 미주입; `parallel-executor.ts:132-185`)
  - claim: frontmatter code 글로브가 소비자로 http-request 만
    → reality: 실제 소비자 다수(AI 3종, DB, Email, llm.service, google.client) — 글로브 미대표
  - §5 cancelled status 후속·§4 HTTP cascade·§2.3/§3 ParallelExecutor cancel-others — 전부 일치 확인.
- frontmatterIssues: code 글로브 확장 권장. status: partial 타당(parallel producer + HTTP/AI/DB/Email 소비 구현, 그러나 cancel in-flight abort·DB driver cancel·workflow timeout·graceful shutdown 미구현). §6 '본 PR/후속' 분류가 status 와 어긋나게 stale → 본문 갱신 필요. pending_plans node-cancellation-infrastructure.md 유효.

### spec/conventions/node-output.md — minor / partial / keep, patch-content

- **headline**: node-output 컨벤션은 코드와 강하게 정합. 5필드 invariant·container output·resume/retry·error contract 모두 일치. baseline 참조 경로/표현만 미세 stale.
- findings:
  - claim: Principle 7(D1) baseline = 'background.handler.ts:64-68 + spec.ts:84-103 의 apiKey 가드'
    → reality: background.handler.ts:64-68 은 notes/notifyOnFailure/maxDurationMs echo 블록, apiKey 필드 없음. 'apiKey 가드' 표현이 cite 된 background spec 와 어긋나 오해 (evidence: `background.handler.ts:58-79`)
  - 5필드 NodeHandlerOutput·_resumeState/_retryState forward·Principle 9.2 container shape·Principle 6 동적 포트·Principle 8.2 LLM output.result/meta·Principle 4.4/4.5 resume — 전부 일치 확인.
- frontmatterIssues: code 글로브 2개 실재하나 실제 강제 surface(각 노드 handler, container 오버라이트 execution-engine.service.ts) 미포함 — execution-engine.service.ts 추가 검토 권장. status: partial 적절(node-output-redesign 진행).

### spec/conventions/secret-store.md — minor / implemented / patch-content

- **headline**: secret-store spec 은 구현과 거의 1:1 일치. §6 delete() 메서드명이 실제 remove()+deleteByPrefix() 와 어긋나고, 마이그레이션 DB CHECK 제약이 §3.1 DDL 에 누락된 minor.
- findings:
  - claim: §6 'TriggersService.delete() 가 secret://triggers/{id}/* 를 delete() 호출'
    → reality: 실제 메서드 `remove()`, 개별 delete() 아닌 `deleteByPrefix('secret://triggers/{id}/')`. §2.1/§5.3 는 올바름, §6 만 구식 (evidence: `triggers.service.ts:709,716`)
  - claim: §3.1 DDL 에 ref 형식 검증 제약 없음
    → reality: V063 마이그레이션이 CHECK chk_secret_store_ref_format 추가. spec DDL 누락 (evidence: `V063__secret_store.sql:33-35`)
  - resolve(ref) throw·§3.3 parseMasterKey 3분기 — 일치 확인.
- frontmatterIssues: code 글로브 9개 파일 정확 매치. status: implemented 정확(5메서드+deleteByPrefix 구현·소비).

### spec/conventions/spec-impl-evidence.md — minor / implemented / keep, patch-content

- **headline**: 본문이 기술한 4개 build-time 가드가 코드와 거의 정확 일치. status:implemented 타당. 가드 동작 서술 2건 사소한 표현 drift.
- findings:
  - claim: §3/§4.2/R-3 — backlog id 가 '§6.3 로드맵 텍스트'에 grep 매칭 의무
    → reality: 가드는 §6.3 한정 아닌 0-overview.md 전체 텍스트 includes(id) 검사. 단 backlog status 사용 0건이라 실효 없음 (evidence: `spec-status-lifecycle.test.ts:69-72`)
  - claim: §4/§2.1 pending_plans 는 'plan/in-progress/ 실존 의무'
    → reality: 가드는 in-progress OR complete 둘 중 하나면 통과(replace fallback). 표 문구가 실제 동작 과소기술 (evidence: `spec-pending-plan-existence.test.ts:40-47`)
  - claim: §4 4개 단위 테스트 모두 docs/__tests__ 위치 → 정확. 공유 파서가 §1/§2.1/§3 을 코드로 구현. 일치 확인.
- frontmatterIssues: code 글로브 4경로 실파일 매치, status:implemented 정확, 문제 없음.
- structuralNotes: §1 제외 목록이 spec/7-channel-web-chat(2026 신설)을 미언급하나 코드 INCLUDE 도 미포함 → 양쪽 일관 미적용. 향후 §1 명시 보강 후보.

### spec/conventions/swagger.md — minor / implemented / patch-content

- **headline**: swagger 컨벤션 거의 정확 일치. 래퍼 헬퍼 5종·writeOnly/readOnly·에러DTO 모두 실존. interaction-token 스킴과 oneOf 헬퍼 누락만 minor.
- findings:
  - claim: §5-2 래퍼 헬퍼 5종
    → reality: 5종 정확 존재 + 표에 없는 `ApiOkWrappedOneOfResponse`(+wrapOneOfDataSchema) 추가 존재(OAuth begin 분기용). 표 누락 (evidence: `api-wrapped.ts:124,140,157,170,183,197`)
  - claim: §2-1 access-token 단일 Bearer scheme
    → reality: main.ts 에 addBearerAuth 2개 — access-token + interaction-token(External Interaction 전용). spec 후자 미언급, 실제 사용 중 (evidence: `main.ts:93,102`)
  - §5-5 ErrorResponseDto·§1-5 writeOnly/readOnly — 일치 확인.
- frontmatterIssues: code 글로브 정상. status: implemented 정확.

### spec/conventions/user-guide-evidence.md — major / implemented / patch-content, fix-code-paths

- **headline**: 코어 컴포넌트·3가드 파일은 실존하나, §2 가드 검증 로직 3건과 §4 enforcement 채널 1건이 코드 현실과 어긋남(가드가 spec 약속보다 약함).
- findings:
  - **[major]** claim: §2 impl-anchor-existence.test.ts 가 api-endpoint 에 @Post/@Get + path 매치 '추가 검증'
    → reality: kind 분기 없이 모든 anchor 에 file 실존 + symbol substring grep 만. 데코레이터/path 검증 코드 전혀 없음 (evidence: `impl-anchor-existence.test.ts:49-53`)
  - **[major]** claim: §2/§3.2 triggers-coverage 가 'provider 별 절(h2/h3 provider 이름)' 대상으로 ui-entry anchor 강제
    → reality: provider-name 탐지 없음. integrations 와 동일 findGuiFlowSections()(GUI 단어/strong 패턴)만. provider 절이라도 GUI 신호 없으면 비대상 (evidence: `triggers-coverage.test.ts:37`; `impl-anchor-parse.ts:70-104`)
  - **[major]** claim: §4 채널2 — user-guide-writer.md 체크리스트에 'GUI 절 작성 시 ImplAnchor 동반 의무' 등재
    → reality: .claude/agents/user-guide-writer.md 에 ImplAnchor/impl-anchor/user-guide-evidence 언급 0. 약속한 3채널 중 1채널 미구현 (evidence: grep → 0 매치)
  - claim: §2 GUI flow 절 = heading 'GUI' 키워드 한 신호
    → reality: 실제는 heading 키워드 OR body strong 패턴 두 신호. 표가 실제보다 좁음 (evidence: `impl-anchor-parse.ts:97-103`)
  - claim: §3.1 예시 symbol="chatChannelCheckbox"
    → reality: 코드 부재(grep 0). 실제 symbol="chatChannelProvider"(page.tsx:68,232,672,678). 가공 예시 (evidence: `telegram.mdx:31`)
  - claim: §1.3/R-1 ImplAnchor 가 display:none 렌더
    → reality: return null(아무것도 렌더 안 함). 결과는 동일하나 메커니즘 표현 불일치 (evidence: `impl-anchor.tsx:14-16`)
- frontmatterIssues: code 글로브 2건 실존하나 핵심 가드(integrations-coverage.test.ts, triggers-coverage.test.ts, impl-anchor-parse.ts) 누락 → stale 검출 약함(fix-code-paths 권장). status: implemented 유지 타당하나 약속 surface 일부 미구현으로 partial 경계.
- structuralNotes: spec 본문이 가드 '검증 강도'를 코드보다 강하게 기술하는 over-claim 패턴 반복.

## 일치 확인됨 (severity none)

- **spec/conventions/cafe24-api-catalog/collection.md** — 15 op 가 collection.ts 와 전부 1:1 일치, drift 없음.
- **spec/conventions/cafe24-api-catalog/community.md** — 24 row 가 community.ts 24 op 와 전부 1:1 일치.
- **spec/conventions/cafe24-api-catalog/mileage.md** — 8 row 가 mileage.ts 8 op 와 method/path/scope/restricted 전부 부합.
- **spec/conventions/cafe24-api-catalog/notification.md** — 12 row 전부 backend 메타데이터와 1:1 일치.
- **spec/conventions/cafe24-api-catalog/order.md** — 106 endpoint 가 order.ts 와 전부 1:1 일치.
- **spec/conventions/cafe24-api-catalog/personal.md** — 5 row 가 personal.ts 와 전부 1:1 일치.
- **spec/conventions/cafe24-api-catalog/privacy.md** — 6 row 가 6 op 와 restricted 포함 전부 정확 일치.
- **spec/conventions/cafe24-api-catalog/product.md** — 63 op 가 productOperations 와 전 필드 완전 일치.
- **spec/conventions/cafe24-api-catalog/salesreport.md** — 5 row 가 salesreport.ts 와 status 포함 전부 동기.
- **spec/conventions/cafe24-api-catalog/shipping.md** — 15 op 가 shipping.ts 와 전부 1:1 일치.
- **spec/conventions/cafe24-api-catalog/store.md** — 106 op 가 store.ts 와 restricted 그룹까지 1:1 일치.
- **spec/conventions/cafe24-api-catalog/supply.md** — 20 op 가 supply.ts 와 전부 1:1 일치.
- **spec/conventions/cafe24-api-catalog/translation.md** — 9 row 가 translation.ts 9 op 와 전부 일치.
- **spec/conventions/cross-node-warning-rules.md** — frontmatter 경로·타입·rule·3중가드·i18n 모두 정합, drift 없음.
- **spec/conventions/error-codes.md** — 인용 코드·예외 레지스트리·교차참조 정합. 글로브가 대표 surface 1개만 가리키는 점만 경미(none 유지).

## 영역 구조·네이밍 이슈

- **cafe24-api-catalog 디렉토리 패턴**: 일반 `N-name.md` 대신 `_overview.md`(인덱스) + `<resource>.md`(상세) 패턴을 쓰지만, 이는 `_overview.md §1` 에 명시·문서화된 의도적 컨벤션이며 Cafe24Resource enum 과 1:1 매칭되어 내부 일관. 위반 아님. 18개 resource md 가 enum/§1 목록/실파일과 모두 정합.
- **restricted 컬럼 optional 규약**: restrictedApproval 메타데이터가 있는 resource(store/mileage/notification/privacy)만 컬럼을 두고 나머지는 생략 — `_overview.md §2` optional 규약 + catalog-sync 파서(header 기반 dynamic indexing, MIN_CATALOG_COLUMNS=9) 가 정식 허용. drift 아님.
- **frontmatter `code:` 글로브의 surface 과소대표가 영역 전반 패턴**: 컨벤션 문서 다수(cafe24-api-metadata, cafe24-restricted-scopes, chat-channel-adapter, conversation-thread, data-hydration-surfaces, execution-context, i18n-userguide, interaction-type-registry, migrations, node-cancellation, node-output, user-guide-evidence)가 본문이 강제하는 소비처·런타임 enrich·가드 테스트 surface 를 글로브에서 누락. 영역 차원 정규화로 fix-code-paths 일괄 권장.
- **execution-context.md frontmatter 만 sibling 관례 이탈**: 동일 폴더 컨벤션이 모두 `code` 글로브 채움 + partial/implemented 인데 이 파일만 status=spec-only / code=[] — 정규화 필요.

## 우선 액션 (정렬)

major:

1. `spec/conventions/cafe24-restricted-scopes.md` §4.3 둘째 bullet — 노드 실행 403 응답의 requiresCafe24Approval/missingScopes enrich 가 미구현. spec 을 partial 로 강등하거나, 해당 enrich 를 cafe24.handler.ts 403 경로에 구현(구현 위임은 developer). 
2. `spec/conventions/cafe24-api-metadata.md` §7/§14/§5.3 의 `Cafe24McpBridge.listTools()/callTool()/operationToMcpTool()` → 실제 심볼 `Cafe24McpToolProvider.buildTools()/execute()/buildToolDescription()` 로 patch (코드 주석 stale 도 동반 정리).
3. `spec/conventions/conversation-thread.md` §1.1/§8.3 system_error 를 backend ConversationTurnSource 6번째 enum 으로 기술한 부분을 'frontend 합성 UI source' 로 정정, §2.3/§1.4/§7 의 classifier/extractor push 'v2 로드맵' 을 '구현 완료' 로 갱신.
4. `spec/conventions/node-cancellation.md` §6 '본 PR/후속' 분류 갱신(AI/DB/Email 소비 이미 구현), §1/§2.3 cancel 버튼을 abortSignal producer 로 묘사한 과장 제거(현재 DB UPDATE-only).
5. `spec/conventions/user-guide-evidence.md` §2 api-endpoint 데코레이터 검증·triggers provider-name 탐지 over-claim 을 실제 가드 수준(symbol grep / GUI 절 탐지)으로 하향 기술, §4 채널2(user-guide-writer.md 체크리스트) 를 실제로 추가하거나 spec 에서 제거.

minor (대표):

6. `spec/conventions/data-hydration-surfaces.md` §1.1 maxTurns 분모 출처를 `output.conversationConfig.maxTurns`(코드 실측)로 정정, §2.1 patchToolItem→updateToolItem, §1.2 appendPresentationInteraction→submitForm 인라인 push 로 patch.
7. `spec/conventions/execution-context.md` frontmatter status=spec-only→partial, code=[] → node-handler.interface.ts/execution-context.service.ts/execution-engine.service.ts 채움.
8. cafe24-api-catalog `application.md/category.md/customer.md/promotion.md` 의 ⚠ 미문서/미검증 seed endpoint(applications_list, webhooks_list, mains_update/delete, customer_get/update, coupon_get/delete) 에 §G-2 provisional caveat 를 표 또는 각주로 노출.
9. `spec/conventions/interaction-type-registry.md` §2.1 system_error 렌더 분기 파일을 result-timeline.tsx → conversation-timeline-item.tsx 로 교정, AST 가드 범위(conversation-utils.ts 단일) 정확 기술.
10. `spec/conventions/i18n-userguide.md` Principle 1 ratchet 가드 위치를 hardcoded-korean-ratchet.test.ts 로 정정.
11. `spec/conventions/secret-store.md` §6 delete()→remove()+deleteByPrefix(), §3.1 DDL 에 V063 CHECK 제약(chk_secret_store_ref_format) 추가.
12. `spec/conventions/swagger.md` §5-2 에 ApiOkWrappedOneOfResponse 헬퍼, §2-1 에 interaction-token Bearer scheme 추가.
13. `spec/conventions/migrations.md` §3 repair 참조 README §4→§5, §1 descriptor 문자집합(spec/spec.ts/python 3위치 정렬), §6.1 가드 메시지 '[migration-guard]' prefix 반영.
14. `spec/conventions/node-output.md` Principle 7 baseline 의 'apiKey 가드' 표현을 background.handler 실제 echo 필드(notes/notifyOnFailure/maxDurationMs)와 정합하게 정정.
15. fix-code-paths 일괄: 위 영역 구조 이슈의 컨벤션 문서들 `code:` 글로브에 누락 surface(소비처 핸들러·런타임 enrich·가드 테스트) 추가.
