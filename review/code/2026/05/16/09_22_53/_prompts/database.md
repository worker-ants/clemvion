# 데이터베이스(Database) Review Payload

본 파일은 orchestrator 가 데이터베이스(Database) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 데이터베이스 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

> 변경 코드가 본 reviewer 의 영역과 무관하면 "해당 없음" 으로 응답하고
> 위험도를 NONE 으로 설정해 `STATUS=success ISSUES=0` 으로 반환합니다.

## 점검 관점 (데이터베이스(Database))

1. **인덱스**: 쿼리에 적절한 인덱스 사용·누락 가능성
2. **N+1 쿼리**: 반복문 내 개별 쿼리 실행 N+1 문제
3. **트랜잭션**: 데이터 정합성을 위한 트랜잭션 사용 적절성
4. **마이그레이션 안전성**: 스키마 변경이 무중단 배포에 안전한지 (lock, 데이터 손실)
5. **스키마 설계**: 테이블 구조·관계·정규화/비정규화 적절성
6. **커넥션 관리**: 커넥션 풀 사용·적절한 해제
7. **SQL 인젝션** (DB 특화 관점): 파라미터화된 쿼리 사용 여부
8. **대량 데이터**: 대용량 테이블에서의 쿼리 성능·페이지네이션

## 리뷰 대상 파일

### 파일 1: Makefile
- 변경 유형: Review
- 언어: 

#### 변경된 코드
```
diff --git a/Makefile b/Makefile
index 5507b19b..f2070e7e 100644
--- a/Makefile
+++ b/Makefile
@@ -14,8 +14,12 @@ help:
 	@echo "  e2e-test       backend e2e (supertest) 1-shot — 끝나면 자동 down"
 	@echo "  e2e-test-full  backend + playwright 까지 — 끝나면 자동 down"
 
+# `--build` 는 source 변경 후 stale 이미지 사용을 방지한다. Docker BuildKit
+# layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 부담은 작다.
+# 누락 시 새로 추가한 controller / 라우트가 컨테이너에 반영되지 않아 e2e 가
+# 사일런트하게 404 로 실패한다 (예: 2026-05-15 background-monitoring 사전 결함).
 e2e-up:
-	$(COMPOSE_E2E) up -d --wait backend-e2e
+	$(COMPOSE_E2E) up -d --wait --build backend-e2e
 
 e2e-down:
 	$(COMPOSE_E2E) down -v --remove-orphans
@@ -24,12 +28,12 @@ e2e-down:
 # `--abort-on-container-exit` 패턴은 Docker Desktop 의 network race 와 충돌하는
 # 사례가 있어 분리. 실패하더라도 후속 e2e-down 이 실행되도록 `; STATUS=$$?` 패턴 사용.
 e2e-test:
-	$(COMPOSE_E2E) up -d --wait backend-e2e
-	$(COMPOSE_E2E) run --rm backend-e2e-runner; STATUS=$$?; \
+	$(COMPOSE_E2E) up -d --wait --build backend-e2e
+	$(COMPOSE_E2E) run --rm --build backend-e2e-runner; STATUS=$$?; \
 	$(MAKE) e2e-down; exit $$STATUS
 
 e2e-test-full:
-	$(COMPOSE_E2E) up -d --wait backend-e2e
-	$(COMPOSE_E2E) run --rm backend-e2e-runner && \
-	  $(COMPOSE_E2E) run --rm playwright-runner; STATUS=$$?; \
+	$(COMPOSE_E2E) up -d --wait --build backend-e2e
+	$(COMPOSE_E2E) run --rm --build backend-e2e-runner && \
+	  $(COMPOSE_E2E) run --rm --build playwright-runner; STATUS=$$?; \
 	$(MAKE) e2e-down; exit $$STATUS

```

---

### 파일 2: backend/src/modules/integrations/third-party-oauth.controller.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/third-party-oauth.controller.spec.ts b/backend/src/modules/integrations/third-party-oauth.controller.spec.ts
index 0249d57a..49190f1a 100644
--- a/backend/src/modules/integrations/third-party-oauth.controller.spec.ts
+++ b/backend/src/modules/integrations/third-party-oauth.controller.spec.ts
@@ -425,9 +425,10 @@ describe('ThirdPartyOAuthController — cafe24 install routes', () => {
       res as never,
     );
     expect(res.statusCode).toBe(404);
-    const contentType = (res as { headers?: Record<string, unknown> })
-      .headers?.['Content-Type'];
-    expect(String(contentType ?? '')).toContain('text/html');
+    const contentType = (res as { headers?: Record<string, string> }).headers?.[
+      'Content-Type'
+    ];
+    expect(contentType ?? '').toContain('text/html');
     const bodyStr = String(res.body);
     expect(bodyStr).toContain('CAFE24_INSTALL_INVALID_TOKEN');
     expect(bodyStr).toContain('token gone');

```

---

### 파일 3: plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md b/plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md
new file mode 100644
index 00000000..6b471e85
--- /dev/null
+++ b/plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md
@@ -0,0 +1,49 @@
+---
+worktree: bg-monitoring-e2e-fix-f789b9
+started: 2026-05-16
+owner: developer
+---
+
+# `make e2e-test` Stale Docker Image — Background 모니터링 e2e 사전 결함 (2026-05-16)
+
+## 배경
+
+`background-monitoring.e2e-spec.ts` 의 2 테스트가 main 브랜치에서 reproducible 하게 실패. 사용자 보고 (user-guide-sync 작업의 REVIEW WORKFLOW 단계 e2e 결과) 후 본 worktree 에서 별도 조사.
+
+## 근본 원인 (Root Cause)
+
+`Makefile` 의 `e2e-test` / `e2e-up` / `e2e-test-full` 타겟이 `docker compose ... up -d --wait backend-e2e` 만 호출하고 **`--build` 플래그를 누락**했다. 결과:
+
+1. 첫 e2e 실행 후 `clemvion-e2e-backend-e2e:latest` 이미지가 Docker daemon 에 캐시됨.
+2. 이후 backend 소스 (controller / module / route) 가 추가·수정되어도 Compose 가 캐시된 이미지를 재사용 — rebuild 없이 그대로 컨테이너 기동.
+3. 새 컨트롤러가 이미지 안 `dist/` 에 없으므로 NestJS RoutesResolver 가 등록조차 하지 않고, 외부 요청은 Express 의 `Cannot GET ...` 404 로 떨어진다.
+
+### 증거
+
+- `docker inspect clemvion-e2e-backend-e2e:latest --format '{{.Created}}'` → `2026-05-12T10:21:35Z`.
+- `BackgroundRunsController` 추가 커밋 `cd7603df feat(executions): Background 본문 모니터링 API` → 5월 14-15일.
+- 빈 stale 이미지의 컨테이너 startup log 에서 `RoutesResolver` 등록 controller 26개 (소스 28개) — `BackgroundRunsController` 와 `ThirdPartyOAuthController` 누락.
+- `docker compose -f docker-compose.e2e.yml build backend-e2e` 후 동일 `make e2e-test` 실행 → 12/12 suites, 66/66 tests PASS.
+
+## 작업 범위
+
+- [x] `Makefile` 의 `e2e-up`, `e2e-test`, `e2e-test-full` 타겟에 `--build` 플래그 추가 — `up -d --wait --build backend-e2e`, `run --rm --build backend-e2e-runner`, `run --rm --build playwright-runner`. WHY: Docker BuildKit layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 오버헤드는 작음. 누락 시 새로 추가한 controller 가 stale 이미지에 반영되지 않아 사일런트 404.
+- [x] 사전 결함 lint error 동반 수정 — `third-party-oauth.controller.spec.ts` L428~430 의 `Record<string, unknown>` 타입을 `Record<string, string>` 로 좁혀 `@typescript-eslint/no-base-to-string` 위반 해소.
+- [x] consistency-check --impl-prep
+
+## 의도적 제외
+
+- **BackgroundRunsController / ThirdPartyOAuthController 로직 변경** — 코드 자체에는 문제 없음. stale 이미지가 유일한 원인.
+- **CI workflow 변경** — CI 는 매번 fresh container 라 영향 없음 (docker layer cache 도 사용량 한도까지).
+
+## 후속
+
+- 이 fix 이후 `make e2e-test` 가 매번 `docker compose ... up --build` 를 실행 → BuildKit layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 부담 작음.
+- (선택) `.github/workflows/*` 가 `make e2e-test` 를 그대로 호출하는지 확인. CI 는 매 실행 fresh runner 라 영향 없지만 의존성 명시 차원.
+
+## 체크리스트
+
+- [x] consistency-check
+- [x] 구현 (Makefile 수정 + 동반 lint fix)
+- [x] TEST WORKFLOW — backend lint(error 0)·unit(3580/3580 PASS)·build·e2e(`make e2e-test` 12/12 suites, 66/66 tests)
+- [ ] REVIEW WORKFLOW

```

---

### 파일 4: review/consistency/2026/05/16/09_13_51/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/SUMMARY.md b/review/consistency/2026/05/16/09_13_51/SUMMARY.md
new file mode 100644
index 00000000..d9db21cf
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/SUMMARY.md
@@ -0,0 +1,30 @@
+BLOCK: NO
+
+# Consistency Check 통합 보고서
+
+세션: `review/consistency/2026/05/16/09_13_51`
+모드: `--impl-prep`
+대상: `Makefile`, `docker-compose.e2e.yml`
+호출자: developer (bg-monitoring-e2e-fix-f789b9 worktree)
+
+## 결론
+
+Critical 0건. 구현 착수 가능. plan_coherence checker 의 정당한 지적(체크박스 사전 `[x]` 표기) 은 plan 문서를 `[ ]` 로 되돌려 즉시 해소함.
+
+## Checker 별
+
+| Checker | issues | 위험도 |
+|---|---|---|
+| cross_spec | 0 | NONE |
+| rationale_continuity | 4 | LOW (자동/수동 빌드 관련 정합성 노트) |
+| convention_compliance | 1 | LOW (스타일 변경 1건) |
+| plan_coherence | 3 | LOW (체크박스 사전 표기 — 즉시 해소) |
+| naming_collision | 0 | NONE |
+
+## 즉시 조치 완료
+
+- **plan_coherence W1**: plan 의 작업 체크박스 `[x]` → `[ ]` 로 되돌림. 구현·테스트·리뷰 단계 종료 시점에 순서대로 갱신.
+
+## 진행
+
+`Makefile` 의 `e2e-up`, `e2e-test`, `e2e-test-full` 에 `--build` 플래그 추가 구현 진입.

```

---

### 파일 5: review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md b/review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md
new file mode 100644
index 00000000..3d10e2a3
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md
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
+구현 착수 전 검토 (--impl-prep, scope=Makefile,docker-compose.e2e.yml)
+
+## Target 문서
+경로: `Makefile,docker-compose.e2e.yml`
+
+```
+### 구현 대상 영역: `Makefile,docker-compose.e2e.yml`
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

### 파일 6: review/consistency/2026/05/16/09_13_51/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 7: review/consistency/2026/05/16/09_13_51/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 8: review/consistency/2026/05/16/09_13_51/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/_prompts/plan_coherence.md b/review/consistency/2026/05/16/09_13_51/_prompts/plan_coherence.md
new file mode 100644
index 00000000..8197ab62
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/_prompts/plan_coherence.md
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
+구현 착수 전 검토 (--impl-prep, scope=Makefile,docker-compose.e2e.yml)
+
+## Target 문서
+경로: `Makefile,docker-compose.e2e.yml`
+
+```
+### 구현 대상 영역: `Makefile,docker-compose.e2e.yml`
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
+1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
+2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
+2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
+3. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
+4. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
+5. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
+6. **`2fa-webauthn.md`** — WebAuthn 2FA.
+7. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
+8. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
+9. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).
+
+> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.
+
+### 최근 완료
+
+- ✅ **`prd-spec-sync.md`** (2026-05-11, `plan/complete/prd-spec-sync.md`) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 (knowledge-base.mdx 한·영) 정합화.
+- ✅ **`logic-node-followups.md`** (2026-05-11, `plan/complete/logic-node-followups.md`) — D1 If/Else `is_type`/`regex` evaluator 통합 ✅, D2 Loop breakCondition + meta.exitReason ✅, D3 Merge P2 → 별도 plan (`merge-p2-async-fanin.md`) 분리 ✅, D4 Switch `meta.value` alias 제거 + 마이그레이션 ✅, D5 Variable Modification recordValues opt-in + 마스킹 유틸 ✅, D6 보류 ✅, D7 case id reserved word 검증 ✅. spec/4-nodes/1-logic 의 P0/P1 미구현 표기 모두 정리 (Merge dormant 표기는 별도 plan 분리에 따른 의도적 잔존).
+- ✅ **`llm-provider-followups.md`** (2026-05-11, `plan/complete/llm-provider-followups.md`) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅. `AzureOpenAIClient`·`LocalClient` 가 `OpenAIClient.stream()` 을 상속하여 자동 지원. spec 2종(7-llm-client.md §8.2, 4-ai-assistant.md §1.2/§11/§13/§15) 🚧·❌→✅, PRD 0 §6.1, 매뉴얼 4종(llm-config.mdx 한·영 + overview.mdx 한·영) 정합화.
+
+---
+
+## 카테고리별 미구현 항목 매핑
+
+### A. 제품 기능 (사용자 가치 큰 기능)
+
+| PRD/Spec 항목 | 상태 | 처리 plan |
+|---------------|------|-----------|
+| **PRD 1 §3.9 NAV-MP-01~07 Marketplace** | ❌ 전체 미구현 (i18n 사전에만 등장) | `marketplace-and-plugin-sdk.md` |
+| **PRD 4 §4 MP-CT/CS/PB-***| ❌ 전체 미구현 | `marketplace-and-plugin-sdk.md` |
+| **PRD 3 §10 ND-EX-01~03 노드 확장성 SDK** | ❌ 우선순위 3 | `marketplace-and-plugin-sdk.md` |
+| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ | `marketplace-and-plugin-sdk.md` |
+| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) | `marketplace-and-plugin-sdk.md` |
+| **PRD 3 §6.1 ND-AG-06/10/21 AI Agent 도구 연결** | 🚧 의도적 제거, 재작성 예정 | `ai-agent-tool-connection-rewrite.md` |
+| **PRD 3 §4.9 ND-PL-03 Parallel 결과 합산 / 중첩 Parallel / waitAll=false** | 🚧 P2 예정 | `parallel-p2.md` |
+| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | ✅ 활성화 (D2, meta.exitReason 추가) | `complete/logic-node-followups.md` |
+| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | ✅ 구현 (D1, evaluator 통합) | `complete/logic-node-followups.md` |
+| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | ✅ 핸들러 구현 + spec 정합 (PR-1) | `complete/logic-node-followups.md` |
+| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod meta** | ✅ 핸들러 구현 + recordValues opt-in (D5) | `complete/logic-node-followups.md` |
+| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
+| **Spec 4-nodes/1-logic/12-background 모니터링 API** | ❌ 미구현 (`meta.backgroundRunId` 키만 발급) | `background-monitoring-api.md` |
+| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 미구현 (future PRD) | `replay-rerun.md` |
+| **PRD 1 §3.11 NAV-UP-05 미가입자 초대 토큰** | 🚧 후속 (가입 사용자 추가만 ✅) | `team-workspace-followups.md` |
+| **PRD 1 §3.1 NAV-WF-07 공유 워크플로우 표시** | 🚧 백엔드만 존재, UI 미노출 | `team-workspace-followups.md` |
+| **PRD 5 NF-SC-10 2FA WebAuthn** | 🚧 TOTP만 ✅, WebAuthn 후속 | `2fa-webauthn.md` |
+
+### B. 인프라/배포 (셀프 호스팅)
+
+| PRD 항목 | 상태 | 처리 plan |
+|----------|------|-----------|
+| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
+| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
+| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
+| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
+| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |
+
+### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)
+
+본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:
+
+| Spec 항목 | 처리 결과 |
+|-----------|-----------|
+| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
+| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |
+
+### D. 접근성
+
+| PRD 항목 | 상태 | 처리 plan |
+|----------|------|-----------|
+| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |
+
+### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)
+
+본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:
+
+| 항목 | 처리 결과 |
+|------|-----------|
+| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
+| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
+| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
+| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
+| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
+| **사용자 매뉴얼** | `frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |
+
+---
+
+## plan 문서 목록
+
+```
+plan/in-progress/
+├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
+├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
+├── merge-p2-async-fanin.md            ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
+├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
+├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
+├── replay-rerun.md                    ← Re-run 재실행 기능 도입
+├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
+├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
+├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
+├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
+└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK
+
+plan/complete/
+├── prd-spec-sync.md                   ← §E "PRD/Spec ↔ 코드 정합성 정리" 완료 (2026-05-11)
+├── llm-provider-followups.md          ← §C "LLM Provider 확장" 완료 (2026-05-11)
+└── logic-node-followups.md            ← Logic 노드 잔여 P0/P1 (D1·D2·D4·D5·D7) 완료, D3 → merge-p2-async-fanin.md 분리 (2026-05-11)
+```
+
+각 plan 문서는 다음 구조를 따른다:
+
+- **배경** — PRD/Spec의 어떤 항목이 미구현인지, 현 코드 상태
+- **관련 문서** — PRD·Spec·메모리·기존 plan 링크
+- **작업 단위** — 체크박스 todo 목록 (SDD: spec → 테스트 → 구현 순서)
+- **수용 기준** — Definition of Done
+- **의존성·리스크** — 다른 plan, 외부 시스템 영향
+
+---
+
+## 참고: 이미 완료되어 본 plan에 포함되지 않은 영역
+
+- `plan/complete/feature-roadmap/stages.md` Stage 1~11 (LLM 토큰 추적 / Parallel P1 / Background 평면 구현 / 팀 워크스페이스 UI / RBAC / 2FA TOTP / 조직 Integration 공유 / OTel 트레이싱 / 알림 룰 CRUD / 접근성 자동화 / 매뉴얼 검색)
+- `plan/complete/node-architecture/*` (handler colocation, schema audit, sub-workflow execution 등)
+- `plan/complete/workflow-assistant/*` (Workflow AI Assistant 본체)
+- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG PRD 단계 — 코드 구현은 ✅, PRD 표기 갱신은 본 plan의 `prd-spec-sync.md`에서 처리)
+
+```
+
+#### `plan/in-progress/2fa-webauthn.md`
+```
+# 2FA WebAuthn 추가
+
+> 작성일: 2026-05-11
+> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
+> 선행 plan: `plan/complete/feature-roadmap/06-2fa.md` (TOTP + 복구 코드 ✅)
+
+## 배경
+
+PRD 5 §2 NF-SC-10:
+
+> **NF-SC-10** 2FA(Two-Factor Authentication) 지원 — 권장 — ✅ (TOTP + 복구 코드 10개. WebAuthn은 후속)
+
+TOTP 인증 + 복구 코드는 ✅. WebAuthn (Passkey / 보안 키 등) 은 후속 작업으로 남아 있음.
+
+## 관련 문서
+
+- `prd/5-non-functional.md` §2 NF-SC-10
+- `spec/5-system/1-auth.md` (인증 / 2FA 흐름)
+- `spec/2-navigation/9-user-profile.md` (보안 설정 화면)
+- `plan/complete/feature-roadmap/06-2fa.md` (TOTP 구현 history)
+- 코드: `backend/src/modules/auth/two-factor*/`, `frontend/src/app/(main)/profile/security/`
+
+## 작업 단위
+
+### 1. 디자인 결정
+
+- [ ] WebAuthn 라이브러리 선택 — `@simplewebauthn/server` + `@simplewebauthn/browser` 가 표준. 사용자 합의 필요
+- [ ] **rpID / origin** — SaaS 도메인 vs. 셀프 호스팅 도메인 모두 지원해야 하므로 환경변수로 분리
+- [ ] **사용자 흐름** — TOTP 만 / WebAuthn 만 / 둘 다 등록한 경우의 로그인 시 인증 옵션 우선순위
+- [ ] **Passkey 다중 등록** — 사용자당 N개 인증기 등록 허용 (모바일 + 데스크톱 + 보안 키)
+- [ ] **복구 코드** — TOTP 와 동일하게 별도 복구 코드 발급 vs. 공통 복구 코드 사용
+
+### 2. 데이터 모델 / 마이그레이션
+
+- [ ] `WebAuthnCredential` 엔티티 — `user_id`, `credential_id` (base64url), `public_key`, `counter`, `transports`, `device_name?`, `last_used_at?`, `created_at`
+- [ ] 마이그레이션 추가
+
+### 3. 백엔드 구현 (TDD)
+
+- [ ] 등록 흐름: `POST /api/v1/auth/2fa/webauthn/register/options` → challenge 생성 + 세션 저장 → 클라이언트가 `navigator.credentials.create()` → `POST /api/v1/auth/2fa/webauthn/register/verify` → credential 저장
+- [ ] 인증 흐름: 로그인 후 2FA 단계에서 `POST /api/v1/auth/2fa/webauthn/authenticate/options` → 클라이언트 `navigator.credentials.get()` → `POST /api/v1/auth/2fa/webauthn/authenticate/verify` → JWT 발급
+- [ ] credential 관리 — 목록 조회 / 이름 수정 / 삭제 API
+- [ ] counter 검증 (replay 방어) + 단위 테스트
+- [ ] 통합 테스트 (등록 / 인증 / counter mismatch / 복구 코드 fallback)
+
+### 4. 프론트엔드 구현 (TDD)
+
+- [ ] 보안 설정 페이지에 "Passkey / 보안 키" 섹션 추가 — 등록 / 목록 / 이름 변경 / 삭제 UI
+- [ ] 로그인 후 2FA 단계 — TOTP / Passkey 선택 UI (사용자가 등록한 인증기에 따라)
+- [ ] 브라우저 호환성 안내 (Safari, Chrome, Firefox 의 WebAuthn 지원 차이)
+- [ ] i18n (ko/en)
+- [ ] 단위 테스트 + e2e (Playwright Virtual Authenticator 활용)
+
+### 5. spec / PRD 갱신
+
+- [ ] `prd/5-non-functional.md` §2 NF-SC-10 상태 — TOTP + WebAuthn 모두 ✅
+- [ ] `spec/5-system/1-auth.md` 에 WebAuthn 흐름 추가
+- [ ] `spec/2-navigation/9-user-profile.md` 보안 섹션 갱신
+
+### 6. 매뉴얼
+
+- [ ] `frontend/src/content/docs/` 보안 가이드에 Passkey 등록·사용법 추가
+
+### 7. REVIEW
+
+- [ ] `ai-review` 실행 → Security 중심 (counter 검증, replay 방어, rpID 정합성, 복구 코드 fallback)
+
+## 수용 기준
+
+- 사용자가 Passkey/보안 키를 등록·관리·삭제 가능
+- 로그인 시 TOTP 또는 Passkey 중 선택해 2FA 통과 가능
+- counter 검증·복구 코드 fallback 회귀 잠금
+- ai-review Critical/Warning 0
+
+## 의존성·리스크
+
+- **의존**: TOTP 2FA 가 이미 ✅이므로 동일 모듈 확장
+- **리스크**:
+  - 셀프 호스팅 환경에서 rpID/origin 설정 실수 시 등록·인증 모두 실패 — 환경변수 검증 필수
+  - 모바일 Safari 의 Passkey 흐름 차이 — 충분한 e2e/수동 검증 필요
+
+```
+
+#### `plan/in-progress/ai-agent-tool-connection-rewrite.md`
+```
+# AI Agent 일반 도구 연결 재설계
+
+> 작성일: 2026-05-11
+> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
+> 선행 plan: [`plan/complete/ai-agent-tool-connection-rewrite.md`](../complete/ai-agent-tool-connection-rewrite.md) (이전 제거 작업의 사유·복원 절차)
+
+## 배경
+
+PRD 3 §6.1 / PRD 6 §3.2 의 다음 요구사항이 **의도적으로 제거된 상태**다:
+
+- ND-AG-06 — Tool/Function 호출 지원 (다른 노드를 도구로 연결)
+- ND-AG-10 — Tool Area를 통한 도구 연결 (캔버스 드래그 앤 드롭)
+- ND-AG-21 — 조건과 일반 도구 동시 호출 시 일반 도구 우선 실행
+
+config 스키마에서 `toolNodeIds` / `toolOverrides` 필드와, 캔버스의 AI Agent 우측 점선 Tool Area UX가 모두 제거됐다. 조건 도구(`cond_*`) / KB 도구(`kb_*`) / MCP 도구(`mcp_*`) 는 영향 없고 정상 동작한다.
+
+이 plan은 새 도구 연결 디자인을 결정하고 위 PRD 항목을 다시 활성화하는 작업이다.
+
+## 관련 문서
+
+- 제거 결정 사유 + 복원 절차: `plan/complete/ai-agent-tool-connection-rewrite.md`
+- PRD: `prd/3-node-system.md` §6.1 ND-AG-06/10/21, `prd/6-phase2-ai.md` §3.2 동일 ID
+- Spec (현재 비활성 박스): `spec/4-nodes/3-ai/1-ai-agent.md` §1 / §Tool Area 박스
+- Spec 캔버스 (재작성 예정 박스): `spec/3-workflow-editor/0-canvas.md` §AI Agent Tool Area
+- 영향 받지 않는 정상 도구: 조건(`cond_*`), KB (`kb_*`), MCP (`mcp_*`) — `backend/src/nodes/ai/ai-agent/tool-providers/{kb-tool-provider,mcp-tool-provider}.ts`
+
+## 작업 단위
+
+### 1. 디자인 결정 (사용자 합의 필요)
+
+본 단계는 **사용자와의 대화로만** 진행한다. SDD/TDD 시작 전 결정해야 할 항목:
+
+- [ ] **도구 등록 모델** — 다음 세 가지 중 어떤 모델을 채택할지 결정
+  - (a) Tool Area 부활 — 캔버스에서 AI Agent 노드 옆 점선 박스로 다른 노드를 드래그해 도구로 등록
+  - (b) Tool Area 폐기 → 설정 패널에서 "도구로 사용할 노드 ID 목록"을 select 위젯으로 선택
+  - (c) 별도 "AI Tool" 노드 타입 신설 — AI Agent 출력 포트 외에 dedicated tool 포트로 연결, 도구 시그니처(name/description/parameters)를 노드 자체 config에 두어 AI Agent의 config는 `toolNodeIds`만 가짐
+- [ ] **도구 시그니처 정의 위치** — 도구 노드 자체 (호출되는 측) vs. AI Agent (호출하는 측). 워크플로 작성자가 도구 사양을 한 곳에서만 관리하도록 결정
+- [ ] **도구 호출 시 실행 컨텍스트** — 일반 워크플로 진행과 별개의 sub-execution으로 보낼지, 같은 execution 내 inline으로 처리할지. AI Agent multi-turn 도중 도구 노드가 form/buttons/ai_conversation 같은 블로킹 노드를 포함하면 어떻게 다룰지 결정
+- [ ] **도구 결과 라우팅** — 도구 노드의 출력은 LLM 컨텍스트에만 들어가는지, 일반 다운스트림 노드로도 흐르는지
+- [ ] **ND-AG-21 우선순위 규칙 재확인** — 일반 도구 우선 실행 → LLM 재평가 → 조건 도구 결정 흐름이 새 설계에서도 유지되는지
+
+> 위 결정 사항은 plan을 진행할 사용자가 답한 후, 이 체크박스를 ✅ 처리하고 결정 내용을 본 plan §결정 기록 절에 추가한다.
+
+### 2. PRD 갱신
+
+- [ ] 결정에 따라 `prd/3-node-system.md` §6.1 ND-AG-06/10/21 본문 업데이트 + "재작성 예정" 표기 제거
+- [ ] `prd/6-phase2-ai.md` §3.2 ND-AG-06/10/21 동일 갱신
+- [ ] PRD 2 §10.4 ED-AI-19 등 AI Assistant 의 편집 도구 거부 정책에 영향 있는지 확인
+
+### 3. Spec 작성
+
+- [ ] `spec/4-nodes/3-ai/1-ai-agent.md` 의 "재작성 예정" 박스 제거 + 새 도구 연결 모델 명세
+  - config 스키마: 새 필드 정의 (`toolNodeIds` 부활인지, 새 모델인지)
+  - 도구 이름 규칙: `tool_*` 접두사 부활 또는 변경
+  - 도구 description 파생 규칙
+  - ToolOverride 구조 (필요 시)
+  - 도구 호출 결과의 `output.result.*` 위치
+- [ ] `spec/3-workflow-editor/0-canvas.md` Tool Area 시각·인터랙션 재작성 (만약 결정 (a)면)
+- [ ] `spec/3-workflow-editor/4-ai-assistant.md` — Workflow AI Assistant가 새 도구 연결 모델을 인식·편집할 수 있는지 정합화 (특히 `add_node` / `update_node` 응답의 dynamic-ports 모델)
+
+### 4. 백엔드 구현 (TDD)
+
+- [ ] `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` config 스키마에 새 필드 복원 + Zod 검증 + 테스트
+- [ ] `backend/src/nodes/ai/ai-agent/tool-providers/` 에 일반 노드 도구 provider 구현 (`node-tool-provider.ts` 등) + 단위 테스트
+- [ ] `ai-agent.handler.ts` — 도구 호출 시 sub-execution / inline 호출 (결정 사항 따라) + 부분 실패 격리 + diagnostics 누적
+- [ ] 조건 도구와 일반 도구 동시 호출 시 ND-AG-21 우선순위 규칙 적용 (테스트로 회귀 잠금)
+- [ ] `TOOL_EXECUTION_FAILED` 에러 코드 복원 (`spec/4-nodes/3-ai/1-ai-agent.md` §6 에 이미 placeholder)
+
+### 5. 프론트엔드 구현 (TDD)
+
+- [ ] AI Agent 설정 패널에 도구 등록 UI (a/b/c 결정 따라)
+- [ ] 캔버스 렌더 (a 선택 시 Tool Area 점선 박스 부활, b 선택 시 패널만)
+- [ ] 도구 호출 시 LLM 타임라인에 tool-call 카드 표시 (이미 KB·MCP·조건 도구는 표시됨 — 일반 도구도 동일 패턴 재사용)
+
+### 6. Migration / Rollout
+
+- [ ] 기존 워크플로의 AI Agent config가 새 스키마에 그대로 호환되는지 확인. 호환 안 되면 `backend/scripts/` 에 마이그레이션 스크립트 추가 + dry-run / apply 흐름
+
+### 7. 매뉴얼 업데이트
+
+- [ ] `frontend/src/content/docs/02-nodes/ai.mdx` (또는 해당 페이지) — 도구 연결 사용법 추가
+- [ ] `frontend/src/content/docs/03-workflow-editor/walkthrough.mdx` — Tool Area / 도구 등록 흐름 walkthrough 갱신
+
+### 8. REVIEW
+
+- [ ] `ai-review` 스킬 실행 (Architecture / Side Effect / API Contract / Concurrency 중심)
+- [ ] Critical / Warning 이슈 해소 → `review/<timestamp>/RESOLUTION.md` 작성
+
+## 수용 기준
+
+- ND-AG-06 / ND-AG-10 / ND-AG-21 가 PRD에서 ✅ 표기로 활성화
+- 새 도구 연결 모델이 spec에 명시되고 코드에 반영
+- 회귀 테스트: 조건 도구·KB 도구·MCP 도구는 동일하게 동작
+- ai-review Critical/Warning 0
+- Workflow AI Assistant 가 새 모델을 인식해 `add_edge` 의 도구 포트를 안전하게 채울 수 있음
+
+## 의존성·리스크
+
+- **의존**: `prd-spec-sync.md` 의 spec 정리가 끝난 baseline에서 시작하면 깔끔
+- **순서 의존성**: `conversation-thread.md` (worktree: `conversation-thread-e509c5`) 가 `spec/4-nodes/3-ai/1-ai-agent.md §1` 표를 먼저 개정 — 본 plan 의 §3 spec 작성은 그 merge 이후 착수해야 신규 5필드(`contextScope`/`contextScopeN`/`contextInjectionMode`/`includeToolTurns`/`excludeFromConversationThread`) 와 DEPRECATED 마커(`conversationHistory`/`historyCount`) 위치를 일관되게 다룰 수 있다.
+- **conversation-thread 와의 정책 의존**: 일반 `tool_*` 도구 결과의 ConversationThread 누적 정책은 `conversation-thread.md` v2 에서 결정된다 — 본 plan 활성화 시 `tool_*` 결과를 `ai_tool` source 로 push 할지(현재 KB/MCP 와 동일하게 `includeToolTurns` 게이트 적용) 별도 `tool_call` source 신설할지 확정 필요.
+- **리스크**:
+  - 결정 (c) "AI Tool 노드 신설" 시 노드 카탈로그·플러그인 인터페이스 변경 영향이 marketplace plan(`marketplace-and-plugin-sdk.md`) 까지 번질 수 있음
+  - multi-turn 도중 도구 호출 → blocking 노드(form/buttons) 진입 시 AI Agent 의 `_resumeState` 관리 복잡도 증가
+  - 기존 `tool_*` 접두사를 다시 사용할 경우 LLM 프롬프트 호환성 (이전 conversation history) 검증 필요
+
+## 결정 기록
+
+(사용자 답변 후 채워질 자리)
+
+- 도구 등록 모델: TBD
+- 도구 시그니처 위치: TBD
+- 도구 호출 실행 컨텍스트: TBD
+- 도구 결과 라우팅: TBD
+- ND-AG-21 우선순위 유지 여부: TBD
+
+```
+
+#### `plan/in-progress/ai-review-subagent.md`
+```
+---
+worktree: ai-review-subagent-b7c8d9
+started: 2026-05-15
+owner: developer
+---
+
+# AI-Review / Consistency-Check — `claude -p` 제거 + Sub-agent 위임
+
+## Context
+
+요금제 정책 변경으로 `subprocess.run(["claude", "-p", ...])` 와
+`anthropic.Anthropic().messages.create(...)` 두 model 호출 경로가 모두 사용
+불가가 되었다. 현재 `/ai-review` (`code-review-agents`) 와
+`/consistency-check` (`consistency-checker`) 의 model 호출이 모두 `claude -p`
+이므로 (`lib/agent_runner.py:34`, `lib/summary.py:46`,
+`consistency_orchestrator.py:32`) 파이프라인 전체를 sub-agent 위임으로 전환한다.
+
+남는 유일한 model 호출 경로는 **main Claude (현재 session) 가 `Agent` tool
+로 sub-agent 를 invoke** 하는 것. sub-agent 는 별도 conversation 으로 자동
+격리된다. 사용량 한도 시 무한 재시도는 `/loop` dynamic mode + `ScheduleWakeup`
+으로 구현.
+
+## 새 아키텍처
+
+```
+사용자 → /ai-review        → 1회 사이클 (한도 걸린 agent 는 pending 유지)
+사용자 → /loop /ai-review  → 무한 재시도 (ScheduleWakeup 으로 self-pace)
+    │
+    ▼
+main Claude
+  1. orchestrator --prepare 호출 → 세션 디렉토리 + _prompts/<role>.md +
+     _retry_state.json 초기화 (model 호출 없음, file IO 만)
+  2. _retry_state.json 의 pending 리스트 Read
+  3. 각 pending agent 에 대해 Agent tool 병렬 invoke
+     (subagent_type=<role>-reviewer, prompt=경로 인자)
+  4. sub-agent return value 파싱 (STATUS=success|rate_limit|network|fatal)
+  5. _retry_state.json 갱신
+  6. pending 비면 summary sub-agent → SUMMARY.md → 종료
+     pending 남으면 /loop 안: ScheduleWakeup(reset_hint or 1800s) → turn 종료
+                  /loop 밖: partial SUMMARY 후 종료
+```
+
+## Sub-agent 정의 (.claude/agents/)
+
+13 reviewer (`<role>-reviewer.md`):
+api_contract, architecture, concurrency, database, dependency,
+documentation, maintainability, performance, requirement, scope, security,
+side_effect, testing
+
+5 checker (`<checker>-checker.md`):
+convention_compliance, cross_spec, naming_collision, plan_coherence,
+rationale_continuity
+
+2 summary: `code-review-summary.md`, `consistency-summary.md`
+
+각 정의 frontmatter:
+```
+---
+name: <slug>
+description: <한 줄>
+tools: Read, Grep, Glob, Bash, Write
+model: sonnet
+---
+```
+
+본문은 기존 prompts 의 내용을 그대로 옮기되, 다음 contract 를 끝에 추가:
+- review.md 본문은 호출자가 prompt 에 인자로 준 OUTPUT_PATH 에 Write tool 로
+  저장한다.
+- 호출자에게 return 하는 값은 한 줄: `STATUS=<...> ISSUES=<n> PATH=<...>
+  RESET_HINT=<sec or "">`.
+- 사용량 한도/네트워크 오류 메시지를 받으면 `STATUS=rate_limit` 또는
+  `STATUS=network` 로 보고하고 임의 우회 금지.
+
+## Python orchestrator 슬림화
+
+`code_review_orchestrator.py` / `consistency_orchestrator.py` 가
+남기는 역할:
+- diff/context 수집 + prompt-budget 압축 (`168-297` 의 기존 로직 유지)
+- prompt 파일을 `review/<timestamp>/_prompts/<role>.md` 로 저장
+- `_retry_state.json` 초기화 (pending=전체, success=[], fatal=[], attempts=0)
+- 세션 디렉토리 경로를 stdout 으로 반환
+
+제거할 코드:
+- `from lib import agent_runner, summary`
+- `agent_runner.run_agents_parallel(...)` 호출 (`code_review_orchestrator.py:290`)
+- `summary.run_summary(...)` 호출 (`code_review_orchestrator.py:308`)
+- 동일 위치의 consistency_orchestrator 호출
+
+`lib/agent_runner.py`, `lib/summary.py` → 삭제. `lib/session.py` 유지.
+
+## 변경 파일
+
+### 신규
+- `.claude/agents/<role>-reviewer.md` × 13
+- `.claude/agents/<checker>-checker.md` × 5
+- `.claude/agents/code-review-summary.md`
+- `.claude/agents/consistency-summary.md`
+
+### 수정
+- `.claude/skills/code-review-agents/hooks/code_review_orchestrator.py`
+- `.claude/skills/consistency-checker/hooks/consistency_orchestrator.py`
+- `.claude/skills/code-review-agents/lib/__init__.py`
+- `.claude/skills/code-review-agents/SKILL.md`
+- `.claude/skills/code-review-agents/README.md`
+- `.claude/skills/consistency-checker/SKILL.md`
+- `.claude/commands/ai-review.md`
+- `.claude/commands/consistency-check.md`
+- `.claude/skills/code-review-agents/hooks/hooks.json` (PostToolUse 제거)
+- `CLAUDE.md` ("외부 LLM 호출 정책" 절 신설)
+
+### 삭제
+- `.claude/skills/code-review-agents/lib/agent_runner.py`
+- `.claude/skills/code-review-agents/lib/summary.py`
+- `.claude/skills/code-review-agents/prompts/`
+- `.claude/skills/consistency-checker/prompts/`
+
+## 환경변수
+
+| 변수 | 기본값 | 의미 |
+| --- | --- | --- |
+| `RETRY_WAKE_DEFAULT_SEC` | 1800 | reset-hint 없을 때 ScheduleWakeup 대기 |
+| `RETRY_WAKE_CAP_SEC` | 3600 | wake delay 상한 |
+| `RATE_LIMIT_PATTERNS` | (내장) | sub-agent return value 매칭용 추가 패턴 |
+| `NETWORK_PATTERNS` | (내장) | 동일 |
+
+## 단계
+
+- [x] 1. .claude/agents/ 디렉토리 신설 + 20 subagent definition 작성
+- [x] 2. code_review_orchestrator.py 축소 (--prepare 모드)
+- [x] 3. consistency_orchestrator.py 축소
+- [x] 4. lib/agent_runner.py + lib/summary.py 삭제, lib/__init__.py 정리
+- [x] 5. prompts/ 디렉토리 삭제 (양 skill)
+- [x] 6. SKILL.md / README.md 재작성
+- [x] 7. .claude/commands/ 슬래시 정의 갱신
+- [x] 8. hooks.json PostToolUse 트리거 제거
+- [x] 9. CLAUDE.md 정책 절 신설
+- [~] 10. `consistency-check --impl-prep`: spec 변경 없음으로 본 작업에는 적용 안 됨. 대신 `--plan` 으로 smoke test 수행 (orchestrator prepare 까지). 실제 sub-agent 호출은 commit/merge 이후 사용자 환경에서 수동 검증.
+- [x] 11. orchestrator smoke test 통과: 두 orchestrator 의 `--prepare` 가 session_dir / _prompts / _retry_state.json 정상 생성. `AI_REVIEW_LOOP=1` 환경변수가 `loop_mode=true` 로 반영됨. subagent_type 매핑 (`side_effect → side-effect-reviewer`, `plan_coherence → plan-coherence-checker`) 정상.
+- [ ] 12. 통합 검증 (follow-up — 사용자 환경에서 수동 수행 필요):
+    - `/ai-review` 호출 → main Claude 가 13개 Agent tool 병렬 invoke → STATUS 파싱 → SUMMARY.md 생성.
+    - `/loop /ai-review` 사용량 한도 시뮬레이션 → ScheduleWakeup 예약 → wake 시 재진입 → pending 만 재호출.
+    - `/consistency-check --plan plan/in-progress/ai-review-subagent.md` → 5 checker sub-agent invoke → consistency-summary → BLOCK 결정.
+    - 본 worktree 의 `.claude/agents/` 가 main session 에 인식되는 시점 확인 (cwd / merge 시점).
+- [x] 13. plan 갱신.
+- [x] 14. 단일 커밋 (7a52b93e on `claude/ai-review-subagent-b7c8d9`). PR 은 통합 검증 후 사용자 결정.
+- [ ] 15. PR 생성 (통합 검증 완료 후).
+
+## 검증 결과 (smoke)
+
+| 항목 | 결과 |
+| --- | --- |
+| `python3 -c "from lib import session"` | OK |
+| `code_review_orchestrator.py` import | OK (ALL_AGENTS 13개 그대로) |
+| `consistency_orchestrator.py` import | OK (ALL_CHECKERS 5개 그대로) |
+| `_subagent_type('side_effect')` | `side-effect-reviewer` |
+| `_subagent_type('plan_coherence')` | `plan-coherence-checker` |
+| `code_review_orchestrator.py --prepare` (전체 diff, 30 파일) | 성공. session_dir/_prompts/security.md + _retry_state.json + meta.json 생성. stdout 마지막 줄에 session_dir 절대경로. |
+| `AI_REVIEW_LOOP=1 code_review_orchestrator.py --prepare` | `_retry_state.json` 의 `loop_mode=true`. |
+| `consistency_orchestrator.py --plan plan/.../ai-review-subagent.md` | 성공. session_dir/_prompts/plan_coherence.md (header + 모드 + Target 문서 + plan_in_progress) + _retry_state.json (pending=['plan_coherence'], summary=consistency-summary). |
+
+## 통합 검증 follow-up
+
+main session 에서 Agent tool 로 sub-agent 를 invoke 하려면 sub-agent definition 이 main 의 `.claude/agents/` 검색 경로에 등록되어야 한다. 본 작업은 worktree 안에 신설했으므로, **PR merge 후 (또는 cwd 를 worktree 로 옮긴 상태에서)** 실제 호출 검증이 가능하다. 수동 검증 절차는 위 단계 12 참고. 검증 실패 시 plan 을 다시 `in-progress` 로 되돌리고 후속 조치.
+
+## Follow-up — 리뷰 디렉토리 nested 구조 (commit 2)
+
+`review/<timestamp>/` 와 `review/consistency/<timestamp>/` 의 flat 누적이 `ls` 등 파일시스템 조회 시 부담이 커서 nested 형식으로 전환.
+
+- 신규 형식:
+  - 코드 리뷰: `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
+  - 일관성 검토: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
+- 변경된 코드:
+  - `lib/session.py:create_session_dir` 가 nested ISO 로 디렉토리 생성. `subdir` 인자는 호환 유지.
+  - `code_review_orchestrator.py` 의 `REVIEW_OUTPUT_DIR` 기본값 `./review` → `./review/code`.
+  - `consistency_orchestrator.py` 는 prefix 그대로 `./review/consistency` (nested 는 session 모듈이 처리).
+- 변경된 문서: `CLAUDE.md` 의 명명 컨벤션 표 + "정보 저장 위치" 표 + Skill 체계 표의 path 표현, `code-review-agents/SKILL.md`, `code-review-agents/README.md` 의 산출물 디렉토리 트리 + `_retry_state.json` 예시, `consistency-checker/SKILL.md`, `.claude/commands/consistency-check.md` 산출물 섹션.
+- Smoke test:
+  - `REVIEW_OUTPUT_DIR=/tmp/code-nested ... --prepare` → `/tmp/code-nested/2026/05/15/07_47_44/...` ✓
+  - `CONSISTENCY_OUTPUT_DIR=/tmp/cons-nested ... --plan ...` → `/tmp/cons-nested/2026/05/15/07_47_46/_prompts/plan_coherence.md` 등 정상 ✓
+  - 기본값(환경변수 없음) → `./review/code/2026/05/15/07_47_57/` ✓
+- 기존 flat 디렉토리(`review/<ts>/`, `review/consistency/<ts>/`) 의 일괄 이동은 사용자 별도 작업.
+
+## 단계 (이어서)
+
+- [x] 16. `lib/session.py:create_session_dir` 를 nested ISO 로 변경 + docstring 갱신.
+- [x] 17. `code_review_orchestrator.py` 기본 `REVIEW_OUTPUT_DIR` 을 `./review/code` 로.
+- [x] 18. 문서 path 표현 갱신 (CLAUDE.md / 양 SKILL.md / README.md / commands/consistency-check.md).
+- [x] 19. Smoke test (양쪽 orchestrator + 기본값).
+- [x] 20. follow-up 단계 본 plan 에 기록.
+- [x] 21. follow-up 커밋 + push (commit 241e0ebb).
+- [x] 22. summary self-discovery follow-up 커밋 + push (commit 04302603).
+
+## Follow-up — 사용자 테스트 피드백 (commit 5+6)
+
+사용자가 실제 `/ai-review` 호출 시 두 가지 이슈 보고:
+1. 이중 경로 — `review/2026-05-15_15-29-14` (옛 flat) 와 `review/code/2026/05/15/15_30_00` (새 nested) 가 동시에 생성됨.
+2. 자동 후속 흐름 누락 — 옛 동작 (리뷰 → planner/developer 위임 → 이슈 해결 → e2e) 이 빠짐.
+
+### 이슈 1 — commit 16a80728 (`fix(settings): plugins 등록 제거`)
+
+원인: `.claude/settings.json` 의 `plugins: [".claude/skills/code-review-agents"]` 가 plugin 시스템을 통해 plugin path 의 `hooks.json` 을 PostToolUse 로 자동 등록. 옛 hooks.json (Write/Edit 트리거) 이 옛 orchestrator 를 fork → `session.create_session_dir` 만 옛 flat 형식으로 만들고 본문은 `claude -p` 부재로 실패.
+
+해결: `plugins` 배열 제거. slash command 가 진입점이 된 후로 plugin 자동 등록은 필요 없음. 머지 후 main 의 hooks.json 도 함께 사라지면 옛 path 생성 메커니즘 완전 소멸.
+
+### 이슈 2 — 자동 후속 흐름 (commit 6 in progress)
+
+SKILL.md 에 "단계 8. 자동 후속 흐름" 신설:
+
+- 8.1 분류: spec 관련 / 코드 관련.
+- 8.2 spec 관련: `project-planner` 절차 (draft → `/consistency-check --spec` → `BLOCK: NO` 시 spec 반영).
+- 8.3 코드 관련: `developer` 절차 (수정 + 단위 테스트 + commit).
+- 8.4 모두 처리 후 `make e2e-test` 자동 실행.
+- 8.5 실패 시 원인 분석 + 추가 fix (최대 3회).
+- 8.6 통과 시 `RESOLUTION.md` 작성.
+- 8.7 안전 가드: consistency-check `BLOCK: YES`, e2e 누적 3회 실패, 직전 수정과 무관한 사전 결함, DB 마이그레이션·외부 API 계약 변경, SUMMARY "사용자 결정 필요" 표기 → 자동 중단 + 사용자 보고.
+
+동반 갱신: commands/ai-review.md 의 단계 8 추가, README.md 의 아키텍처 그림에 자동 후속 흐름 추가.
+
+- [x] 23. settings.json plugins 제거 commit (16a80728).
+- [x] 24. SKILL.md / commands / README 의 자동 후속 흐름 작성.
+- [ ] 25. 자동 후속 흐름 commit + push.
+
+## Follow-up — 지침 통합 보강 (commit 4)
+
+전체 skill·agent 지침 검토 결과 발견된 약점 일괄 보강. 사용자 확인 사항: C3 (role-specific prompt 재작성) 적용, E1·E2 (가독성) 적용, C3 의 단일 공유 제안은 거부 (역할 격리 강화 의도).
+
+- **A1 — `--resume` 모드 도입**: 두 orchestrator (`code_review_orchestrator.py`, `consistency_orchestrator.py`) 에 `--resume <session_dir>` 신설. `_retry_state.json` 존재만 검증 후 그 경로를 stdout 으로 echo. /loop wake 후 동일 세션 재진입 메커니즘이 결정성 있게 동작.
+- **A2 — STATUS 미수신 fallback**: SKILL.md 단계 4 에 sub-agent 가 한도/네트워크 오류로 STATUS 라인을 만들지 못한 경우 main 이 응답 본문 키워드 매칭으로 분류하는 규칙 + 패턴 리스트 명시.
+- **C3 (재해석) — role-specific prompt body**: `lib/role_instructions.py` 신설 — 13 reviewer + 5 checker 의 `ko_title`·`perspective`·`checklist` 를 single source 로 보관. orchestrator 의 `build_agent_prompt_body(agent_name, ...)` 가 role 마다 다른 본문 (`_prompts/<role>.md`) 을 생성 — system prompt 와 이중 강화로 역할 격리 보장.
+- **C1, C2 — /loop 호출 형식 명시**: `AI_REVIEW_LOOP=1` env prefix 의 정확한 명령 라인, ScheduleWakeup prompt 의 `/loop /<slash> --resume <session_dir>` 절대경로 표기.
+- **C4 — `_retry_state.json` 갱신 필드 명시**: SKILL.md 단계 5 에 갱신 필드 6개(`agents_*`, `agent_history`, `rate_limit_episodes`, `last_reset_hint_sec`, `wake_history`, `total_wait_sec`) 명시.
+- **D1, D2 — output_file 검증 + STATUS 정규식 파싱**: SKILL.md 단계 4 에 보강. sub-agent 본문에도 "Write 실패 시 success 거짓 보고 금지" 추가.
+- **B1, B2, B3 — stale path / slash 누락 동기화**: SKILL.md·README.md 의 `REVIEW_OUTPUT_DIR` 기본값 → `./review/code`, project-planner SKILL.md 의 옛 flat path → nested, developer SKILL.md 의 `consistency-checker` → `/consistency-check`.
+- **E1, E2 — 가독성**: 18개 sub-agent definition 의 호출 규약·상태 결정 섹션을 통일 패턴으로 일괄 재생성 (`lib.role_instructions` 가 single source). commands 의 step 번호에 0 (사전 점검 — worktree 확인) 추가해 SKILL.md 와 일관.
+- Smoke: reviewer 3종 + checker 3종 prompt 가 role-specific 으로 다르게 생성됨, `--resume` valid/invalid 분기 정상.
+
+- [ ] 23. 통합 보강 follow-up 커밋 + push.
+
+## Follow-up — summary sub-agent self-discovery (commit 3)
+
+main 이 매 사이클마다 임시 markdown 을 만들어 summary sub-agent 에 전달하던 단계를 제거. summary sub-agent 가 `session_dir=<...>` 한 인자만 받고 자기 컨텍스트에서 `_retry_state.json` → `subagent_invocations[*].output_file` → `meta.json` 을 직접 Read 해 통합 보고서를 작성하도록 단순화.
+
+- 변경: `.claude/agents/code-review-summary.md`, `.claude/agents/consistency-summary.md` 의 호출 규약 + 수행 절차.
+- 동반 갱신: code-review-agents/SKILL.md (단계 6), consistency-checker/SKILL.md (단계 5), commands/ai-review.md, commands/consistency-check.md.
+- retry_state 스키마 변경 없음 — `summary_subagent_type` / `summary_output_file` 필드가 summary sub-agent 내부에서 직접 참조된다.
+- main 의 절차에서 "임시 `_summary.md` 작성" step 제거 → main 의 turn 길이 1단계 감소, conversation 안에 본문이 들어가지 않아 격리 강화.
+
+- [ ] 22. summary self-discovery follow-up 커밋 + push.
+
+## 검증
+
+1. drift: 20 subagent definition 의 frontmatter 가 Claude Code 가 로드
+   가능한 schema 인지 확인.
+2. 수동 1: 작은 diff 가 있는 worktree 에서 `/ai-review` → 13 Agent 호출 →
+   각 review.md + SUMMARY.md 생성.
+3. 수동 2: 한 sub-agent prompt 를 임시로 "강제 STATUS=rate_limit" 로 만들고
+   `/loop /ai-review` 진입 → ScheduleWakeup 예약·재진입·재호출 검증.
+4. 회귀: hooks.json PostToolUse 제거 후 자동 trigger 가 fire 하지 않는지.
+
+## 비-목표
+
+- `claude -p` 의 동시 실행 성능 보존 (Agent tool 의 병렬성에 위임).
+- 13개 sub-agent prompt 내용 자체의 품질 개선.
+- /loop 외 자동 재시도 메커니즘 (cron 등 검토 가능하나 본 작업 범위 밖).
+
+```
+
+#### `plan/in-progress/brand-refresh-impl.md`
+```
+---
+worktree: brand-refresh-7a3f12
+started: 2026-05-15
+owner: developer
+---
+
+# Plan: Brand Refresh — Stage 2 (자산·코드 구현)
+
+Stage 1 (`spec/6-brand.md` §8 정식 개정) 의 인수인계를 받아, 신 brand spec 에 맞게 자산을 생성하고 코드에 통합한다.
+
+## 컨텍스트
+
+- **Stage 1 산출물**: `spec/6-brand.md` §8 정식판 (Visual Identity), `spec/2-navigation/_layout.md` §2.1 동기화, `spec/2-navigation/10-auth-flow.md` §1 동기화.
+- **사전 일관성 검토**: 1차 `review/consistency/2026/05/15/18_25_10/`, 2차 `review/consistency/2026/05/15/18_36_51/` (BLOCK: NO).
+- **원본 컨셉 자산**: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관). inline SVG 가 light/dark 페어로 들어있음.
+- **현재 코드 상태**: `frontend/public/logo.svg`·`logo-mark.svg`·`frontend/src/app/icon.svg`·`favicon.ico` 는 옛 덩굴 곡선 자산이며 코드에서 거의 참조되지 않음. `frontend/src/app/globals.css` 의 `--primary` 는 generic HSL — brand spec 과 매핑 안 됨.
+
+## 0. 착수 전 의무 절차
+
+- [x] **현재 worktree 확인** — main 워크트리에서 진입 금지. 본 plan 의 worktree 는 `brand-refresh-7a3f12`.
+- [x] **`/consistency-check --impl-prep spec/6-brand.md` 호출** (`developer` skill 의무). Critical 0 건 확인 시 착수.
+- [x] **Stage 1 산출물 재읽기** — `spec/6-brand.md` §8 (특히 §8.2 컬러 토큰, §8.4 로고 시스템, §8.6 자산 마이그레이션) 과 `_layout.md §2.1`, `10-auth-flow.md §1`.
+
+---
+
+## 1. 자산 생성 (§8.4.1 의 9종)
+
+원본은 `temp/clemvion_logo_concepts.html` 의 inline SVG. 각각 별도 파일로 추출하고 viewBox·색을 spec 토큰과 정렬한다.
+
+### 1.1 SVG 자산 (5종)
+
+- [x] `frontend/public/logo.svg` — Full logo (light). viewBox `260×80`. mark + wordmark + sub-copy 3요소. 색은 §8.2.1 / §8.2.2 의 light 토큰.
+- [x] `frontend/public/logo-dark.svg` — Full logo (dark). 동 viewBox. 색은 §8.2.3 의 dark 토큰.
+- [x] `frontend/public/logo-mark.svg` — Icon mark (light, 96px master).
+- [x] `frontend/public/logo-mark-dark.svg` — Icon mark (dark, 96px master).
+- [x] `frontend/public/logo-wordmark.svg` — Wordmark only (sub-copy 없음). 라이트 변종. 다크 변종은 `<Logo />` 컴포넌트의 `currentColor` 활용 또는 추후 분리.
+
+SVG 작성 시 주의:
+- 워드마크 `<text>` 의 fontFamily 에 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택 명시 (§8.3, R-11).
+- 워드마크 weight: base 200 / accent `vi` 600. `<tspan font-weight="600" fill="...">vi</tspan>` 활용.
+- sub-copy `AGENTIC WORKFLOW` 은 Courier New / 8px / letter-spacing 3px / uppercase.
+
+### 1.2 Favicon multi-size 합성
+
+- [x] **16px 전용 vector 신규 작성** — 96px master 의 단순 축소 금지 (§8.4.2). 노드 ≤ 4 / 라인 ≤ 3 으로 단순화. `frontend/public/favicon-16.svg` 로 배치.
+- [x] **32px vector** — `frontend/src/app/icon.svg` 가 master 의 축소판으로 작동. Next.js metadata 가 자동 노출.
+- [ ] **48px vector + multi-size `favicon.ico` 합성** — *Follow-up*. ImageMagick / `png-to-ico` 등 raster 도구 필요. 현 PR 에서는 옛 `favicon.ico` 삭제, modern 브라우저는 `icon.svg` 사용.
+
+### 1.3 PNG 자산 (Follow-up)
+
+PNG 변환은 raster 도구(sharp / ImageMagick / Inkscape) 가 필요하므로 별도 PR 로 분리한다. 현 PR 에서는 SVG 등가물을 임시 사용:
+
+- [ ] `frontend/src/app/apple-icon.png` (180×180) — 임시로 `frontend/public/apple-icon.svg` 사용 (modern iOS ≥ 12 가 SVG apple-touch-icon 지원). 폴백 PNG 는 follow-up.
+- [ ] `frontend/src/app/opengraph-image.png` (1200×630) — *현 PR 에서는 OG/Twitter `images` 메타데이터 비활성화*. SVG OG 카드는 X/Slack/Facebook 크롤러가 안정적으로 렌더하지 않아 소셜 미리보기가 깨질 위험. PNG 생성 후 `frontend/src/app/layout.tsx` 의 `openGraph.images` 와 `twitter.card`(`summary_large_image`로 복원) 를 재활성화.
+
+---
+
+## 2. CSS 토큰 매핑 — **테마 롤백 (2026-05-15)**
+
+사용자 피드백 *"전체적인 색상이 별로"* 로 globals.css 의 Vine 토큰 매핑을 **main 으로 전면 롤백**. Shadcn neutral 토큰 (`--primary: 222.2 47.4% 11.2%` 등) 그대로 유지. `(auth)/layout.tsx` 배경도 `bg-gradient-to-br ...` 로 복원.
+
+SVG 자산은 자체 fill 로 Vine 컬러를 보유하므로 로고/파비콘 비주얼은 그대로 유지됨. 단 spec ↔ 코드 일치를 위해 `spec/in-progress/spec-update-brand-followu

... (truncated due to prompt size limit) ...

---

### 파일 9: review/consistency/2026/05/16/09_13_51/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/_prompts/rationale_continuity.md b/review/consistency/2026/05/16/09_13_51/_prompts/rationale_continuity.md
new file mode 100644
index 00000000..6fb1f1c7
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/_prompts/rationale_continuity.md
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
+구현 착수 전 검토 (--impl-prep, scope=Makefile,docker-compose.e2e.yml)
+
+## Target 문서
+경로: `Makefile,docker-compose.e2e.yml`
+
+```
+### 구현 대상 영역: `Makefile,docker-compose.e2e.yml`
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

### 파일 10: review/consistency/2026/05/16/09_13_51/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/_retry_state.json b/review/consistency/2026/05/16/09_13_51/_retry_state.json
new file mode 100644
index 00000000..ff86a791
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/_retry_state.json
@@ -0,0 +1,27 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/SUMMARY.md",
+  "subagent_invocations": [
+    {"name": "cross_spec", "subagent_type": "cross-spec-checker", "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/_prompts/cross_spec.md", "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/cross_spec/review.md"},
+    {"name": "rationale_continuity", "subagent_type": "rationale-continuity-checker", "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/_prompts/rationale_continuity.md", "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md"},
+    {"name": "convention_compliance", "subagent_type": "convention-compliance-checker", "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md", "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/convention_compliance/review.md"},
+    {"name": "plan_coherence", "subagent_type": "plan-coherence-checker", "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/_prompts/plan_coherence.md", "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/plan_coherence/review.md"},
+    {"name": "naming_collision", "subagent_type": "naming-collision-checker", "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/_prompts/naming_collision.md", "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_13_51/naming_collision/review.md"}
+  ],
+  "agents_pending": [],
+  "agents_success": ["cross_spec", "rationale_continuity", "convention_compliance", "plan_coherence", "naming_collision"],
+  "agents_fatal": [],
+  "agent_history": {
+    "cross_spec": [{"status": "success", "issues": 0}],
+    "rationale_continuity": [{"status": "success", "issues": 4}],
+    "convention_compliance": [{"status": "success", "issues": 1}],
+    "plan_coherence": [{"status": "success", "issues": 3}],
+    "naming_collision": [{"status": "success", "issues": 0}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}

```

---

### 파일 11: review/consistency/2026/05/16/09_13_51/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/convention_compliance/review.md b/review/consistency/2026/05/16/09_13_51/convention_compliance/review.md
new file mode 100644
index 00000000..3c6afb5a
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/convention_compliance/review.md
@@ -0,0 +1,52 @@
+# 정식 규약 준수 검토 결과
+
+검토 대상: `Makefile`, `docker-compose.e2e.yml`
+검토 모드: 구현 착수 전 (--impl-prep)
+검토 일시: 2026-05-16
+
+---
+
+### 발견사항
+
+규약 위반 또는 우려 사항이 없습니다.
+
+`Makefile`과 `docker-compose.e2e.yml`은 인프라 자동화 파일이며, 다음 관점에서 검토하였습니다.
+
+**1. 명명 규약**
+- `docker-compose.e2e.yml` 파일명은 CLAUDE.md에서 e2e 격리 인프라 기준 파일로 직접 언급(`make e2e-test`, `docker-compose.e2e.yml` 기반)되어 있으며, 파일명이 일치한다.
+- `name: clemvion-e2e` — Compose project name이 dev 환경(`clemvion`)과 명확히 분리되어 있어 CLAUDE.md의 격리 원칙을 준수한다.
+- 서비스 이름(`postgres`, `redis`, `minio`, `migrate`, `backend-e2e`, `backend-e2e-runner`, `playwright-runner`)은 용도를 반영한 명확한 kebab-case로 작성되어 있다. 규약에 서비스 이름 패턴을 별도로 정의하지 않으나, 기존 프로젝트 관습과 일치한다.
+- Makefile target 이름(`e2e-up`, `e2e-down`, `e2e-test`, `e2e-test-full`)은 CLAUDE.md의 `make e2e-test` 호출 예시와 정확히 일치한다.
+
+**2. 출력 포맷 규약**
+- 본 파일들은 노드 Output, API 응답, error code 등의 출력 포맷 규약(`spec/conventions/node-output.md`) 적용 대상이 아니다. 인프라 설정 파일이므로 해당 규약과 교차하는 지점이 없다.
+
+**3. 문서 구조 규약**
+- `Makefile`, `docker-compose.e2e.yml`은 spec 문서가 아니므로 Overview/본문/Rationale 3섹션 구성 요건이 적용되지 않는다.
+- 두 파일 모두 상단 주석으로 목적과 사용법을 간결하게 기술하고 있어 가독성 측면에서 무리가 없다.
+
+**4. API 문서 규약**
+- Swagger 패턴·DTO 명명 규약(`spec/conventions/swagger.md`) 적용 대상 파일이 아니다.
+
+**5. 금지 항목**
+- `prd/`, `memory/`, `user_memo/` 경로를 참조하거나 생성하는 패턴이 없다.
+- `subprocess.run(["claude", "-p", ...])` 또는 Anthropic SDK 직접 호출 패턴이 없다.
+- `e2e-test-full` target의 runner 연결 방식(`&&` + `; STATUS=$$?`)이 일관성 없이 혼용되어 있으나, 이는 정식 규약의 명시적 금지 항목이 아닌 구현 품질 사항이다 (하단 INFO 항목 참조).
+
+---
+
+- **[INFO]** `e2e-test-full` target의 runner 연결 연산자 혼용
+  - target 위치: `Makefile` 31-35행, `e2e-test-full` target
+  - 위반 규약: 해당 없음 (정식 규약 금지 항목 아님)
+  - 상세: `e2e-test`는 `backend-e2e-runner`를 `;`로 연결하고 `STATUS=$$?`로 종료 코드를 포착하는 패턴을 사용한다. 반면 `e2e-test-full`은 `backend-e2e-runner && playwright-runner` 로 `&&`를 사용하여 backend runner 실패 시 playwright runner를 건너뛰지만, 이어서 `; STATUS=$$?`로 playwright runner의 종료 코드만 포착한다. backend runner가 실패했을 때 exit code가 playwright-runner의 결과(미실행 시 0이 아닌 값 또는 255)에 의존하게 되어 의도한 실패 전파가 불명확하다. Makefile 상단 주석에서 "분리" 이유를 설명했으나 `e2e-test-full`의 경우 그 설명이 누락되어 있다.
+  - 제안: `e2e-test`와 동일하게 `;`로 분리하고 `STATUS=$$?`로 각각 포착하거나, 주석으로 의도를 명시한다. 정식 규약 항목은 아니므로 규약 갱신이 아닌 코드 수정이 적절하다.
+
+---
+
+### 요약
+
+`Makefile`과 `docker-compose.e2e.yml` 두 파일은 `spec/conventions/` 내 정식 규약(node-output, swagger, migrations, cafe24-api-metadata, conversation-thread)의 직접 적용 대상이 아닌 인프라 자동화 파일이다. CLAUDE.md에서 명시한 `make e2e-test` / `docker-compose.e2e.yml` 기반 e2e 격리 운영 방침과 정확히 부합하며, 금지된 경로·패턴을 사용하지 않는다. 발견된 유일한 사항은 `e2e-test-full` target의 종료 코드 포착 패턴 불일치로, 이는 구현 품질 차원의 INFO이며 규약 위반이 아니다.
+
+### 위험도
+
+NONE

```

---

### 파일 12: review/consistency/2026/05/16/09_13_51/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/cross_spec/review.md b/review/consistency/2026/05/16/09_13_51/cross_spec/review.md
new file mode 100644
index 00000000..fafc96b9
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/cross_spec/review.md
@@ -0,0 +1,65 @@
+# Cross-Spec 일관성 검토 — `Makefile, docker-compose.e2e.yml`
+
+검토 모드: `--impl-prep` (구현 착수 전 검토)
+대상 범위: `Makefile` e2e 타겟에 `--build` 플래그 추가
+
+---
+
+## 발견사항
+
+이번 변경은 `Makefile` 의 `e2e-up` / `e2e-test` / `e2e-test-full` 타겟에 `--build` 플래그를 추가하는 순수 빌드 툴링 버그픽스다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 규칙 중 어느 것도 수정하지 않는다. 아래 점검 결과를 기술한다.
+
+### 데이터 모델 충돌
+
+발견 없음. `Makefile` / `docker-compose.e2e.yml` 은 엔티티 정의를 보유하지 않는다.
+
+### API 계약 충돌
+
+발견 없음. 빌드 플래그 변경은 e2e 실행 방식에만 영향을 미치며, HTTP endpoint / request-response shape 과 무관하다.
+
+### 요구사항 ID 충돌
+
+발견 없음. 이 변경에 요구사항 ID 가 사용되지 않는다.
+
+### 상태 전이 충돌
+
+발견 없음. `docker-compose.e2e.yml` 의 서비스 의존 체인(`depends_on: condition: service_healthy / service_completed_successfully`)은 변경되지 않으며, `backend-e2e` 의 상태 전이(`healthy` 로 인정되어야 runner 기동)도 그대로다.
+
+### 권한·RBAC 모델 충돌
+
+발견 없음. 빌드 플래그는 RBAC 구조와 무관하다.
+
+### 계층 책임 충돌
+
+발견 없음. `docker-compose.e2e.yml` 은 이미 `backend-e2e` 와 `backend-e2e-runner` 모두에 `build:` 섹션을 보유하고 있다. `--build` 플래그 추가는 기존 Compose 설계(빌드 가능 서비스)와 완전히 일치한다.
+
+---
+
+### 참조 spec 와의 정합 확인
+
+| 참조 위치 | 내용 | 정합 여부 |
+|----------|------|----------|
+| `spec/conventions/migrations.md:57` | `make e2e-test` 로 마이그레이션 dry-run 수행 | 명령 이름 변경 없음 — 정합 |
+| `.claude/skills/developer/SKILL.md` §TEST WORKFLOW | `make e2e-test` / `make e2e-test-full` / `make e2e-down` 명령 | 명령 이름 변경 없음 — 정합 |
+| `.claude/skills/developer/SKILL.md:66` | "e2e 는 `docker-compose.e2e.yml` 에서 backend 이미지를 빌드해 실행" | `--build` 는 이 설명이 항상 성립하도록 보장하는 수정 — 정합 강화 |
+| `spec/0-overview.md §2.6` | "셀프 호스팅: Docker Compose에 포함" (MinIO) | e2e Compose 파일 구조 변경 없음 — 정합 |
+
+---
+
+### 부가 관찰 (INFO)
+
+- **[INFO]** `docker-compose.e2e.yml` 의 `backend-e2e` 서비스는 `--build` 를 Makefile 에서 지정하지 않아도 `build:` 섹션이 존재해 Compose 가 최초에 빌드한다. 그러나 이후 소스 변경 시 `--build` 없이는 재빌드가 일어나지 않는다는 점이 이번 버그의 근본 원인이다. 이 사실은 Makefile help 메시지(`e2e-up: e2e 인프라 + backend-e2e 까지 백그라운드 기동`)와도 일치하며, `--build` 추가 후에도 동일 서술이 유효하다. spec 수정 불필요.
+  - target 위치: `Makefile:12-35`
+  - 충돌 대상: 없음 (단순 관찰)
+  - 상세: 변경이 기존 Compose 구조 및 모든 참조 spec 과 일치함을 확인하는 정보성 메모.
+  - 제안: 필요 없음.
+
+---
+
+## 요약
+
+이번 구현 대상(`Makefile` e2e 타겟에 `--build` 플래그 추가)은 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중 어떤 영역과도 충돌하지 않는다. `docker-compose.e2e.yml` 은 이미 빌드 가능한 서비스 구조를 보유하고 있으며, `spec/conventions/migrations.md` 및 `.claude/skills/developer/SKILL.md` 가 참조하는 `make e2e-test` 명령 이름도 변경되지 않는다. 오히려 `developer/SKILL.md` 가 "e2e 는 backend 이미지를 빌드해 실행"이라고 명시한 설계 의도를 `--build` 추가가 항상 보장하게 되어 정합성이 강화된다. Cross-Spec 관점에서 구현 착수를 차단할 이유가 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 13: review/consistency/2026/05/16/09_13_51/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/meta.json b/review/consistency/2026/05/16/09_13_51/meta.json
new file mode 100644
index 00000000..339b076f
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T09:13:51.194395",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=Makefile,docker-compose.e2e.yml)",
+  "target_path": "Makefile,docker-compose.e2e.yml",
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

### 파일 14: review/consistency/2026/05/16/09_13_51/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/naming_collision/review.md b/review/consistency/2026/05/16/09_13_51/naming_collision/review.md
new file mode 100644
index 00000000..b62dcccb
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/naming_collision/review.md
@@ -0,0 +1,37 @@
+# 신규 식별자 충돌 검토 — naming_collision
+
+검토 모드: --impl-prep  
+대상 파일: `Makefile`, `docker-compose.e2e.yml`  
+변경 내용: `e2e-up` / `e2e-test` / `e2e-test-full` Makefile 타겟에 `--build` 플래그 추가
+
+---
+
+## 발견사항
+
+### 발견 없음
+
+본 변경(Makefile 타겟에 `--build` 플래그 추가)은 식별자를 새로 도입하지 않는다. 구체적으로 아래 6개 관점을 각각 점검한 결과:
+
+1. **요구사항 ID 충돌** — 새로 부여된 요구사항 ID 없음. 기존 플랜 문서(`plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`)의 작업 항목 변경만 발생.
+
+2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 미도입. `Makefile`·`docker-compose.e2e.yml`의 서비스 이름(`backend-e2e`, `backend-e2e-runner`, `playwright-runner`, `postgres`, `redis`, `minio`, `createbuckets`, `migrate`)과 Make 타겟명(`e2e-up`, `e2e-down`, `e2e-test`, `e2e-test-full`)은 모두 기존에 존재하는 식별자이며 의미가 변경되지 않는다.
+
+3. **API endpoint 충돌** — API 경로 변경 없음.
+
+4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 변경 없음.
+
+5. **환경변수·설정키 충돌** — `docker-compose.e2e.yml`에 선언된 환경변수(`NODE_ENV`, `APP_PORT`, `APP_URL`, `FRONTEND_URL`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `REDIS_HOST`, `REDIS_PORT`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `MAIL_TRANSPORT`, `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `OAUTH_STUB_MODE`, `E2E_BASE_URL`, `POSTGRES_VERSION`, `MC_USER`, `MC_PASS`, `CI`, `PLAYWRIGHT_BASE_URL`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`)는 모두 기존 `backend/.env.example` 및 `docker-compose.yml`(dev)에서 동일한 의미로 이미 사용 중이다. 신규 도입된 키 없음.
+
+6. **파일 경로 충돌** — 새 spec 파일이나 파일 경로 변경 없음. `Makefile`·`docker-compose.e2e.yml` 두 파일 모두 repo 루트에 기존부터 존재한다.
+
+---
+
+## 요약
+
+`Makefile`의 `e2e-up`·`e2e-test`·`e2e-test-full` 타겟에 `--build` 플래그를 추가하는 이번 변경은 기존 식별자의 동작 방식(컨테이너를 기동 전 항상 rebuild)을 보강할 뿐이며, 새로운 식별자(요구사항 ID, 엔티티명, API 경로, 이벤트명, 환경변수, 파일 경로)를 전혀 도입하지 않는다. 6가지 신규 식별자 충돌 관점 모두에서 발견 사항이 없다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 15: review/consistency/2026/05/16/09_13_51/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/plan_coherence/review.md b/review/consistency/2026/05/16/09_13_51/plan_coherence/review.md
new file mode 100644
index 00000000..683a3b59
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/plan_coherence/review.md
@@ -0,0 +1,27 @@
+## 발견사항
+
+- **[WARNING]** plan 체크리스트와 실제 코드 상태 불일치
+  - target 위치: `Makefile` (e2e-up, e2e-test, e2e-test-full 타겟)
+  - 관련 plan: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` §체크리스트 — `[x] 구현 (Makefile 수정)`, `[x] TEST WORKFLOW`, `[x] REVIEW WORKFLOW`
+  - 상세: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` 의 체크리스트 항목 "구현 (Makefile 수정)" 이 `[x]` 로 표기되어 있지만, worktree `bg-monitoring-e2e-fix-f789b9` 는 main 브랜치(`8fbad212`)와 동일한 커밋에 머물러 있고 Makefile 에 실제 변경이 없다. `git status` 는 plan 파일과 review 디렉토리만 untracked 로 보여준다. 즉 consistency-check `--impl-prep` 이 실행된 시점에 target 파일 diff 가 "(없음)" 인 상태가 맞지만, 동시에 plan 의 "구현 완료" 체크가 사실과 다르다.
+  - 제안: plan 의 `[x] 구현 (Makefile 수정)` 과 `[x] TEST WORKFLOW`, `[x] REVIEW WORKFLOW` 를 `[ ]` 로 되돌려 실제 구현 순서를 반영한다. consistency-check 완료 후 Makefile `--build` 플래그 추가 구현 → `make e2e-test` 통과 확인 → plan 체크박스 순서대로 갱신.
+
+- **[INFO]** `brand-refresh-impl.md` 의 e2e fail #2 와 Makefile 수정의 간접 연관
+  - target 위치: `Makefile` e2e-test / e2e-test-full 타겟
+  - 관련 plan: `plan/in-progress/brand-refresh-impl.md` §5 "fail #2 (password-reset — `/login` redirect timeout) — root cause 미확정, CI 검증 대기"
+  - 상세: `brand-refresh-impl.md` 는 `make e2e-test-full` 에서 password-reset e2e 가 local Mac ARM Docker 에서 결정적으로 실패하고 있으며 CI 결과를 대기 중이다. 본 Makefile 수정 (`--build` 추가) 은 stale 이미지 문제를 해결하지만, brand-refresh worktree(`brand-refresh-7a3f12`) 는 별도 브랜치이므로 fix 가 merge 되기 전까지 그 worktree 에서 `make e2e-test` 실행 시 동일 stale 이미지 문제가 재현될 수 있다. 인과 관계는 없으나 brand-refresh 의 e2e 재검증 시 stale 이미지 여부도 같이 확인하면 좋다.
+  - 제안: plan 갱신 불필요. brand-refresh e2e 재검증 시 `docker compose -f docker-compose.e2e.yml build` 수동 실행 여부를 확인하는 메모를 `brand-refresh-impl.md` §5 fail #2 항목 하단에 추가하면 추적에 도움이 됨 (선택 사항).
+
+- **[INFO]** worktree 간 `Makefile` / `docker-compose.e2e.yml` 동시 수정 없음 — 충돌 없음
+  - target 위치: `Makefile`, `docker-compose.e2e.yml`
+  - 관련 plan: 전체 활성 worktree (`ai-agent-i18n-fix-b7d4e2`, `cafe24-fields-add-btn-d3f8a2`, `cafe24-node-i18n-fix-d8f3a1`, `cafe24-refresh-fix-a8c2f1`, `migrate-dup-guard-51c9fc`, `user-guide-sync-4af69c`)
+  - 상세: 모든 활성 worktree 의 `docker-compose.e2e.yml` 이 main 과 동일하고, `Makefile` 도 마찬가지다. `self-hosting-deployment.md` 는 `docker-compose.production.yml` (신규 파일) 만 다루므로 경합 없음. worktree 충돌 없음.
+  - 제안: 없음.
+
+## 요약
+
+target 파일(`Makefile`, `docker-compose.e2e.yml`) 에 대한 현재 diff 가 없는 상태(`(없음)`)로 consistency-check `--impl-prep` 이 수행된 것은 구현 착수 직전이라는 점에서 절차상 정상이다. 다른 진행 중 plan 과의 worktree 충돌, 미해결 결정 우회, 중복 작업은 발견되지 않았다. 단, `e2e-makefile-stale-image-fix-2026-05-16.md` 의 체크리스트가 구현·테스트·리뷰 항목까지 모두 `[x]` 로 선행 표기되어 있는 점은 plan 문서와 실제 git 상태 사이의 불일치를 초래한다. plan 체크박스를 실제 완료 시점에 맞게 갱신해 계획(plan)이 진실 소스로서의 역할을 유지하도록 교정이 필요하다.
+
+## 위험도
+
+LOW

```

---

### 파일 16: review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md b/review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md
new file mode 100644
index 00000000..099c8615
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md
@@ -0,0 +1,33 @@
+### 발견사항
+
+- **[INFO]** Makefile 인라인 Rationale(기각된 `--abort-on-container-exit` 패턴) 은 유지됨
+  - target 위치: `Makefile` 주석 블록 (L23-25) — "Docker Desktop 의 network race 와 충돌하는 사례가 있어 분리"
+  - 과거 결정 출처: `Makefile` 자체 주석 (인라인 ADR). `spec/` 레벨 Rationale 없음.
+  - 상세: `--abort-on-container-exit` 가 Docker Desktop network race 를 유발해 기각됐고, 대신 `up -d --wait` + `run --rm` + `; STATUS=$$?` 패턴을 채택한 결정이 코드 주석으로 보존되어 있다. 현재 `Makefile` 내 어떤 타겟도 이 기각된 패턴을 재도입하고 있지 않다.
+  - 제안: 문제 없음. 향후 타겟 추가 시에도 `--abort-on-container-exit` 재사용은 주석 근거에 따라 금지.
+
+- **[INFO]** `docker-compose.e2e.yml` 의 격리 원칙(ephemeral, 호스트 포트 미노출, `OAUTH_STUB_MODE`) 유지됨
+  - target 위치: `docker-compose.e2e.yml` 전체
+  - 과거 결정 출처: `docker-compose.e2e.yml` 파일 상단 주석 블록 + `CLAUDE.md` e2e 인프라 원칙 ("e2e 는 `docker-compose.e2e.yml` 에서 격리 인프라" 정책)
+  - 상세: (a) `name: clemvion-e2e` 로 dev 인프라와 project-level 격리, (b) 호스트 포트 미노출로 dev 포트 충돌 방지, (c) 영속 볼륨 없는 ephemeral 설계, (d) `OAUTH_STUB_MODE: "true"` 로 OAuth 실 호출 차단. 이 4가지 invariant 가 모두 유지된다.
+  - 제안: 향후 서비스 추가 시 이 4가지 속성을 동일하게 적용해야 한다. 특히 `OAUTH_STUB_MODE` 는 e2e 격리의 핵심이므로 신규 OAuth 의존 기능 e2e 작성 시 이 설정이 테스트 의미에 영향을 주는지 반드시 검토.
+
+- **[INFO]** `profiles: ["test"]` runner 분리 원칙 유지됨
+  - target 위치: `docker-compose.e2e.yml` L164, L182 (`backend-e2e-runner`, `playwright-runner`)
+  - 과거 결정 출처: `docker-compose.e2e.yml` 주석("runner 서비스는 `profiles: ["test"]` 로 분리되어 `make e2e-up` 만으로는 안 뜬다")
+  - 상세: `make e2e-up` 과 `make e2e-test` 의 역할이 명확히 분리되어 있고, runner 서비스는 profile 게이트로 분리된 설계가 유지된다.
+  - 제안: 문제 없음.
+
+- **[INFO]** Makefile `--build` 플래그 누락 — plan 의 결정과 현재 파일 상태 불일치 (Rationale 연속성 범위 경계)
+  - target 위치: `Makefile` L18, L27, L32 (`e2e-up`, `e2e-test`, `e2e-test-full` 타겟의 `up -d --wait` 호출)
+  - 과거 결정 출처: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — "e2e-up, e2e-test, e2e-test-full 타겟에 `--build` 플래그 추가" (체크박스 `[x]`)
+  - 상세: plan 문서는 `--build` 추가가 완료됐다고 표기하지만, 실제 `Makefile` 에는 `--build` 가 없다. `--build` 추가는 기각된 어떤 대안을 재도입하는 것이 아니며(기각된 대안은 `--abort-on-container-exit` 패턴이었음), 기존 `up -d --wait` 패턴을 유지하면서 캐시 새로고침만 추가하는 것이므로 Rationale 원칙과 충돌하지 않는다. 다만 plan 이 완료됐다고 기록됐는데 파일이 미반영된 상태는 `plan_coherence` 검사 영역이며 Rationale 연속성 자체의 위반은 아니다.
+  - 제안: 본 checker 범위 밖이나 기록 목적으로 명시. `plan_coherence` checker 또는 구현 재확인이 필요.
+
+### 요약
+
+`Makefile` 과 `docker-compose.e2e.yml` 은 spec 레벨의 `## Rationale` 섹션 대상 문서가 아니다. 이 두 파일에 관련된 과거 설계 결정은 (a) Makefile 인라인 주석의 `--abort-on-container-exit` 기각 기록, (b) `docker-compose.e2e.yml` 의 ephemeral·호스트포트 미노출·project 격리·`OAUTH_STUB_MODE` invariant 네 가지, (c) `profiles: ["test"]` runner 분리 원칙이다. 현재 두 파일의 내용은 이 모든 과거 결정과 충돌하지 않으며, 제공된 spec Rationale 발췌(data-model, OAuth/integration, navigation, user-profile, AI-assistant 영역)는 이 두 인프라 파일과 직접적 연관이 없어 충돌 가능성이 없다. plan 문서와 실제 Makefile 상태 간 불일치(--build 누락)는 Rationale 원칙 위반이 아니며 plan_coherence 영역이다.
+
+### 위험도
+
+NONE

```
