# 유지보수성(Maintainability) Review Payload

본 파일은 orchestrator 가 유지보수성(Maintainability) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 유지보수성 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (유지보수성(Maintainability))

1. **가독성**: 코드가 읽기 쉽고 의도가 명확한지
2. **네이밍**: 변수/함수/클래스 이름이 목적을 잘 나타내는지, 컨벤션 일관성
3. **함수 길이**: 함수가 너무 길거나 여러 책임을 가지고 있는지
4. **중첩 깊이**: 조건문·반복문 중첩 과도 여부
5. **매직 넘버**: 의미를 알 수 없는 하드코딩된 숫자·문자열
6. **중복 코드**: 동일하거나 유사한 코드가 반복되는지
7. **코드 복잡도**: 순환 복잡도가 높지 않은지
8. **일관성**: 기존 코드베이스 스타일·패턴 준수

## 리뷰 대상 파일

### 파일 1: frontend/src/content/docs/02-nodes/ai.en.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/02-nodes/ai.en.mdx b/frontend/src/content/docs/02-nodes/ai.en.mdx
index 865d554d..8a115675 100644
--- a/frontend/src/content/docs/02-nodes/ai.en.mdx
+++ b/frontend/src/content/docs/02-nodes/ai.en.mdx
@@ -28,8 +28,11 @@ This page covers the three AI nodes: calling an LLM to generate answers, classif
   {name: "maxToolCalls", required: false, type: "integer", description: "Max tool calls.", default: "10"},
   {name: "Tool nodes (Tool Area)", required: false, type: "Node list", description: "Nodes dropped into the canvas Tool Area are auto-registered as the agent's tools. Managed purely by drag and drop — no explicit setting.", default: "None"},
   {name: "toolOverrides", required: false, type: "ToolOverride[]", description: "Per-tool name/description/input-mapping overrides.", default: "[]"},
-  {name: "conversationHistory", required: false, type: "`none` / `last_n` / `full`", description: "Conversation-history retention strategy.", default: "none"},
-  {name: "historyCount", required: false, type: "integer", description: "How many messages to keep with `last_n`.", default: "-"},
+  {name: "contextScope", required: false, type: "`none` / `thread` / `lastN`", description: "Automatic Conversation Thread injection scope. `none` sends only system+user, `thread` injects the full workflow thread, and `lastN` injects only the most recent N turns.", default: "none"},
+  {name: "contextScopeN", required: false, type: "integer", description: "Number of most recent turns to inject when `contextScope=lastN`.", default: "20"},
+  {name: "contextInjectionMode", required: false, type: "`messages` / `system_text`", description: "How the thread is injected. `messages` prepends per-turn role messages to the LLM messages array; `system_text` renders the thread as a single text block appended to the system prompt.", default: "messages"},
+  {name: "includeToolTurns", required: false, type: "boolean", description: "When true, also pushes KB/MCP/condition tool-call turns into the thread. Defaults to pushing only the final assistant response.", default: "false"},
+  {name: "excludeFromConversationThread", required: false, type: "boolean", description: "When checked, skips pushing this node's user/assistant turns into the workflow thread (opt-out).", default: "false"},
   {name: "maxTurns", required: false, type: "integer", description: "Max conversation turns in Multi Turn mode. `0` means unlimited.", default: "20"}
 ]} />
 
@@ -44,6 +47,23 @@ This page covers the three AI nodes: calling an LLM to generate answers, classif
 Conditions are exposed to the LLM as special tools (`cond_*`). When the LLM calls only condition tools, the run branches to that port; when it calls them alongside regular tools, regular tools run first and the decision is re-evaluated. Up to 20 conditions allowed.
 </Callout>
 
+### Conversation Context
+
+A workflow run keeps a **Conversation Thread** that accumulates user and AI Agent turns during execution. An AI Agent node can inject that thread into the LLM call automatically — you don't need to splice `{{ $thread.text }}` into the system prompt by hand, just set `contextScope`.
+
+- `contextScope: none` — disables auto-injection; the LLM sees only this node's `systemPrompt` / `userPrompt`. (Default.)
+- `contextScope: thread` — sends every turn from the workflow thread alongside the LLM call. Token usage can grow quickly in long conversations.
+- `contextScope: lastN` — sends only the most recent `contextScopeN` turns (default 20). Use this to balance token cost against context retention.
+
+Injection mode (`contextInjectionMode`) has two flavors.
+
+- `messages` (default) — prepends per-turn `role: user/assistant` messages to the front of the LLM messages array. Plays well with tool calls and feels natural on chat models like OpenAI / Anthropic.
+- `system_text` — renders the turns into a single text block appended to the system prompt. Use it when you want to keep the messages slot empty or target a single-system-prompt model.
+
+By default the thread receives **only the final assistant response and user turns**. Turn on `includeToolTurns` to also persist KB / MCP / condition tool-call turns. Conversely, set `excludeFromConversationThread` to keep a node out of the thread entirely (handy for background classifier-style LLM calls).
+
+To reference the thread directly from expressions, use `{{ $thread.length }}`, `{{ $thread.text }}`, or `{{ $thread.turns[0].data.email }}`. See [Variables and context · $thread](/docs/04-expression-language/variables-and-context#thread-conversation-thread) for details.
+
 ### Example
 
 <Example title="Customer inquiry — Single Turn with condition branching">

```

---

### 파일 2: frontend/src/content/docs/02-nodes/ai.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/02-nodes/ai.mdx b/frontend/src/content/docs/02-nodes/ai.mdx
index ee74b8ff..9b2094f0 100644
--- a/frontend/src/content/docs/02-nodes/ai.mdx
+++ b/frontend/src/content/docs/02-nodes/ai.mdx
@@ -5,7 +5,7 @@ section: "02-nodes"
 order: 6
 summary: "AI Agent, 텍스트 분류기, 정보 추출기로 LLM 기반 처리를 담당하는 노드들을 설명해요."
 summary_en: "LLM-powered nodes: AI Agent, Text Classifier, and Information Extractor."
-spec: ["spec/4-nodes/3-ai/0-common.md"]
+spec: ["spec/4-nodes/3-ai/0-common.md", "spec/conventions/conversation-thread.md"]
 code: ["backend/src/nodes/ai/ai-agent/ai-agent.schema.ts", "backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts", "backend/src/nodes/ai/text-classifier/text-classifier.schema.ts", "backend/src/nodes/ai/information-extractor/information-extractor.schema.ts"]
 ---
 
@@ -39,8 +39,11 @@ code: ["backend/src/nodes/ai/ai-agent/ai-agent.schema.ts", "backend/src/nodes/ai
   {name: "maxToolCalls", required: false, type: "integer", description: "최대 도구 호출 횟수예요.", default: "10"},
   {name: "도구 노드 (Tool Area)", required: false, type: "노드 목록", description: "캔버스의 Tool Area에 끌어다 놓은 노드가 AI Agent의 도구로 자동 등록돼요. 명시적 설정 없이 드래그만으로 관리돼요.", default: "없음"},
   {name: "toolOverrides", required: false, type: "ToolOverride[]", description: "도구별 이름/설명/입력 매핑 오버라이드예요.", default: "[]"},
-  {name: "conversationHistory", required: false, type: "`none` / `last_n` / `full`", description: "대화 이력 보관 전략이에요.", default: "none"},
-  {name: "historyCount", required: false, type: "integer", description: "`last_n`일 때 보관 메시지 수예요.", default: "-"},
+  {name: "contextScope", required: false, type: "`none` / `thread` / `lastN`", description: "Conversation Thread 자동 주입 범위예요. `none`은 system+user 만 보내고, `thread`는 워크플로우 thread 전체를, `lastN`은 가장 최근 N turn 만 LLM에 함께 보내요.", default: "none"},
+  {name: "contextScopeN", required: false, type: "integer", description: "`contextScope=lastN`일 때 주입할 최근 turn 수예요.", default: "20"},
+  {name: "contextInjectionMode", required: false, type: "`messages` / `system_text`", description: "Thread 주입 방식이에요. `messages`는 LLM messages 배열 앞에 turn 별로 prepend하고, `system_text`는 system 프롬프트 뒤에 한 덩어리로 append해요.", default: "messages"},
+  {name: "includeToolTurns", required: false, type: "boolean", description: "true면 KB/MCP/조건 도구 호출 turn까지 thread에 push해요. 기본은 최종 assistant 응답만 push해요.", default: "false"},
+  {name: "excludeFromConversationThread", required: false, type: "boolean", description: "체크하면 이 노드의 user/assistant turn을 워크플로우 thread에 push하지 않아요(opt-out).", default: "false"},
   {name: "maxTurns", required: false, type: "integer", description: "Multi Turn 모드의 최대 대화 턴 수예요. `0`은 무제한이에요.", default: "20"}
 ]} />
 
@@ -55,6 +58,23 @@ code: ["backend/src/nodes/ai/ai-agent/ai-agent.schema.ts", "backend/src/nodes/ai
 조건(Conditions)은 LLM에게 특별한 도구(`cond_*`)로 제공돼요. LLM이 조건 도구만 호출하면 해당 포트로 분기하고, 일반 도구와 함께 호출하면 일반 도구를 먼저 실행한 뒤 재평가해요. 최대 20개 조건까지 허용해요.
 </Callout>
 
+### Conversation Context
+
+워크플로우는 실행 동안 사용자·AI Agent 의 대화 turn 을 누적한 **Conversation Thread** 를 유지해요. AI Agent 노드는 이 thread 를 LLM 호출 직전에 자동으로 끼워 넣을 수 있어요. 직접 `{{ $thread.text }}` 같은 표현식으로 system 프롬프트에 박아 넣을 필요 없이, `contextScope` 만 설정하면 끝이에요.
+
+- `contextScope: none` — 자동 주입을 끄고 본 노드의 `systemPrompt`/`userPrompt` 만 LLM 에 보내요. (기본값)
+- `contextScope: thread` — 워크플로우 thread 의 모든 turn 을 LLM 에 함께 보내요. 긴 대화에서는 토큰 사용량이 빠르게 늘 수 있어요.
+- `contextScope: lastN` — 가장 최근 `contextScopeN` 개(기본 20) turn 만 보내요. 토큰 비용과 맥락 유지의 균형을 잡고 싶을 때 써요.
+
+주입 방식(`contextInjectionMode`)은 두 가지가 있어요.
+
+- `messages` (기본) — LLM messages 배열의 앞쪽에 turn 별 `role: user/assistant` 메시지로 prepend 해요. 도구 호출과 매끄럽게 섞이고, OpenAI/Anthropic 등 대부분의 채팅 모델에서 자연스러워요.
+- `system_text` — turn 들을 하나의 텍스트 블록으로 렌더해서 system 프롬프트 뒤에 append 해요. messages 슬롯을 비워 두고 단일 system 프롬프트 모델에 적합해요.
+
+기본적으로 thread 에는 **최종 assistant 응답과 사용자 turn 만** push 돼요. KB/MCP/조건 도구 호출까지 보존하고 싶으면 `includeToolTurns` 를 켜요. 반대로 특정 AI Agent 노드를 thread 에서 제외하고 싶으면 `excludeFromConversationThread` 를 켜요(예: 백그라운드 분류용 LLM 호출).
+
+표현식에서 thread 를 직접 참조하려면 `{{ $thread.length }}`, `{{ $thread.text }}`, `{{ $thread.turns[0].data.email }}` 처럼 쓸 수 있어요. 자세한 내용은 [변수와 컨텍스트 §$thread](/docs/04-expression-language/variables-and-context#thread-conversation-thread) 를 참고해요.
+
 ### 예시
 
 <Example title="고객 문의 처리 — Single Turn + 조건 분기">

```

---

### 파일 3: frontend/src/content/docs/02-nodes/integrations.en.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/02-nodes/integrations.en.mdx b/frontend/src/content/docs/02-nodes/integrations.en.mdx
index bbadcf84..0d0f7939 100644
--- a/frontend/src/content/docs/02-nodes/integrations.en.mdx
+++ b/frontend/src/content/docs/02-nodes/integrations.en.mdx
@@ -197,11 +197,57 @@ To/CC/BCC accept both arrays and comma-separated strings. Values are trimmed, bl
   {name: "none", required: false, type: "Integration credential", description: "Plain SMTP without TLS.", default: "-"}
 ]} />
 
+## Cafe24
+
+### When to use it
+
+- To call the Korean e-commerce SaaS **Cafe24** Admin API across its 18 categories (products, orders, customers, promotions, mileage, and so on — about 180 endpoints) from a workflow.
+- The same Cafe24 integration is reused by both this node and the AI Agent's MCP tool surface, so OAuth tokens, leaky-bucket rate limits, and call logs stay unified.
+
+### Fields
+
+<FieldTable rows={[
+  {name: "integrationId", required: true, type: "UUID", description: "Reference to an Integration with `service_type='cafe24'`. Create one from sidebar → Integrations → Cafe24 card.", default: "-"},
+  {name: "resource", required: true, type: "enum", description: "Cafe24 category — one of 18 values: `store`, `product`, `order`, `customer`, `community`, `design`, `promotion`, `application`, `category`, `collection`, `supply`, `shipping`, `salesreport`, `personal`, `privacy`, `mileage`, `notification`, `translation`.", default: "-"},
+  {name: "operation", required: true, type: "string", description: "Operation identifier for the selected resource — e.g. `product_list`, `product_get`, `order_list`, `order_update_status`. The metadata table fills the dropdown automatically.", default: "-"},
+  {name: "fields", required: false, type: "Record<string, unknown>", description: "Input fields for the selected operation. Expression `{{ }}` allowed. Required vs. optional varies per operation.", default: "{}"},
+  {name: "pagination", required: false, type: "object", description: "`{ limit?, offset?, cursor? }`. Meaningful only when the operation supports pagination.", default: "-"}
+]} />
+
+### Ports
+
+- `success` — API call succeeded
+- `error` — auth expired, leaky-bucket rate limit exceeded, Cafe24-side 5xx, etc.
+
+### Example
+
+<Example title="Fetch yesterday's unshipped orders">
+```ts
+// config
+{
+  integrationId: "…",
+  resource: "order",
+  operation: "order_list",
+  fields: {
+    shop_no: 1,
+    order_status: "N00",
+    start_date: "{{ formatDate($now, \"YYYY-MM-DD\") }}"
+  },
+  pagination: { limit: 50, offset: 0 }
+}
+```
+</Example>
+
+<Callout type="tip">
+If this is your first time, register the integration from **sidebar → Integrations → Cafe24** first. The full onboarding (app type, OAuth callback, registering a Private app) is covered in the [Cafe24 integration guide](/docs/06-integrations-and-config/cafe24). That page also explains how to expose the same integration as an MCP tool on an AI Agent node.
+</Callout>
+
 ## Canvas summary
 
 - HTTP Request: `{method} {url}` (URL trimmed at 35 chars)
 - Database Query: `{queryType} · {first line of the query}` (trimmed)
 - Send Email: `to: {recipient}` (with `+N` when there are more than 2)
+- Cafe24: `{resource} · {operation}` (operation name trimmed when long)
 
 When the referenced Integration is deleted, a `⚠ Missing integration` badge appears on the canvas summary.
 

```

---

### 파일 4: frontend/src/content/docs/02-nodes/integrations.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/02-nodes/integrations.mdx b/frontend/src/content/docs/02-nodes/integrations.mdx
index a7fdc1f3..c34ce332 100644
--- a/frontend/src/content/docs/02-nodes/integrations.mdx
+++ b/frontend/src/content/docs/02-nodes/integrations.mdx
@@ -3,10 +3,10 @@ title: "통합 노드"
 title_en: "Integration nodes"
 section: "02-nodes"
 order: 7
-summary: "HTTP Request, Database Query, Send Email로 외부 서비스와 연동하는 노드들을 설명해요."
-summary_en: "Nodes that connect to external services: HTTP Request, Database Query, and Send Email."
-spec: ["spec/4-nodes/4-integration/0-common.md"]
-code: ["backend/src/nodes/integration/http-request/http-request.schema.ts", "backend/src/nodes/integration/database-query/database-query.schema.ts", "backend/src/nodes/integration/send-email/send-email.schema.ts"]
+summary: "HTTP Request, Database Query, Send Email, Cafe24로 외부 서비스와 연동하는 노드들을 설명해요."
+summary_en: "Nodes that connect to external services: HTTP Request, Database Query, Send Email, and Cafe24."
+spec: ["spec/4-nodes/4-integration/0-common.md", "spec/4-nodes/4-integration/4-cafe24.md"]
+code: ["backend/src/nodes/integration/http-request/http-request.schema.ts", "backend/src/nodes/integration/database-query/database-query.schema.ts", "backend/src/nodes/integration/send-email/send-email.schema.ts", "backend/src/nodes/integration/cafe24/cafe24.schema.ts"]
 ---
 
 이 페이지에서는 외부 서비스와 연동하는 통합 노드 세 종류를 설명해요. 대부분의 통합 노드는 공통적으로 **Integration 엔티티**를 참조해 인증과 연결 정보를 재사용하고, 성공/실패를 각각 다른 출력 포트로 분기해요.
@@ -208,11 +208,57 @@ To/CC/BCC는 배열과 쉼표 구분 문자열 모두 허용해요. 내부적으
   {name: "none", required: false, type: "Integration credential", description: "TLS 없이 일반 SMTP예요.", default: "-"}
 ]} />
 
+## Cafe24
+
+### 언제 쓰나요?
+
+- 한국 이커머스 SaaS **Cafe24** 의 Admin API 18개 카테고리(상품·주문·회원·프로모션·적립금 등 ~180개 endpoint)를 워크플로우에서 호출하고 싶을 때 써요.
+- 같은 Cafe24 통합 한 개를 등록하면 본 노드와 AI Agent 의 MCP 도구 양쪽에서 그대로 재사용돼요(토큰·요청 한도·로그가 일원화돼요).
+
+### 필드
+
+<FieldTable rows={[
+  {name: "integrationId", required: true, type: "UUID", description: "`service_type='cafe24'` 인 Integration 참조예요. 사이드바 → 통합 → Cafe24 카드로 만들어요.", default: "-"},
+  {name: "resource", required: true, type: "enum", description: "Cafe24 카테고리예요. 18개 값 중 하나: `store`, `product`, `order`, `customer`, `community`, `design`, `promotion`, `application`, `category`, `collection`, `supply`, `shipping`, `salesreport`, `personal`, `privacy`, `mileage`, `notification`, `translation`.", default: "-"},
+  {name: "operation", required: true, type: "string", description: "선택한 `resource` 의 operation 식별자예요. 예: `product_list`, `product_get`, `order_list`, `order_update_status`. 메타데이터 테이블이 자동으로 드롭다운을 채워요.", default: "-"},
+  {name: "fields", required: false, type: "Record<string, unknown>", description: "선택한 operation 의 입력 필드 값이에요. 표현식 `{{ }}` 사용 가능해요. 필수·선택 필드는 operation 마다 달라요.", default: "{}"},
+  {name: "pagination", required: false, type: "object", description: "`{ limit?, offset?, cursor? }` 형태예요. 페이지네이션을 지원하는 operation 에서만 의미가 있어요.", default: "-"}
+]} />
+
+### 포트
+
+- `success` — API 호출 정상 완료
+- `error` — 인증 만료·요청 한도(leaky bucket) 초과·Cafe24 측 5xx 등 오류
+
+### 예시
+
+<Example title="어제 미발송 주문 가져오기">
+```ts
+// config
+{
+  integrationId: "…",
+  resource: "order",
+  operation: "order_list",
+  fields: {
+    shop_no: 1,
+    order_status: "N00",
+    start_date: "{{ formatDate($now, \"YYYY-MM-DD\") }}"
+  },
+  pagination: { limit: 50, offset: 0 }
+}
+```
+</Example>
+
+<Callout type="tip">
+처음 사용한다면 **사이드바 → 통합 → Cafe24** 에서 통합부터 만들어야 해요. 통합 등록 흐름(앱 종류 선택, OAuth 콜백, Private 앱 등록)은 [Cafe24 통합 가이드](/docs/06-integrations-and-config/cafe24)에서 자세히 다뤄요. 같은 통합을 AI Agent 노드의 MCP 도구로 노출하는 방법도 그 페이지에 있어요.
+</Callout>
+
 ## 캔버스 요약
 
 - HTTP Request: `{method} {url}` (URL 35자 초과 시 잘림)
 - Database Query: `{queryType} · {쿼리 첫 줄}` (잘림)
 - Send Email: `to: {수신자}` (2명 초과 시 `+N`)
+- Cafe24: `{resource} · {operation}` (operation 명이 길면 잘림)
 
 Integration이 삭제되면 캔버스 요약에 `⚠ Missing integration` 배지가 붙어요.
 

```

---

### 파일 5: frontend/src/content/docs/02-nodes/overview.en.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/02-nodes/overview.en.mdx b/frontend/src/content/docs/02-nodes/overview.en.mdx
index 1398d931..fad850b8 100644
--- a/frontend/src/content/docs/02-nodes/overview.en.mdx
+++ b/frontend/src/content/docs/02-nodes/overview.en.mdx
@@ -17,7 +17,7 @@ Nodes are grouped into seven categories. Each has a distinct color that makes th
   {name: "Logic", required: false, type: "Blue #3B82F6", description: "Controls data flow — branches, loops, variables, merges.", default: "-"},
   {name: "Flow", required: false, type: "Purple #8B5CF6", description: "Calls other workflows as sub-workflows.", default: "-"},
   {name: "AI", required: false, type: "Green #10B981", description: "LLM-powered agents, classification, and information extraction.", default: "-"},
-  {name: "Integration", required: false, type: "Orange #F97316", description: "Integrations with external services like HTTP, databases, email.", default: "-"},
+  {name: "Integration", required: false, type: "Orange #F97316", description: "Integrations with external services like HTTP, databases, email, and Cafe24.", default: "-"},
   {name: "Data", required: false, type: "Cyan #06B6D4", description: "Shape and transform data with Transform and Code nodes.", default: "-"},
   {name: "Presentation", required: false, type: "Pink #EC4899", description: "Show results or collect input via carousel, chart, form, table, and template nodes.", default: "-"}
 ]} />

```

---

### 파일 6: frontend/src/content/docs/02-nodes/overview.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/02-nodes/overview.mdx b/frontend/src/content/docs/02-nodes/overview.mdx
index 09385652..b24766b9 100644
--- a/frontend/src/content/docs/02-nodes/overview.mdx
+++ b/frontend/src/content/docs/02-nodes/overview.mdx
@@ -28,7 +28,7 @@ code: ["backend/src/nodes/core/node-component.interface.ts", "backend/src/nodes/
   {name: "Logic", required: false, type: "파랑 #3B82F6", description: "분기, 반복, 변수, 병합 등 데이터 흐름을 제어해요.", default: "-"},
   {name: "Flow", required: false, type: "보라 #8B5CF6", description: "다른 워크플로우를 서브 워크플로우로 호출해요.", default: "-"},
   {name: "AI", required: false, type: "초록 #10B981", description: "LLM 기반 에이전트, 분류, 정보 추출을 수행해요.", default: "-"},
-  {name: "Integration", required: false, type: "주황 #F97316", description: "HTTP, 데이터베이스, 이메일 같은 외부 서비스 연동이에요.", default: "-"},
+  {name: "Integration", required: false, type: "주황 #F97316", description: "HTTP, 데이터베이스, 이메일, Cafe24 같은 외부 서비스 연동이에요.", default: "-"},
   {name: "Data", required: false, type: "시안 #06B6D4", description: "Transform과 Code로 데이터를 가공해요.", default: "-"},
   {name: "Presentation", required: false, type: "핑크 #EC4899", description: "캐러셀, 차트, 폼, 테이블, 템플릿으로 결과를 보여주거나 입력을 받아요.", default: "-"}
 ]} />

```

---

### 파일 7: frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx b/frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx
index 094eb9d1..e97162c7 100644
--- a/frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx
+++ b/frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx
@@ -12,7 +12,8 @@ This page lists the **built-in reference variables** you can use inside expressi
   { name: "$trigger", type: "Object", description: "Trigger payload — webhook body, schedule context, etc." },
   { name: "$loop", type: "Object", description: "Loop-node inner context — index, iteration count, first/last flags." },
   { name: "$item", type: "Any", description: "The current item inside a ForEach/Map container." },
-  { name: "$itemIndex", type: "Number", description: "Current ForEach index, 0-based." }
+  { name: "$itemIndex", type: "Number", description: "Current ForEach index, 0-based." },
+  { name: "$thread", type: "Object", description: "Conversation Thread — a readonly snapshot of user and AI Agent turns accumulated during this workflow execution. Exposes `turns`, `length`, and `text`." }
 ]} />
 
 ## `$input`: the previous node's result
@@ -133,6 +134,42 @@ Access the raw data provided by Webhook, Schedule, or Manual triggers.
 ```
 </Example>
 
+## `$thread`: Conversation Thread
+
+A readonly view over **user inputs and AI Agent responses** accumulated during this workflow execution. Independent of an AI Agent node's `contextScope` auto-injection — you can read it from any expression in the workflow.
+
+<FieldTable rows={[
+  { name: "turns", type: "Array", description: "Readonly snapshot of the ConversationTurn array. Each turn carries `source`, `role`, `nodeId`, `data`, and so on." },
+  { name: "length", type: "Number", description: "Number of accumulated turns." },
+  { name: "text", type: "String", description: "Full thread rendered in system_text format. Memoized after the first access." }
+]} />
+
+<Example title="Branch on accumulated turn count">
+```ts
+{{ $thread.length > 5 }}
+```
+</Example>
+
+<Example title="Attach the full thread text as input to a downstream node">
+```ts
+{{ $thread.text }}
+```
+</Example>
+
+<Example title="Pick a field from the first form turn (when source is presentation_user)">
+```ts
+{{ $thread.turns[0].data.email }}
+```
+</Example>
+
+<Callout type="note">
+`$thread.text` renders the whole thread every time it is evaluated, so calling it repeatedly inside a loop can get expensive. Compute it once and stash the result in a variable.
+</Callout>
+
+<Callout type="tip">
+For most AI Agent calls it is simpler to let the node auto-inject the thread via [Conversation Context settings](/docs/02-nodes/ai#conversation-context). Reach for `$thread` directly when (1) a non-AI node (Transform / HTTP / Code) needs to shape the thread, or (2) you only want a slice of the turns.
+</Callout>
+
 ## Tips & notes
 
 - Autocomplete uses the schema from the most recent run. In a workflow that hasn't run yet, suggestions are limited — we recommend running it once first.

```

---

### 파일 8: frontend/src/content/docs/04-expression-language/variables-and-context.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/04-expression-language/variables-and-context.mdx b/frontend/src/content/docs/04-expression-language/variables-and-context.mdx
index 68b8baa5..81cd25e8 100644
--- a/frontend/src/content/docs/04-expression-language/variables-and-context.mdx
+++ b/frontend/src/content/docs/04-expression-language/variables-and-context.mdx
@@ -23,7 +23,8 @@ code: ["packages/expression-engine/src/evaluator.ts"]
   { name: "$trigger", type: "Object", description: "트리거 데이터예요. 웹훅 페이로드, 스케줄 컨텍스트 등이 들어가요." },
   { name: "$loop", type: "Object", description: "Loop 노드 내부 컨텍스트예요. 인덱스, 반복 횟수, 첫·마지막 여부를 담아요." },
   { name: "$item", type: "Any", description: "ForEach/Map 컨테이너의 현재 항목이에요." },
-  { name: "$itemIndex", type: "Number", description: "ForEach 현재 인덱스예요. 0부터 시작해요." }
+  { name: "$itemIndex", type: "Number", description: "ForEach 현재 인덱스예요. 0부터 시작해요." },
+  { name: "$thread", type: "Object", description: "Conversation Thread — 워크플로우 실행 동안 누적된 사용자·AI Agent turn 의 읽기 전용 스냅샷이에요. `turns`, `length`, `text` 속성을 가져요." }
 ]} />
 
 ## `$input`: 직전 노드 결과
@@ -144,6 +145,42 @@ Webhook, Schedule, Manual 트리거가 제공하는 원본 데이터에 접근
 ```
 </Example>
 
+## `$thread`: Conversation Thread
+
+워크플로우가 실행되는 동안 누적된 **사용자 입력 + AI Agent 응답 turn** 의 읽기 전용 뷰예요. AI Agent 노드의 `contextScope` 자동 주입과는 별개로, 어떤 표현식에서나 명시적으로 참조할 수 있어요.
+
+<FieldTable rows={[
+  { name: "turns", type: "Array", description: "ConversationTurn 배열의 readonly 스냅샷이에요. 각 turn 은 `source`, `role`, `nodeId`, `data` 등을 포함해요." },
+  { name: "length", type: "Number", description: "누적된 turn 개수예요." },
+  { name: "text", type: "String", description: "전체 thread 를 system_text 포맷으로 렌더한 결과예요. 첫 접근 시 메모이즈돼요." }
+]} />
+
+<Example title="누적 turn 개수로 분기">
+```ts
+{{ $thread.length > 5 }}
+```
+</Example>
+
+<Example title="전체 thread 텍스트를 후속 노드 입력으로 첨부">
+```ts
+{{ $thread.text }}
+```
+</Example>
+
+<Example title="첫 turn 의 form 데이터 필드 참조 (Presentation Form turn 일 때)">
+```ts
+{{ $thread.turns[0].data.email }}
+```
+</Example>
+
+<Callout type="note">
+`$thread.text` 는 호출할 때마다 전체 thread 를 렌더하므로 루프 내부에서 무분별하게 쓰면 비용이 커져요. 한 번만 가공해서 변수에 담아 두는 패턴을 권장해요.
+</Callout>
+
+<Callout type="tip">
+대부분의 경우 AI Agent 노드의 [Conversation Context 설정](/docs/02-nodes/ai#conversation-context)으로 자동 주입하는 편이 더 간단해요. 직접 `$thread` 를 참조하는 건 (1) AI Agent 가 아닌 노드(예: Transform/HTTP/Code)에서 thread 를 가공할 때, (2) 일부 turn만 골라 쓰고 싶을 때 유용해요.
+</Callout>
+
 ## 팁 & 참고
 
 - 자동완성은 마지막 실행 결과의 스키마를 기반으로 해요. 한 번도 실행하지 않은 워크플로우에서는 필드 제안이 제한되니 **먼저 한 번 실행**해 보는 걸 권장해요.

```

---

### 파일 9: plan/in-progress/user-guide-sync-2026-05-16.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/user-guide-sync-2026-05-16.md b/plan/in-progress/user-guide-sync-2026-05-16.md
new file mode 100644
index 00000000..d71519d2
--- /dev/null
+++ b/plan/in-progress/user-guide-sync-2026-05-16.md
@@ -0,0 +1,49 @@
+---
+worktree: user-guide-sync-4af69c
+started: 2026-05-16
+owner: developer
+---
+
+# User Guide ↔ 구현 정합성 보강 (2026-05-16)
+
+## 배경
+
+`frontend/src/content/docs/**` 사용자 매뉴얼이 일부 영역에서 실제 구현(backend/frontend)·spec 과 어긋남이 확인됨. 가이드를 단일 진실(spec/4-nodes, packages/expression-engine, backend/src/nodes)에 다시 맞춘다.
+
+## 작업 범위
+
+다음 4가지 보강만 본 plan 에서 처리한다. **도구 연결(tool connection) 영역은 손대지 않는다** — 그 부분은 `plan/in-progress/ai-agent-tool-connection-rewrite.md` 가 책임지므로 별도 작업으로 분리.
+
+- [x] **02-nodes/ai.mdx (+ .en.mdx)** — `conversationHistory` / `historyCount` 필드 표 행 제거, 실 구현 필드(`contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread`) 추가. `## Conversation Context` 섹션 신설.
+  - 소스: `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` L246–384, `spec/conventions/conversation-thread.md` §5, `spec/4-nodes/3-ai/0-common.md` §10.
+- [x] **02-nodes/integrations.mdx (+ .en.mdx)** — Cafe24 노드 섹션 추가. 풀 등록 흐름은 `/docs/06-integrations-and-config/cafe24` 로 deep-link.
+  - 소스: `backend/src/nodes/integration/cafe24/cafe24.schema.ts`, `spec/4-nodes/4-integration/4-cafe24.md`.
+- [x] **02-nodes/overview.mdx (+ .en.mdx)** — Integration 카테고리 한 줄 설명에 Cafe24 포함. 카테고리별 페이지 목록은 그대로.
+- [x] **04-expression-language/variables-and-context.mdx (+ .en.mdx)** — `$thread` 변수 행을 한눈에-보기 표에 추가 + `## $thread: Conversation Thread` 섹션 신설.
+  - 소스: `backend/src/modules/execution-engine/expression/expression-resolver.service.ts` L100–145, `spec/5-system/5-expression-language.md` §4.1 / §4.4.
+
+## 의도적 제외
+
+- **AI Agent 도구 연결 UX 갱신** (Tool Area 사용법, 신규 입력 경로) — `ai-agent-tool-connection-rewrite` plan 에서 별도 처리.
+- **영문 frontmatter** — `frontend/src/lib/docs/registry.ts` 의 `isLocaleSibling` 가 `.en.mdx` 를 navigation 등록에서 제외하므로 frontmatter 필수 대상 아님. 위반 아님으로 결론.
+- **cafe24 페이지 IA 등록** — `spec/2-navigation/13-user-guide.md` §2 IA 가 cafe24 항목을 빠뜨림. 이는 spec 갱신 사항이므로 `project-planner` 위임 (아래 spec-update 노트 참고).
+
+## 후속(spec 갱신 위임)
+
+다음 항목은 `developer` 권한 밖이므로 `project-planner` 위임. 본 worktree 의 consistency-check 세션 `review/consistency/2026/05/16/08_22_34/SUMMARY.md` 참고.
+
+- `spec/2-navigation/13-user-guide.md` §2 IA 의 `06-integrations-and-config/` 트리에 `cafe24` 항목 추가
+- `spec/4-nodes/4-integration/4-cafe24.md` §2/§5.1 의 `{{ $now.iso }}` → `{{ $now }}` 정정 (W1)
+- `spec/4-nodes/4-integration/4-cafe24.md` §9.4/§9.8 에 `install_token mismatch 회복 분기` 보강 (W3)
+- `spec/4-nodes/4-integration/4-cafe24.md` §5 섹션 번호 불연속 정리 (W4)
+- `spec/5-system/5-expression-language.md` §4.1 에 `$schedule` 변수 추가 (W2)
+- `spec/5-system/5-expression-language.md` 함수 목록에 `today()` 함수 명시
+- I3, I7, I8, I9, I10 등 정합·구조 항목 (SUMMARY.md 참고)
+
+## 체크리스트
+
+- [x] consistency-check --impl-prep
+- [x] DOCUMENTATION (본 plan = 곧 결과물 자체)
+- [x] 테스트 — `registry.ts` 단위 테스트에서 모든 .mdx frontmatter 의 `spec`/`code` 경로 실존을 검증함 (변경 결과로 새 spec/code 경로 추가 시 통과 여부 확인)
+- [x] TEST WORKFLOW (lint, unit, build)
+- [x] REVIEW WORKFLOW

```

---

### 파일 10: review/consistency/2026/05/16/08_22_34/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/SUMMARY.md b/review/consistency/2026/05/16/08_22_34/SUMMARY.md
new file mode 100644
index 00000000..f0da4f45
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/SUMMARY.md
@@ -0,0 +1,54 @@
+BLOCK: NO
+
+# Consistency Check 통합 보고서
+
+검토 세션: `review/consistency/2026/05/16/08_22_34`
+검토 모드: 구현 착수 전 검토 (`--impl-prep`)
+대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`
+
+호출자: developer (user-guide-sync-4af69c worktree)
+
+---
+
+## 결론
+
+**Critical 없음. 구현 착수 가능.** 발견된 4건의 Warning 및 13건의 Info 는 본 user-guide-sync 작업이 직접 영향을 받지 않는 spec 본문 측 항목으로, `project-planner` 후속 위임 대상.
+
+본 plan(`plan/in-progress/user-guide-sync-2026-05-16.md`)이 보강하려는 4개 MDX 변경(AI Agent contextScope 필드, integrations.mdx Cafe24 섹션, overview.mdx 카테고리 한 줄, variables-and-context.mdx `$thread` 행)은 W/I 어느 항목과도 직접 충돌하지 않는다.
+
+---
+
+## 본 작업과의 관련성
+
+| 항목 | 본 MDX 작업 충돌? | 비고 |
+|---|---|---|
+| W1 `{{ $now.iso }}` (cafe24 spec 예시) | 무관 | MDX 의 예시에서 `$now.iso` 표현식을 신규로 추가하지 않는다 — `$now` 만 사용 |
+| W2 `$schedule` 변수 누락 | 무관 | 본 작업은 `$thread` 변수만 추가, `$schedule` 는 spec 갱신 사항 |
+| W3 cafe24 install_token 회복 분기 | 무관 | cafe24 통합은 06-... 페이지 deep-link 만 추가, 회복 로직 본문 미기재 |
+| W4 cafe24 §5 섹션 번호 불연속 | 무관 | 사용자 가이드는 spec 의 섹션 번호를 그대로 노출하지 않음 |
+| I3 `contextScope` 표 중복(0-common §10 ↔ conversation-thread §5) | 정보성 | 본 MDX 는 `conversation-thread §5` 를 1차 소스로 frontmatter 의 `spec` 에 명시 |
+| I11 plan stale 위험 | 처리됨 | 본 plan 의 "후속(spec 갱신 위임)" 섹션에 cafe24 install_token spec 후속 영향 노트 |
+
+---
+
+## 후속(spec 갱신 위임)
+
+본 SUMMARY 의 W1~W4·I1~I13 중 spec 본문 수정이 필요한 항목은 `developer` 권한 밖이므로 다음과 같이 위임:
+
+- W1, W3, W4 → `spec/4-nodes/4-integration/4-cafe24.md` 본문 수정. `project-planner` 호출.
+- W2 → `spec/5-system/5-expression-language.md` §4.1 에 `$schedule` 추가. `project-planner` 호출.
+- I3, I7, I8, I9, I10 → spec 정합·구조 정리. `project-planner` 호출.
+
+이 노트는 본 plan 의 "후속(spec 갱신 위임)" 섹션에 추가로 반영.
+
+---
+
+## Checker 산출물
+
+- `cross_spec/review.md` — 5 issues, MEDIUM
+- `rationale_continuity/review.md` — 4 issues, LOW
+- `convention_compliance/review.md` — 6 issues, LOW
+- `plan_coherence/review.md` — 3 issues, LOW
+- `naming_collision/review.md` — 2 issues, NONE
+
+총 17건 (Critical 0 / Warning 4 / Info 13).

```

---

### 파일 11: review/consistency/2026/05/16/08_22_34/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/_prompts/convention_compliance.md b/review/consistency/2026/05/16/08_22_34/_prompts/convention_compliance.md
new file mode 100644
index 00000000..28157bb8
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/_prompts/convention_compliance.md
@@ -0,0 +1,635 @@
+# 정식 규약 준수 Check Payload
+
+본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (정식 규약 준수)
+
+1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
+2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
+3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
+4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
+5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가
+
+## 검토 모드
+구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md)
+
+## Target 문서
+경로: `spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md`
+
+```
+### 구현 대상 영역: `spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md`
+(없음)
+
+```
+
+## 정식 규약 모음 (spec/conventions/)
+
+### spec/conventions 정식 규약
+
+#### `spec/conventions/cafe24-api-metadata.md`
+```
+# CONVENTION: Cafe24 API Metadata
+
+> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)
+
+본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 형식을 정의한다. backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpBridge` 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가로 끝나야 한다.
+
+---
+
+## 1. 디렉토리 구조
+
+```
+backend/src/nodes/integration/cafe24/metadata/
+  index.ts             # 18 resource 의 종합 export
+  store.ts             # Store (상점)
+  product.ts           # Product (상품)
+  order.ts             # Order (주문)
+  customer.ts          # Customer (회원)
+  community.ts         # Community (게시판)
+  design.ts
+  promotion.ts
+  application.ts       # ⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의
+  category.ts
+  collection.ts
+  supply.ts
+  shipping.ts
+  salesreport.ts
+  personal.ts
+  privacy.ts
+  mileage.ts
+  notification.ts
+  translation.ts
+```
+
+각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다.
+
+## 2. Operation 메타데이터 형식
+
+```ts
+interface Cafe24OperationMetadata {
+  // 식별
+  id: string;                    // 예: 'product_list'. resource 안에서 unique
+  label: string;                 // UI 드롭다운 라벨 (한국어) 예: '상품 목록 조회'
+  description: string;           // MCP tool description (영문 권장) 또는 다국어 키
+  scopeType: 'read' | 'write';   // scope 매핑 — mall.read_<resource> / mall.write_<resource>. Node.category 와의 명명 충돌 회피 위해 'category' 가 아닌 'scopeType' 사용
+
+  // HTTP 매핑
+  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
+  path: string;                  // path template. 예: 'products/{product_no}'
+
+  // 입력 스키마
+  requiredFields: string[];
+  fields: {
+    [fieldName: string]: {
+      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
+      location: 'path' | 'query' | 'body';
+      enum?: string[];
+      description?: string;
+      default?: unknown;
+    };
+  };
+
+  responseShape?: 'list' | 'single' | 'empty';
+  paginated?: boolean;
+}
+```
+
+## 3. 예시 — `product` Resource 일부
+
+```ts
+export const productOperations: Cafe24OperationMetadata[] = [
+  {
+    id: 'product_list',
+    label: '상품 목록 조회',
+    description: 'List products in the mall. Supports filtering by category, display status, date range.',
+    scopeType: 'read',
+    method: 'GET',
+    path: 'products',
+    requiredFields: ['shop_no'],
+    fields: {
+      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
+      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
+      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
+      since:       { type: 'string',  location: 'query',  description: 'ISO8601 date — created_after' },
+    },
+    responseShape: 'list',
+    paginated: true,
+  },
+  {
+    id: 'product_get',
+    label: '상품 단건 조회',
+    description: 'Get a single product by product_no.',
+    scopeType: 'read',
+    method: 'GET',
+    path: 'products/{product_no}',
+    requiredFields: ['product_no'],
+    fields: {
+      product_no:  { type: 'number',  location: 'path' },
+      shop_no:     { type: 'number',  location: 'query' },
+    },
+    responseShape: 'single',
+  },
+  {
+    id: 'product_update',
+    label: '상품 수정',
+    description: 'Update a product (name, price, display, stock, etc).',
+    scopeType: 'write',
+    method: 'PUT',
+    path: 'products/{product_no}',
+    requiredFields: ['product_no'],
+    fields: {
+      product_no:    { type: 'number',  location: 'path' },
+      product_name:  { type: 'string',  location: 'body' },
+      price:         { type: 'string',  location: 'body', description: 'Decimal string (KRW)' },
+      display:       { type: 'enum',    location: 'body', enum: ['T', 'F'] },
+    },
+    responseShape: 'single',
+  },
+];
+```
+
+## 4. 신규 endpoint 추가 절차
+
+1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
+2. 해당 resource 의 metadata 파일에 §2 형식으로 row 1 추가.
+3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
+4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
+5. 백엔드 단위 테스트가 자동으로 검증:
+   - 모든 `id` 의 unique
+   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
+   - `requiredFields` 가 `fields` 의 키 부분집합인지
+6. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.
+
+## 5. MCP Bridge 와의 매핑
+
+> **레이어 경계**: 본 절의 `Cafe24McpBridge.callTool(name, args)` 와 `listTools()` 가 반환하는 도구 `name` 은 **bare operation id** (예: `product_list`) 다. MCP Client 레이어가 외부 노출 시점에 `mcp_<sid>__` prefix 를 자동 부여한다 ([Spec MCP Client §5.2](../5-system/11-mcp-client.md#52-도구-이름-규칙)). AI Agent config 의 `mcpServers[].enabledTools` 도 bare id 배열로 저장된다.
+
+`Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다:
+
+```ts
+function operationToMcpTool(op: Cafe24OperationMetadata): McpTool {
+  return {
+    name: op.id,                                 // bare id — 예: 'product_list'
+    description: `${op.description}\n\n(Cafe24 ${op.method} ${op.path})`,
+    inputSchema: {
+      type: 'object',
+      properties: Object.fromEntries(
+        Object.entries(op.fields).map(([k, f]) => [k, fieldToJsonSchema(f)])
+      ),
+      required: op.requiredFields,
+    },
+  };
+}
+```
+
+`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.
+
+## 6. allowlist 와의 관계
+
+> 용어: **UI grouping 단위 = "카테고리"** (사용자 친화 표기) — 백엔드 메타데이터 파일 구조의 "Resource" 와 동일 범위를 가리키며, 문맥에 따라 혼용한다. spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용. `Node.category` Enum 과는 별개 개념 (이름 충돌은 §2 의 `scopeType` 채택으로 이미 회피).
+
+AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출 (bare id 비교). UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의. `scopeType` 필드명 채택 (`Node.category` 와의 명명 충돌 회피) |
+
+```
+
+#### `spec/conventions/conversation-thread.md`
+```
+# Conversation Thread (대화 스레드)
+
+> 관련 문서: [Spec 실행 엔진 §6.1](../5-system/4-execution-engine.md#61-컨텍스트-구조) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec AI 공통 §11](../4-nodes/3-ai/0-common.md#11-conversation-context) · [CONVENTIONS Principle 4.5](./node-output.md#45-interactiondata-payload-규격) · [Spec 표현식 언어 §4.4](../5-system/5-expression-language.md#44-thread-속성)
+
+워크플로우 한 실행 동안 발생하는 사용자 인터랙션과 AI 대화 turn 을 시간순으로 누적하는 1급 컨텍스트. AI Agent 노드가 노드 설정 (`contextScope`) 으로 자동 주입받는다.
+
+---
+
+## 1. 자료구조
+
+### 1.1 ConversationTurnSource
+
+| 값 | 발생원 |
+|---|---|
+| `presentation_user` | Form / Carousel / Table / Chart / Template 의 `output.interaction.{type}` 가 `form_submitted` / `button_click` / `button_continue` 일 때 |
+| `ai_user` | AI Agent multi-turn 의 `output.interaction.type='message_received'` 시점 |
+| `ai_assistant` | AI Agent (single·multi) 의 final assistant 응답 |
+| `ai_tool` | KB / MCP / condition tool 결과 (opt-in 시 `includeToolTurns: true`) |
+| `system` | 명시적으로 push 한 system text (예약, v1 자동 누적 없음). **주의**: AssistantMessage `role: 'system'` 과 무관 — 워크플로우 레벨의 수동 push 전용 (예: 초기 시스템 안내 turn) |
+
+### 1.2 ConversationTurn
+
+| 필드 | 타입 | 설명 |
+|---|---|---|
+| `seq` | Number | 단조 증가. append 순서 == 시간 순서. thread 내 unique |
+| `nodeId` | UUID | turn 을 발생시킨 그래프 노드 |
+| `nodeLabel` | String | append 시점의 라벨 snapshot (라벨 변경 후에도 표시 일관성) |
+| `nodeType` | String | 예: `form`, `carousel`, `ai_agent` |
+| `timestamp` | String (ISO 8601) | 서버 시각 |
+| `source` | ConversationTurnSource | §1.1 |
+| `text` | String | system_text injection 과 UI 의 1차 텍스트. 빈 문자열 가능 (구조화 데이터만 있는 경우) |
+| `data?` | Object | 구조화 원본 — `output.interaction.data` snapshot |
+| `toolCalls?` | Array<{id,name,arguments}> | `source='ai_assistant'` 한정. provider 호환성을 위해 messages 모드에서 drop 가능 |
+| `toolCallId?` | String | `source='ai_tool'` 한정 |
+
+### 1.3 ConversationThread
+
+| 필드 | 타입 | 설명 |
+|---|---|---|
+| `id` | String | v1 고정값 `"default"` (multi-thread 는 v2). **port 예약어 `'default'` 와 무관** — namespace 분리. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장 |
+| `nextSeq` | Number | 다음 append 시 부여될 seq (== `turns.length`) |
+| `turns` | ConversationTurn[] | 시간순 누적 |
+| `totalChars` | Number | append 시 갱신되는 누적 char 길이 캐시 (cap 빠른 경로) |
+
+### 1.4 `text` 변환 규칙
+
+| `interaction.type` | text |
+|---|---|
+| `form_submitted` | `name=John, age=30` (key=value 리스트, 200자 cap, value 가 객체/배열이면 JSON 직렬화) |
+| `button_click` | `clicked: <buttonLabel>` (label 미존재 시 `<buttonId>`) |
+| `button_continue` | `continued: <url>` (url 미존재 시 `continued`) |
+| `message_received` (ai_user) | 메시지 본문 그대로 |
+| `ai_agent` final assistant | `output.result.response` 그대로 (CONVENTIONS Principle 8.2 LLM 응답 텍스트 경로) |
+| `text_classifier` final assistant (v2) | single-label: `output.result.category`. Multi-label: `output.result.categories.map(c => c.name).join(', ')` (categories 는 객체 배열이라 raw `.join` 불가). |
+| `information_extractor` final assistant (v2) | `output.result.extracted` 를 항상 `JSON.stringify` 직렬화 (`responseFormat` 필드는 `ai_agent` 전용 — extractor 는 항상 구조화 출력). |
+
+---
+
+## 2. 자동 누적 컨트랙트
+
+### 2.1 Presentation 노드
+
+`status: 'resumed'` 직전, `output.interaction` 빌드 후 엔진이 자동 push:
+- form `interaction.type='form_submitted'` → `source: 'presentation_user'`
+- carousel/table/chart/template `interaction.type='button_click' | 'button_continue'` → `source: 'presentation_user'`
+
+> 현재 실행 엔진의 presentation resume 코드는 `'submitted' / 'button_click' / 'button_continue'` 의 legacy status 값을 status 필드에 사용한다 (spec [실행 엔진 §1.3](../5-system/4-execution-engine.md#13-블로킹재개-컨트랙트-nodehandleroutput-status) 의 마이그레이션 노트 참조). 통일된 `'resumed'` 값으로의 마이그레이션은 별도 phase (presentation Principle 1.1 재작성) — 본 컨벤션은 status 값과 무관하게 `interaction.{type, data, receivedAt}` payload 가 emit 되는 시점에 push 가 발화함을 정의한다.
+
+### 2.2 AI Agent
+
+| 시점 | source |
+|---|---|
+| multi-turn user message 도착 (`output.interaction.type='message_received'`) | `ai_user` |
+| multi-turn 매 turn 종료 시 final assistant 응답 (`output.result.response`) | `ai_assistant` |
+| multi-turn condition route 시 assistant 응답 (`output.result.response`) | `ai_assistant` |
+| single-turn `userPrompt` (resolved) | `ai_user` (1회) |
+| single-turn 최종 `output.result.response` | `ai_assistant` (1회) |
+| tool-loop 중 assistant + tool result | `ai_assistant` / `ai_tool` (opt-in `includeToolTurns: true` 시에만) |
+
+### 2.3 v1 적용 범위 (push vs inject 구분)
+
+| 동작 | v1 적용 범위 | v2 로드맵 |
+|---|---|---|
+| **Turn push (누적)** | `ai_agent` 만 — multi-turn user/assistant + single-turn final assistant 자동 push | `text_classifier` / `information_extractor` 도 final assistant push 추가 (§1.4 의 v2 표기 행) |
+| **자동 주입 (inject — `contextScope` 활성화)** | `ai_agent` 만 | `text_classifier` / `information_extractor` 도 동일 인터페이스 |
+
+> push 와 inject 를 분리해 정의하는 이유: 다른 AI 노드의 final 응답도 후속 AI Agent 가 thread 로 받게 하려는 의도였으나, 분류·추출 노드 핸들러는 final-assistant 의미 있는 시점이 ai_agent 와 다르고 (text_classifier 는 카테고리, information_extractor 는 구조화 데이터), §1.4 의 변환 규칙도 노드별로 갈라진다. v1 출하 기준은 ai_agent 만이며 (handler 코드에 push hook 존재), 다른 두 노드의 push 는 §1.4 의 변환 규칙이 합의된 v2 에서 활성화.
+
+### 2.4 opt-out
+
+각 노드에 공통 boolean config: `excludeFromConversationThread` (default `false`). `true` 면 해당 노드의 모든 push 가 silent skip. UI 그룹은 `Advanced > Conversation`.
+
+---
+
+## 3. 스코프 규칙
+
+| 컨테이너 | 정책 |
+|---|---|
+| Sub-workflow (`executeInline`) | parent thread 상속·공유 |
+| Background | enqueue 시점 turns 배열까지 복사한 snapshot — 격리 |
+| Loop / ForEach / Map / Parallel | parent thread 상속·공유 |
+
+### 3.1 Sub-workflow 상속 근거
+
+`Workflow` 노드의 sync `executeInline` 경로는 부모 `ExecutionContext` 를 그대로 재사용한다 (`recursionDepth` 만 증가). 따라서 sub 안의 AI Agent 도 부모의 thread 를 본다. 사용자가 명시적으로 격리하고 싶으면 async mode 로 호출 (별도 Execution → 별도 thread).
+
+### 3.2 Background 격리 근거
+
+`scheduleBackgroundBody` 가 enqueue 시점에 thread 의 **turns 배열까지 함께 복사한 snapshot** 을 만든다 — 최소 `{ ...thread, turns: [...thread.turns] }` 형태. 단순 reference 복사가 아니라 새 array 인스턴스를 만들어, 백그라운드가 새 turn 을 push 해도 메인 thread 의 `turns` 가 변형되지 않음을 보장한다. ConversationTurn 객체 자체는 immutable (한 번 push 되면 수정되지 않음) 이라 깊은 복사까지 필요하지 않다.
+
+→ 메인 흐름이 이후 발생시킨 turn 은 background 가 못 보고, background 안에서 발생한 turn 은 메인 thread 에 영향 없음. PRD 3 §4.11 ND-BG-05 ("백그라운드 실패가 메인 흐름의 Execution 상태에 영향을 주지 않음") 격리 원칙과 정합.
+
+### 3.3 컨테이너 상속 근거
+
+Loop / ForEach / Map / Parallel 컨테이너는 별도 ExecutionContext 를 만들지 않고 같은 context.nodeOutputCache 를 공유한다. thread 도 같은 정책. iteration 메타 (index 등) 는 thread 에 자동 주입하지 않으며, 필요시 사용자가 `{{ $loop.index }}` 등으로 명시.
+
+---
+
+### 2.5 nextSeq 원자성
+
+`nextSeq` 의 단조 증가는 **단일 ExecutionContext 인스턴스 하에 직렬 실행** 보장에
+의존한다. v1 의 in-memory + single-instance 환경에서는 한 execution 의 노드
+처리가 한 번에 한 노드씩 진행되므로 (engine 의 `executeNode` 가 sequential)
+`appendInternal` 의 `seq = thread.nextSeq; thread.nextSeq = seq + 1` 가
+race-free.
+
+다음 시나리오에서는 별도 보장이 필요:
+- **Parallel 컨테이너**: 분기들이 같은 thread 에 동시 push 가능. v1 은 Parallel
+  내부 thread 사용을 정의하지 않음 (관련 spec follow-up). v2 에서 분기별 child
+  thread 또는 merge point 재통합 정책 결정.
+- **Multi-instance / Redis 분산**: thread 가 Redis 로 옮겨가면 `INCR` 같은
+  atomic operation 또는 lock 필요. v1 은 in-memory only.
+
+---
+
+## 4. 영속화
+
+| 단계 | 저장소 | 비고 |
+|---|---|---|
+| 실행 중 | `ExecutionContext` (실행 엔진 §6.2 정책에 따라 Redis 포함 직렬화) | `ExecutionContextService.createContext` 가 빈 thread (`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`) 로 초기화. TTL 은 실행 타임아웃 × 2 (execution-engine §6.2) |
+| 실행 후 | NodeExecution 분산 저장 | `output.interaction` (presentation, `interaction.type` ∈ form_submitted/button_click/button_continue), `output.messages` (AI 멀티턴 누적 — waiting/resumed 시), `output.result.response` (AI 최종 응답) 가 SoT. thread 자체는 재구성 가능한 derived view |
+| WS payload | `EXECUTION_WAITING_FOR_INPUT` 의 `conversationThread` snapshot 동봉 (선택) | UI 가 라이브 thread 표시 가능 |
+
+**v1 은 신규 DB 컬럼 도입 없음.** 향후 사용자 요구 명확해지면 `Execution.conversation_thread jsonb NULL` 컬럼 마이그레이션 검토.
+
+---
+
+## 5. AI Agent 자동 주입
+
+`spec/4-nodes/3-ai/1-ai-agent.md` §1 의 5 신규 필드:
+
+| 필드 | 타입 | 기본값 |
+|---|---|---|
+| `contextScope` | `none` / `thread` / `lastN` | `none` |
+| `contextScopeN` | Integer | `20` |
+| `contextInjectionMode` | `messages` / `system_text` | `messages` |
+| `includeToolTurns` | Boolean | `false` |
+| `excludeFromConversationThread` | Boolean | `false` |
+
+주입 위치는 `processMultiTurnMessageInner` 의 매 turn `llmService.chat` 직전 (single-turn 은 첫 chat 직전). messages 배열을 매 turn `[system, ...injectedThread, ...selfHistory]` 로 재빌드 — `injectedThread` 에서 자기 노드가 발생시킨 turn 은 `getThreadExcludingNode` 로 제외해 중복 방지.
+
+### 5.1 messages 모드 매핑
+
+| turn.source | role | content prefix |
+|---|---|---|
+| `presentation_user` | `user` | `[from <nodeLabel>] ` |
+| `ai_user` | `user` | (없음) |
+| `ai_assistant` | `assistant` | (없음, `toolCalls` 보존 또는 drop) |
+| `ai_tool` | `tool` | (없음, `toolCallId` 매칭) |
+| `system` | `system` | (없음) — **Anthropic API 비호환**: messages 배열 내 `role: 'system'` 미지원. provider 가 anthropic 이면 `system_text` 모드 또는 별도 분기로 우회 필수. v1 자동 push 없으므로 현재 실질 문제 없음 (수동 push 도입 시 provider 분기 검증 필수). |
+
+### 5.2 system_text 모드
+
+`thread-renderer` 가 헤더 `[#seq · timestamp · label (type) · source]` + text 본문으로 렌더해 `finalSystemPrompt` 끝에 첨부. KB guidance / condition suffix 보다 뒤.
+
+**Sanitization**: `turn.text` 가 사용자 입력 (form 제출, ai_user 메시지) 에서 유래한 경우 prompt injection 방어를 위해 `LlmService` 의 user content sanitizer 와 동일한 방식으로 sanitize 한다.
+
+### 5.3 Cap (v1 — char 기반)
+
+| 상수 | 값 | 동작 |
+|---|---|---|
+| `MAX_INJECTED_TURNS` | `100` | 초과 시 가장 오래된 turn 부터 drop, `[... N earlier turns omitted ...]` 마커 1줄 prepend |
+| `MAX_TURN_TEXT_CHARS` | `4000` | 초과 시 truncate (`...` 접미사) |
+| `MAX_INJECTED_CHARS` | `200_000` | 합산 char 추가 안전망 |
+
+`meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 디버그 echo. `appliedScope`/`appliedMode` 는 config 값의 echo 가 아니라 **실제 적용 결과** 를 표기 (예: `contextScope='thread'` 더라도 thread 가 비어있으면 `appliedScope='none'`, cap 으로 잘리면 `injectedTurns < turns.length`). Principle 2 (meta = 런타임 측정값) 정합.
+
+---
+
+## 6. Expression 통합
+
+`spec/5-system/5-expression-language.md` §4.4 의 `$thread` 변수:
+
+| 표현식 | 반환 |
+|---|---|
+| `$thread.turns` | ConversationTurn[] (readonly) |
+| `$thread.length` | Number |
+| `$thread.text` | String — system_text 렌더 결과 |
+
+자동 주입과 독립적으로 사용자가 명시 참조 가능 (예: 별도 `transform` 노드에서 thread 가공).
+
+---
+
+## 7. v2 로드맵
+
+- **Multi-thread**: 사용자 지정 key 로 한 execution 안에서 여러 thread 운영. presentation 노드가 어느 thread 에 push 할지 명시할 수 있게.
+- **Token-aware cap**: 현재 char-based cap (§5.3) 을 provider tokenizer 기반으로 — 모델별 정확한 토큰 budget 고려.
+- **`text_classifier` / `information_extractor` 자동 push + 주입**: §1.4 의 변환 규칙이 합의된 후 두 노드 핸들러에 push hook 추가, contextScope 적용 확장.
+- **DB 컬럼 신설**: `Execution.conversation_thread jsonb` 컬럼 마이그레이션 검토 — 현재는 NodeExecution 분산 저장이라 cross-node 조회가 N+1.
+- **실행 이력 화면의 ConversationThread 크로스노드 뷰**: EH-DETAIL-06 과 함께 v2 UI spec 정의.
+- **Parallel 컨테이너 + Thread 정책**: 현재 §2.5 가 "Parallel 내부 thread 사용을 정의하지 않음" 으로 명시. 분기별 child thread 또는 merge point 재통합 정책 결정 필요. 사용 케이스 정의 후 spec write.
+- **`$thread.text` lazy 평가**: 현재 `buildExpressionContext` 가 호출마다 전체 thread 를 system_text 로 즉시 렌더 (성능 hot path). 측정 결과 비용이 크면 `Object.defineProperty` lazy getter 또는 `$thread.text` 를 별도 key 로 분리해 명시 요청 시만 렌더.
+- **Service 모듈 위치 정리**: 현재 `backend/src/modules/execution-engine/conversation-thread/` 에 types/renderer/service 가 함께 있음. types/renderer 는 pure 라 향후 `src/shared/` 또는 별도 `@workflow/conversation-thread` 패키지로 분리해 nodes/ai → execution-engine 의 의존 그래프를 단순화 검토.
+- **Storage cap evict 정책**: §STORAGE_MAX_TURNS=500 은 LRU style FIFO drop. 향후 사용자 인터랙션 우선 보존 등 정책 옵션 검토.
+
+---
+
+## 8. Rationale
+
+설계 결정의 근거는 [Spec AI Agent §12](../4-nodes/3-ai/1-ai-agent.md#12-rationale) Rationale 섹션에 단일 인라인 — Conversation Thread 도입 동기, 선택지 비교, v1/v2 경계, 옛 `conversationHistory` 필드 제거 사유. 본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다.
+
+---
+
+## 9. CHANGELOG
+
+| 일자 | 변경 |
+|---|---|
+| 2026-05-14 | 신규 작성 — Conversation Thread 정식 도입 |
+| 2026-05-16 | AI Agent 의 옛 `conversationHistory` / `historyCount` schema·UI 메타 제거 (`contextScope` / `contextScopeN` 로 단일화) |
+
+```
+
+#### `spec/conventions/migrations.md`
+```
+# Flyway 마이그레이션 운영 규약
+
+## Overview
+
+본 규약은 PostgreSQL 스키마 마이그레이션을 다음 세 가지 안전성 기준으로 운영하기 위한 정식 규칙이다.
+
+1. **충돌 방지** — 여러 PR 이 병렬로 진행될 때 같은 V번호를 동시에 점유하는 사고를 사전에 차단한다.
+2. **순서 보장** — 마이그레이션 적용 순서를 작성 의도와 일치시켜, 의존성 (예: `V<N+1>` 이 `V<N>` 컬럼을 참조) 사고를 막는다.
+3. **운영 안전성** — 이미 운영에 적용된 마이그레이션을 수정해 Flyway checksum 불일치로 부팅이 실패하는 일을 막는다.
+
+본문 절차·도구는 모두 위 세 기준을 보장하기 위한 수단이다. 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension 의존성 등)는 [`backend/migrations/README.md`](../../backend/migrations/README.md) 가 담당하며, 본 문서는 **버전 번호 정책과 머지 race 안전망**에 집중한다.
+
+---
+
+## 1. 명명 규약
+
+```text
+backend/migrations/V<번호>__<snake_case_descriptor>.sql
+backend/migrations/V<번호>__<snake_case_descriptor>.conf  # 필요한 경우만 (executeInTransaction=false 등)
+```
+
+- 번호는 **단조 증가하는 정수**. `V001__initial_schema.sql` 부터 시작해 1씩 증가한다.
+- 설명자는 `snake_case`. 영문 소문자 + 숫자 + `_` 만 사용한다.
+- `.conf` 페어는 항상 `.sql` 과 동일한 base name (`V<NNN>__<descriptor>`) 을 사용한다. 예: `V033__embedding_hnsw_1024.sql` ↔ `V033__embedding_hnsw_1024.conf`.
+- ⚠️ **alphanumeric suffix 금지** — `V035a`, `V035_1` 처럼 정수가 아닌 접미사를 붙이면 Flyway 의 기본 version 파서가 매치에 실패해 schema_history 에 미등록된 채 silent skip 된다. 이 조건은 `backend/src/migrations.spec.ts` 가 빌드/CI 마다 자동 검증한다.
+
+## 2. V번호 정책
+
+- **단조 증가**: 신규 V번호는 항상 현재 main 의 max(V) **+1** 이다.
+- **gap 금지**: 작업 도중 V번호를 건너뛰지 않는다. 두 개를 추가하면 `+1`, `+2` 가 되어야 한다.
+- **재사용 금지**: 한번 main 에 들어간 V번호는 다른 마이그레이션으로 재할당하지 않는다.
+
+작성 시 절차는 [§5 새 마이그레이션 추가 절차](#5-새-마이그레이션-추가-절차) 를 따른다.
+
+## 3. Append-only 원칙
+
+이미 main 에 들어간 V<N> 의 `.sql` / `.conf` 는 **절대 수정하지 않는다**.
+
+- Flyway 는 부팅 시 각 적용된 마이그레이션의 SQL 내용 checksum 을 `flyway_schema_history` 와 비교한다. 파일이 한 글자라도 바뀌면 `Migration checksum mismatch for migration version NNN` 으로 부팅이 실패한다.
+- 컬럼/인덱스/제약 추가·변경·삭제가 필요하면 **새 V<N+k>** 로 `ALTER`·`DROP`·`CREATE` 를 작성한다.
+- 운영 사고로 어쩔 수 없이 checksum 을 재정렬해야 한다면 `migrate-repair` 서비스를 사용한다 (절차는 [`backend/migrations/README.md`](../../backend/migrations/README.md) §4 참고).
+
+## 4. `outOfOrder=false` 유지
+
+Flyway 의 `outOfOrder=true` 옵션은 옛 V번호가 늦게 들어와도 실행을 허용한다. 본 repo 는 이 옵션을 **명시적으로 사용하지 않는다** (Flyway 기본값 `false` 유지).
+
+이유:
+- `outOfOrder=true` 환경에서 두 PR 이 동시에 V<N+1> 을 만들고 한쪽이 V<N+2> 로 양보한 뒤 늦게 머지되면, **의도된 의존성 순서와 실제 적용 순서가 어긋난다**.
+- 본 규약은 PR CI 단계에서 V번호 충돌을 잡아내므로 (`§5`), `outOfOrder` 를 켤 필요가 없다.
+
+## 5. 새 마이그레이션 추가 절차
+
+1. `git fetch origin main && git rebase origin/main` — base 를 최신화한다.
+2. `ls backend/migrations | tail -2` 로 현재 max V 를 확인한다.
+3. `V<max+1>__<descriptor>.sql` 을 작성한다. 필요하면 동일 base name 의 `.conf` 를 함께 둔다 ([`backend/migrations/README.md`](../../backend/migrations/README.md) §4·§5 참고).
+4. 로컬에서 `python3 scripts/check-migration-versions.py --base origin/main` 으로 V번호 가드를 통과시킨다.
+5. `make e2e-test` 로 dry-run — e2e 컨테이너의 Flyway 가 실제 마이그레이션을 적용해 본다.
+6. PR 을 연다. CI 의 `migration-check` 가 동일한 검사를 다시 돌린다.
+
+> PR open 후에는 가능한 빠르게 리뷰·머지하여 다른 PR 과의 V번호 점유 윈도우를 짧게 유지한다.
+
+## 6. 충돌 검출 / 머지 race
+
+본 repo 는 두 단계 안전망으로 V번호 충돌과 merge race 를 모두 차단한다.
+
+### 6.1 PR CI 가드 (`scripts/check-migration-versions.py`)
+
+`pull_request` 이벤트마다 [`/.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml) 이 실행되어 다음을 검사한다.
+
+| 검사 | 위반 예시 | 메시지 |
+| --- | --- | --- |
+| 중복 | 같은 V<N>__*.sql 두 개 | `FAIL: V041 is duplicated` |
+| 단조성 | 신규 V<N> 가 main_max 이하 | `FAIL: V040 is not greater than base (origin/main) max V040` |
+| 연속성 | gap 발생 (예: V041 없이 V042) | `FAIL: V042 leaves a gap (expected V041 after base max V040)` |
+| `.conf` 페어 | `.conf` 의 base name 이 `.sql` 과 다름 | `FAIL: V041 .conf base name does not match its .sql` |
+
+위반 시 workflow exit 1 로 PR 머지가 막힌다. 작성자가 rebase 해 V번호를 재할당하면 즉시 재검증된다.
+
+로컬에서 동일 검사를 돌리려면:
+
+```bash
+python3 scripts/check-migration-versions.py --base origin/main
+```
+
+### 6.2 머지 직전 rebase 규약 (운영 규약)
+
+PR CI 가 통과한 직후 다른 PR 이 먼저 머지되어 main 의 max(V) 가 추월되는 **merge race** 가 발생할 수 있다. 본 repo 는 GitHub 무료 플랜의 private 저장소여서 branch protection 의 "Require branches to be up to date before merging" 옵션을 사용할 수 없으므로 (자세한 사유는 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date)), race 차단을 다음 운영 규약으로 대체한다.
+
+**머지 직전 확인 (작성자 책임)**
+
+1. `git fetch origin main && git rebase origin/main` 으로 base 를 최신화한다.
+2. push 후 `migration-check` 가 PR 의 latest commit 기준 green 인지 확인한다.
+3. 본 PR 에 `migration-recheck-on-main` 알림 코멘트가 게시되어 있다면, 무조건 위 1·2 단계를 다시 수행한다.
+
+이 규약은 [`/.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) 의 Migration checklist 와 짝을 이룬다 — 작성자는 체크박스를 통해 self-confirmation 한다.
+
+### 6.3 사후 안전망 — `migration-recheck-on-main`
+
+`backend/migrations/**` 가 main 에 push 될 때 (= migration PR 이 머지된 직후) [`/.github/workflows/migration-recheck-on-main.yml`](../../.github/workflows/migration-recheck-on-main.yml) 이 두 가지를 자동 수행한다.
+
+- **Post-merge sanity** — `python3 scripts/check-migration-versions.py --base HEAD~1` 를 main 에서 실행. dup / gap / 단조성 / `.conf` 페어 위반이 main 에 실제로 도달했으면 워크플로가 fail 하여 Actions 탭에 빨간불이 켜진다 (Slack/Email 알림이 연동되어 있으면 자동 통지).
+- **Auto-nudge** — 열린 PR 중 `backend/migrations/**` 파일이 변경 목록에 포함된 PR 들에 "rebase + CI 재실행 필요" 코멘트를 자동 게시. PR 작성자가 race 가능성을 즉시 인지하고 §6.2 규약을 수행하도록 nudge.
+
+두 작업 모두 머지 자체를 막진 못한다 — 무료 private 환경에서 가능한 최대 강도는 "즉시 가시화 + nudge" 다. 향후 유료 플랜으로 전환 시 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date) 의 branch protection 을 §6.2 로 승격하고 본 절은 backup 으로 유지할 수 있다.
+
+## 7. 폐기 대안 (Rationale)
+
+### 대안 1: 타임스탬프 prefix (`V<YYYYMMDDHHMMSS>__...`)
+
+장점은 unique 보장이 자연스럽다는 점이지만, 다음 단점으로 폐기.
+
+- 타임스탬프 순서가 **실제 의도된 실행 순서와 어긋날 수 있다** — 작성자 시계 차이 / merge 순서 / cherry-pick 으로 인해 의존성 깨짐이 발생한다.
+- Flyway 의 단조 정수 모델과 자연스럽게 맞물리지 않아 `outOfOrder` 위험을 흡수하게 된다.
+- 한 PR 의 마이그레이션을 다른 PR 의 마이그레이션 사이에 끼워 넣을 동기가 발생해 (시계 후순위) append-only 원칙이 흔들린다.
+
+### 대안 2: `flyway.outOfOrder=true`
+
+옛 V번호가 늦게 들어와도 실행한다. PR 충돌 부담은 줄지만:
+
+- **의존성 사고 위험** — V<N+1> 이 V<N> 컬럼을 참조하는 코드를 작성해 두었는데, 운영 환경에는 V<N> 이 더 늦게 들어가는 케이스가 가능해진다.
+- 환경별 적용 이력이 비결정적이 되어 디버깅·재현이 어려워진다.
+
+본 규약은 `outOfOrder=false` 를 유지하고 PR CI 가드로 충돌을 사전 차단한다.
+
+### 대안 3: GitHub Merge Queue
+
+자동화 강도는 가장 높지만:
+
+- GitHub plan 의존성 + 셋업 비용이 작지 않다 (private 저장소의 merge queue 는 유료 플랜 한정).
+- 본 repo 규모에서는 §6.2/§6.3 의 규약 + 사후 안전망만으로도 race 빈도 대비 비용 대비 효율이 더 낫다.
+- 향후 PR 동시성이 늘어 race 가 빈번해지면 재검토 후보로 둔다.
+
+### 대안 4: GitHub branch protection — "Require branches to be up to date"
+
+race 차단의 **정공법**이지만 본 repo 는 GitHub 무료 플랜의 private 저장소여서 다음 제약이 있다.
+
+- Settings → Branches → Branch protection rules 의 일부 옵션 (특히 required status checks / "up to date" 강제) 이 무료 private 에서 비활성화되어 있다.
+- `gh api -X PUT repos/<owner>/<repo>/branches/main/protection` CLI 역시 동일한 플랜 제약으로 실패한다.
+
+따라서 현재는 §6.2 (작성자 책임 규약) + §6.3 (`migration-recheck-on-main`) 으로 대체한다. 향후 유료 플랜으로 전환하면 다음 순서로 승격을 검토한다.
+
+1. Settings → Branches → main → "Require branches to be up to date before merging" 활성화.
+2. `migration-check / guard` 를 required status check 로 등록.
+3. §6.2 의 작성자 책임 규약을 자동화 차단으로 흡수.
+4. §6.3 의 `migration-recheck-on-main` 은 backup 으로 유지 — race 가 사후에라도 main 에 도달했을 때 가시화하는 역할은 branch protection 이 대체하지 못한다.
+
+---
+
+## 참고
+
+- 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension, `.conf` 사용법, repair 절차): [`backend/migrations/README.md`](../../backend/migrations/README.md)
+- 시스템 아키텍처 §2.8 (Flyway 운영): [`spec/0-overview.md`](../0-overview.md)
+- 가드 스크립트: [`scripts/check-migration-versions.py`](../../scripts/check-migration-versions.py)
+- CI workflow: [`.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml)
+
+```
+
+#### `spec/conventions/node-output.md`
+```
+# Output 변수 일관성 규칙 (Conventions)
+
+모든 노드 개선 문서가 참조하는 **공통 규칙집**입니다. 각 노드 개선 문서는 이 Principle들 중 위반 사항을 식별하고 그에 대한 구체적인 수정안을 제시합니다.
+
+> **설계 목표**: "워크플로우 작성자가 `$node["노드 이름"].output.*` 로 값을 꺼낼 때, **노드 종류를 몰라도 어디에 무엇이 있을지 예측 가능**하도록 한다."
+
+---
+
+## Principle 0 — `NodeHandlerOutput`의 5필드는 불변
+
+모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 반환합니다.
+- `config`: 해석된 설정값 (자격증명 제거)
+- `output`: 후속 노드에 전달되는 **주 데이터**
+- `meta`: **실행 메타데이터** (duration, statusCode, tokens, logs)
+- `port`: 라우팅 포트 지시 (string | string[])
+- `status`: 흐름 제어 상태 (`waiting_for_input`, `resumed`, `ended` 등)
+
+이 5필드의 의미는 **어떤 노드에서든 동일**해야 합니다.
+
+---
+
+## Principle 1 — `output` 은 "비즈니스 결과물"만 담는다
+
+`output` 아래에는 후속 노드가 로직에 사용할 **도메인 데이터**만 둡니다.
+
+| ✅ `output`에 두는 것 | ❌ `output`에 두지 않는 것 |
+| --- | --- |
+| 응답 본문 / 분류 결과 / 추출된 필드 | 토큰 수 / duration / HTTP status code |
+| 렌더링된 프레젠테이션 뷰 | LLM model 이름 / 디버그 로그 |
+| 사용자 입력 / 버튼 클릭 인터랙션 | 실행 횟수 / retry count |
+
+→ 실행 메트릭은 **Principle 2** 에 따라 `meta`에 둡니다.
+
+---
+
+
+... (truncated due to size limit) ...

```

---

### 파일 12: review/consistency/2026/05/16/08_22_34/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 13: review/consistency/2026/05/16/08_22_34/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 14: review/consistency/2026/05/16/08_22_34/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/_prompts/plan_coherence.md b/review/consistency/2026/05/16/08_22_34/_prompts/plan_coherence.md
new file mode 100644
index 00000000..f3b35562
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/_prompts/plan_coherence.md
@@ -0,0 +1,841 @@
+# Plan 정합성 Check Payload
+
+본 파일은 orchestrator 가 Plan 정합성 checker 용으로 작성한 입력입니다. `plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (Plan 정합성)
+
+1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
+2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
+3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
+4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
+5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)
+
+## 검토 모드
+구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md)
+
+## Target 문서
+경로: `spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md`
+
+```
+### 구현 대상 영역: `spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md`
+(없음)
+
+```
+
+## 진행 중 plan 문서 모음 (plan/in-progress/)
+
+### plan/in-progress 진행 중 문서
+
+#### `plan/in-progress/0-unimplemented-overview.md`
+```
+# 미구현 항목 오버뷰 (PRD/Spec 기준)
+
+> 작성일: 2026-05-11
+> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
+> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것
+
+본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.
+
+---
+
+## 작업 흐름 권장 순서
+
+다음 순서로 plan을 소화하면 의존성 충돌이 적다.
+
+1. **`

... (truncated due to prompt size limit) ...

---

### 파일 15: review/consistency/2026/05/16/08_22_34/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/_prompts/rationale_continuity.md b/review/consistency/2026/05/16/08_22_34/_prompts/rationale_continuity.md
new file mode 100644
index 00000000..2eff8a3d
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/_prompts/rationale_continuity.md
@@ -0,0 +1,588 @@
+# Rationale 연속성 Check Payload
+
+본 파일은 orchestrator 가 Rationale 연속성 checker 용으로 작성한 입력입니다. target 문서가 기존 spec 의 `## Rationale` 에서 이미 기각·폐기된 결정을 다시 도입하거나 합의 원칙을 무시하지 않는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (Rationale 연속성)
+
+1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
+2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙을 따르지 않고 있는가
+3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가
+4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 들어와 있는가
+
+## 검토 모드
+구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md)
+
+## Target 문서
+경로: `spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md`
+
+```
+### 구현 대상 영역: `spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md`
+(없음)
+
+```
+
+## 관련 Rationale 발췌
+
+### Rationale 발췌
+
+#### `spec/1-data-model.md` 의 Rationale
+
+## Rationale
+
+### Execution.execution_path → ExecutionNodeLog (V035 → V036)
+
+옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.
+
+이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.
+
+- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
+- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.
+
+설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.
+
+### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)
+
+옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).
+
+#### `spec/2-navigation/1-workflow-list.md` 의 Rationale
+
+## Rationale
+
+### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체
+
+NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:
+
+- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
+- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)
+
+(a) 를 채택한 이유:
+
+- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
+- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
+- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.
+
+결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.
+
+#### `spec/2-navigation/10-auth-flow.md` 의 Rationale
+
+## Rationale
+
+### R-1. 인증 화면 배경 — 그라데이션 복원 (2026-05-15 롤백)
+
+§1 배경 기술을 *"제품 브랜드 색상 또는 그래디언트"* (main 표현) 로 **복원**. 이전 Stage 1 (commit `b6267429`) 에서 *"`soil-50` 단색, 그라데이션 금지"* 로 구체화했으나, 동일자 §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 `soil-50` 토큰이 §8.2 와 함께 폐기되어 본 표현도 함께 복원했다.
+
+코드 상태: `frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `#111e14` 라운드 컨테이너 안에 별도 배치 (그라데이션 위 dark surface 로 시인성 확보).
+
+### R-2. `[Logo]` 자리 변종 명시 (2026-05-15 정정)
+
+§1 의 `[Logo]` 플레이스홀더에 *"Full logo 변종 사용"* 명시. 이전 Stage 1 에서는 *"Full logo (light)"* 로 라이트 한정했으나, §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 라이트/다크 자산 선택을 노출 자리의 surface 톤에 위임하는 형태로 바뀌어 본 행에서도 라이트 한정을 제거.
+
+본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종·라이트/다크 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (R-9 — 브랜드 spec 의 라우트 spec 우선권).
+
+근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`, `R-13`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/` (Stage 1), `review/consistency/2026/05/15/23_45_11/` (롤백).
+
+#### `spec/2-navigation/4-integration.md` 의 Rationale
+
+## Rationale
+
+### Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나 (2026-05-14)
+
+`pending_install` 상태의 Integration 이 callback 처리 중 token exchange 실패 등으로 떨어졌을 때, 자연스러운 선택지는 `error(auth_failed)` 로 전이하는 것이다. 그러나 Private 앱은 `reauthorize` 액션이 불가능하다 — OAuth 재시작은 **Cafe24 Developers 의 "테스트 실행"** 만 정식 진입점이고, 그 진입점은 우리가 발급한 `install_token` 을 path 에 그대로 사용한다. status 를 `error` 로 바꾸면 (a) UI 가 "reauthorize" 액션을 권장하지만 실제로 그 액션이 무력하고, (b) 사용자는 cafe24 측 설정을 고친 뒤 다시 "테스트 실행" 을 누르는 외부 흐름을 진행 중인데 우리 화면이 이를 "error" 로 표기해 흐름 단계를 오인하게 된다. 따라서 callback 실패는 `status_reason` + `last_error` 만 채우고 status 는 `pending_install` 그대로 유지한다. (참고: `review/consistency/2026/05/14/18_23_55`)
+
+`status_reason` 의 저장값은 callback 에러 코드를 `snake_case` 로 표기한다 — DB 컬럼 컨벤션 전체가 `auth_failed`, `token_expired` 등 `snake_case` 인 것과 통일. 한편 API 응답·callback HTML 의 에러 코드는 `OAUTH_*`, `CAFE24_*` 같은 `UPPER_SNAKE_CASE` 를 유지한다 (HTTP 컨벤션). 동일 의미 두 표기는 §10.4 에서 매핑.
+
+`last_error.code` 와 `status_reason` 이 같은 값을 중복 보존하는 이유: `last_error` 는 JSONB 라 보존 정책(향후 GDPR 등)에 따라 소거될 수 있다. `status_reason` 은 plain string 컬럼으로 더 가볍게 유지되며, "왜 이 상태에 있는지" 의 핵심 신호로 보존된다. `status_reason` 은 에러 분류 코드만 담아 민감 정보 미포함 → 평문 저장.
+
+### OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)
+
+Cafe24 Private 의 "테스트 실행" 흐름은 `pending_install` 행이 이미 존재하는 상태에서 OAuthState 를 새로 발급해 token 교환을 완료한다 — 의미상 "기존 행에 token 을 채운다" 라는 점에서 `mode='reauthorize'` 와 동일 (`mode='new'` 는 OAuthState 에 integrationId 가 없고 callback 이 previewToken 을 발급하는 다른 흐름). 별도 `mode='cafe24_private_install'` 을 신설하는 안도 검토했으나, callback 의 처리 분기가 동일 (integration row UPDATE) 이고 §10.2 step 4 가 이미 reauthorize 를 "기존 integrationId 의 credentials 갱신" 으로 정의하고 있어 enum 확장으로 얻는 이득이 없다. status 가 `pending_install` 이냐 `connected` 이냐에 따라 callback 의 후처리만 살짝 다를 뿐 (`installToken=null` 처리 등). 단, 향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토.
+
+### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)
+
+**현행 (V045+)**: `mall_id` 가 plain 컬럼 (`integration.mall_id`) 으로 분리되어 — `credentials.mall_id` (encrypted JSONB) 와 동일 값을 plain 컬럼으로 복제 — SQL WHERE 절로 직접 필터링·UNIQUE 제약 강제가 가능. 부분 UNIQUE 인덱스 `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 workspace 내 중복 cafe24 통합 생성을 SQL constraint violation 으로 거부 (TOCTOU race 차단). begin 핸들러는 in-memory 사전 체크 (connected → 409 / pending → reuse 분기 판단) 와 함께 SQL UNIQUE 를 backstop 으로 사용 — 두 검사를 모두 통과한 동시 INSERT 는 `23505 unique_violation` 으로 변환되어 같은 409 응답을 받는다.
+
+**옛 (V045 이전, 2026-05-14)**: `mall_id` 가 암호화 JSONB 안에만 있어 SQL 필터 불가. begin 시점에 (a) 동일 workspace 의 cafe24 통합을 SQL 로 조회한 뒤 (b) ORM 경계의 자동 복호화로 `credentials.mall_id` 와 in-memory 비교. (a) O(N) decrypt 비용 + (b) SELECT 와 INSERT 사이의 TOCTOU 윈도우 두 가지 운영 위험.
+
+**전환기**: V045 이전 행은 `mall_id` 컬럼이 NULL — 부분 UNIQUE 가 그런 행을 비교 대상에서 제외하므로 새 행과 충돌하지 않는다. 옛 행은 callback / re-auth 시점에 plain 컬럼이 backfill 되어 점진적으로 인덱스 범위로 편입된다. begin 시점의 in-memory 비교도 동일 전환기 동안 `credentials.mall_id` fallback 을 둔다.
+
+### install_token 을 App URL path 식별 키로 승격 (2026-05-14)
+
+원래 설계는 `GET /oauth/install/cafe24` 가 mall_id + HMAC 만 받고, 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial 했다. 두 가지 운영 위험이 누적됐다 — (a) 동일 mall_id 의 중복 `pending_install` 이 누적되면 HMAC 매칭이 비결정적이고 사용자가 보고 있는 행이 아닌 다른 행이 connected 처리될 수 있다, (b) `pending_install` 수가 커지면 O(N) 매칭 비용. App URL path 에 `install_token` 을 박으면 단일 row 조회로 고정되고, 토큰 자체가 random 이므로 추측 불가능한 식별자 역할도 겸한다. 옛 토큰 없는 경로는 별도 PR 로 즉시 제거됐다 (운영 등록자 0 인 시점에 정리 — 이후 등록자는 새 token-pathed URL 만 발급받는다).
+
+(2026-05-15 후속: 토큰을 16바이트 base64url 22자로 단축 — 보안 동등성은 본 섹션 "Cafe24 App URL 100자 한도 대응" 항 참조)
+
+`install_token` 은 App URL path 에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 암호화 정책 대상 아님.
+
+### CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 (2026-05-14)
+
+옛 `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함)` 합산 정책은 토큰이 path 에 없던 시절 "어느 mall_id 에 pending 이 있는지" 정보가 응답 코드로 새지 않게 하는 안전망이었다. 새 디자인에서 `install_token` 은 **128-bit 이상 random** (현행 16바이트 base64url, 2026-05-15 단축 이전엔 32바이트 hex 256-bit) 이라 추측 불가능 — URL path 자체가 capability token 처럼 동작한다. 이 전제 하에서 "토큰 미존재" 케이스를 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리해도 무의미한 enumeration 이 일어나지 않는다. **이 전제가 깨지면** (예: **96-bit (12바이트) 미만으로의 토큰 길이 단축**, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다.
+
+### install_token TTL 24h (2026-05-14)
+
+**기존 spec §6 는 install timeout 시 `→ (삭제)` 를 명시했으나 본 개정에서 `→ expired (status_reason='install_timeout')` 로 번복한다.** 이유: 데이터 분석·감사 목적으로 보존이 유리하고, 사용자가 만료된 행을 보고 "왜 install 이 안 됐는지" 를 진단할 단서가 남아야 함. 자동 삭제는 더 이상 일어나지 않으며, manual delete 만 삭제 경로다.
+
+Cafe24 Developers 의 앱 등록 → "테스트 실행" 까지의 사용자 작업 텀을 최대 1일로 가정한다. 더 길면 stale `pending_install` 행이 누적되어 §9.2 의 식별 키 룩업 성능과 §2.4 attention 카운트에 잡음. 더 짧으면 정상 흐름이 끊긴다 (사용자가 점심·미팅·휴일 사이클에 작업이 분할되기 쉬움). 24h 가 지나면 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 만료된 행은 데이터 분석·감사 목적으로 삭제하지 않고 보존한다 (manual delete 별도).
+
+**TTL 기준 (2026-05-15 갱신)**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다. 옛 (V044 이전) 행은 NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.
+
+`status_reason='install_timeout'` 인 expired 행에서는 reauthorize 버튼이 **비활성** 이다 — Private 앱은 재인증 진입점이 없고 cafe24 "테스트 실행" 만 정식이다. 사용자는 행을 삭제 후 새로 등록한다.
+
+### status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분 (2026-05-14)
+
+소셜 로그인 흐름(`spec/2-navigation/10-auth-flow.md`) 의 URL param `error=token_exchange_failed` 와 본 spec 의 통합 callback `status_reason='oauth_token_exchange_failed'` 는 도메인이 다른 별개 신호다 — 전자는 user authentication 도메인, 후자는 integration credentials 도메인. 의도적으로 prefix `oauth_` 를 두어 grep·index 시 도메인 구분이 자명하도록 분리했다. 이름은 통일하지 않는다.
+
+### Cafe24 Private 의 `connected → expired` 복구 경로 (2026-05-14)
+
+일반 OAuth provider 는 `expired → connected` 가 reauthorize 또는 자동 refresh 로 복구된다 (§6 / data-flow §3.1). **Cafe24 Private 앱은 reauthorize 진입점이 없고**, refresh 도 token endpoint 가 mall 별이라 일반 흐름이긴 하지만 만약 refresh 가 실패해 `expired(refresh_failed)` 로 떨어지면 **복구 유일 경로는 삭제 후 재등록** 이다. 이건 Private 앱의 구조적 제약 (우리 서버가 OAuth 를 시작할 수 없음) 의 당연한 귀결이며, §6 전이 표의 `expired → connected (reauthorize)` 항은 Cafe24 Private 에는 적용되지 않음. UI 의 reauthorize 버튼 비활성 (§4.2) 이 이 사실을 반영한다.
+
+### `pending_install` 은 필터 칩에 추가하지 않는다 (2026-05-14)
+
+§2.3 상태 필터 칩은 `Connected / Expiring / Expired / Error` 4종 + All 로 운영된다. `Pending install` 은 사용자가 외부 흐름(Cafe24 Developers) 을 진행 중인 **정상 전환 상태** 로 보고 필터 칩에 추가하지 않는다. 별도 필터링 수요가 발생하면 후속 plan 으로 추가 검토.
+
+### Cafe24 App URL 100자 한도 대응 — `/api/3rd-party/<provider>/` namespace 도입 (2026-05-15)
+
+운영 사용자가 Cafe24 Developers 의 앱 URL 입력 필드에서 "허용 길이 초과" 경고를 받아 Private 앱 연동이 막혔다. 수동 테스트 결과 100자 제한이며, 호스트 변동 가능성까지 감안해 90자를 마지노선으로 잡았다. 현행 `/api/integrations/oauth/install/cafe24/<64-hex>` 은 호스트 32자 가정 135자로 한도 초과.
+
+**두 부분을 모두 단축**:
+
+- **path namespace**: `/api/integrations/oauth/install/cafe24/...` (39자) → `/api/3rd-party/cafe24/install/...` (30자). 옛 namespace 는 "사용자가 호출하는 통합 관리 API" 와 "3rd party 가 호출하는 콜백·설치 API" 가 한 prefix 에 섞여 있던 구조. 3rd-party 의미가 명확한 prefix 로 분리하면 IP allowlist · rate limit · 미래 webhook receiver 같은 per-provider 처리가 sub-tree 단위로 모인다.
+- **install_token**: 32바이트 hex (64자) → 16바이트 base64url no-padding (22자). 128-bit 엔트로피는 capability token 으로 충분 (NIST SP 800-63B §A.7 권장 96-bit 이상, OWASP capability token 가이드 128-bit 권장). 옛 256-bit 는 과잉.
+
+**provider-grouped vs action-grouped**: `/api/3rd-party/cafe24/install/:token` (provider-grouped) 대신 `/api/3rd-party/install/cafe24/:token` (action-grouped) 도 검토. 두 안 모두 길이 동일. provider-grouped 채택 이유 — (a) 향후 Cafe24 webhook receiver 등을 추가할 때 `/api/3rd-party/cafe24/webhook` 처럼 같은 sub-tree 에 모임. action-grouped 면 webhook 이 또 다른 top-level segment 가 되어 비일관. (b) 새 provider 가 들어올 때 모듈 단위 (`Cafe24ThirdPartyController` 등) 매핑이 자연스럽다. (c) per-provider 미들웨어 (IP allowlist 등) prefix 가 한 곳.
+
+**google/github callback 도 동시 이동**: cafe24 만 옮기면 callback 경로가 provider 별로 갈라져 비대칭 (`/api/3rd-party/cafe24/callback` vs `/api/integrations/oauth/callback/google`). 일관성 우선 + OAuth 콘솔 재등록을 한 번에 마치는 편이 운영상 깔끔. 운영 영향: Google Cloud Console / GitHub OAuth App / Cafe24 Developers 모두 새 redirect URI 등록 필요 (배포와 동시). 사용자 소셜 로그인용 redirect URI (`/api/auth/oauth/:provider/callback`) 는 **별개로 유지** — 두 URI 가 같은 OAuth 콘솔에 공존한다 (§10.1 참고 노트 참조).
+
+**callback URL 표기 컨벤션**: spec 본문·표·다이어그램은 모두 파라메트릭 단일 형식 `/api/3rd-party/:provider/callback` (`:provider ∈ {cafe24, google, github}`) 만 사용한다. 컨트롤러 구현이 provider 별 분리 (3개) 인지 파라메트릭 (1개) 인지는 구현 plan 의 결정 사항.
+
+**옛 경로 미보전**: `/api/integrations/oauth/install/cafe24/:installToken` 및 `/api/integrations/oauth/callback/:provider` 핸들러는 즉시 제거. 운영자에게 OAuth 콘솔 갱신이 강제로 가시화되는 편이 누락 없이 안전. 이전 동일 패턴 (2026-05-14, 토큰 없는 경로 즉시 제거) 의 선례를 따른다. 옛 토큰 없는 `/api/integrations/oauth/install/cafe24` 의 410 Gone hint 라우트는 현재 코드에 존재하지 않으며 (followup plan 의 가설적 항목이었음), 본 PR 의 변경과 무관.
+
+**기존 `pending_install` 행 마이그레이션 생략**: 옛 64자 hex 토큰을 가진 행은 이미 옛 라우트와 결속되어 있고, 새 라우트는 22자 base64url 만 발급한다. 새 라우트로 호출 자체가 path-format mismatch 로 404 가 되므로 자연 만료 (24h install_timeout 스캐너) 에 맡긴다. 실제 영향 범위는 보고된 사례 자체가 "길이 초과로 등록 못 함" 상태였으므로 거의 0.
+
+### Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)
+
+Cafe24 Developers Console 에 등록한 App URL 은 **두 가지 진입점** 모두에서 호출된다 — ① 초기 install (테스트 실행), ② **post-install navigation** (카페24 쇼핑몰 관리자의 "앱으로 가기" 버튼). ②번이 새로 발견된 요구사항으로, 옛 spec 의 single-use 가정 (callback 성공 시 `installToken=NULL` 소거) 과 충돌해 운영 사용자가 "앱으로 가기" 클릭 시 `404 CAFE24_INSTALL_INVALID_TOKEN` 을 받았다 (2026-05-15 사용자 보고).
+
+**결정**: `install_token` 을 통합 lifetime 동안 보존되는 persistent identifier 로 격상.
+
+- `pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로).
+- `handleInstall` 이 status 분기 — `pending_install` → OAuth authorize, `connected`/`error(*)`/`expired` → 우리 frontend redirect.
+- HMAC 검증은 두 분기 모두 유지 (Cafe24 출처 보증).
+- V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` 은 변경 없음 — 한 워크스페이스 안에서 같은 token 이 한 row 에만 매핑되는 invariant 보존.
+
+**옛 connected 행 호환**: 본 변경 이전에 connected 로 전환되어 token 이 이미 NULL 인 통합은 새 동작이 작동하지 않는다 ("앱으로 가기" 클릭 시 여전히 404). 마이그레이션 plan 없이 자연 해소 — 사용자가 통합을 삭제 후 재등록하면 새 token 이 발급되고 새 동작 적용. 옛 행을 위해 추가 마이그레이션 비용을 들이지 않는 이유는 (a) Cafe24 Private 통합 사용자 수가 적고, (b) 재등록 비용이 SQL 마이그레이션 작성·테스트 비용보다 낮으며, (c) 옛 행의 client_secret 이 credentials 에 그대로 있어 token 재발급 자체는 가능하나 그 시점부터 다시 "테스트 실행" 부터 시작해야 하므로 결국 사용자 작업이 필요해 자동화 가치가 낮다.
+
+**NULL 처리 유지 경로**: `pending_install → expired (install_timeout)` 의 24h TTL 만료는 token 을 NULL 로 소거 유지 — 사용자가 새 통합을 등록해야 하므로 옛 token 무효화가 정당. 통합 삭제 시도 row 삭제로 token 자동 소멸.
+
+**post-install navigation 의 redirect target**: `${FRONTEND_URL}/integrations/<id>` 로 통일. 사용자가 카페24 admin 에서 우리 앱으로 들어올 때 그 통합의 상태·diagnostic 을 바로 확인할 수 있는 화면. 단순 `${FRONTEND_URL}/` 으로의 redirect 도 검토했으나 (워크플로 목록 등) 통합 컨텍스트 보존이 더 유익.
+
+### Cafe24 Private request-scopes 흐름 (2026-05-15)
+
+cafe24 Private 의 OAuth 시작은 우리 서버가 할 수 없어 `mode='reauthorize'` 에서 begin 이 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거부한다. 옛 `/request-scopes` 는 내부적으로 begin 을 호출하며 mode `request_scopes` 도 같은 거부 분기에 걸려 동작 불가였다 (2026-05-15 운영 사용자 보고 — `CAFE24_INVALID_MALL_ID` 가 noise, 실제로는 Private 흐름이 막혀 있는 본질적 문제). 또한 옛 requestScopes 는 `entity.credentials.mall_id` 를 providerMeta 로 전달하지 않아 begin 의 cafe24 검증부가 missing mall_id 로 reject 도 함께 발생.
+
+**결정**: `requestScopes` 가 cafe24 Private 을 감지하면 begin 우회 — 기존 `installToken` 보존 + `credentials.scopes` merge 갱신 + `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded }` 응답. 사용자가 Cafe24 Developers 의 앱 권한에서 추가 scope 활성화 후 "테스트 실행" 누르면 기존 install handler 가 작동 → callback → token 의 scope 가 확장된 새 token 으로 교체된다.
+
+**왜 begin 우회인가**: begin 의 Private 거부는 정당 (OAuth 시작 불가). request-scopes 는 본질적으로 "OAuth 재시작 + 확장 scope" 인데, Private 에서는 Cafe24 측 진입점만 정식이므로 우리 화면은 안내만 담당. credentials.scopes merge 는 install handler 의 `OAuthState.requestedScopes` 채움에 영향을 주므로 사전에 갱신해 둔다.
+
+**`request_scopes` 와 `reauthorize` 의 분리 유지**: 옛 코드는 두 mode 가 거의 동일 처리. 새 흐름에서도 Private 의 reauthorize 는 여전히 거부 (사용자가 reauthorize 의도로 누르면 안내 — Private 앱은 "테스트 실행" 만 정식). request_scopes 만 위 우회 분기로 처리.
+
+**UI 안내 패턴 결정 (2026-05-16 추가)**: 분기 ② 응답(`cafe24_private_pending`) 에 대한 화면 표시는 modal/dialog 가 아닌 **inline alert + info 토스트** 로 정한다. modal 은 닫히면 잊혀지지만 Cafe24 측 작업(권한 활성화 → 테스트 실행)을 진행하는 동안 사용자가 안내를 계속 참조해야 한다 — 따라서 inline 으로 영구 표시. toast 는 응답 도착 신호로만 사용 (alert 가 본문). alert 생존 주기는 "다음 요청 시작 직전 reset" — `useMutation` 의 `onMutate` 훅에서 비워 옛 안내가 새 요청과 섞이지 않게 한다. 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다 — token 갱신은 Cafe24 측 후속 callback handler (`handleInstall` 의 status 분기) 가 담당하므로 즉시 refetch 해도 변화 없음. `scopesAdded` 는 alert 안의 칩 목록으로 표시하되 빈 배열이면 칩 영역 자체를 숨긴다. UI 매핑 표는 §4.4.
+
+### Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)
+
+운영 사용자 보고 — 새 통합 등록 후 Cafe24 Developers 에 App URL 을 등록했는데, "테스트 실행" 시 우리 endpoint 가 `404 CAFE24_INSTALL_INVALID_TOKEN` 응답. 원인: 사용자가 신규 통합 폼을 여러 번 제출하면서 (예: client_secret 오타 수정) idempotent begin 의 credentials-change 분기로 install_token 이 재발급됨. 마지막에 본 URL 만 옳고, 그 사이 Cafe24 Developers 에 등록한 옛 URL 은 stale.
+
+옛 동작은 단호한 404. 사용자는 통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 수동 갱신해야 회복 가능. UX 가 뚝뚝 끊기고 운영 문의가 잦음.
+
+**결정**: `handleInstall` 의 install_token 직접 매칭 실패 시 회복 분기 추가.
+
+1. 같은 mall_id 의 cafe24 row 들 조회 (V046 partial UNIQUE 로 보통 1~2건).
+2. 각 row 의 `client_secret` 으로 HMAC trial 검증.
+3. **정확히 1개** validates → 그 row 의 OAuth/navigation 흐름으로 fall-through.
+4. 0개 또는 2개+ → 기존 404 흐름 + HTML 안내 페이지 (사용자가 통합 상세의 현재 App URL 로 갱신).
+
+비용: O(N) HMAC verify (회복 분기에서만, 정상 흐름 zero impact). 옛 폐기된 "100건 mall_id 스캔 + trial HMAC" (Rationale "install_token 을 App URL path 식별 키로 승격" 항 참조) 과 형태는 비슷하나 (a) 호출 빈도가 낮고 (404 fallback only), (b) **같은 workspace 안에서는** V046 partial UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 mall_id row 를 최대 1개로 제한하며, 회복 분기 스캔이 workspace 횡단이라도 같은 mall_id 를 둘 이상 workspace 에서 동시 사용하는 케이스는 드물어 N=1~2 가 실무 값 ("구조적 상한 N≤2" 가 아니라 workspace-scoped 1개 보장 + 실무적으로 소수). 정상 식별은 여전히 install_token 단일 row 조회.
+
+**TOCTOU 부재**: 회복 분기는 SELECT + HMAC verify 만 수행하는 read-only 조회로 INSERT/UPDATE 가 없어 race 자체가 발생하지 않는다. begin 핸들러의 V045 partial UNIQUE backstop (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Rationale 참조) 은 INSERT 단계의 동시 신청 차단을 담당하는 보완 보증이며, 본 분기와는 다른 시점의 보증.
+
+**보안 분석**: HMAC 위조에는 client_secret 이 필요. client_secret 보유자는 정상 흐름으로도 동일 행위 가능 → 회복 흐름이 추가 권한을 부여하지 않음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항 참조) 는 그대로 유지 — 옛 URL 이 leak 되어도 HMAC 위조 없이는 진행 불가.
+
+**모호 케이스 (2개+ HMAC 매칭)**: 같은 mall_id 가 두 workspace 에 등록되어 있고 동일 client_secret 을 공유하는 경우 (드문 케이스 — 한 Cafe24 앱을 우리 서비스의 둘 이상 workspace 에서 동시에 사용). 어느 row 를 선택할지 결정 불가 → 회복 포기 + 404. 회복 운영로그 (`[cafe24-install-recovery] ambiguous: N rows passed HMAC`) 가 진단을 보조.
+
+**HTML 에러 페이지**: 404 (회복 실패 포함) 시 요청의 `Accept: text/html` 일 때 minimal styled HTML 페이지 렌더. error code/message + 회복 안내 ("통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 갱신하세요"). API 클라이언트 (JSON 기대) 는 기존 JSON 응답 유지.
+
+### Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)
+
+Cafe24 Public app 흐름은 우리 서버의 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` env 가 등록된 경우에만 동작 (앱스토어 등록 앱의 OAuth client credentials). env 가 미설정이면 Public 옵션을 선택해도 begin 이 `OAUTH_CONFIG_MISSING` 으로 거부 — 사용자 입장에서 dead-end UX.
+
+**결정**: `/api/integrations/services` 응답의 cafe24 항목에 `meta.publicAppAvailable: boolean` 노출. `CAFE24_CLIENT_ID && CAFE24_CLIENT_SECRET` 둘 다 set 이면 true. Frontend 의 신규 통합 폼이 false 일 때 Public 옵션 토글에서 제거 + 기본값 `private` 강제 + 안내 문구 갱신.
+
+**Private 는 항상 노출**: env 와 무관. 사용자가 직접 client_id/secret 입력하므로 deployment 의 env 상태에 의존하지 않음. Public 만 env 게이트 (사용자 명시 결정).
+
+**왜 server-side 게이트인가**: 클라이언트가 env 를 알 길이 없으므로 server 가 single source of truth. `meta` 객체에 담아 향후 다른 가용성 hints (예: GitHub Enterprise URL 설정 여부 등) 도 같은 통로로 노출 가능.
+
+#### `spec/2-navigation/9-user-profile.md` 의 Rationale
+
+## Rationale
+
+### `/profile` 편집 인터랙션의 분리 (§2)
+
+초기 와이어프레임은 사용자 정보·환경설정·비밀번호 변경을 한 페이지의 폼으로 묶고 하단 단일 `[Save Changes]` 버튼으로 모두 커밋하는 형태였다. 다음과 같은 footgun 이 식별되어 현재의 하이브리드 편집 패턴(인라인 토글 + sub-route + diff 확인 모달) 으로 개정했다.
+
+- **이질적 변경의 의도 충돌** — 자격증명(비밀번호)·개인정보(이름·아바타)·환경설정(언어·테마) 은 위험 수준이 서로 다른데도 한 번의 클릭이 모두를 동시에 PATCH 하는 구조였다. 사용자 의도와 실제 결과가 어긋날 가능성이 컸다.
+- **무방비 편집 활성화** — 모든 input 이 디폴트로 활성화되어 있어 단순 탐색 중에도 실수 입력이 그대로 저장 대상이 되었다.
+- **세션 강제 종료 패턴과의 톤 불일치** — `/profile/sessions` 의 강제 종료는 이미 `RevokeConfirmDialog`(password/TOTP 재인증) 로 명시적 의도를 분리해 안전하게 운영 중인데, 같은 영역의 다른 민감 동작은 그 톤을 따르지 못하고 있었다.
+
+해법으로 (a) `/profile` 을 디폴트 readonly 로 두고 카드 단위 [편집] 토글로 의도를 분리, (b) 저위험 항목(이름·환경설정) 도 저장 직전 변경 전·후 diff 확인 모달을 한 단계 거치게 해 실수 방지, (c) 고위험 항목(비밀번호) 은 별도 sub-route 진입 자체가 의도 표명 역할을 하도록 채택했다. 이메일은 기존 결정대로 "별도 변경 (확인 메일)" 으로 본 화면에서 분리한 상태를 유지한다.
+
+폐기된 대안:
+
+- **모달 일원화** — 모든 편집을 모달로 처리(인라인 토글 없음). 환경설정처럼 자주 만지는 항목까지 매번 모달이 떠야 해 마찰이 과도하다고 판단.
+- **전 항목 sub-route** — 환경설정·이름까지 모두 별도 라우트로 분리. 라우팅·뒤로가기 비용이 가치 대비 과도. 위험 수준에 비례한 마찰이 더 합리적.
+- **단일 페이지 + 섹션별 Save 버튼** — 폼은 그대로 두고 Save 만 섹션 단위로 쪼개기. "폼이 디폴트로 노출되어 무방비" 라는 핵심 문제를 해결하지 못함.
+
+#### `spec/2-navigation/_layout.md` 의 Rationale
+
+## Rationale
+
+### R-1. 사이드바 로고 변종 규칙 (2026-05-15)
+
+§2.1 로고 행에 expanded/collapsed 변종 규칙을 추가한 이유: 본 문서는 사이드바의 **자리**만 정의하고, 자리에 들어가는 로고 변종·색은 `spec/6-brand.md §8.4` (brand spec) 가 단일 진실로 결정한다. 본 행은 brand spec §8.4.6 의 결정(expanded → Full logo / collapsed → Icon mark)을 자리 정의에 반영한 것이다.
+
+근거 출처: `spec/6-brand.md §8.4.6` (로고 노출 자리) 및 동 문서 R-9 (브랜드 spec 의 라우트 spec 우선권). 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/`.
+
+### R-2. §2.1 로고 행 정정 (2026-05-15 롤백)
+
+§8.2 컬러 토큰 정식화 폐기(`spec/6-brand.md` R-13) 와 함께, 본 §2.1 의 *"Full logo (light)"* 표현에서 *(light)* 한정을 제거. 라이트/다크 자산 선택은 노출 자리(surface) 의 배경 톤에 따라 brand spec §8.4 가 결정한다. R-1 의 §8.4.6 참조는 본 롤백 후에도 유효하며, 다만 §8.4.6 표 자체가 *"라이트/다크 자산 선택은 노출 자리에 맞춤"* 표현으로 정정되었다.
+
+사전 일관성 검토 세션: `review/consistency/2026/05/15/23_45_11/`.
+
+#### `spec/3-workflow-editor/4-ai-assistant.md` 의 Rationale
+
+## Rationale
+
+본 spec 결정 사항의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며, 폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 를 참조.
+
+_원본 메모: memory/workflow-ai-assistant-decisions.md_
+
+### Workflow AI Assistant — 기획 결정 메모
+
+Workflow AI Assistant(에디터 내 채팅형 AI) 스펙 작성 시 사용자와 합의한 결정 사항을 구현자가 재참조할 수 있도록 정리한다.
+
+#### 확정된 결정 사항
+
+| 항목 | 결정 | 근거 |
+|------|------|------|
+| 제품 명칭 | **Workflow AI Assistant** / 워크플로우 AI 어시스턴트 | PRD/Spec/i18n 전 영역에서 통일 사용. "Copilot", "AI Workflow Builder" 후보는 기각 |
+| PRD 배치 | `prd/2-workflow-editor.md` §10, 요구사항 ID 접두사 `ED-AI-*` | 에디터 내부 UI/UX가 주 영역이므로 에디터 문서에 포함. PRD 6에서는 cross-ref만 |
+| 채팅 세션 영속화 | **서버 저장** (신규 엔티티 `AssistantSession`, `AssistantMessage`) | 페이지 새로고침·재접속 시 이어서 대화 지원. 관련: `spec/1-data-model.md` §2.20~2.21 |
+| 변경 적용 방식 | 즉시 반영 + Undo (`editor-store` 재사용) | 기존 자동 저장/Ctrl+S 흐름과 일관. DB 영구 기록은 사용자의 Save를 통해서만 |
+| 스트리밍 | SSE + `LLMClient.stream()` 신규 메서드 | 관련: `spec/5-system/7-llm-client.md` §8 |
+| 스트리밍 v1 지원 provider | OpenAI, Anthropic만 | Google/Azure는 Tool-use 포맷 차이로 후속. 미지원 provider 선택 시 `ASSISTANT_STREAMING_UNSUPPORTED` 에러 |
+| NodeSettings Panel과 동시 오픈 | **상호 배타** (Assistant 열면 Settings 닫힘) | MVP 단순화. 사용자 피드백에 따라 후속 버전에서 나란히 배치 가능 |
+| Assistant의 편집 권한 | `editor` 역할 이상 | 기존 RBAC 규약 재사용 |
+
+#### 구현 시 유의 사항 (승인된 기술 플랜 `~/.claude/plans/ui-partitioned-porcupine.md` 대비 변경점)
+
+원래 기술 플랜에는 "채팅 히스토리는 in-memory only (MVP)"로 명시되어 있었으나, **기획 단계에서 서버 영속화로 변경**되었다. 따라서 다음 작업이 추가된다:
+
+1. **DB 엔티티 2개 신규**: `AssistantSession`, `AssistantMessage` (Flyway 마이그레이션 필요)
+2. **REST API 5개 신규**: `GET/POST/PATCH/DELETE /workflow-assistant/sessions`, `GET /workflow-assistant/sessions/:id`. SSE 엔드포인트는 `POST /workflow-assistant/sessions/:id/messages`로 경로 변경 (기존 플랜의 `/workflow-assistant/message`가 아님).
+3. **백엔드 Service**: 세션/메시지 CRUD + 대화 컨텍스트 조립(최근 30턴 프롬프트 주입 룰).
+4. **프론트엔드 스토어**: `assistant-store.ts`가 서버 세션 id를 들고 있어야 하며, 패널 오픈 시 `GET /sessions?workflowId=...`로 기존 세션을 로드.
+5. **Cascade 삭제**: `Workspace` 삭제 → `Workflow` 삭제 → `AssistantSession` 삭제 → `AssistantMessage` 삭제. Flyway 마이그레이션에서 ON DELETE CASCADE FK 설정.
+
+#### 미결 UX (발견 시 확인 필요)
+
+- 세션 보관 기간/자동 archive 정책 — 현재 Spec은 "수동 삭제까지 영속". 향후 워크스페이스별 용량 제한과 연계 가능.
+- 세션 공유/내보내기 — v1 스코프 밖 명시. 팀 워크스페이스 RBAC 선행 필요.
+- Plan 카드의 step을 사용자가 직접 편집/체크 가능한지 — 현재 Spec은 "사용자 조작 불가, 진행도 표시 전용"(§3.3). 필요해지면 별도 RFC.
+
+_원본 메모: memory/workflow-assistant-prompt-restructure.md_
+
+### Workflow AI Assistant 시스템 프롬프트 재구조 (2026-04-22)
+
+`backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 를 5블록 구조로 재편한 작업의 핵심 결정 사항과 향후 주의점을 정리한다.
+
+#### 왜 바꿨나
+
+##### 이전 구조의 문제
+
+1. **규칙 중복.** "plan-only vs execution turn" 분기가 5군데(L84/L85/L129/L138–153/L251)에 흩어져 LLM이 매 턴 파싱해야 했다. `planStepId` 태깅 규칙도 4군데, `get_node_schema` 선행 규칙도 4군데 반복.
+2. **토큰/캐시 비효율.** 매 턴 변하는 `workflow snapshot JSON`(L121)과 `activePlanSection`(L87 근처)이 프롬프트 상단에 있어 provider prefix cache가 사실상 매 턴 무효화.
+3. **시각적 우선순위 부재.** 섹션이 전부 `##` 동일 레벨, MUST/SHOULD 계층 구분 없음. 서술형 문장 안에 분기 로직이 숨어 있었음.
+4. **부정문 지배.** DO NOT / NEVER / MUST NOT 위주. 긍정형 격언이 드물었다.
+5. **예시 중복.** 6개 예시 중 3개가 사실상 같은 교훈(trigger 연결 + dynamic-ports + label/id) 반복.
+
+#### 새 구조 (5블록)
+
+1. **ROLE & TURN-OP PROTOCOL** — 역할 1문장 + 툴 호출 규약 + **turn 결정표** (Markdown table: `Turn type | Emit prose? | finish call? | Further tools | When it applies`)
+2. **CONTRACTS (MUST)** — Node output contract (CONVENTIONS 0/1.1/2/8), Label vs identifier, Entry-point connectivity, Dynamic-ports (schema-first + stable ids), Plan gating (openQuestions / planStepId / completeness)
+3. **EDIT PLAYBOOK** — Closing the turn, pendingUserConfig, Editing existing node's config, Layout guidance, Error handling, Examples (3개)
+4. **REFERENCE** — Node catalog, Expression language
+5. **DYNAMIC STATE** — Active plan context + Current workflow snapshot JSON (**반드시 프롬프트 끝에 위치**)
+
+##### 주요 효과
+
+- **Prefix cache 친화.** 정적 콘텐츠가 앞, 동적 상태가 뒤로 이동해 prefix-cache hit rate가 크게 개선될 것으로 기대.
+- **규칙 단일 소스.** "Call `finish` immediately after `propose_plan`" 문구가 **딱 한 곳(turn 결정표)** 에만 존재. 다른 섹션에서는 "the decision table above" 로만 참조.
+- **Expression reference 캐시.** `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 변수로 한 번만 문자열화. 이전엔 매 턴 `getAllFunctionNames().sort().join()` 을 재실행.
+- **예시 3개로 축소** — Ex1 단순 edit / Ex2 dynamic-ports+pendingUserConfig (label/id 동시 커버) / Ex3 openQuestions 포함 복잡 요청.
+
+#### 새 구조를 고정하는 테스트
+
+`system-prompt.spec.ts` 에 `5-block structural layout (cache-friendly ordering)` describe 블록 추가. 향후 변경 시 다음이 깨지면 안 된다:
+
+- `## Expression language` 이후에 workflow snapshot JSON(`"nodes":[`) 이 위치.
+- `## Expression language` 이후에 `## Active plan context` 위치.
+- `Label vs identifier` (CONTRACTS) 는 `## Expression language` (REFERENCE) 보다 앞.
+- Turn 결정표 헤더 `| Turn ... | ... prose ... | ... finish ...` 형태가 존재하고 `plan-only` / `execution` 두 턴 종류가 본문에 등장.
+- `Call finish immediately after propose_plan` 정규식 매치가 **1회 이하** (중복 금지).
+
+#### 보존한 계약 (기존 테스트가 보장하는 것)
+
+다음은 절대 문구를 깨면 안 된다 (regex 매칭됨):
+
+- `[dynamic-ports]` 카탈로그 마커
+- P0 guard rail: `manual_trigger` entry-point / `openQuestions` finish 금지 / `get_node_schema` MANDATORY
+- Label vs identifier 예시: `btn_approve`, `승인`, `interaction.data.buttonId`, `interaction.data.email`, `data["승인"]` 금지 사례
+- `## Closing the turn ... execution turn` 헤더 (동일 라인에 두 문구)
+- `pendingUserConfig`, 4종 selector: `integration-selector`, `llm-config-selector`, `kb-selector`, `workflow-selector`
+- `TODO|placeholder` 금지 가드
+- `## Expression language`, `validate()`, `INVALID_EXPRESSION`, `Optional chaining`, `` `??` ``, `Arrow`, `Template literal`
+- `Editing an existing node's config`, `shallow-merged`, `[REDACTED]`, `minimum patch`, "keep .* id"
+- Active plan rendering: `[x] s1 · add_node` / `[ ] s2 · add_edge` / `• [note] ...` / `awaiting approval` / XML fence `<user-request>...</user-request>`
+
+#### 이번 작업에서 발견한 pre-existing 이슈
+
+TEST WORKFLOW 중 다음 테스트가 **main 브랜치에서도 실패** 함을 확인 (git stash 로 재현):
+
+- `backend/src/modules/workflow-assistant/tools/validate-expressions.spec.ts` — "accepts optional chaining" 케이스
+- `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts` — "accepts add_node with optional chaining (supported syntax)"
+
+원인은 `@workflow/expression-engine` 패키지의 optional chaining 파서가 한글 키 인덱싱(`$node["1depth 음식 종류"]?.output?.interaction?.data.field`)을 거부하는 것으로 보인다. 최근 커밋 `6f6cfe1 표현식에 ? 지원` 에서 도입하려던 수정이 불완전한 듯하다.
+
+**이번 프롬프트 재구조 작업 범위 밖**이므로 별도 이슈로 처리해야 한다. 프롬프트 재구조는 이 실패들과 독립적으로 완결.
+
+#### 유지보수 시 체크
+
+- 섹션을 추가할 때 **블록 경계를 넘지 말 것.** 정적 내용은 BLOCK 1~4, 동적 내용은 BLOCK 5. 이 규율이 캐시 효과의 근간.
+- `STATIC_BLOCK_1_*`, `STATIC_BLOCK_2_*`, `STATIC_BLOCK_3_*` 모듈 스코프 상수로 빌드 타임에 1회만 문자열화됨. 동적 값이 필요하면 이 상수에 넣지 말고 `buildSystemPrompt` 본체에서 조립.
+- 새 규칙을 추가하기 전, **기존 섹션에 흡수 가능한지 먼저 검토.** 규칙을 여러 곳에 반복 넣으면 이번 리팩토링이 무효화된다.
+- Harmony control token 경고(`<|channel|>` 등) 는 OpenAI gpt-oss 계열 대비 유산. 현 provider (OpenAI/Anthropic/Google) 모두에서 발생하지 않는다는 것이 확인되면 제거 가능.
+
+_원본 메모: memory/workflow-assistant-self-review-and-error-hints.md_
+
+### Workflow Assistant — 자체 점검 + 에러 풍부화 (2026-04-23)
+
+Assistant 가 복합 워크플로우 (예: 설문조사) 를 만들 때 실패 tool call 이 연쇄적으로 발생하던 문제와, 완료 후 자체 점검이 없던 문제를 해결한다. 본 메모는 향후 유지보수 시 놓치면 안 되는 결정·제약을 정리한다.
+
+#### Part A — Tool-call 오류 감소
+
+##### 에러 풍부화 (ShadowResult 확장)
+
+`ShadowResult` 에 optional 필드 추가:
+- `knownTypes: string[]` (정렬, 최대 `KNOWN_TYPES_MAX=40`) — `UNKNOWN_NODE_TYPE`
+- `suggestedType: string` — alias 맵 hit (`NODE_TYPE_ALIASES`) 우선, 없으면 Levenshtein ≤ 3
+- `repeatCount: number` — 같은 label LABEL_CONFLICT 가 `LABEL_CONFLICT_REPEAT_THRESHOLD(=2)` 이상 반복 시
+- `hint: string` — 복구 지침 한 문장. 세 케이스에서 set 될 수 있다 (JSDoc 에 명시):
+  - UNKNOWN_NODE_TYPE (alias / Levenshtein / 후보 없음 별로 문구 다름)
+  - LABEL_CONFLICT (repeatCount ≥ 2)
+  - NODE_NOT_FOUND on add_edge (recentFailedAddNodeLabels 가 있을 때 cascading 힌트)
+
+##### alias 별칭 정책
+
+`NODE_TYPE_ALIASES` 는 `error_message | error | alert | notification | message | text → template`.
+기준: LLM 이 "UI 메세지용 전용 노드" 가 있다고 가정해 만들어내는 타입명을 `template` 으로 라우팅.
+반드시 `this.knownNodeTypes.has(aliasHit)` 를 확인한 뒤에만 suggestedType 으로 싣는다 (registry 변화 대응).
+
+##### LABEL_CONFLICT ≠ 실패한 노드 생성
+
+**규약**: `addNode()` 의 LABEL_CONFLICT 분기에서는 `recordFailedAddNode` 를 호출하지 않는다. 이유: LABEL_CONFLICT 는 "이름만 겹쳤을 뿐 타입·config 자체는 타당" 한 상태이므로, 이후 `add_edge` 가 NODE_NOT_FOUND 로 떨어졌을 때 cascading 힌트에 섞이면 "앞서 노드 생성이 실패했다" 는 잘못된 진단을 LLM 에 준다. 테스트: `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint".
+
+##### LLM 제공 문자열 embedding 규약
+
+LLM 이 자유 텍스트로 채우는 값(label, attemptedType) 을 힌트/에러 메세지에 embed 할 때는 **반드시** `sanitizeLlmProvidedString(value, maxLen)` 경유. 이 헬퍼가 제어 문자·개행 제거, 백틱·꺾쇠 중화, 길이 절단을 일관 처리한다. 이유: LLM 출력이 `\n## HACK` 같은 마크다운 헤더/인젝션을 품은 채 힌트로 재주입되면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다.
+
+길이 상수:
+- `ATTEMPTED_TYPE_MAX_LEN = 64` — node type 후보 embed
+- `LABEL_HINT_MAX_LEN = 80` — NODE_NOT_FOUND 힌트 label 목록
+
+##### schemaCache 정책
+
+`workflow-assistant-stream.service.ts` 의 턴 스코프 `schemaCache: Map<string, { result, hits }>`.
+
+카운트 규칙: **hits 값은 호출 순번 그 자체**. 첫 호출 후 1, 두 번째 2, 세 번째 3...
+- hits=1 (첫 호출): 정상 실행, cache set
+- hits=2 (두 번째): cached + `warning: 'REDUNDANT_SCHEMA_LOOKUP'` + `cached: true`
+- hits ≥ 3 (`SCHEMA_LOOKUP_HARD_STOP`): `ok: false, error: 'REDUNDANT_SCHEMA_LOOKUP'` (hard stop)
+
+이 상수를 변경할 때는 서비스 L137–142 주석 + L459–462 inline 주석 + 테스트 3회차 기대값을 모두 동시에 고친다.
+
+#### Part B — 2-stage finish (self-review)
+
+##### 흐름
+
+LLM 이 `finish` 를 호출하면 서버는 아래 순서로 판정:
+
+1. `evaluateFinishGuard` → `PLAN_NOT_COMPLETE` 면 block (기존 동작, 변경 없음).
+2. 통과하면 `evaluateReviewGuard` → `WORKFLOW_REVIEW_REQUIRED` 면 block.
+3. 둘 다 통과하면 `{ ok: true }` 로 finish 성공.
+
+Review 는 **한 턴에 한 번만** 발동 (`state.reviewCompleted`, `state.reviewRoundCount < 2`). 두 번째 `finish` 는 review 를 건너뛰고 통과해, LLM 이 사용자에게 다음 턴에서 후속 지시를 받을 기회를 보장.
+
+##### review skip 조건 (`shouldSkipReview`)
+
+다음 중 하나라도 참이면 review 는 발동하지 않는다. **시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지** (프롬프트·구현 drift 가 곧 LLM 혼란으로 이어짐):
+
+- `state.reviewCompleted`
+- `state.reviewRoundCount >= 2`
+- `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복
+- `state.planClearedThisTurn`
+- 이번 턴 성공 edit 이 0 — 실행 턴 아님
+- non-trigger 노드 ≤ 1 — trivial 편집 (plan 유무 무관)
+
+##### 체크리스트 항목 (`review-workflow.ts`)
+
+Blocking:
+- **UNRESOLVED_FAILED_CALLS** — `kind === 'edit'` 실패 중 같은 label(add_node) / id(update/remove) / source+target+port 튜플(add_edge, camelCase 도 포함) 로 성공 흔적이 없는 것. **`finish` / `explore` 계열은 제외** (review-guard feedback 이나 `REDUNDANT_SCHEMA_LOOKUP` 은 실패 의미가 아님).
+- **`PORT_NOT_FOUND` (2026-04-23 추가, add_edge 단계에서 즉시 반환)** — UNRESOLVED_FAILED_CALLS 과는 다른 class. `ShadowWorkflow.addEdge` 가 `portResolver` (stream.service 에서 `resolveEffectiveOutputPorts` 기반 주입) 로 source/target 포트 존재성을 검사, 없는 포트면 즉시 `PORT_NOT_FOUND` + `portInfo.knownPorts` 로 reject. 사용자가 config update 실패로 생성되지 못한 동적 포트 (carousel 버튼 / switch case 등) 에 edge 를 붙이려는 실수를 첫 시도에서 catch. 컨테이너 loopback `emit` 포트는 여전히 허용 (spec §4.4).
+- **ORPHAN_NODES** — trigger category 에서 BFS 도달 불가 + container emit loopback 조상도 미reachable. `byId` Map 은 `collectOrphans` 에서 1회 생성 후 인자로 주입 (O(N²) → O(N+E)).
+- **DANGLING_OUTPUT_PORTS** (2026-04-23 추가) — `resolveEffectiveOutputPorts` 가 돌려주는 `isUserConfigured=true` 포트 중 outgoing edge 없는 것. "ORPHAN_NODES 는 입력 방향 reachability, 이 검사는 출력 방향 connectivity" 의 대칭 쌍. weak 포트 (`error`/`default`/`fallback`/`continue`/단일 static `out`) 는 제외 — terminal 노드는 정상 케이스. `nodeDefs` 가 `BuildReviewChecklistInput` 으로 주입되어야 작동; 빈 배열이면 no-op. 상한 `MAX_DANGLING_PORTS=20`.
+- **FAKE_STEP_COMPLETION** — `planStepId` 또는 `planStepIds` 가 붙은 호출들이 step 에 연결되어 있으나 모두 `ok: false`.
+- **PENDING_USER_CONFIG_UNMENTIONED** — pendingUserConfig 있는 노드의 label 이 assistantText 에 포함되지 않음.
+
+Non-blocking:
+- **REQUEST_COVERAGE_LOW** — originalRequest 의미 토큰과 노드 label 겹침 비율 < 30%. 경고만.
+
+##### Port 해석 (resolve-dynamic-ports.ts)
+
+`frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 로직을 backend 로 포팅한 `tools/resolve-dynamic-ports.ts` 가 SSOT. 6 종 `DynamicPortsSpec` (switch-cases, classifier-categories, ai-agent-conditional, info-extractor-mode, presentation-buttons, parallel-branches) 를 전부 지원. 반환 구조에 `isUserConfigured: boolean` 추가 — strong (user-authored) vs weak (framework-synthesized) 구분이 DANGLING_OUTPUT_PORTS 의 핵심 필터. Frontend 사본과 드리프트하지 않도록 `resolve-dynamic-ports.spec.ts` 에 kind 별 시나리오 미러 (16 테스트).
+
+##### 프롬프트 인젝션 방어
+
+`WORKFLOW_REVIEW_REQUIRED` payload 의 `originalRequest` 필드는 `truncateReviewOriginalRequest()` 로 `REVIEW_ORIGINAL_REQUEST_MAX_LEN=200` 자로 잘라 싣는다. 전체 원문은 system prompt 의 Active plan context 에 XML fence 로 이미 중화되어 주입되므로 review 쪽에는 요약만.
+
+##### 프론트엔드 영향
+
+`tool-call-badge.tsx` 는 `kind === 'edit' | 'explore'` 만 SSE 로 구독하므로 `finish` tool_result (`ok: false, error: 'WORKFLOW_REVIEW_REQUIRED'`) 는 UI 빨간 배지로 누출되지 않는다. 사용자는 review 라운드 중 LLM 이 추가로 부른 `get_current_workflow` / 수정 edit 배지 + Korean "검토 완료" 문장만 본다.
+
+#### 유지보수 체크리스트
+
+- `SCHEMA_LOOKUP_HARD_STOP` 변경 시: 상수 정의부 + 인라인 주석 + 테스트 기대값 3곳 동시 수정.
+- `ShadowResult` 필드 추가/제거 시: JSDoc 블록 + 테스트 fixture + 후속 `detectPendingUserConfig` / `toChatMessages` rehydration 경로 확인.
+- Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화 (테스트 `system-prompt.spec.ts` "teaches the 2-stage finish self-review routine..." 가 고정).
+- `NODE_TYPE_ALIASES` 변경 시: alias 가 registry 에 존재하지 않으면 Levenshtein fallthrough 로 빠지는지 회귀 확인 (`shadow-workflow.spec.ts` "falls through to Levenshtein when alias exists but not in knownTypes").
+- `resolveEffectiveOutputPorts` 변경 시: **frontend `resolveDynamicPorts` 와 동일 동작** 을 유지하는지 확인. 두 파일이 각자의 spec 을 가지므로 어느 한쪽만 업데이트하면 review false positive/negative 가 생긴다. 새로운 `DynamicPortsSpec.kind` 추가 시 양쪽에 동시에 branch 추가.
+- DANGLING_OUTPUT_PORTS 의 weak/strong 경계 변경 시: `resolve-dynamic-ports.spec.ts` 의 `isUserConfigured` 단언 + `review-workflow.spec.ts` "does NOT flag weak ports" 케이스 모두 업데이트.
+
+#### Follow-up (스코프 밖, 별도 이슈)
+
+- `ShadowResult` discriminated union 전환
+- `ShadowWorkflow` SRP 분리 (`ShadowWorkflowErrorAdvisor`)
+- `schemaCache` 응답 명시 구조 래핑 (`{ ok, data, cached, warning }`)
+- CHANGELOG 정책 수립 후 본 변경 소급 반영
+
+_원본 메모: memory/workflow-assistant-provider-quirks-and-review-always.md_
+
+### Workflow Assistant — 프로바이더 이상동작 대응 + review 항상 발동 (2026-04-23)
+
+초기 self-review + 에러 풍부화 배포 후 다양한 LLM 프로바이더에서 관찰된 이슈에 대한 2차 대응을 정리.
+
+#### 1. 프로토콜 이상: tool_call + finishReason=stop (gpt-oss-120b)
+
+##### 증상
+gpt-oss-120b 같은 오픈소스 서빙이 edit tool 호출 후에도 `finish` tool 을 부르지 않고 `finishReason: 'stop'` 으로 round 를 종료. LLM text 채널에는 "다음 단계 진행 중" 같은 내레이션을 남겨 사용자는 "멈춤" 으로 체감.
+
+##### 대응
+`stream.service.ts` 루프 종료 조건 확장:
+```ts
+const hadSuccessfulEditThisRound = pendingResultsForLlm.some(...)
+const shouldContinueLoop =
+  pendingResultsForLlm.length > 0 &&
+  (finishReason === 'tool_calls' ||
+   (!finishResolved && hadSuccessfulEditThisRound));
+```
+
+**edit 가 실제로 성공한 round 에서만** round-trip. propose_plan / explore 만 있는 plan-only round 는 기존처럼 stop 으로 종료 (추가 round 의 ROI 없음).
+
+##### 프롬프트 강화
+`STATIC_BLOCK_3_EDIT_PLAYBOOK` Closing the turn 섹션:
+- **Past tense only** — "진행 중", "차례대로", "다음 단계", "이어서 진행하겠습니다" 등 미래형 내레이션 금지 (포착된 실제 leak 패턴).
+- **finish 필수** — tool 호출 후 반드시 `finish` 를 명시 호출해야 함을 강조. 서버의 round-trip 은 fallback 이며 의존 금지.
+
+#### 2. Harmony control token 누수 (gpt-oss)
+
+##### 증상
+gpt-oss-120b 가 `<|channel|>final<|message|>...` 같은 내부 제어 토큰을 응답에 노출. OpenAI SDK 의 SSE 파서가 이를 파싱하다 "Failed to parse input at pos 0: ..." 로 throw → 사용자에게 raw `LLM_CONNECTION_ERROR` 노출.
+
+##### 대응 (2계층)
+`openai.client.ts`:
+1. **Streaming stripping** — `delta.content` / tool_call arguments 에서 harmony 제어 토큰 제거. 패턴 2개 사용:
+   - `HARMONY_CHANNEL_PREAMBLE_REGEX = /<\|channel\|>[\s\S]*?<\|message\|>/g` — preamble 전체 (channel 이름 포함) 한 번에.
+   - `HARMONY_STANDALONE_TOKEN_REGEX = /<\|(channel|start|end|message|return|constrain|...)\|>/g` — 잔여 단독 토큰.
+2. **Parse error 분류** — catch 블록에서 에러 메세지가 harmony 패턴 매치면 `LLM_OUTPUT_MALFORMED` 로 분류하고 사용자 친화적 한국어 안내문으로 치환. Raw 메세지는 UI 에 노출하지 않음 (로그에만).
+
+#### 3. 에러 UI 시안성 개선
+
+##### 증상
+어시스턴트 패널 error box 가 `text-red-800/200` 탁한 shade 사용 → 배경과 대비 부족, 특히 11px 소형 텍스트에서 가독성 낮음.
+
+##### 대응
+`assistant-message.tsx` 의 error box 를 systemHint 패턴과 동기화:
+- 본문 텍스트: `text-red-950 dark:text-red-50` + `font-medium` — "가장 짙은 shade / 가장 옅은 shade" 대비 극대화.
+- 에러 코드 pill: 별도 shade 배경 (red-200 light / red-800 dark) + border 로 명확히 구분.
+- 본문 글자 크기 `10px → 11px` 로 상향 (message.error 타이틀과 동일 레벨).
+- 긴 영문 에러 메세지 대비 `break-all` 추가.
+
+#### 4. Gemini-3-flash 존재하지 않는 노드 타입 발명
+
+##### 증상
+Gemini-3-flash 이 `음식 종류 선택` 같은 label 로 add_node 시도 — catalog 에 없는 type 을 기본 시나리오 표현으로 발명. 첫 `UNKNOWN_NODE_TYPE` 응답의 `suggestedType` / `knownTypes` 힌트도 무시하고 반복 재시도.
+
+##### 대응
+1. **`NODE_TYPE_ALIASES` 확장** — LLM 이 빈번히 발명하는 패턴을 실제 존재 타입으로 매핑 추가:
+   - `user_input / input / question / prompt / survey / text_input` → `form`
+   - `choice / choices / options / selection / selector / button_group / category / buttons` → `carousel`
+   - `router / route / branch / conditional` → `switch` (boolean 은 `if_else`)
+   - `email / send_mail / mail` → `send_email`
+   - `display / show / render / result / output` → `template`
+
+2. **프롬프트 강화** — `STATIC_BLOCK_3_EDIT_PLAYBOOK` Common pitfalls:
+   - "Node types are a fixed catalog — do NOT invent new types based on your task wording." 추가.
+   - 각 카테고리별 "흔한 오발명 → 실제 타입" 표 내장 (message/input/choice/branching/email 5계열).
+
+3. **UNKNOWN_NODE_TYPE 시 suggestedType 을 알려주는 것에 더해 alias 매핑이 광범위해 대부분의 발명 패턴을 한 번에 교정**.
+
+#### 5. Review guard 항상 발동 (사용자 요구 반영)
+
+##### 증상
+`finishBlockCount > 0` skip 조건 때문에 PLAN_NOT_COMPLETE 가 fire 한 다음에는 review 가 발동하지 않음. 사용자 보고: 복잡한 워크플로우에서 plan 가드를 통과한 뒤에도 orphan / pendingUserConfig 미안내 이슈가 여전히 발생.
+
+##### 대응
+`evaluateReviewGuard` 의 `shouldSkipReview` 에서 `finishBlockCount > 0` 체크 **제거**. 두 가드는 독립 계층으로 운영:
+- PLAN_NOT_COMPLETE — plan 체크박스 충족성 (step ↔ tool call 매핑)
+- WORKFLOW_REVIEW_REQUIRED — 워크플로우 품질 (orphan / 실패 미해결 / pendingUserConfig 안내 / fake step 완료)
+
+Plan 가드가 fire 했다는 것은 LLM 이 한 번 보정 했을 뿐, 결과 워크플로우의 품질을 보장하지 않음. 두 가드 모두 fire 하는 3~4 round 시나리오가 현실적 정상 경로.
+
+##### 남은 skip 조건 (최소 안전망)
+- `reviewCompleted` / `reviewRoundCount >= 2` — 같은 턴 review 1회 상한
+- `planClearedThisTurn` — 화제 전환
+- 성공 edit 0 — 실행 턴 아님
+- non-trigger 노드 ≤ 1 — trivial 편집 (ROI 낮음)
+
+##### PENDING_USER_CONFIG_UNMENTIONED 상세화
+details 문자열에 구체적 노드 label + 빠진 selector 목록을 인라인으로 실어, LLM 이 다음 라운드 한국어 마무리 메세지 작성 시 즉시 참조할 수 있게 함. 예:
+> "SendEmail (Integration); AIAgent (LLM Config). In the next round, emit a Korean summary that names each listed node label verbatim..."
+
+> **2026-04-24 업데이트 — 본 가드는 이제 "candidate 0 인 항목" 에만 발동한다.**
+> spec ED-AI-39 로 in-message candidate picker 가 도입되어, 워크스페이스에
+> 후보가 1건 이상 있으면 프런트 picker 가 UX 를 완결한다. LLM 의 한국어
+> mention 은 후보 목록이 비어있어 **사용자가 직접 Integration/LLM/KB/워크플로
+> 를 등록해야 하는 경우에만** 필요하다. 상세는
+> *workflow-assistant-candidate-picker.md (본 Rat
+
+... (truncated due to size limit) ...

```

---

### 파일 16: review/consistency/2026/05/16/08_22_34/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/_retry_state.json b/review/consistency/2026/05/16/08_22_34/_retry_state.json
new file mode 100644
index 00000000..ca62d151
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/user-guide-sync-4af69c/review/consistency/2026/05/16/08_22_34/naming_collision/review.md"
+    }
+  ],
+  "agents_pending": [],
+  "agents_success": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ],
+  "agents_fatal": [],
+  "agent_history": {
+    "cross_spec": [{"status": "success", "issues": 5}],
+    "rationale_continuity": [{"status": "success", "issues": 4}],
+    "convention_compliance": [{"status": "success", "issues": 6}],
+    "plan_coherence": [{"status": "success", "issues": 3}],
+    "naming_collision": [{"status": "success", "issues": 2}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}

```

---

### 파일 17: review/consistency/2026/05/16/08_22_34/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/convention_compliance/review.md b/review/consistency/2026/05/16/08_22_34/convention_compliance/review.md
new file mode 100644
index 00000000..7a58224d
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/convention_compliance/review.md
@@ -0,0 +1,77 @@
+# 정식 규약 준수 검토 결과
+
+검토 대상:
+- `spec/4-nodes/3-ai/0-common.md`
+- `spec/4-nodes/4-integration/4-cafe24.md`
+- `spec/5-system/5-expression-language.md`
+- `spec/conventions/conversation-thread.md`
+
+---
+
+### 발견사항
+
+---
+
+- **[INFO]** `spec/4-nodes/3-ai/0-common.md` — `## Rationale` 섹션 부재
+  - target 위치: 문서 전체 (§11 CHANGELOG 이전 어느 섹션에도 Rationale 없음)
+  - 위반 규약: `CLAUDE.md` 명명 컨벤션 표 — "`spec/<영역>/N-name.md` 본문 끝에 `## Rationale` 섹션을 권장"
+  - 상세: `0-common.md` 는 `0-` prefix(기술 아키텍처 개요/공통 규약 파일)로 분류되어 있으나 `N-name.md` 형식의 상세 spec 문서와 동일한 권장 사항이 해당된다. 문서에 설계 근거·선택지 비교 등의 Rationale 섹션이 없다.
+  - 제안: `## Rationale` 섹션을 CHANGELOG 앞에 추가. 예: multi-turn 차단 모드 선택 근거, 공통 wrapper(`output.result.*` / `output.error.*`) 채택 배경 등을 기재.
+
+---
+
+- **[INFO]** `spec/4-nodes/3-ai/0-common.md` — 섹션 번호 `§11`이 "CHANGELOG"인데 중간 번호와 미스매치 가능성
+  - target 위치: `## 11. CHANGELOG`
+  - 위반 규약: 해당 규약 없음 (정식 위반은 아님)
+  - 상세: §10 은 "Conversation Context"이고 그 다음이 §11 CHANGELOG 인데, 내용상 §10 신설로 기존 §10 이 §11 로 재번호된 점이 CHANGELOG 에는 기록되어 있으나 문서 본문에는 Overview 섹션이 없다. `0-common.md` 패턴 파일에는 전체 개요를 담는 `## Overview` 혹은 도입 설명 섹션이 사실상 없다.
+  - 제안: 권고 수준이므로 필요 시 문서 첫머리에 한 문단 Overview 를 두어 3섹션 구성(Overview / 본문 / Rationale)을 완성.
+
+---
+
+- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` — 출력 구조 섹션 번호 불연속 (`§5.1`, `§5.3`, `§5.8` — `§5.2`, `§5.4`~`§5.7` 누락)
+  - target 위치: `## 5. 출력 구조` 내부 (§5.1, §5.3, §5.8)
+  - 위반 규약: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리(성공 / 에러 / 재개 등)", 출력 예시 문서화 규칙. 정식 위반은 아니나 `N-name.md` 정렬 보장 컨벤션(`CLAUDE.md`) 정신에 어긋난다.
+  - 상세: §5.2 가 없고 §5.3 으로 바로 이동, §5.4~§5.7 은 공란이며 §5.8 이 "Pre-flight throw"다. 의도적 예비 번호 확보인지 삭제된 케이스의 잔재인지 불분명하여 독자가 누락 여부를 판단하기 어렵다. Principle 11 은 케이스별 분리를 요구하며, 번호 불연속은 문서 유지보수 시 혼란을 야기한다.
+  - 제안: §5.2 를 명시적으로 제거하거나 "Reserved" 주석을 달거나, 섹션 번호를 §5.1(성공) / §5.2(에러) / §5.3(Pre-flight) 으로 재번호화. 또는 CHANGELOG 에 섹션 번호 재배치 배경을 기재.
+
+---
+
+- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` — `§9.7` OAuth scope wire format 절이 `§9.8` 뒤에 내용이 위치
+  - target 위치: `### 9.7 OAuth scope wire format — 콤마 구분 (RFC 6749 예외)` (실제 내용 텍스트가 §9.8 이후 줄에 있음)
+  - 위반 규약: `CLAUDE.md` "N-name.md — 정렬 보장된 상세 spec 문서"
+  - 상세: 파일 내 §9.7 헤더 직후 본문이 없고, 본문이 §9.8 다음 줄(파일 말미)에 나타난다. 즉 §9.7 절의 내용이 §9.8 뒤에 실제로 배치되어 있어 섹션 순서가 어긋나 있다.
+  - 제안: §9.7 헤더 직후에 해당 OAuth scope wire format 본문을 이동하거나, §9.8 뒤의 본문을 §9.7 헤더 바로 아래로 재배치.
+
+---
+
+- **[INFO]** `spec/conventions/conversation-thread.md` — `§2.5 nextSeq 원자성` 절이 `## 3. 스코프 규칙` 안에 삽입되어 있음
+  - target 위치: `### 2.5 nextSeq 원자성` (파일 내 줄 326~338, `## 3. 스코프 규칙` 본문 중간에 위치)
+  - 위반 규약: `CLAUDE.md` "N-name.md — 정렬 보장" 및 문서 구조 권장
+  - 상세: §2.5 는 번호 기준으로 §2 (자동 누적 컨트랙트) 의 하위 절이어야 하지만, 파일 구조를 보면 §3 (스코프 규칙) 섹션의 §3.1~§3.3 이 모두 나온 뒤에 `### 2.5` 가 등장한다. 즉 §3 본문 안에 §2.5 가 끼어들어 있어 문서 섹션 순서가 2→3→2.5→4 가 된다.
+  - 제안: `### 2.5 nextSeq 원자성` 절을 `## 2` 섹션의 끝(§2.4 이후)으로 이동시켜 섹션 번호 순서를 복원.
+
+---
+
+- **[INFO]** `spec/5-system/5-expression-language.md` — `## Rationale` 섹션 부재
+  - target 위치: 문서 전체 (§8.5 보안 고려사항이 마지막 섹션)
+  - 위반 규약: `CLAUDE.md` — "`spec/<영역>/N-name.md` 본문 끝에 `## Rationale` 섹션을 권장"
+  - 상세: 표현식 언어는 여러 설계 선택(BNF 문법, 느슨한 타입 변환, strict 모드 opt-in, eval 금지, npm 패키지 분리 등)을 포함하고 있으나 이 결정들에 대한 Rationale/배경 섹션이 없다.
+  - 제안: 문서 말미에 `## Rationale` 섹션을 추가하여 설계 결정의 근거(예: eval 금지 이유, 자체 파서 선택, 타입 변환 느슨 모드 기본 채택 근거 등)를 기재.
+
+---
+
+- **[INFO]** `spec/conventions/conversation-thread.md` — conventions 파일임에도 `## 8. Rationale` 에 "본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다"는 위임 표현
+  - target 위치: `## 8. Rationale`
+  - 위반 규약: `CLAUDE.md` "정식 규약 (옛 user_memo CONVENTIONS) — `spec/conventions/<name>.md`". 단일 진실 원칙.
+  - 상세: conventions 문서가 Rationale 자체는 다른 문서(`spec/4-nodes/3-ai/1-ai-agent.md §12`)에 위임하고 있다. 이는 규약 위반은 아니지만 `spec/conventions/` 파일이 해당 규약의 단일 진실 공급원이어야 한다는 원칙과 긴장 관계에 있다. 독자가 컨벤션 파일을 읽으면서 설계 근거를 이해하려면 별도 문서를 참조해야 한다.
+  - 제안: 핵심 결정(예: push vs inject 분리, source 열거 이유, v1 ai_agent 만 적용한 이유)에 대한 1~2문장 요약을 §8 에 인라인으로 추가하고, 상세는 `ai-agent.md §12` 참조로 연결하는 방식을 권장. 단순 위임보다는 요약+참조 형식이 단일 진실 공급원 원칙에 더 부합.
+
+---
+
+### 요약
+
+4개 target 문서 모두 정식 규약(`spec/conventions/`)의 핵심 항목(노드 Output Principle, Cafe24 API Metadata, Conversation Thread 컨벤션)을 직접 위반하는 CRITICAL 이슈는 발견되지 않았다. 각 문서는 Principle 0~11 의 5필드 불변, output/meta/error 분리, config echo 규칙, `output.error.{code, message, details?}` envelope, 파일 명명(`0-common`, `N-name`, `conventions/*.md`) 등 핵심 규약을 올바르게 준수하고 있다. 다만 WARNING 1건(출력 섹션 번호 불연속), INFO 5건(Rationale 섹션 부재, 섹션 순서 이탈 2건, Rationale 위임 표현)이 발견되었으며, 이는 채택 시 다른 시스템 invariant 를 깨지는 않으나 문서 유지보수와 가독성 측면에서 개선이 권장된다.
+
+### 위험도
+
+LOW

```

---

### 파일 18: review/consistency/2026/05/16/08_22_34/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/cross_spec/review.md b/review/consistency/2026/05/16/08_22_34/cross_spec/review.md
new file mode 100644
index 00000000..45e24bf7
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/cross_spec/review.md
@@ -0,0 +1,61 @@
+# Cross-Spec 일관성 검토 결과
+
+검토 대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`
+
+검토 모드: `--impl-prep` (구현 착수 전 검토)
+
+---
+
+## 발견사항
+
+---
+
+- **[WARNING]** `$now.iso` 표현식 — Cafe24 spec 에서 정의되지 않은 멤버 접근
+  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI 예시 (`│ since [{{ $now.iso }}] │`), §5.1 출력 구조 예시 (`"since": "{{ $now.iso }}"`)
+  - 충돌 대상: `spec/5-system/5-expression-language.md` §4.1 — `$now` 를 `String` (ISO 8601, UTC) 으로 정의. 멤버 속성 없음
+  - 상세: 표현식 엔진에서 `$now` 는 `String` 스칼라값이다. `$now.iso` 는 문자열 위에 `.iso` 멤버 접근을 시도하므로 런타임에 `null` 또는 `undefined` 를 반환하거나 `EXPR_REFERENCE_ERROR` 를 발생시킨다. Cafe24 spec 예시는 "날짜 문자열을 얻는 방법"을 보여주기 위한 의도인 것으로 보이나, 올바른 표현식은 `{{ $now }}` (ISO 8601 문자열 그대로) 또는 `{{ formatDate($now, "YYYY-MM-DD") }}` 이다.
+  - 제안: Cafe24 spec §2 UI 예시 및 §5.1 출력 예시의 `{{ $now.iso }}` 를 `{{ $now }}` 로 수정. 또는 표현식 언어 spec §4.1 에 `$now` 가 단순 String 임을 명시적으로 재확인하는 주석을 추가.
+
+---
+
+- **[WARNING]** `$schedule` 참조 변수 — 표현식 언어 spec 변수 목록 누락
+  - target 위치: 직접 target 파일 아님 (간접 연관)
+  - 충돌 대상: `spec/5-system/5-expression-language.md` §4.1 변수 목록 vs `spec/1-data-model.md` §2.9 (`{{ $schedule.* }}` 제한 표현식), `spec/5-system/4-execution-engine.md` §6.2 Schedule 어댑터 (`{ $now, $schedule: { id, cronExpression, timezone } }` 제한 컨텍스트)
+  - 상세: `$schedule` 변수는 Schedule 파라미터 값 resolve 시 전용 제한 컨텍스트로 주입되어 사용된다. 그러나 `spec/5-system/5-expression-language.md` §4.1 의 내장 참조 변수 목록에는 `$schedule` 이 없다. 이 spec 을 구현하는 개발자가 `$schedule` 의 존재와 사용 범위(Schedule 파라미터 값에서만 허용, 워크플로 노드 config 에서는 불가)를 파악하지 못할 위험이 있다.
+  - 제안: `spec/5-system/5-expression-language.md` §4.1 에 `$schedule` 항목 추가. `적용 범위: Schedule.parameter_values 에서만 사용 가능. 워크플로 노드 config 에서는 미지원` 주석과 함께. 속성 `{ id, cronExpression, timezone }` 명시.
+
+---
+
+- **[WARNING]** `NodeExecution.interaction_data` 의 키 이름 — 컨벤션과 불일치
+  - target 위치: `spec/conventions/conversation-thread.md` §4 영속화, §1.4 `text` 변환 규칙 (간접 참조)
+  - 충돌 대상: `spec/1-data-model.md` §2.14 NodeExecution — `interaction_data JSONB?: { interactionType: "form_submitted" | "button_click" | "button_continue", buttonId?, buttonLabel?, clickedAt, clickedBy }` vs `spec/conventions/node-output.md` §4.4/4.5 — `output.interaction.type` (중첩 객체, `type` 키) vs `spec/conventions/conversation-thread.md` §4 — `output.interaction` (`interaction.type` 로 참조)
+  - 상세: `spec/1-data-model.md` 의 `interaction_data` 는 `interactionType` (flat, camelCase) 키를 사용하고 `clickedAt`, `clickedBy` 필드를 포함하는 반면, CONVENTIONS (`node-output.md`) 와 실행 엔진은 `output.interaction.type` (중첩 객체) / `output.interaction.data` / `output.interaction.receivedAt` 구조를 SoT 로 정의한다. `conversation-thread.md` §4 영속화 절도 `output.interaction` 을 SoT 로 명시하며 `interaction_data` 컬럼과의 매핑 관계를 설명하지 않는다. 구현 시 DB 컬럼 `interaction_data` 의 JSON shape 를 `output.interaction` shape 와 어떻게 매핑할지 혼란을 줄 수 있다.
+  - 제안: `spec/1-data-model.md` §2.14 의 `interaction_data` 설명에 "저장 형식은 `output.interaction` 의 `{ type, data, receivedAt }` 구조를 그대로 보존 (CONVENTIONS §4.4/4.5 참조)" 를 명시하거나, flat `interactionType` 형식과 중첩 `interaction.type` 형식의 관계(DB 저장 포맷 vs 런타임 객체 포맷)를 명시적으로 기술.
+
+---
+
+- **[INFO]** `conversation-thread.md` §7 v2 로드맵의 `STORAGE_MAX_TURNS=500` 참조 — 구현 상수 정의 위치 불명확
+  - target 위치: `spec/conventions/conversation-thread.md` §7 v2 로드맵 (`§STORAGE_MAX_TURNS=500 은 LRU style FIFO drop`)
+  - 충돌 대상: `spec/5-system/4-execution-engine.md` — STORAGE_MAX_TURNS 상수 언급 없음
+  - 상세: `STORAGE_MAX_TURNS=500` 이 v2 로드맵에 등장하나 해당 상수가 어느 파일/모듈에서 정의되어야 하는지 명시되지 않음. 구현 착수 시 실행 엔진 spec 에도 같은 cap 상수를 등록해야 할지 판단이 필요. v2 항목이므로 v1 구현 차단은 아니지만 일관성 관리를 위해 위치를 명시하는 것이 좋음.
+  - 제안: `spec/5-system/4-execution-engine.md` 또는 `spec/conventions/conversation-thread.md` 중 한 곳에 `STORAGE_MAX_TURNS` 상수를 v1 cap 상수들(`MAX_INJECTED_TURNS`, `MAX_TURN_TEXT_CHARS`, `MAX_INJECTED_CHARS`) 과 동일 표로 통합 관리.
+
+---
+
+- **[INFO]** `spec/4-nodes/3-ai/0-common.md` §10 과 `spec/conventions/conversation-thread.md` — 동일 `contextScope` 필드 표가 두 곳에 중복 정의
+  - target 위치: `spec/4-nodes/3-ai/0-common.md` §10 Conversation Context 필드 테이블 (5개 필드: `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`)
+  - 충돌 대상: `spec/conventions/conversation-thread.md` §5 AI Agent 자동 주입 (동일 5개 필드의 타입·기본값 표)
+  - 상세: 두 문서 간 타입·기본값 정의가 현재는 일치하지만, 두 곳이 독립적으로 관리되어 향후 한쪽만 갱신될 위험이 있다. `0-common.md` §10 은 노드 설정 관점의 요약, `conversation-thread.md` §5 는 단일 진실 공급원으로 명시되어 있으나 양쪽 모두 필드 테이블을 갖는다.
+  - 제안: 현재 정합성은 유지되고 있으므로 즉각 수정 불필요. 다만 향후 필드 변경 시 두 문서를 반드시 동시 갱신하도록 `0-common.md` §10 의 필드 표 위에 "단일 진실: `spec/conventions/conversation-thread.md` §5" 명시적 노트 추가 권장.
+
+---
+
+## 요약
+
+Cross-Spec 일관성 관점에서 CRITICAL 충돌은 없다. 가장 주요한 발견사항은 `spec/4-nodes/4-integration/4-cafe24.md` 의 UI/출력 예시에서 사용된 `{{ $now.iso }}` 표현식이 `spec/5-system/5-expression-language.md` 에서 정의한 `$now: String` 타입과 모순된다는 점(WARNING)이다. 구현 코드 작성 시 이 표현식을 그대로 따르면 런타임 오류가 발생하므로 어느 쪽을 수정할지 결정이 필요하다. 두 번째 WARNING 은 Schedule 파라미터에서만 허용되는 `$schedule` 변수가 표현식 언어 spec 의 변수 목록에 누락되어 있다는 점이다. 나머지 두 항목은 데이터 모델의 `interaction_data` 키 명명 비일관성(구현 시 매핑 혼란 가능)과 cap 상수 위치 불명확(v2 해당)에 관한 INFO 수준의 동기화 권장 사항이다.
+
+---
+
+## 위험도
+
+MEDIUM

```

---

### 파일 19: review/consistency/2026/05/16/08_22_34/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/meta.json b/review/consistency/2026/05/16/08_22_34/meta.json
new file mode 100644
index 00000000..de653a90
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T08:22:34.351061",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md)",
+  "target_path": "spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 20: review/consistency/2026/05/16/08_22_34/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/naming_collision/review.md b/review/consistency/2026/05/16/08_22_34/naming_collision/review.md
new file mode 100644
index 00000000..4f9dc4af
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/naming_collision/review.md
@@ -0,0 +1,32 @@
+# 신규 식별자 충돌 검토 (naming_collision)
+
+검토 모드: `--impl-prep`
+대상 스코프: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`
+
+---
+
+## 발견사항
+
+### [INFO] `ConversationThread.id = "default"` 값과 Edge port 예약어 `"default"` 의 namespace 혼동 가능성
+- **target 신규 식별자**: `ConversationThread.id` — 고정값 `"default"` (v1 single-thread)
+- **기존 사용처**: `spec/1-data-model.md §2.7 Edge.source_port` 및 `spec/3-workflow-editor/2-edge.md` 에서 포트 예약어 `"default"` 가 출력 포트 기본값으로 사용됨
+- **상세**: `spec/conventions/conversation-thread.md §1.3` 는 이미 "port 예약어 `'default'` 와 무관 — namespace 분리. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장" 이라고 명시한다. 두 `"default"` 는 서로 다른 도메인(thread ID vs. port 이름)에 속하며 런타임 충돌은 없다. 단, 사용자 매뉴얼(MDX)에서 `$thread` 변수를 설명할 때 port `"default"` 와의 의미 차이를 독자가 혼동하지 않도록 문맥을 분리하는 것이 바람직하다.
+- **제안**: MDX docs 에 `$thread` 소개 시 "thread ID `default`" 라는 내부 구현 상세는 노출하지 않고 변수 접근 방법(`.turns` / `.length` / `.text`)만 설명하면 충분. spec 레벨의 명세는 이미 정합되어 있으므로 spec 변경 불필요.
+
+---
+
+### [INFO] `application.ts` Cafe24 메타데이터 파일명과 Cafe24 OAuth `app_type` 개념의 혼동 가능성
+- **target 신규 식별자**: `backend/src/nodes/integration/cafe24/metadata/application.ts` — Cafe24 "앱 관리 API" 카테고리의 Operation 메타데이터 파일
+- **기존 사용처**: `spec/1-data-model.md §2.10 Integration.credentials` 의 `app_type` (public / private), `spec/2-navigation/4-integration.md §5.8` 의 Cafe24 Private App 등록 흐름에서 "application" / "앱" 용어가 반복 사용됨
+- **상세**: `spec/conventions/cafe24-api-metadata.md §1` 이 이미 "⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의" 라고 명시해 선제적으로 경고하고 있다. 런타임 충돌은 없으며 spec 차원에서도 이미 인지·문서화된 상태이다.
+- **제안**: 기존 spec 주의 표기로 충분. 개발자가 `application.ts` 파일명이 OAuth app 등록과 무관함을 코드 주석으로도 명시하면 혼동이 줄어든다. spec 수정 불필요.
+
+---
+
+## 요약
+
+이번 구현 착수 전 검토(`--impl-prep`) 의 대상은 기존 spec 파일 4종을 1차 소스로 삼아 MDX 사용자 매뉴얼을 보강하는 작업이다. target 문서 자체에 신규 식별자 내용이 없으며(`(없음)` 표기), 보강에 사용될 식별자(`contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` / `$thread` 변수 및 하위 속성 / `ConversationTurnSource` · `ConversationTurn` · `ConversationThread` 타입 / Cafe24 노드)는 모두 spec 에서 일관되게 정의되어 있고 기존 사용처와 의미 충돌이 없다. `ConversationThread.id = "default"` 와 Edge port 예약어 `"default"`, `application.ts` 와 OAuth app 개념의 잠재 혼동은 spec 자체에서 이미 명시적으로 경고·분리되어 있다. 구현을 차단할 CRITICAL·WARNING 수준의 식별자 충돌은 발견되지 않았다.
+
+## 위험도
+
+NONE

```

---

### 파일 21: review/consistency/2026/05/16/08_22_34/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/plan_coherence/review.md b/review/consistency/2026/05/16/08_22_34/plan_coherence/review.md
new file mode 100644
index 00000000..402c1294
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/plan_coherence/review.md
@@ -0,0 +1,44 @@
+# Plan 정합성 Check — user-guide-sync-2026-05-16
+
+검토 모드: `--impl-prep`
+Target 파일: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`
+Target plan: `plan/in-progress/user-guide-sync-2026-05-16.md` (worktree: `user-guide-sync-4af69c`)
+
+---
+
+## 발견사항
+
+### 1 — [INFO] `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신이 아직 미완 — MDX 가 갱신 전 상태 기준으로 작성됨
+
+- **target 위치**: `user-guide-sync-2026-05-16.md` §작업 범위, "integrations.mdx — Cafe24 노드 섹션 추가" — 소스로 `spec/4-nodes/4-integration/4-cafe24.md` 를 명시
+- **관련 plan**: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — 미체크 항목 `[ ] spec 갱신` 에 "`spec/4-nodes/4-integration/4-cafe24.md §9.4` 의 install_token 소거 표기 갱신" 포함
+- **상세**: user-guide-sync 는 이미 모든 태스크를 완료(`[x]`)한 상태이므로 작업 자체의 직접 충돌은 없다. 그러나 `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신이 완료되어 `spec/4-nodes/4-integration/4-cafe24.md §9.4` 가 변경되면, user-guide-sync 가 작성한 `integrations.mdx` 내 install_token 관련 내용이 즉시 stale 해질 수 있다. `cafe24-app-url-reuse-f9a2e3` worktree 는 현재 존재하지 않으므로 병렬 직접 충돌은 아님.
+- **제안**: `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신 완료 후, `integrations.mdx` Cafe24 섹션의 install_token 관련 표현이 새 spec 과 일치하는지 확인하는 후속 태스크를 해당 plan 에 추가한다.
+
+---
+
+### 2 — [INFO] `conversation-thread.md` plan 에 미체크 항목이 하나 남아 있으나 `plan/in-progress/` 에 유지 중
+
+- **target 위치**: N/A (user-guide-sync 의 spec 소스 파일들 — `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`)
+- **관련 plan**: `plan/in-progress/conversation-thread.md` (worktree: `conversation-thread-e509c5`, 이미 PR #17 merge 완료) — 미체크 항목: `[ ] (follow-up) tool turn opt-in push (includeToolTurns: true)` (코드 작업, spec 변경 없음)
+- **상세**: `conversation-thread-e509c5` worktree 는 이미 정리되어 없고, 위 세 spec 파일에 대한 모든 spec 작업은 `[x]` 완료 상태이다. user-guide-sync 가 이 spec 파일들을 읽기 전용 소스로 사용하는 것에 대한 충돌은 없다. 남은 미체크 항목은 순수 백엔드 코드 작업이므로 spec 정합성에 영향이 없다. 추적 관점에서, 해당 follow-up 이 완료되면 `conversation-thread.md` 를 `plan/complete/` 로 이동하면 된다.
+- **제안**: user-guide-sync 관점에서 별도 조치 불필요. `conversation-thread.md` 담당자가 tool turn opt-in push 완료 시 `plan/complete/` 로 이동.
+
+---
+
+### 3 — [INFO] `ai-agent-tool-connection-rewrite.md` 의 미해결 디자인 결정이 user-guide-sync 와 무관하게 격리됨을 확인
+
+- **target 위치**: `user-guide-sync-2026-05-16.md` §의도적 제외 — "AI Agent 도구 연결 UX 갱신은 `ai-agent-tool-connection-rewrite` plan 에서 별도 처리"
+- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — §1 디자인 결정 전체가 미해결 TBD(도구 등록 모델, 시그니처 위치, 실행 컨텍스트, 결과 라우팅, ND-AG-21 우선순위). 해당 plan 은 `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/3-workflow-editor/0-canvas.md` 등을 대상으로 하며, user-guide-sync 의 target 파일인 `spec/4-nodes/3-ai/0-common.md` 에 대한 쓰기 계획이 없음.
+- **상세**: 명시적 제외 선언으로 충돌 위험이 이미 관리되고 있다. `spec/4-nodes/3-ai/0-common.md` 는 user-guide-sync 에서 읽기 전용이며 `ai-agent-tool-connection-rewrite.md` 의 spec 작업 범위에도 해당 파일이 포함되지 않는다.
+- **제안**: 현 상태 유지. 다만 `ai-agent-tool-connection-rewrite.md` 가 `spec/4-nodes/3-ai/0-common.md` 에 변경을 가져올 경우 user-guide-sync 가 작성한 `ai.mdx` 의 Conversation Context 섹션이 갱신이 필요할 수 있다. 해당 plan 진행 시 MDX 갱신 후속 태스크를 추가 권장.
+
+---
+
+## 요약
+
+`user-guide-sync-2026-05-16.md` 가 참조하는 네 개의 spec 파일에 대해 plan/in-progress 문서와의 충돌을 검토한 결과, CRITICAL·WARNING 수준의 이슈는 발견되지 않았다. target plan 은 이미 모든 태스크를 완료한 상태이며, 네 spec 파일 모두에 대해 쓰기가 아닌 읽기 전용 소스로 사용하고 있다. `spec-update-cafe24-app-url-reuse.md` 가 `spec/4-nodes/4-integration/4-cafe24.md §9.4` 를 갱신하면 이미 작성된 MDX 내용이 stale 해질 수 있으나, 해당 worktree 가 현재 비활성 상태이고 영향 범위가 §9.4 의 install_token 소거 표기로 한정되어 있어 INFO 로 분류한다. `conversation-thread.md` 의 미체크 항목은 순수 코드 작업으로 spec 정합성에 영향 없다.
+
+## 위험도
+
+LOW

```

---

### 파일 22: review/consistency/2026/05/16/08_22_34/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/rationale_continuity/review.md b/review/consistency/2026/05/16/08_22_34/rationale_continuity/review.md
new file mode 100644
index 00000000..de5776e1
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/rationale_continuity/review.md
@@ -0,0 +1,44 @@
+# Rationale 연속성 검토
+
+검토 모드: 구현 착수 전 (--impl-prep)
+대상 문서: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`
+
+---
+
+## 발견사항
+
+- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md §9.8` — install_token mismatch 회복 분기 미반영
+  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "Private 앱 App URL HMAC 검증" 식별 전략 단락
+  - 과거 결정 출처: Rationale 발췌 — "Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)" 항 (prompt_file 193~214행). `spec/2-navigation/4-integration.md ## Rationale` 동 항목.
+  - 상세: Rationale 발췌에는 직접 매칭 실패 시 회복 분기(같은 mall_id 의 row 들에 대해 각 row 의 client_secret 으로 HMAC trial 검증, O(N) 이지만 404 fallback only + workspace-scoped N=1 실무값)가 정식 결정으로 기록되어 있다. 이 회복 분기는 운영 사용자 보고("여러 번 폼 제출 → 옛 URL stale → 404 UX 단절")에서 비롯된 것으로 신규 요구사항이다. 그러나 target 문서 §9.8의 식별 전략 단락은 "단일 row 조회 + 1회 HMAC 검증"만 기술하고, 이 회복 경로 및 HTML 에러 페이지 렌더 동작을 전혀 언급하지 않는다. 구현자가 §9.8만 보면 회복 분기를 빠뜨릴 수 있다.
+  - 제안: §9.8에 "install_token 직접 매칭 실패 시 회복 경로" 단락을 추가한다. 정상 흐름(단일 row 조회 + 1회 HMAC) → 실패 시 회복 분기(같은 mall_id row들에 대해 HMAC trial, 정확히 1개 통과 시 fallthrough, 0개 또는 2개+ 시 404 + HTML 에러 페이지)의 두 단계 흐름과, 회복 분기의 보안 분석(HMAC 위조에는 client_secret 필요, 추가 권한 부여 없음), TOCTOU 미발생(read-only 조회) 근거를 명시한다. 이미 `spec/2-navigation/4-integration.md ## Rationale`에 상세 기술이 있으므로 cross-reference로 처리해도 무방하나, §9.8 자체에 흐름 요약이 있어야 구현자가 빠뜨리지 않는다.
+
+- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 4` — 회복 분기 미언급으로 흐름 불완전
+  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.4 "Private 앱 연동 흐름 요약" step 4
+  - 과거 결정 출처: 동 Rationale "Cafe24 install_token mismatch 회복 흐름" 항
+  - 상세: §9.4 step 4는 "path 의 install_token 으로 Integration 단일 row 조회 → HMAC 1회 검증"만 기술한다. Rationale 에 기록된 회복 분기(직접 매칭 실패 → 회복 경로)는 step 4의 정상 흐름 다음 단계로 존재하는데, §9.4에서 완전히 누락되어 있다. 결과적으로 §9.4 흐름도와 §9.8 식별 전략이 각각 "회복 없는 단순 404" 를 기술하는 형태가 된다.
+  - 제안: §9.4 step 4 또는 그 바로 뒤에 "install_token 미매칭 시 회복 경로: §9.8 참조" 한 줄을 추가한다.
+
+- **[INFO]** `spec/conventions/conversation-thread.md §8` — Rationale 위치 위임 명시만 있고 내용 없음 (설계상 의도된 형태이나 검토자 주의 필요)
+  - target 위치: `spec/conventions/conversation-thread.md §8 Rationale`
+  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12` Rationale (도입 동기·선택지·v1/v2 경계·conversationHistory 제거 사유)
+  - 상세: `conversation-thread.md §8`은 "설계 결정의 근거는 AI Agent §12 Rationale 에 단일 인라인"이라고 위임만 선언한다. 이것은 의도된 설계(단일 진실 원칙)이므로 CRITICAL/WARNING 이 아니다. 다만 구현자가 `conversation-thread.md` 만 보다가 Rationale 에 접근하지 않는 실수가 발생할 수 있다. 추가 강조가 있으면 좋다.
+  - 제안: §8에 AI Agent §12 직링크를 명시하거나, `conversationHistory` 폐기 및 `contextScope` 대체 결정의 핵심 한 줄 요약만 inline 추가를 고려할 수 있다. 강제 사항은 아님.
+
+- **[INFO]** `spec/5-system/5-expression-language.md §4.4` — `$thread.text` lazy 평가 검토 항이 명시적으로 v2 로드맵에만 있어 v1 성능 주의 사항 미기재
+  - target 위치: `spec/5-system/5-expression-language.md §4.4 $thread 속성`
+  - 과거 결정 출처: `spec/conventions/conversation-thread.md §7 v2 로드맵` — "`$thread.text` lazy 평가: 현재 `buildExpressionContext` 가 호출마다 전체 thread 를 system_text 로 즉시 렌더 (성능 hot path)..."
+  - 상세: `conversation-thread.md`의 v2 로드맵에 `$thread.text` 의 eager 렌더링이 성능 hot path 임이 기록되어 있다. `expression-language.md §4.4` 는 `$thread.text`의 의미(system_text 렌더 결과)만 기술하고 이 주의 사항을 언급하지 않는다. 구현자가 `$thread.text` 를 루프나 고빈도 호출 경로에서 사용할 때 성능 위험을 인지하지 못할 수 있다.
+  - 제안: §4.4 `$thread.text` 항에 "주의: `$thread.text` 는 호출마다 전체 thread 를 즉시 렌더하므로 루프·고빈도 경로에서의 남용 자제. 자세한 배경은 [Spec Conversation Thread §7 v2 로드맵](../conventions/conversation-thread.md#7-v2-로드맵)" 노트를 추가한다.
+
+---
+
+## 요약
+
+target 문서 4개 전체에서 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다. `conversationHistory` / `historyCount` 필드는 target 문서에 존재하지 않으며 `contextScope` / `contextScopeN` 으로 완전 대체되어 있다. install_token 식별 전략도 "단일 row 조회 + 1회 HMAC"으로 올바르게 기술되어 있고, 폐기된 "100건 mall_id 스캔 + trial HMAC" 방식의 재도입은 없다. 다만 `spec/4-nodes/4-integration/4-cafe24.md §9.8`에 2026-05-15 후속 결정으로 도입된 "install_token mismatch 회복 분기"가 미반영되어 있어 WARNING 이다. 이 회복 분기는 `spec/2-navigation/4-integration.md ## Rationale`에는 기록되어 있으나 cafe24 노드 spec 본문에는 반영되지 않아, 구현자가 §9.8 만 보면 회복 경로를 누락할 수 있다. 나머지 2건은 문서 완성도 보완 수준의 INFO이다.
+
+---
+
+## 위험도
+
+LOW

```
